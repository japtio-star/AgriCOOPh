import type { DepartmentId } from '../../src/shared/workforce';
import type { Pipeline, Step, StepContext, WorkforceEngine } from './engine';
import { PACING_MS } from './engine';
import { generate } from './llm';
import * as R from './research';

// Task pipelines. Each step names the employee state it represents and does the
// real work for that state: database queries while RESEARCHING, computation
// while ANALYZING, SQL authoring while CODING, document drafting while WRITING.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function persona(c: StepContext) {
  return `You are ${c.employee.name}, ${c.employee.title} in the AI workforce of AgriCOOPh, ` +
    'a federation of agricultural cooperatives in the Philippines that runs the AgriCOOPh Membership Database System (AMDS).';
}

function sectionPrompt(c: StepContext, title: string, data: unknown, extra = '') {
  return [
    persona(c),
    `Write the "${title}" section of the AMDS implementation report in GitHub-flavoured Markdown.`,
    `Start with the heading "## ${title}". 150-250 words. Use only the figures in the DATA block; never invent numbers.`,
    'Include one compact table if it helps, and end with 2-3 bullet-point recommendations.',
    extra,
    'DATA:',
    JSON.stringify(data, null, 1),
  ].join('\n');
}

function projectTask(c: StepContext, kind: string) {
  if (!c.task.project_id) return undefined;
  const t = c.engine.store.projectTasks(c.task.project_id).find((x) => x.kind === kind);
  return t ? { task: t, ctx: c.engine.store.taskContext(t.id) } : undefined;
}

function approvalStep(
  key: string,
  label: string | ((c: StepContext) => string),
  build: (c: StepContext) => { title: string; summary: string; details?: string },
  onDecision: (c: StepContext, d: { status: 'approved' | 'rejected'; note: string | null; by?: string }) => ReturnType<Step['run']>,
  when?: Step['when'],
): Step {
  return {
    key, state: 'AWAITING_APPROVAL', label, when,
    run: (c) => {
      const decision = c.ctx.approvals?.[key];
      if (decision) return onDecision(c, decision);
      return c.engine.requestApproval(c, key, build(c));
    },
  };
}

// ---- Reusable shapes ---------------------------------------------------------

// A specialist pulls and analyses data, then hands the findings to the section owner.
function dataPull(kind: string, opts: {
  researchLabel: string; analyzeLabel: string; handoffTo: string;
  research: (c: StepContext) => any; analyze: (raw: any) => any; summary: (metrics: any) => string;
}): Pipeline {
  return {
    kind,
    steps: [
      { key: 'research', state: 'RESEARCHING', label: opts.researchLabel, run: (c) => {
        const raw = opts.research(c);
        c.ctx.raw = raw;
        c.ctx.sources = raw.sources;
        c.log(`Retrieved ${raw.rows?.length ?? 0} records from ${raw.sources.join(', ')}`);
      } },
      { key: 'analyze', state: 'ANALYZING', label: opts.analyzeLabel, run: (c) => {
        c.ctx.metrics = opts.analyze(c.ctx.raw);
        delete c.ctx.raw;
        c.log(opts.summary(c.ctx.metrics));
      } },
      { key: 'handoff', state: 'COMMUNICATING', label: 'Handing findings to section owner', run: (c) => {
        c.engine.handoff(c, opts.handoffTo, opts.summary(c.ctx.metrics));
        c.engine.updateTask(c.task.id, { output: opts.summary(c.ctx.metrics) });
      } },
    ],
  };
}

// The section owner outlines from the hand-off, then drafts their section.
function section(kind: string, opts: {
  depKind: string; title: string; fallback: (metrics: any) => string; extra?: string;
}): Pipeline {
  return {
    kind,
    steps: [
      { key: 'outline', state: 'THINKING', label: `Outlining "${opts.title}"`, run: (c) => {
        const dep = projectTask(c, opts.depKind);
        if (!dep?.ctx.metrics) throw new Error(`No findings received from "${opts.depKind}"`);
        c.ctx.metrics = dep.ctx.metrics;
        c.ctx.sources = dep.ctx.sources;
      } },
      { key: 'write', state: 'WRITING', label: `Drafting "${opts.title}"`, run: async (c) => {
        const out = await generate(sectionPrompt(c, opts.title, c.ctx.metrics, opts.extra), () => opts.fallback(c.ctx.metrics));
        c.ctx.engine = out.engine;
        c.engine.updateTask(c.task.id, { output: out.text });
        c.log(`Drafted ${out.text.split(/\s+/).length} words (${out.engine})`);
      } },
    ],
  };
}

// ---- Implementation report project -------------------------------------------

const planReport: Pipeline = {
  kind: 'plan_report',
  steps: [
    { key: 'scope', state: 'THINKING', label: 'Scoping the implementation report', run: async (c) => {
      const ov = R.overview(c.engine.db);
      c.ctx.overview = ov;
      const out = await generate(
        `${persona(c)}\nWrite a 4-bullet Markdown brief for the department leads producing this period's AMDS implementation report. ` +
          `Mention what each department must cover. Current totals: ${JSON.stringify(ov)}. No preamble.`,
        () => [
          `- Scope: ${ov.cooperatives} cooperatives, ${ov.members} members, ${ov.reports} M&E reports on file.`,
          '- Membership & Coop Dev: profile members and the cooperative portfolio.',
          '- M&E & Data: assess report compliance and audit data quality.',
          '- Tech: document what has been built and what remains.',
        ].join('\n'),
      );
      c.ctx.brief = out.text;
    } },
    { key: 'brief', state: 'COMMUNICATING', label: 'Briefing department leads', paced: false, run: async (c) => {
      const leads = ['mem-rec', 'coop-field', 'mne-comp', 'data-eng', 'tech-lead'];
      for (const code of leads) {
        c.engine.handoff(c, code, 'Implementation report brief');
        await sleep(Math.max(PACING_MS / 3, 200));
      }
      c.engine.updateTask(c.task.id, { output: c.ctx.brief });
    } },
  ],
};

const memberData = dataPull('member_data', {
  researchLabel: 'Pulling member records', analyzeLabel: 'Computing membership metrics', handoffTo: 'mem-lead',
  research: (c) => R.researchMembers(c.engine.db), analyze: (raw) => R.analyzeMembers(raw.rows),
  summary: (m) => `${m.total} members analysed, ${m.activeRate}% active`,
});

const coopData = dataPull('coop_data', {
  researchLabel: 'Reviewing cooperative registry', analyzeLabel: 'Profiling the cooperative portfolio', handoffTo: 'coop-lead',
  research: (c) => R.researchCooperatives(c.engine.db), analyze: (raw) => R.analyzeCooperatives(raw.rows),
  summary: (m) => `${m.total} cooperatives profiled, avg ${m.avgMembers} members`,
});

const reportData = dataPull('mne_data', {
  researchLabel: 'Collecting CAPAR / CAIS submissions', analyzeLabel: 'Measuring report compliance', handoffTo: 'mne-lead',
  research: (c) => R.researchReports(c.engine.db), analyze: (raw) => R.analyzeReports(raw.rows, raw.coops),
  summary: (m) => `${m.total} reports reviewed, ${m.compliance}% compliance`,
});

const dataChecks: Pipeline = {
  kind: 'data_checks',
  steps: [
    { key: 'design', state: 'THINKING', label: 'Designing data-quality checks', run: (c) => {
      c.ctx.schema = R.schemaForPrompt(c.engine.readonlyDb);
    } },
    { key: 'code', state: 'CODING', label: 'Writing SQL checks', run: async (c) => {
      const checks: R.QualityCheck[] = [...R.QUALITY_CATALOG];
      const out = await generate(
        `${persona(c)}\nPropose up to 3 additional SQLite data-quality checks for this schema, beyond: ` +
          `${checks.map((x) => x.name).join(', ')}.\nSchema:\n${c.ctx.schema}\n` +
          'Each must be ONE read-only SELECT that returns the offending rows. ' +
          'Reply with only a JSON array of {"name","description","sql"}.',
        () => '[]',
      );
      if (out.engine === 'gemini') {
        let proposed: any[] = [];
        try { proposed = JSON.parse(out.text.match(/\[[\s\S]*\]/)?.[0] ?? '[]'); } catch { c.log('Model reply was not valid JSON; using catalog checks only'); }
        for (const p of proposed.slice(0, 3)) {
          if (!p?.sql || !p?.name) continue;
          const problem = R.validateCheck(c.engine.readonlyDb, String(p.sql));
          if (problem) c.log(`Rejected generated check "${p.name}": ${problem}`);
          else checks.push({ name: String(p.name), description: String(p.description || p.name), sql: String(p.sql), author: 'gemini' });
        }
      }
      for (const chk of checks) {
        const problem = R.validateCheck(c.engine.readonlyDb, chk.sql);
        if (problem) throw new Error(`Check "${chk.name}" failed validation: ${problem}`);
      }
      c.ctx.checks = checks;
      c.log(`Prepared ${checks.length} validated SQL checks`);
    } },
    approvalStep('approve', (c) => `Requesting approval to run ${c.ctx.checks?.length ?? 0} queries`,
      (c) => ({
        title: `Run ${c.ctx.checks.length} data-quality queries on the live database`,
        summary: `${c.employee.name} wrote read-only SQL checks for the implementation report and needs your go-ahead before executing them.`,
        details: c.ctx.checks.map((x: R.QualityCheck) => `-- ${x.description} [${x.author}]\n${x.sql};`).join('\n\n'),
      }),
      (c, d) => {
        if (d.status === 'rejected') {
          c.ctx.declined = d.note || 'declined';
          c.log('Execution declined by owner; checks will not run');
          return { goto: 'handoff' };
        }
      }),
    { key: 'run', state: 'ANALYZING', label: 'Running checks on a read-only connection', when: (c) => !c.ctx.declined, run: (c) => {
      c.ctx.results = R.runChecks(c.engine.readonlyDb, c.ctx.checks);
      const issues = c.ctx.results.reduce((s: number, r: any) => s + Math.max(r.findings, 0), 0);
      c.log(`Executed ${c.ctx.results.length} checks, ${issues} issue(s) found`);
    } },
    { key: 'handoff', state: 'COMMUNICATING', label: 'Sending results to the data analyst', run: (c) => {
      const msg = c.ctx.declined ? 'Checks not executed (owner declined)' : `${c.ctx.results.length} check results ready`;
      c.engine.handoff(c, 'data-lead', msg);
      c.engine.updateTask(c.task.id, { output: msg });
    } },
  ],
};

const qualitySection: Pipeline = {
  kind: 'quality_section',
  steps: [
    { key: 'score', state: 'ANALYZING', label: 'Scoring data quality', run: (c) => {
      const dep = projectTask(c, 'data_checks');
      if (!dep) throw new Error('No data-quality results received');
      const ov = R.overview(c.engine.db);
      c.ctx.results = dep.ctx.results ?? null;
      c.ctx.declined = dep.ctx.declined ?? null;
      c.ctx.score = c.ctx.results ? R.scoreQuality(c.ctx.results, ov.members + ov.cooperatives + ov.reports) : null;
      c.ctx.sources = ['Members', 'Cooperatives', 'Reports'];
    } },
    { key: 'write', state: 'WRITING', label: 'Drafting "Data Quality Audit"', run: async (c) => {
      const data = { score: c.ctx.score, results: c.ctx.results, declinedByOwner: c.ctx.declined };
      const out = await generate(sectionPrompt(c, 'Data Quality Audit', data),
        () => R.writeDataQualityFallback(c.ctx.results, c.ctx.score, c.ctx.declined));
      c.ctx.engine = out.engine;
      c.engine.updateTask(c.task.id, { output: out.text });
    } },
  ],
};

const systemAudit: Pipeline = {
  kind: 'system_audit',
  steps: [
    { key: 'research', state: 'RESEARCHING', label: 'Introspecting schema and audit log', run: (c) => {
      c.ctx.system = R.researchSystem(c.engine.db);
      c.ctx.sources = c.ctx.system.sources;
    } },
    { key: 'analyze', state: 'ANALYZING', label: 'Mapping API routes to modules', run: (c) => {
      c.ctx.coverage = R.analyzeSystem(c.ctx.system.tables);
      c.log(`Found ${c.ctx.coverage.routes.length} API routes across ${c.ctx.coverage.coverage.length} modules`);
    } },
    { key: 'write', state: 'WRITING', label: 'Drafting "System Implementation Status"', run: async (c) => {
      const data = { coverage: c.ctx.coverage.coverage, pages: c.ctx.coverage.pages, routes: c.ctx.coverage.routes, audit: c.ctx.system.audit };
      const out = await generate(sectionPrompt(c, 'System Implementation Status', data),
        () => R.writeSystemFallback(c.ctx.system, c.ctx.coverage));
      c.ctx.engine = out.engine;
      c.engine.updateTask(c.task.id, { output: out.text });
    } },
    { key: 'handoff', state: 'COMMUNICATING', label: 'Sharing audit with the technical writer', run: (c) => {
      c.engine.handoff(c, 'tech-doc', 'System audit ready for the methodology appendix');
    } },
  ],
};

const SECTION_KINDS = ['membership_section', 'coop_section', 'mne_section', 'quality_section', 'system_audit'];

const methodology: Pipeline = {
  kind: 'methodology',
  steps: [
    { key: 'collect', state: 'RESEARCHING', label: 'Collecting sources from every section', run: (c) => {
      c.ctx.rows = SECTION_KINDS.map((k) => {
        const dep = projectTask(c, k);
        const author = dep?.task.assignee_id ? c.engine.store.employee(dep.task.assignee_id)?.name : null;
        return { kind: k, title: dep?.task.title, author, sources: dep?.ctx.sources ?? [], engine: dep?.ctx.engine ?? 'rule-based' };
      });
    } },
    { key: 'write', state: 'WRITING', label: 'Writing methodology & data sources', run: (c) => {
      const text = [
        '## Methodology & Data Sources',
        '',
        'Each section was produced by an AI employee working directly against the live AMDS database. ' +
          'Specialists queried and analysed the data, then handed findings to section owners who drafted the text. ' +
          'Data-quality SQL ran on a read-only connection only after owner approval.',
        '',
        '| Section | Author | Sources | Writer |',
        '|---|---|---|---|',
        ...c.ctx.rows.map((r: any) => `| ${r.title ?? r.kind} | ${r.author ?? '—'} | ${r.sources.join(', ')} | ${r.engine} |`),
      ].join('\n');
      c.engine.updateTask(c.task.id, { output: text });
    } },
  ],
};

// Rule-based recommendations derived from each department's measured findings.
function ruleRecommendations(c: StepContext): string[] {
  const recs: string[] = [];
  const mem = projectTask(c, 'member_data')?.ctx.metrics;
  const coop = projectTask(c, 'coop_data')?.ctx.metrics;
  const mne = projectTask(c, 'mne_data')?.ctx.metrics;
  const dq = projectTask(c, 'quality_section')?.ctx;
  const sys = projectTask(c, 'system_audit')?.ctx.coverage;
  if (mem && mem.activeRate < 80) recs.push(`Run a re-engagement drive: only ${mem.activeRate}% of members are active (${mem.inactive} inactive).`);
  if (mem?.missingContact) recs.push(`Complete contact details for ${mem.missingContact} member record(s).`);
  if (coop?.withoutMembers.length) recs.push(`Encode members for ${coop.withoutMembers.join(', ')}.`);
  if (mne?.gaps.length) recs.push(`Follow up missing reports: ${mne.gaps.map((g: any) => `${g.missing} from ${g.coop}`).join('; ')}.`);
  if (mne?.pending) recs.push(`Review the ${mne.pending} M&E report(s) still awaiting approval.`);
  if (mne?.daysSinceLatest > 180) recs.push(`Restart the reporting cycle: the latest submission is ${mne.daysSinceLatest} days old.`);
  if (dq?.declined) recs.push('Schedule the data-quality audit that was not run this period.');
  else if (dq?.score?.issues) recs.push(`Fix the ${dq.score.issues} data-quality issue(s) flagged by the audit.`);
  const schemaOnly = sys?.coverage.filter((m: any) => m.status === 'Schema only').map((m: any) => m.module) ?? [];
  if (schemaOnly.length) recs.push(`Build API and UI support for ${schemaOnly.join(', ')}.`);
  if (sys?.coverage.some((m: any) => m.status === 'Partial')) recs.push('Add update and delete endpoints to the Members, Cooperatives and Reports modules.');
  return recs.length ? recs : ['No corrective actions identified this period.'];
}

// First paragraph of each section, used as rule-based meeting findings.
function leadSentences(md: string) {
  return md.split(/\n(?=## )/).map((sec) => sec.split('\n').slice(1).find((l) => l.trim() && !l.startsWith('|'))?.trim())
    .filter(Boolean) as string[];
}


const synthesis: Pipeline = {
  kind: 'synthesis',
  steps: [
    { key: 'meeting', state: 'IN_MEETING', label: 'Synthesis meeting with department leads', paced: false, run: async (c) => {
      const leads = ['mem-lead', 'coop-lead', 'mne-lead', 'data-lead', 'tech-lead', 'tech-doc', 'exec-pm'];
      c.ctx.notes = await c.engine.meeting(c, leads, 'Implementation report synthesis', async () => {
        const sections = SECTION_KINDS.map((k) => projectTask(c, k)?.task.output ?? '').join('\n\n');
        const out = await generate(
          `${persona(c)}\nYou are chairing a synthesis meeting. From the report sections below, list the 5 most important ` +
            'findings and the top 3 risks as Markdown bullets under "Findings" and "Risks". Use only facts in the sections.\n\n' + sections,
          () => ['**Findings**', '', ...leadSentences(sections).map((b) => `- ${b}`)].join('\n'),
        );
        return out.text;
      });
    } },
    { key: 'write', state: 'WRITING', label: (c) => (c.ctx.feedback ? `Revising report (round ${c.ctx.revision})` : 'Writing executive summary & assembling report'), run: async (c) => {
      const feedback = c.ctx.feedback ? `\nThe owner rejected the previous draft with this feedback; address it: "${c.ctx.feedback}"` : '';
      const ov = R.overview(c.engine.db);
      const out = await generate(
        `${persona(c)}\nWrite the Executive Summary (one paragraph, ~120 words) and a numbered Recommendations list (4-6 items) ` +
          `for the AMDS implementation report. Use headings "## Executive Summary" and "## Recommendations". ` +
          `Base it only on these meeting notes and totals.${feedback}\nTOTALS: ${JSON.stringify(ov)}\nNOTES:\n${c.ctx.notes}`,
        () => [
          '## Executive Summary',
          '',
          `AMDS currently serves ${ov.cooperatives} cooperatives and ${ov.members} members (${ov.activeMembers} active), with ${ov.reports} M&E reports on file. ` +
            'The sections below summarise membership, portfolio, compliance, data quality and system build status as measured from the live database.' +
            (c.ctx.feedback ? ` This revision addresses owner feedback: "${c.ctx.feedback}".` : ''),
          '',
          '## Recommendations',
          '',
          ...ruleRecommendations(c).map((b, i) => `${i + 1}. ${b}`),
        ].join('\n'),
      );
      const parts = ['membership_section', 'coop_section', 'mne_section', 'quality_section', 'system_audit', 'methodology']
        .map((k) => projectTask(c, k)?.task.output).filter(Boolean);
      const participants = c.ctx.meetingParticipants?.length ? c.ctx.meetingParticipants.join(', ') : 'none available';
      const markdown = [
        '# AgriCOOPh AMDS — Implementation Report',
        '',
        `_Project #${c.task.project_id} · compiled ${new Date().toISOString().slice(0, 10)} by ${c.employee.name} · ` +
          `writer: ${out.engine}${c.ctx.revision ? ` · revision ${c.ctx.revision}` : ''}_`,
        '',
        out.text,
        '',
        ...parts.flatMap((p) => [p!, '']),
        '## Synthesis Meeting Notes',
        '',
        `Participants: ${participants}.`,
        '',
        c.ctx.notes,
      ].join('\n');
      const report = c.engine.store.upsertProjectReport(c.task.project_id, 'AMDS Implementation Report', markdown, 'draft', null);
      c.ctx.reportId = report.id;
      c.engine.broadcast({ type: 'report', report });
      c.engine.updateTask(c.task.id, { output: markdown });
    } },
    approvalStep('approve', 'Requesting owner sign-off on the report',
      (c) => ({
        title: `Publish "AMDS Implementation Report"${c.ctx.revision ? ` (revision ${c.ctx.revision})` : ''}`,
        summary: `${c.employee.name} assembled the implementation report from all six departments and needs your sign-off to publish. Approve to publish, or reject with feedback to request a revision.`,
        details: `report:${c.ctx.reportId}`,
      }),
      (c, d) => {
        if (d.status === 'rejected') {
          c.ctx.feedback = d.note || 'Owner requested a revision';
          c.ctx.revision = (c.ctx.revision || 0) + 1;
          delete c.ctx.approvals.approve;
          return { goto: 'write' };
        }
        c.ctx.approvedBy = d.by ?? 'owner';
      }),
    { key: 'publish', state: 'COMMUNICATING', label: 'Publishing the report', run: (c) => {
      const markdown = c.engine.store.report(c.ctx.reportId)!.markdown;
      const report = c.engine.store.upsertProjectReport(c.task.project_id, 'AMDS Implementation Report', markdown, 'published', c.ctx.approvedBy);
      c.engine.broadcast({ type: 'report', report });
      c.engine.handoff(c, 'exec-pm', 'Report approved and published');
    } },
  ],
};

// ---- Ad-hoc tasks from the owner ---------------------------------------------

const DEPARTMENT_CONTEXT: Record<DepartmentId, (c: StepContext) => any> = {
  executive: (c) => R.overview(c.engine.db),
  membership: (c) => R.analyzeMembers(R.researchMembers(c.engine.db).rows),
  coop_dev: (c) => R.analyzeCooperatives(R.researchCooperatives(c.engine.db).rows),
  mne: (c) => { const r = R.researchReports(c.engine.db); return R.analyzeReports(r.rows, r.coops); },
  data: (c) => R.scoreQuality(R.runChecks(c.engine.readonlyDb, R.QUALITY_CATALOG), R.overview(c.engine.db).members),
  tech: (c) => { const s = R.researchSystem(c.engine.db); return { ...R.analyzeSystem(s.tables), audit: s.audit }; },
};

const custom: Pipeline = {
  kind: 'custom',
  steps: [
    { key: 'plan', state: 'THINKING', label: 'Planning an approach', run: () => {} },
    { key: 'research', state: 'RESEARCHING', label: 'Gathering database context', run: (c) => {
      c.ctx.data = { overview: R.overview(c.engine.db), department: DEPARTMENT_CONTEXT[c.task.department](c) };
    } },
    { key: 'write', state: 'WRITING', label: (c) => (c.ctx.feedback ? 'Revising response' : 'Writing response'), run: async (c) => {
      const feedback = c.ctx.feedback ? `\nThe owner rejected the previous answer: "${c.ctx.feedback}". Address this.` : '';
      const out = await generate(
        `${persona(c)}\nTask from the owner: "${c.task.title}"\n${c.task.instructions ?? ''}${feedback}\n` +
          `Answer in concise Markdown using only this data:\n${JSON.stringify(c.ctx.data, null, 1)}`,
        () => [
          `## ${c.task.title}`,
          '',
          '_No language model is configured (set GEMINI_API_KEY), so this is the raw data context gathered for the task._',
          '',
          '```json',
          JSON.stringify(c.ctx.data, null, 2),
          '```',
        ].join('\n'),
      );
      c.engine.updateTask(c.task.id, { output: out.text });
    } },
    approvalStep('approve', 'Requesting sign-off',
      (c) => ({ title: `Accept result: ${c.task.title}`, summary: `${c.employee.name} finished the task and needs your sign-off.`, details: c.engine.store.task(c.task.id)?.output ?? undefined }),
      (c, d) => {
        if (d.status === 'rejected') {
          c.ctx.feedback = d.note || 'Please revise';
          delete c.ctx.approvals.approve;
          return { goto: 'write' };
        }
      },
      (c) => c.task.requires_approval === 1),
    { key: 'deliver', state: 'COMMUNICATING', label: 'Delivering the result', run: () => {} },
  ],
};

export const PIPELINES: Pipeline[] = [
  planReport, memberData, coopData, reportData, dataChecks, qualitySection, systemAudit, methodology, synthesis, custom,
  section('membership_section', { depKind: 'member_data', title: 'Membership Profile', fallback: R.writeMembershipFallback }),
  section('coop_section', { depKind: 'coop_data', title: 'Cooperative Portfolio', fallback: R.writeCoopFallback }),
  section('mne_section', { depKind: 'mne_data', title: 'Monitoring & Evaluation Compliance', fallback: R.writeMneFallback }),
];

// Builds the task graph for one implementation report.
export function createImplementationReport(engine: WorkforceEngine, by: string) {
  const project = engine.store.insertProject('implementation_report', 'AMDS Implementation Report', by);
  const add = (kind: string, title: string, department: DepartmentId, preferred: string, deps: number[] = [], approval = false) => {
    const task = engine.store.insertTask({
      project_id: project.id, kind, title, department, preferred_employee: preferred, depends_on: deps,
      step_count: engine.pipeline(kind).steps.length, requires_approval: approval,
    });
    engine.broadcast({ type: 'task', task });
    return task.id;
  };
  const plan = add('plan_report', 'Scope report & brief departments', 'executive', 'exec-pm');
  const mem = add('member_data', 'Pull & analyse member records', 'membership', 'mem-rec', [plan]);
  const memS = add('membership_section', 'Write Membership Profile', 'membership', 'mem-lead', [mem]);
  const coop = add('coop_data', 'Profile cooperative portfolio', 'coop_dev', 'coop-field', [plan]);
  const coopS = add('coop_section', 'Write Cooperative Portfolio', 'coop_dev', 'coop-lead', [coop]);
  const mne = add('mne_data', 'Measure CAPAR / CAIS compliance', 'mne', 'mne-comp', [plan]);
  const mneS = add('mne_section', 'Write M&E Compliance', 'mne', 'mne-lead', [mne]);
  const dq = add('data_checks', 'Code & run data-quality checks', 'data', 'data-eng', [plan], true);
  const dqS = add('quality_section', 'Write Data Quality Audit', 'data', 'data-lead', [dq]);
  const sys = add('system_audit', 'Audit system implementation', 'tech', 'tech-lead', [plan]);
  const meth = add('methodology', 'Write methodology & sources', 'tech', 'tech-doc', [memS, coopS, mneS, dqS, sys]);
  add('synthesis', 'Synthesise & publish report', 'executive', 'exec-lead', [meth], true);
  engine.broadcast({ type: 'project', project });
  engine.activity(null, null, 'project', null, `${by} commissioned project #${project.id}: AMDS Implementation Report`);
  return project;
}

export function createCustomTask(engine: WorkforceEngine, by: string, input: {
  title: string; instructions?: string; department: DepartmentId; requires_approval?: boolean;
}) {
  const task = engine.store.insertTask({
    project_id: null, kind: 'custom', title: input.title, instructions: input.instructions ?? null,
    department: input.department, step_count: custom.steps.length, requires_approval: !!input.requires_approval,
  });
  engine.broadcast({ type: 'task', task });
  engine.activity(null, task.id, 'task', null, `${by} assigned "${task.title}" to ${input.department}`);
  return task;
}
