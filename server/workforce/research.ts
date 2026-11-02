import type Database from 'better-sqlite3';

// Research and analysis routines the AI employees run against the programme
// evidence base (PrgIndicators, PrgCoopValues, PrgEvidence, PrgCoops,
// PrgSources). Every figure in a report comes from these tables.

export interface IndicatorRow {
  code: string; name: string; level: string; unit: 'count' | 'percent' | 'peso'; baseline: string;
  v2024: number | null; v2025: number | null; target: number; target_kind: 'growth' | 'level' | 'count';
  coverage: string; cov_full: number; cov_partial: number; cov_none: number; department: string; comment: string;
}
export interface EvidenceRow { id: number; coop: string; indicator: string; kind: string; text: string; source: string }

const round1 = (n: number) => Math.round(n * 10) / 10;

export function fmt(value: number | null, unit: string): string {
  if (value == null) return '—';
  if (unit === 'peso') return value >= 1e6 ? `₱${round1(value / 1e6)}M` : `₱${Math.round(value).toLocaleString('en-US')}`;
  if (unit === 'percent') return `${value}%`;
  return Math.round(value).toLocaleString('en-US');
}

export function overview(db: Database.Database) {
  const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  return {
    indicators: n('SELECT COUNT(*) AS n FROM PrgIndicators'),
    directIndicators: n(`SELECT COUNT(*) AS n FROM PrgIndicators WHERE coverage = 'Direct'`),
    coops: n('SELECT COUNT(*) AS n FROM PrgCoops'),
    coopsRecorded: n(`SELECT COUNT(*) AS n FROM PrgCoops WHERE endline_status = 'recorded'`),
    evidence: n('SELECT COUNT(*) AS n FROM PrgEvidence'),
    sources: n('SELECT COUNT(*) AS n FROM PrgSources'),
  };
}

// ---- Indicator research ----------------------------------------------------------

export function researchIndicators(db: Database.Database, codes: string[]) {
  const q = codes.map(() => '?').join(',');
  const indicators = db.prepare(`SELECT * FROM PrgIndicators WHERE code IN (${q}) ORDER BY code`).all(...codes) as IndicatorRow[];
  const evidence = db.prepare(`SELECT * FROM PrgEvidence WHERE indicator IN (${q}) ORDER BY indicator, coop`).all(...codes) as EvidenceRow[];
  const coopValues = db.prepare(`SELECT * FROM PrgCoopValues WHERE indicator IN (${q}) ORDER BY indicator, coop`).all(...codes) as any[];
  return { indicators, evidence, coopValues, rows: [...indicators, ...evidence], sources: ['PrgIndicators', 'PrgEvidence', 'PrgCoopValues'] };
}

// Status follows the logframe workbook's own formulas, so figures match "as logged":
// change = (2025 − 2024) / 2025, variance = change − Year-5 target.
export function indicatorStatus(i: IndicatorRow) {
  const change = i.v2024 != null && i.v2025 ? round1(((i.v2025 - i.v2024) / i.v2025) * 100) : null;
  const variance = change != null && i.target_kind !== 'count' ? round1(change - i.target) : null;
  let status: string;
  if (i.v2025 == null) status = 'Not numeric';
  else if (i.target_kind === 'growth') status = change != null && change >= i.target ? 'On or above target' : 'Below target';
  else if (i.target_kind === 'level') status = i.v2025 >= i.target ? 'Attained' : 'Below target';
  else status = i.v2025 >= i.target ? 'Attained' : `${Math.round((i.v2025 / i.target) * 100)}% of target`;
  return { change, variance, status };
}

export function analyzeIndicators(raw: ReturnType<typeof researchIndicators>) {
  return raw.indicators.map((i) => {
    const ev = raw.evidence.filter((e) => e.indicator === i.code);
    return {
      code: i.code, name: i.name, unit: i.unit, baseline: i.baseline, v2024: i.v2024, v2025: i.v2025,
      target: i.target, targetKind: i.target_kind, coverage: i.coverage,
      coverageCounts: { full: i.cov_full, partial: i.cov_partial, none: i.cov_none },
      comment: i.comment,
      ...indicatorStatus(i),
      findings: ev.filter((e) => ['finding', 'example'].includes(e.kind)).map((e) => ({ coop: e.coop, text: e.text, source: e.source })),
      adjacent: ev.filter((e) => e.kind === 'adjacent').map((e) => ({ coop: e.coop, text: e.text, source: e.source })),
      constraints: ev.filter((e) => e.kind === 'constraint').map((e) => ({ coop: e.coop, text: e.text })),
      gaps: ev.filter((e) => e.kind === 'gap').map((e) => ({ coop: e.coop, text: e.text })),
      coopsWithEvidence: [...new Set(ev.filter((e) => ['finding', 'example', 'adjacent'].includes(e.kind)).map((e) => e.coop))],
      coopValues2024: raw.coopValues.filter((v) => v.indicator === i.code).map((v) => ({ coop: v.coop, value: v.value })),
    };
  });
}

export type IndicatorAnalysis = ReturnType<typeof analyzeIndicators>;

export function summarizeAnalysis(a: IndicatorAnalysis) {
  const below = a.filter((x) => x.status === 'Below target').map((x) => x.code);
  return `${a.length} indicators analysed (${below.length ? `${below.join(', ')} below target` : 'none below target'}), ` +
    `${a.reduce((s, x) => s + x.findings.length + x.adjacent.length, 0)} endline findings`;
}

export function writeIndicatorSectionFallback(title: string, intro: string, a: IndicatorAnalysis) {
  const out = [`## ${title}`, '', intro, '',
    '| Indicator | 2024 | 2025 | Change (as logged) | Year-5 target | Status | Endline coverage |',
    '|---|---|---|---|---|---|---|',
    ...a.map((x) => `| ${x.code} ${x.name} | ${fmt(x.v2024, x.unit)} | ${fmt(x.v2025, x.unit)} | ${x.change != null ? `${x.change > 0 ? '+' : ''}${x.change}%` : '—'} | ${x.targetKind === 'count' ? x.target : `${x.target}%`} | ${x.status} | ${x.coverage}${x.coverage === 'Direct' ? ` (${x.coverageCounts.full} full, ${x.coverageCounts.partial} partial, ${x.coverageCounts.none} not captured)` : ''} |`),
  ];
  for (const x of a) {
    out.push('', `### ${x.code} ${x.name}`, '');
    if (x.findings.length) out.push(...x.findings.map((f) => `- **${f.coop}:** ${f.text}`));
    if (x.adjacent.length) out.push(`- Related evidence recorded elsewhere: ${x.adjacent.map((f) => `${f.coop} (${f.text.replace(/\.$/, '')})`).join('; ')}.`);
    if (x.constraints.length) out.push(`- Constraints named: ${x.constraints.map((c) => `${c.coop} — ${c.text.replace(/\.$/, '').toLowerCase()}`).join('; ')}.`);
    if (x.gaps.length) out.push(`- Data gaps: ${x.gaps.map((g) => `${g.coop} — ${g.text.replace(/\.$/, '')}`).join('; ')}.`);
    if (!x.findings.length && !x.adjacent.length && !x.gaps.length) out.push('- No endline evidence recorded for this indicator.');
    if (x.comment) out.push('', `_Logframe comment (as logged): ${x.comment}_`);
  }
  return out.join('\n');
}

// ---- Whole-logframe status -----------------------------------------------------------

export function researchLogframe(db: Database.Database) {
  const all = (db.prepare('SELECT code FROM PrgIndicators ORDER BY code').all() as { code: string }[]).map((r) => r.code);
  const raw = researchIndicators(db, all);
  const coops = db.prepare('SELECT * FROM PrgCoops ORDER BY rowid').all() as any[];
  return { ...raw, coops, sources: ['PrgIndicators', 'PrgEvidence', 'PrgCoops'] };
}

export function analyzeLogframe(raw: ReturnType<typeof researchLogframe>) {
  const a = analyzeIndicators(raw);
  const count = (s: string) => a.filter((x) => x.status === s).length;
  return {
    indicators: a.map(({ findings, adjacent, constraints, gaps, coopValues2024, ...rest }) => ({ ...rest, evidenceItems: findings.length + adjacent.length })),
    totals: {
      indicators: a.length, onOrAbove: count('On or above target') + count('Attained'), below: count('Below target'),
      notNumeric: count('Not numeric'), direct: a.filter((x) => x.coverage === 'Direct').length,
      indirect: a.filter((x) => x.coverage === 'Indirect').length, notCovered: a.filter((x) => x.coverage === 'Not covered').length,
    },
    coops: raw.coops.map((c) => ({ code: c.code, location: c.location, dates: c.endline_dates, status: c.endline_status })),
    indirect: analyzeIndicators({ ...raw, indicators: raw.indicators.filter((i) => i.coverage !== 'Direct') })
      .map((x) => ({ code: x.code, name: x.name, evidence: [...x.findings, ...x.adjacent].map((f) => `${f.coop}: ${f.text}`) })),
  };
}

export function writeLogframeFallback(l: ReturnType<typeof analyzeLogframe>) {
  const pending = l.coops.filter((c) => c.status !== 'recorded').map((c) => c.code);
  return [
    '## Logframe Status at Closing',
    '',
    `Of the ${l.totals.indicators} logframe indicators, **${l.totals.onOrAbove}** are on or above their Year-5 target, **${l.totals.below}** are below it and ` +
      `${l.totals.notNumeric} are not recorded as numbers. The endline assessed ${l.totals.direct} indicators directly, supports ${l.totals.indirect} indirectly ` +
      `and did not cover ${l.totals.notCovered}. ${l.coops.length - pending.length} of ${l.coops.length} cooperatives have recorded endline data` +
      (pending.length ? `; ${pending.join(', ')} is pending.` : '.'),
    '',
    '| Indicator | 2024 | 2025 | Change | Target | Variance (as logged) | Status |',
    '|---|---|---|---|---|---|---|',
    ...l.indicators.map((x) => `| ${x.code} ${x.name} | ${fmt(x.v2024, x.unit)} | ${fmt(x.v2025, x.unit)} | ${x.change != null ? `${x.change}%` : '—'} | ${x.targetKind === 'count' ? x.target : `${x.target}%`} | ${x.variance != null ? `${x.variance} pts` : '—'} | ${x.status} |`),
    '',
    '_Change and variance follow the workbook formula (change = (2025 − 2024) ÷ 2025; variance = change − target). For level indicators such as 1.1 and 1.2 the status compares the 2025 value with the target directly._',
    '',
    '### Indirect contributions (knowledge, funding, policy and platforms)',
    '',
    ...l.indirect.flatMap((x) => x.evidence.length ? [`- **${x.code} ${x.name}:** ${x.evidence.join(' ')}`] : [`- **${x.code} ${x.name}:** no endline mentions.`]),
  ].join('\n');
}

// ---- Data reconciliation -------------------------------------------------------------

export interface QualityCheck { name: string; description: string; sql: string; author: 'catalog' | 'gemini' }

export const QUALITY_CATALOG: QualityCheck[] = [
  { name: 'duplicated_indicator_series', author: 'catalog', description: 'Indicators whose 2024 and 2025 values are identical to another indicator',
    sql: `SELECT a.code AS indicator, b.code AS same_as, a.v2024, a.v2025 FROM PrgIndicators a JOIN PrgIndicators b ON a.code < b.code AND a.v2024 = b.v2024 AND a.v2025 = b.v2025` },
  { name: 'coop_value_exceeds_programme_total', author: 'catalog', description: "A single cooperative's 2024 value exceeds the programme total",
    sql: `SELECT v.coop, v.indicator, v.value, i.v2024 AS programme_total FROM PrgCoopValues v JOIN PrgIndicators i ON i.code = v.indicator WHERE v.year = 2024 AND v.value > i.v2024` },
  { name: 'coop_sum_differs_from_total', author: 'catalog', description: 'Sum of per-cooperative 2024 values differs from the logged total by more than 10%',
    sql: `SELECT v.indicator, SUM(v.value) AS coop_sum, i.v2024 AS logged_total FROM PrgCoopValues v JOIN PrgIndicators i ON i.code = v.indicator WHERE v.year = 2024 GROUP BY v.indicator HAVING ABS(SUM(v.value) - i.v2024) > 0.1 * i.v2024` },
  { name: 'zero_value_but_activity_described', author: 'catalog', description: 'Cooperative logged as zero although the endline describes activity',
    sql: `SELECT v.coop, v.indicator FROM PrgCoopValues v WHERE v.year = 2024 AND v.value = 0 AND EXISTS (SELECT 1 FROM PrgEvidence e WHERE e.coop = v.coop AND e.indicator = v.indicator AND e.kind IN ('finding', 'example', 'adjacent'))` },
  { name: 'value_without_endline_evidence', author: 'catalog', description: 'Cooperative has a logged value but no endline evidence to corroborate it',
    sql: `SELECT v.coop, v.indicator, v.value FROM PrgCoopValues v WHERE v.year = 2024 AND v.value > 0 AND NOT EXISTS (SELECT 1 FROM PrgEvidence e WHERE e.coop = v.coop AND e.indicator = v.indicator AND e.kind IN ('finding', 'example', 'adjacent'))` },
  { name: 'blank_coop_values', author: 'catalog', description: 'Per-cooperative values left blank in the workbook',
    sql: `SELECT coop, indicator FROM PrgCoopValues WHERE value IS NULL` },
  { name: 'direct_indicators_with_uncaptured_coops', author: 'catalog', description: 'Directly assessed indicators that some cooperatives did not capture',
    sql: `SELECT code, name, cov_none AS coops_not_captured FROM PrgIndicators WHERE coverage = 'Direct' AND cov_none > 0` },
  { name: 'pending_endline_coops', author: 'catalog', description: 'Cooperatives whose endline data are still pending',
    sql: `SELECT code, name FROM PrgCoops WHERE endline_status <> 'recorded'` },
];

export function schemaForPrompt(db: Database.Database) {
  return ['PrgIndicators', 'PrgCoopValues', 'PrgEvidence', 'PrgCoops'].map((t) => {
    const cols = (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string; type: string }[]).map((c) => `${c.name} ${c.type}`);
    return `${t}(${cols.join(', ')})`;
  }).join('\n');
}

// A check is only accepted if it is a single read-only statement that does not
// touch credentials. Execution also happens on a read-only connection.
export function validateCheck(readonlyDb: Database.Database, sql: string): string | null {
  const s = sql.trim().replace(/;+\s*$/, '');
  if (s.includes(';')) return 'multiple statements are not allowed';
  if (/password|\bUsers\b|Agent[A-Z]/i.test(s)) return 'queries may not read credentials or workforce tables';
  if (!/^(select|with)\b/i.test(s)) return 'only SELECT queries are allowed';
  try {
    if (!readonlyDb.prepare(s).reader) return 'statement does not return rows';
  } catch (e: any) {
    return e.message;
  }
  return null;
}

export function runChecks(readonlyDb: Database.Database, checks: QualityCheck[]) {
  return checks.map((c) => {
    try {
      const rows = readonlyDb.prepare(c.sql.trim().replace(/;+\s*$/, '')).all() as any[];
      return { name: c.name, description: c.description, author: c.author, findings: rows.length, sample: rows.slice(0, 12) };
    } catch (e: any) {
      return { name: c.name, description: c.description, author: c.author, findings: -1, error: e.message, sample: [] as any[] };
    }
  });
}

export function scoreQuality(results: ReturnType<typeof runChecks>) {
  const ran = results.filter((r) => r.findings >= 0);
  return {
    checksRun: ran.length,
    checksPassed: ran.filter((r) => r.findings === 0).length,
    issues: ran.reduce((s, r) => s + r.findings, 0),
  };
}

export const unitOf = (indicator: string) => (indicator === '1.3' || indicator === '1.4' ? 'peso' : 'count');
const describeRow = (r: any) => Object.entries(r).map(([k, v]) => `${k}: ${typeof v === 'number' ? fmt(v, unitOf(r.indicator)) : v}`).join(', ');

export function writeReconciliationFallback(results: ReturnType<typeof runChecks> | null, score: ReturnType<typeof scoreQuality> | null, declined: string | null) {
  if (!results || !score) {
    return ['## Data Reconciliation', '',
      `The reconciliation queries were prepared but **not executed**: the owner declined the request${declined ? ` ("${declined}")` : ''}. ` +
        'Logframe figures are therefore unreconciled in this report.'].join('\n');
  }
  return [
    '## Data Reconciliation',
    '',
    `${score.checksRun} automated checks ran on a read-only connection against the logframe values, per-cooperative values and endline evidence; ` +
      `${score.checksPassed ? `${score.checksPassed} found nothing; ` : ''}${score.checksRun - score.checksPassed} flagged a total of ${score.issues} item(s) to reconcile before terminal figures are quoted.`,
    '',
    ...results.flatMap((r) => [
      `### ${r.description}`,
      '',
      r.findings < 0 ? `Check failed: ${r.error}` : r.findings === 0 ? 'No issues found.' : r.sample.map((s: any) => `- ${describeRow(s)}`).join('\n'),
      '',
    ]),
  ].join('\n');
}

// ---- Department context for ad-hoc tasks -------------------------------------------

export const DEPARTMENT_INDICATORS: Record<string, string[]> = {
  pmo: ['0.1A', '0.2A', '1.1', '1.2', '2.2'],
  inclusion: ['0.1A', '0.1B', '0.1C', '0.2A', '0.2B'],
  enterprise: ['1.1', '1.2', '1.3', '1.4'],
  extension: ['2.1', '2.2'],
  mne: ['0.3', '3.1', '3.2', '4.1', '4.2'],
  data: ['0.1B', '0.2B', '1.3', '2.1', '2.2'],
};
