import type { DepartmentId } from '../../src/shared/workforce';
import type { Pipeline, Step, StepContext, WorkforceEngine } from './engine';
import { PACING_MS } from './engine';
import { generate } from './llm';
import { PROGRAMME } from './program-data';
import * as R from './research';

// Task pipelines for the AgriCOOPh–CSA DGD Programme terminal implementation
// report. Each step names the employee state it represents and does the real
// work for that state: querying the programme evidence base while RESEARCHING,
// computing logframe status while ANALYZING, authoring reconciliation SQL while
// CODING, drafting while WRITING.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const REPORT_TITLE = 'DGD Programme Terminal Implementation Report';

function persona(c: StepContext) {
  return `You are ${c.employee.name}, ${c.employee.title} in the AI workforce of AgriCOOPh, the Philippine federation of family farmers' ` +
    `cooperatives. You are preparing the terminal implementation report for the ${PROGRAMME.name}. Programme outcome: ${PROGRAMME.outcome}`;
}

function sectionPrompt(c: StepContext, title: string, data: unknown, extra = '') {
  return [
    persona(c),
    `Write the "${title}" section of the terminal implementation report in GitHub-flavoured Markdown.`,
    `Start with the heading "## ${title}". 250-400 words. Use only the figures and evidence in the DATA block and never invent numbers.`,
    'Quote logframe values "as logged". Attribute every endline finding to its cooperative. Describe the endline as consistency or explanation, not causation.',
    'Include one compact table, name data gaps plainly, and end with 2-3 bullet-point recommendations.',
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

// ---- Reusable shapes -----------------------------------------------------------

// An analyst pulls the indicators and endline evidence for a result area, analyses
// them, then hands the findings to the section owner.
function dataPull(kind: string, codes: string[], opts: { researchLabel: string; analyzeLabel: string; handoffTo: string }): Pipeline {
  return {
    kind,
    steps: [
      { key: 'research', state: 'RESEARCHING', label: opts.researchLabel, run: (c) => {
        const raw = R.researchIndicators(c.engine.db, codes);
        c.ctx.raw = raw;
        c.ctx.sources = raw.sources;
        c.log(`Retrieved ${raw.indicators.length} indicators, ${raw.evidence.length} endline evidence items and ${raw.coopValues.length} cooperative values`);
      } },
      { key: 'analyze', state: 'ANALYZING', label: opts.analyzeLabel, run: (c) => {
        c.ctx.metrics = R.analyzeIndicators(c.ctx.raw);
        delete c.ctx.raw;
        c.log(R.summarizeAnalysis(c.ctx.metrics));
      } },
      { key: 'handoff', state: 'COMMUNICATING', label: 'Handing findings to the section owner', run: (c) => {
        const summary = R.summarizeAnalysis(c.ctx.metrics);
        c.engine.handoff(c, opts.handoffTo, summary);
        c.engine.updateTask(c.task.id, { output: summary });
      } },
    ],
  };
}

// The section owner outlines from the hand-off, then drafts their section.
function section(kind: string, opts: { depKind: string; title: string; intro: string }): Pipeline {
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
        const out = await generate(sectionPrompt(c, opts.title, c.ctx.metrics),
          () => R.writeIndicatorSectionFallback(opts.title, opts.intro, c.ctx.metrics));
        c.ctx.engine = out.engine;
        c.engine.updateTask(c.task.id, { output: out.text });
        c.log(`Drafted ${out.text.split(/\s+/).length} words (${out.engine})`);
      } },
    ],
  };
}

// ---- Terminal implementation report -------------------------------------------------

const planReport: Pipeline = {
  kind: 'plan_report',
  steps: [
    { key: 'scope', state: 'THINKING', label: 'Scoping the terminal report', run: async (c) => {
      const ov = R.overview(c.engine.db);
      c.ctx.overview = ov;
      const out = await generate(
        `${persona(c)}\nWrite a 5-bullet Markdown brief for the department leads producing the terminal implementation report. ` +
          `Say what each department covers. Evidence base: ${JSON.stringify(ov)}. No preamble.`,
        () => [
          `- Scope: ${ov.indicators} logframe indicators (${ov.directIndicators} assessed directly by the endline), ${ov.coops} partner cooperatives (${ov.coopsRecorded} with recorded endline data), ${ov.evidence} endline evidence items from ${ov.sources} source documents.`,
          '- Member Services & Inclusion: Outcomes 0.1A–0.2B (reach, women, youth, income).',
          '- Enterprise & Finance: Result 1 (professionalism, funds, purchases from members, patronage).',
          '- Extension & Agroecology: Result 2 (technical advice, agroecological practices).',
          '- M&E and Data: logframe status at closing, indirect results, and reconciliation of logged values before terminal figures are quoted.',
        ].join('\n'),
      );
      c.ctx.brief = out.text;
    } },
    { key: 'brief', state: 'COMMUNICATING', label: 'Briefing department leads', paced: false, run: async (c) => {
      for (const code of ['inc-analyst', 'ent-analyst', 'ext-analyst', 'data-eng', 'mne-lead']) {
        c.engine.handoff(c, code, 'Terminal report brief');
        await sleep(Math.max(PACING_MS / 3, 200));
      }
      c.engine.updateTask(c.task.id, { output: c.ctx.brief });
    } },
  ],
};

const OUTCOME_CODES = ['0.1A', '0.1B', '0.1C', '0.2A', '0.2B'];
const RESULT1_CODES = ['1.1', '1.2', '1.3', '1.4'];
const RESULT2_CODES = ['2.1', '2.2'];

const inclusionData = dataPull('inclusion_data', OUTCOME_CODES, {
  researchLabel: 'Pulling Outcome 0.1–0.2 indicators and endline evidence', analyzeLabel: 'Assessing reach, women, youth and income', handoffTo: 'inc-lead',
});
const enterpriseData = dataPull('enterprise_data', RESULT1_CODES, {
  researchLabel: 'Pulling Result 1 indicators and cooperative values', analyzeLabel: 'Assessing funds, purchases and patronage', handoffTo: 'ent-lead',
});
const extensionData = dataPull('extension_data', RESULT2_CODES, {
  researchLabel: 'Pulling Result 2 indicators and cooperative values', analyzeLabel: 'Assessing extension reach and agroecology', handoffTo: 'ext-lead',
});

const logframeStatus: Pipeline = {
  kind: 'logframe_status',
  steps: [
    { key: 'research', state: 'RESEARCHING', label: 'Reading all 16 logframe indicators', run: (c) => {
      const raw = R.researchLogframe(c.engine.db);
      c.ctx.raw = raw;
      c.ctx.sources = raw.sources;
    } },
    { key: 'analyze', state: 'ANALYZING', label: 'Computing status and variance against Year-5 targets', run: (c) => {
      c.ctx.status = R.analyzeLogframe(c.ctx.raw);
      delete c.ctx.raw;
      const t = c.ctx.status.totals;
      c.log(`${t.onOrAbove} indicators on or above target, ${t.below} below, ${t.notNumeric} not numeric`);
    } },
    { key: 'write', state: 'WRITING', label: 'Drafting "Logframe Status at Closing"', run: async (c) => {
      const out = await generate(sectionPrompt(c, 'Logframe Status at Closing', c.ctx.status,
        'Change = (2025 − 2024) ÷ 2025 and variance = change − target, as in the workbook; say that for level indicators (1.1, 1.2) the 2025 value is compared with the target directly. Cover the indirect indicators (0.3, 3.1, 3.2, 4.1, 4.2) in a short subsection.'),
        () => R.writeLogframeFallback(c.ctx.status));
      c.ctx.engine = out.engine;
      c.engine.updateTask(c.task.id, { output: out.text });
    } },
    { key: 'handoff', state: 'COMMUNICATING', label: 'Sharing status with the reporting officer', run: (c) => {
      c.engine.handoff(c, 'mne-writer', 'Logframe status ready for the methodology annex');
    } },
  ],
};

const dataChecks: Pipeline = {
  kind: 'data_checks',
  steps: [
    { key: 'design', state: 'THINKING', label: 'Designing reconciliation checks', run: (c) => {
      c.ctx.schema = R.schemaForPrompt(c.engine.readonlyDb);
    } },
    { key: 'code', state: 'CODING', label: 'Writing reconciliation SQL', run: async (c) => {
      const checks: R.QualityCheck[] = [...R.QUALITY_CATALOG];
      const out = await generate(
        `${persona(c)}\nPropose up to 3 additional SQLite checks that find inconsistencies between logframe values, per-cooperative values and endline evidence, beyond: ` +
          `${checks.map((x) => x.name).join(', ')}.\nSchema:\n${c.ctx.schema}\n` +
          'Each must be ONE read-only SELECT that returns the offending rows. Reply with only a JSON array of {"name","description","sql"}.',
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
      c.log(`Prepared ${checks.length} validated reconciliation queries`);
    } },
    approvalStep('approve', (c) => `Requesting approval to run ${c.ctx.checks?.length ?? 0} queries`,
      (c) => ({
        title: `Run ${c.ctx.checks.length} reconciliation queries on the programme data`,
        summary: `${c.employee.name} wrote read-only SQL that cross-checks logframe totals, per-cooperative values and endline evidence, and needs your go-ahead before running it.`,
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
      c.log(`Executed ${c.ctx.results.length} checks, ${issues} item(s) to reconcile`);
    } },
    { key: 'handoff', state: 'COMMUNICATING', label: 'Sending results to the data quality analyst', run: (c) => {
      const msg = c.ctx.declined ? 'Checks not executed (owner declined)' : `${c.ctx.results.length} check results ready`;
      c.engine.handoff(c, 'data-lead', msg);
      c.engine.updateTask(c.task.id, { output: msg });
    } },
  ],
};

const reconciliationSection: Pipeline = {
  kind: 'reconciliation_section',
  steps: [
    { key: 'score', state: 'ANALYZING', label: 'Scoring reconciliation results', run: (c) => {
      const dep = projectTask(c, 'data_checks');
      if (!dep) throw new Error('No reconciliation results received');
      c.ctx.results = dep.ctx.results ?? null;
      c.ctx.declined = dep.ctx.declined ?? null;
      c.ctx.score = c.ctx.results ? R.scoreQuality(c.ctx.results) : null;
      c.ctx.sources = ['PrgIndicators', 'PrgCoopValues', 'PrgEvidence', 'PrgCoops'];
    } },
    { key: 'write', state: 'WRITING', label: 'Drafting "Data Reconciliation"', run: async (c) => {
      const data = { score: c.ctx.score, results: c.ctx.results, declinedByOwner: c.ctx.declined };
      const out = await generate(sectionPrompt(c, 'Data Reconciliation', data,
        'List each reconciliation point with the cooperative and indicator concerned and what must be confirmed before terminal figures are quoted.'),
        () => R.writeReconciliationFallback(c.ctx.results, c.ctx.score, c.ctx.declined));
      c.ctx.engine = out.engine;
      c.engine.updateTask(c.task.id, { output: out.text });
    } },
  ],
};

const SECTION_KINDS = ['logframe_status', 'inclusion_section', 'enterprise_section', 'extension_section', 'reconciliation_section'];

const methodology: Pipeline = {
  kind: 'methodology',
  steps: [
    { key: 'collect', state: 'RESEARCHING', label: 'Collecting sources from every section', run: (c) => {
      c.ctx.rows = SECTION_KINDS.map((k) => {
        const dep = projectTask(c, k);
        const author = dep?.task.assignee_id ? c.engine.store.employee(dep.task.assignee_id)?.name : null;
        return { title: dep?.task.title ?? k, author, sources: dep?.ctx.sources ?? [], engine: dep?.ctx.engine ?? 'rule-based' };
      });
      c.ctx.docs = c.engine.db.prepare('SELECT * FROM PrgSources ORDER BY id').all();
      c.ctx.coops = c.engine.db.prepare('SELECT * FROM PrgCoops ORDER BY rowid').all();
    } },
    { key: 'write', state: 'WRITING', label: 'Writing sources and methodology', run: (c) => {
      const pending = c.ctx.coops.filter((x: any) => x.endline_status !== 'recorded').map((x: any) => x.code);
      const text = [
        '## Sources and Methodology',
        '',
        `Logframe values are quoted as logged in the M&E logframe workbook. Endline evidence comes from the key-informant assessment of cooperative officers and staff (${PROGRAMME.endlinePeriod}); ` +
          'it explains and corroborates the logged figures but supplies no new counts and cannot show causation. Reconciliation queries ran on a read-only connection after owner approval.',
        '',
        '**Source documents**',
        '',
        ...c.ctx.docs.map((d: any) => `- [${d.title}](${d.url}) (${d.date})`),
        '',
        '**Endline schedule**',
        '',
        '| Cooperative | Location | Dates | Endline data |',
        '|---|---|---|---|',
        ...c.ctx.coops.map((x: any) => `| ${x.code} | ${x.location || '—'} | ${x.endline_dates} | ${x.endline_status} |`),
        '',
        '**Who wrote what**',
        '',
        '| Section | Author | Data used | Writer |',
        '|---|---|---|---|',
        ...c.ctx.rows.map((r: any) => `| ${r.title} | ${r.author ?? '—'} | ${r.sources.join(', ')} | ${r.engine} |`),
        '',
        '**Limitations**',
        '',
        '- Endline data are institutional (officers and staff), not a survey of farmer-members.',
        ...(pending.length ? [`- ${pending.join(', ')}: endline data pending; contribution to every indicator shown as pending.`] : []),
        '- Individuals named in the source reports are referred to by role in this report.',
      ].join('\n');
      c.engine.updateTask(c.task.id, { output: text });
    } },
  ],
};

// Rule-based recommendations derived from measured findings.
function ruleRecommendations(c: StepContext): string[] {
  const recs: string[] = [];
  const status = projectTask(c, 'logframe_status')?.ctx.status;
  const recon = projectTask(c, 'reconciliation_section')?.ctx;
  const results: any[] = recon?.results ?? [];
  const hit = (name: string) => results.find((r) => r.name === name && r.findings > 0);
  const list = (r: any, f: (s: any) => string) => r.sample.map(f).join('; ');

  if (recon?.declined) recs.push('Run the data reconciliation that was not executed this period before quoting terminal figures.');
  const dup = hit('duplicated_indicator_series');
  if (dup) recs.push(`Confirm whether ${list(dup, (s) => `${s.same_as} was estimated separately from ${s.indicator}`)}; the logged values are identical.`);
  const over = hit('coop_value_exceeds_programme_total');
  if (over) recs.push(`Reconcile ${list(over, (s) => `${s.indicator}: ${s.coop}'s 2024 value (${R.fmt(s.value, R.unitOf(s.indicator))}) exceeds the programme total (${R.fmt(s.programme_total, R.unitOf(s.indicator))})`)}.`);
  const sum = hit('coop_sum_differs_from_total');
  if (sum) recs.push(`Align per-cooperative values with the logged totals for ${sum.sample.map((s: any) => s.indicator).join(', ')}.`);
  const zero = hit('zero_value_but_activity_described');
  if (zero) recs.push(`Update values logged as zero where the endline describes activity: ${list(zero, (s) => `${s.coop} (${s.indicator})`)}.`);
  const unsupported = hit('value_without_endline_evidence');
  if (unsupported) recs.push(`Obtain records to corroborate values without endline evidence: ${list(unsupported, (s) => `${s.coop} (${s.indicator})`)}.`);
  const pending = hit('pending_endline_coops');
  if (pending) recs.push(`Complete the endline for ${pending.sample.map((s: any) => s.code).join(', ')} and show its contribution as pending until then.`);
  const below = status?.indicators.filter((x: any) => x.status === 'Below target').map((x: any) => x.code) ?? [];
  if (below.length) recs.push(`Explain the shortfall against Year-5 targets for ${below.join(', ')} in the terminal logframe comments.`);
  recs.push('Request records by sex and age (0.1B, 0.1C, 0.2B) and farmer lists for agroecology (2.2) so terminal figures rest on cooperative-level evidence.');
  return recs;
}

// Rule-based meeting notes: findings and risks derived from each department's analysis.
function ruleMeetingNotes(c: StepContext): string {
  const findings: string[] = [];
  const risks: string[] = [];
  const status = projectTask(c, 'logframe_status')?.ctx.status;
  if (status) {
    const on = status.indicators.filter((x: any) => ['On or above target', 'Attained'].includes(x.status)).map((x: any) => x.code);
    const below = status.indicators.filter((x: any) => x.status === 'Below target').map((x: any) => x.code);
    findings.push(`${on.length} of ${status.totals.indicators} indicators are on or above their Year-5 target (${on.join(', ')}); ${below.length} are below (${below.join(', ')}).`);
    const pending = status.coops.filter((x: any) => x.status !== 'recorded').map((x: any) => x.code);
    if (pending.length) risks.push(`Endline data pending for ${pending.join(', ')}.`);
  }
  for (const [kind, area] of [['inclusion_data', 'Outcomes'], ['enterprise_data', 'Result 1'], ['extension_data', 'Result 2']]) {
    const m: R.IndicatorAnalysis | undefined = projectTask(c, kind)?.ctx.metrics;
    if (!m) continue;
    const best = [...m].sort((a, b) => b.coopsWithEvidence.length - a.coopsWithEvidence.length)[0];
    findings.push(`${area}: strongest endline evidence for ${best.code} (${best.coopsWithEvidence.length} cooperatives); ` +
      `${m.reduce((s, x) => s + x.findings.length, 0)} findings, ${m.reduce((s, x) => s + x.constraints.length, 0)} constraints named.`);
    const gaps = m.filter((x) => x.gaps.length).map((x) => `${x.code} (${x.gaps.map((g) => g.coop).join(', ')})`);
    if (gaps.length) risks.push(`${area} data gaps: ${gaps.join('; ')}.`);
  }
  const recon = projectTask(c, 'reconciliation_section')?.ctx;
  if (recon?.score) risks.push(`${recon.score.issues} reconciliation item(s) across ${recon.score.checksRun - recon.score.checksPassed} checks must be settled before terminal figures are quoted.`);
  else if (recon?.declined) risks.push('Reconciliation was not run, so logged figures are unverified.');
  return ['**Findings**', '', ...findings.map((f) => `- ${f}`), '', '**Risks**', '', ...risks.map((r) => `- ${r}`)].join('\n');
}

const synthesis: Pipeline = {
  kind: 'synthesis',
  steps: [
    { key: 'meeting', state: 'IN_MEETING', label: 'Synthesis meeting with department leads', paced: false, run: async (c) => {
      const leads = ['inc-lead', 'ent-lead', 'ext-lead', 'data-lead', 'mne-lead', 'mne-writer', 'pmo-coord'];
      c.ctx.notes = await c.engine.meeting(c, leads, 'Terminal report synthesis', async () => {
        const sections = SECTION_KINDS.map((k) => projectTask(c, k)?.task.output ?? '').join('\n\n');
        const out = await generate(
          `${persona(c)}\nYou are chairing the synthesis meeting. From the report sections below, list the 6 most important findings and the ` +
            'top 4 reconciliation or sustainability risks as Markdown bullets under "Findings" and "Risks". Use only facts in the sections.\n\n' + sections,
          () => ruleMeetingNotes(c),
        );
        return out.text;
      });
    } },
    { key: 'write', state: 'WRITING', label: (c) => (c.ctx.feedback ? `Revising report (round ${c.ctx.revision})` : 'Writing executive summary & assembling report'), run: async (c) => {
      const feedback = c.ctx.feedback ? `\nThe owner rejected the previous draft with this feedback; address it: "${c.ctx.feedback}"` : '';
      const ov = R.overview(c.engine.db);
      const status = projectTask(c, 'logframe_status')?.ctx.status;
      const recs = ruleRecommendations(c);
      const out = await generate(
        `${persona(c)}\nWrite the Executive Summary (one paragraph, ~150 words) and a numbered Recommendations list (5-8 items) for the terminal ` +
          `implementation report. Use headings "## Executive Summary" and "## Recommendations". Base it only on these notes, totals and rule-based ` +
          `recommendations.${feedback}\nTOTALS: ${JSON.stringify({ ...ov, status: status?.totals })}\nRULE-BASED RECOMMENDATIONS: ${JSON.stringify(recs)}\nNOTES:\n${c.ctx.notes}`,
        () => [
          '## Executive Summary',
          '',
          `The ${PROGRAMME.name} closes with ${status ? `${status.totals.onOrAbove} of ${status.totals.indicators} logframe indicators on or above their Year-5 targets and ${status.totals.below} below` : 'its logframe under review'}. ` +
            `The endline assessment (${PROGRAMME.endlinePeriod}) recorded data for ${ov.coopsRecorded} of ${ov.coops} partner cooperatives and ${ov.evidence} evidence items, ` +
            `assessing ${ov.directIndicators} indicators directly. It is consistent with the direction of the logged results and explains shortfalls, ` +
            'but several logged values need reconciling before terminal figures are quoted (see Data Reconciliation).' +
            (c.ctx.feedback ? ` This revision addresses owner feedback: "${c.ctx.feedback}".` : ''),
          '',
          '## Recommendations',
          '',
          ...recs.map((b, i) => `${i + 1}. ${b}`),
        ].join('\n'),
      );
      const parts = [...SECTION_KINDS, 'methodology'].map((k) => projectTask(c, k)?.task.output).filter(Boolean);
      const participants = c.ctx.meetingParticipants?.length ? c.ctx.meetingParticipants.join(', ') : 'none available';
      const markdown = [
        `# ${PROGRAMME.name} — Terminal Implementation Report`,
        '',
        `_Project #${c.task.project_id} · compiled ${new Date().toISOString().slice(0, 10)} by ${c.employee.name} · ` +
          `writer: ${out.engine}${c.ctx.revision ? ` · revision ${c.ctx.revision}` : ''}_`,
        '',
        `**Programme outcome:** ${PROGRAMME.outcome}`,
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
      const report = c.engine.store.upsertProjectReport(c.task.project_id, REPORT_TITLE, markdown, 'draft', null);
      c.ctx.reportId = report.id;
      c.engine.broadcast({ type: 'report', report });
      c.engine.updateTask(c.task.id, { output: markdown });
    } },
    approvalStep('approve', 'Requesting owner sign-off on the report',
      (c) => ({
        title: `Publish "${REPORT_TITLE}"${c.ctx.revision ? ` (revision ${c.ctx.revision})` : ''}`,
        summary: `${c.employee.name} assembled the terminal implementation report from all six departments and needs your sign-off to publish. Approve to publish, or reject with feedback to request a revision.`,
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
      const report = c.engine.store.upsertProjectReport(c.task.project_id, REPORT_TITLE, markdown, 'published', c.ctx.approvedBy);
      c.engine.broadcast({ type: 'report', report });
      c.engine.handoff(c, 'pmo-coord', 'Report approved and published');
    } },
  ],
};

// ---- Ad-hoc tasks from the owner ---------------------------------------------------

const custom: Pipeline = {
  kind: 'custom',
  steps: [
    { key: 'plan', state: 'THINKING', label: 'Planning an approach', run: () => {} },
    { key: 'research', state: 'RESEARCHING', label: 'Gathering programme evidence', run: (c) => {
      const codes = R.DEPARTMENT_INDICATORS[c.task.department] ?? [];
      c.ctx.data = { overview: R.overview(c.engine.db), indicators: R.analyzeIndicators(R.researchIndicators(c.engine.db, codes)) };
    } },
    { key: 'write', state: 'WRITING', label: (c) => (c.ctx.feedback ? 'Revising response' : 'Writing response'), run: async (c) => {
      const feedback = c.ctx.feedback ? `\nThe owner rejected the previous answer: "${c.ctx.feedback}". Address this.` : '';
      const out = await generate(
        `${persona(c)}\nTask from the owner: "${c.task.title}"\n${c.task.instructions ?? ''}${feedback}\n` +
          `Answer in concise Markdown using only this data:\n${JSON.stringify(c.ctx.data, null, 1)}`,
        () => R.writeIndicatorSectionFallback(c.task.title,
          '_No language model is configured (set GEMINI_API_KEY), so this is the department\'s evidence for the question, not a written answer._',
          c.ctx.data.indicators),
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
  planReport, inclusionData, enterpriseData, extensionData, logframeStatus, dataChecks, reconciliationSection, methodology, synthesis, custom,
  section('inclusion_section', { depKind: 'inclusion_data', title: 'Outcomes: Services, Inclusion and Income',
    intro: 'Outcome indicators 0.1A–0.2B track how many farmer-members, women and young people the cooperatives serve, and whether member income rose.' }),
  section('enterprise_section', { depKind: 'enterprise_data', title: 'Result 1: Cooperative Business and Finance',
    intro: 'Result 1 covers organizational professionalism, access to funds, products purchased from members and profit shared with them.' }),
  section('extension_section', { depKind: 'extension_data', title: 'Result 2: Extension and Agroecology',
    intro: 'Result 2 covers farmers receiving technical advice and farmers applying at least two agroecological practices.' }),
];

// Builds the task graph for one terminal implementation report.
export function createImplementationReport(engine: WorkforceEngine, by: string) {
  const project = engine.store.insertProject('implementation_report', REPORT_TITLE, by);
  const add = (kind: string, title: string, department: DepartmentId, preferred: string, deps: number[] = [], approval = false) => {
    const task = engine.store.insertTask({
      project_id: project.id, kind, title, department, preferred_employee: preferred, depends_on: deps,
      step_count: engine.pipeline(kind).steps.length, requires_approval: approval,
    });
    engine.broadcast({ type: 'task', task });
    return task.id;
  };
  const plan = add('plan_report', 'Scope terminal report & brief departments', 'pmo', 'pmo-coord');
  const inc = add('inclusion_data', 'Analyse Outcomes 0.1–0.2 evidence', 'inclusion', 'inc-analyst', [plan]);
  const incS = add('inclusion_section', 'Write Outcomes: Services, Inclusion and Income', 'inclusion', 'inc-lead', [inc]);
  const ent = add('enterprise_data', 'Analyse Result 1 evidence', 'enterprise', 'ent-analyst', [plan]);
  const entS = add('enterprise_section', 'Write Result 1: Business and Finance', 'enterprise', 'ent-lead', [ent]);
  const ext = add('extension_data', 'Analyse Result 2 evidence', 'extension', 'ext-analyst', [plan]);
  const extS = add('extension_section', 'Write Result 2: Extension and Agroecology', 'extension', 'ext-lead', [ext]);
  const dq = add('data_checks', 'Code & run reconciliation checks', 'data', 'data-eng', [plan], true);
  const dqS = add('reconciliation_section', 'Write Data Reconciliation', 'data', 'data-lead', [dq]);
  const lf = add('logframe_status', 'Assess logframe status at closing', 'mne', 'mne-lead', [plan]);
  const meth = add('methodology', 'Write sources & methodology', 'mne', 'mne-writer', [incS, entS, extS, dqS, lf]);
  add('synthesis', 'Synthesise & publish terminal report', 'pmo', 'pmo-lead', [meth], true);
  engine.broadcast({ type: 'project', project });
  engine.activity(null, null, 'project', null, `${by} commissioned project #${project.id}: ${REPORT_TITLE}`);
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
