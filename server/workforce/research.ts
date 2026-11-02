import type Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Real research and analysis routines the AI employees run against the live
// AgriCOOPh database and source tree. Every number in a report comes from here.

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

function ageOf(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const d = new Date(birthdate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

// ---- Overview ---------------------------------------------------------------

export function overview(db: Database.Database) {
  const count = (t: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
  return {
    cooperatives: count('Cooperatives'),
    members: count('Members'),
    activeMembers: (db.prepare(`SELECT COUNT(*) AS n FROM Members WHERE status = 'Active'`).get() as { n: number }).n,
    reports: count('Reports'),
    activities: count('Activities'),
    users: count('Users'),
  };
}

// ---- Membership --------------------------------------------------------------

export function researchMembers(db: Database.Database) {
  const rows = db.prepare(
    `SELECT m.id, m.name, m.birthdate, m.gender, m.contact, m.status, m.created_at, c.name AS coop
     FROM Members m LEFT JOIN Cooperatives c ON c.id = m.coop_id`,
  ).all() as any[];
  return { rows, sources: ['Members', 'Cooperatives'] };
}

export function analyzeMembers(rows: any[]) {
  const total = rows.length;
  const active = rows.filter((r) => r.status === 'Active').length;
  const byGender: Record<string, number> = {};
  const byCoop: Record<string, { total: number; active: number }> = {};
  const ageBands: Record<string, number> = { 'Under 30': 0, '30-44': 0, '45-59': 0, '60+': 0, Unknown: 0 };
  const ages: number[] = [];
  for (const r of rows) {
    const g = r.gender || 'Unspecified';
    byGender[g] = (byGender[g] || 0) + 1;
    const c = r.coop || 'Unassigned';
    byCoop[c] ??= { total: 0, active: 0 };
    byCoop[c].total++;
    if (r.status === 'Active') byCoop[c].active++;
    const a = ageOf(r.birthdate);
    if (a == null) ageBands.Unknown++;
    else {
      ages.push(a);
      ageBands[a < 30 ? 'Under 30' : a < 45 ? '30-44' : a < 60 ? '45-59' : '60+']++;
    }
  }
  const avgAge = ages.length ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : null;
  return {
    total, active, inactive: total - active, activeRate: pct(active, total),
    byGender, byCoop, ageBands, avgAge,
    missingContact: rows.filter((r) => !r.contact).length,
  };
}

export function writeMembershipFallback(m: ReturnType<typeof analyzeMembers>) {
  const lines = [
    '## Membership Profile',
    '',
    `The federation has **${m.total}** registered members, of whom **${m.active}** are active (${m.activeRate}%) and ${m.inactive} inactive.` +
      (m.avgAge != null ? ` The average member age is ${m.avgAge}.` : ''),
    '',
    '| Cooperative | Members | Active | Active rate |',
    '|---|---|---|---|',
    ...Object.entries(m.byCoop).map(([c, v]) => `| ${c} | ${v.total} | ${v.active} | ${pct(v.active, v.total)}% |`),
    '',
    `- Gender split: ${Object.entries(m.byGender).map(([g, n]) => `${g} ${n}`).join(', ') || 'no data'}.`,
    `- Age bands: ${Object.entries(m.ageBands).filter(([, n]) => n).map(([b, n]) => `${b} ${n}`).join(', ') || 'no data'}.`,
  ];
  if (m.activeRate < 80) lines.push(`- Active rate is below the 80% benchmark; a re-engagement drive for inactive members is advised.`);
  if (m.missingContact) lines.push(`- ${m.missingContact} member record(s) have no contact number.`);
  return lines.join('\n');
}

// ---- Cooperatives -------------------------------------------------------------

export function researchCooperatives(db: Database.Database) {
  const rows = db.prepare(
    `SELECT c.id, c.name, c.location, c.type, c.date_joined,
       (SELECT COUNT(*) FROM Members m WHERE m.coop_id = c.id) AS members,
       (SELECT COUNT(*) FROM Members m WHERE m.coop_id = c.id AND m.status = 'Active') AS active_members,
       (SELECT COUNT(*) FROM Reports r WHERE r.coop_id = c.id) AS reports
     FROM Cooperatives c ORDER BY c.name`,
  ).all() as any[];
  return { rows, sources: ['Cooperatives', 'Members', 'Reports'] };
}

export function analyzeCooperatives(rows: any[]) {
  const byType: Record<string, number> = {};
  const byLocation: Record<string, number> = {};
  const now = Date.now();
  const coops = rows.map((r) => {
    byType[r.type || 'Unspecified'] = (byType[r.type || 'Unspecified'] || 0) + 1;
    byLocation[r.location || 'Unspecified'] = (byLocation[r.location || 'Unspecified'] || 0) + 1;
    const joined = r.date_joined ? new Date(r.date_joined).getTime() : NaN;
    return {
      name: r.name, location: r.location, members: r.members, active: r.active_members, reports: r.reports,
      yearsInFederation: Number.isNaN(joined) ? null : Math.floor((now - joined) / (365.25 * 864e5)),
    };
  });
  return {
    total: rows.length, coops, byType, byLocation,
    withoutMembers: coops.filter((c) => c.members === 0).map((c) => c.name),
    withoutReports: coops.filter((c) => c.reports === 0).map((c) => c.name),
    avgMembers: rows.length ? Math.round((coops.reduce((s, c) => s + c.members, 0) / rows.length) * 10) / 10 : 0,
  };
}

export function writeCoopFallback(a: ReturnType<typeof analyzeCooperatives>) {
  const lines = [
    '## Cooperative Portfolio',
    '',
    `The federation covers **${a.total}** cooperative(s) with an average of ${a.avgMembers} members each.`,
    '',
    '| Cooperative | Location | Members | Active | Reports | Years in federation |',
    '|---|---|---|---|---|---|',
    ...a.coops.map((c) => `| ${c.name} | ${c.location ?? '—'} | ${c.members} | ${c.active} | ${c.reports} | ${c.yearsInFederation ?? '—'} |`),
    '',
    `- By type: ${Object.entries(a.byType).map(([t, n]) => `${t} ${n}`).join(', ')}.`,
  ];
  if (a.withoutMembers.length) lines.push(`- No members encoded yet: ${a.withoutMembers.join(', ')}.`);
  if (a.withoutReports.length) lines.push(`- No M&E reports on file: ${a.withoutReports.join(', ')}.`);
  return lines.join('\n');
}

// ---- Monitoring & Evaluation --------------------------------------------------

export function researchReports(db: Database.Database) {
  const rows = db.prepare(
    `SELECT r.id, r.type, r.status, r.date_submitted, r.file_path, c.name AS coop
     FROM Reports r LEFT JOIN Cooperatives c ON c.id = r.coop_id ORDER BY r.date_submitted DESC`,
  ).all() as any[];
  const coops = (db.prepare('SELECT name FROM Cooperatives').all() as { name: string }[]).map((c) => c.name);
  return { rows, coops, sources: ['Reports', 'Cooperatives'] };
}

export function analyzeReports(rows: any[], coops: string[]) {
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const r of rows) {
    byType[r.type] = (byType[r.type] || 0) + 1;
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }
  const required = ['CAPAR', 'CAIS'];
  const gaps = coops.flatMap((coop) =>
    required.filter((t) => !rows.some((r) => r.coop === coop && r.type === t)).map((t) => ({ coop, missing: t })),
  );
  const approved = byStatus['Approved'] || 0;
  const latest = rows[0]?.date_submitted ?? null;
  return {
    total: rows.length, byType, byStatus, approvalRate: pct(approved, rows.length),
    pending: rows.filter((r) => r.status !== 'Approved').length,
    gaps, latest,
    daysSinceLatest: latest ? Math.floor((Date.now() - new Date(latest).getTime()) / 864e5) : null,
    compliance: pct(coops.length * required.length - gaps.length, coops.length * required.length),
  };
}

export function writeMneFallback(a: ReturnType<typeof analyzeReports>) {
  const lines = [
    '## Monitoring & Evaluation Compliance',
    '',
    `**${a.total}** report(s) are on file; ${a.approvalRate}% are approved and ${a.pending} await review. ` +
      `Required-report compliance (CAPAR + CAIS per cooperative) stands at **${a.compliance}%**.`,
    '',
    `- By type: ${Object.entries(a.byType).map(([t, n]) => `${t} ${n}`).join(', ') || 'none'}.`,
    `- By status: ${Object.entries(a.byStatus).map(([t, n]) => `${t} ${n}`).join(', ') || 'none'}.`,
  ];
  if (a.latest) lines.push(`- Latest submission: ${a.latest} (${a.daysSinceLatest} days ago).`);
  if (a.gaps.length) {
    lines.push('', '| Cooperative | Missing report |', '|---|---|', ...a.gaps.map((g) => `| ${g.coop} | ${g.missing} |`));
  }
  return lines.join('\n');
}

// ---- Data quality -------------------------------------------------------------

export interface QualityCheck {
  name: string;
  description: string;
  sql: string;
  author: 'catalog' | 'gemini';
}

export const QUALITY_CATALOG: QualityCheck[] = [
  { name: 'members_missing_birthdate', description: 'Members without a birthdate', author: 'catalog',
    sql: `SELECT id, name FROM Members WHERE birthdate IS NULL OR trim(birthdate) = ''` },
  { name: 'members_invalid_birthdate', description: 'Birthdates that are unparsable or in the future', author: 'catalog',
    sql: `SELECT id, name, birthdate FROM Members WHERE birthdate IS NOT NULL AND trim(birthdate) <> '' AND (date(birthdate) IS NULL OR date(birthdate) > date('now'))` },
  { name: 'members_missing_contact', description: 'Members without a contact number', author: 'catalog',
    sql: `SELECT id, name FROM Members WHERE contact IS NULL OR trim(contact) = ''` },
  { name: 'members_bad_contact_format', description: 'Contact numbers not in 09XXXXXXXXX mobile format', author: 'catalog',
    sql: `SELECT id, name, contact FROM Members WHERE contact IS NOT NULL AND trim(contact) <> '' AND (length(contact) <> 11 OR substr(contact, 1, 2) <> '09')` },
  { name: 'members_missing_gender', description: 'Members without a gender value', author: 'catalog',
    sql: `SELECT id, name FROM Members WHERE gender IS NULL OR trim(gender) = ''` },
  { name: 'duplicate_members', description: 'Possible duplicate members (same name within a cooperative)', author: 'catalog',
    sql: `SELECT lower(trim(name)) AS name, coop_id, COUNT(*) AS copies FROM Members GROUP BY lower(trim(name)), coop_id HAVING COUNT(*) > 1` },
  { name: 'reports_without_file', description: 'Reports submitted without an attached file', author: 'catalog',
    sql: `SELECT id, type, coop_id FROM Reports WHERE file_path IS NULL OR trim(file_path) = ''` },
  { name: 'coops_missing_location', description: 'Cooperatives without a location', author: 'catalog',
    sql: `SELECT id, name FROM Cooperatives WHERE location IS NULL OR trim(location) = ''` },
];

// Schema shown to the model when it proposes extra checks. Credentials are left out.
export function schemaForPrompt(db: Database.Database) {
  const tables = ['Cooperatives', 'Members', 'Reports', 'Activities', 'Attendance', 'Documents'];
  return tables.map((t) => {
    const cols = (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string; type: string }[])
      .map((c) => `${c.name} ${c.type}`);
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
    const stmt = readonlyDb.prepare(s);
    if (!stmt.reader) return 'statement does not return rows';
  } catch (e: any) {
    return e.message;
  }
  return null;
}

export function runChecks(readonlyDb: Database.Database, checks: QualityCheck[]) {
  return checks.map((c) => {
    try {
      const rows = readonlyDb.prepare(c.sql.trim().replace(/;+\s*$/, '')).all() as any[];
      return { name: c.name, description: c.description, author: c.author, findings: rows.length, sample: rows.slice(0, 5) };
    } catch (e: any) {
      return { name: c.name, description: c.description, author: c.author, findings: -1, error: e.message, sample: [] };
    }
  });
}

export function scoreQuality(results: ReturnType<typeof runChecks>, totalRecords: number) {
  const ran = results.filter((r) => r.findings >= 0);
  const issues = ran.reduce((s, r) => s + r.findings, 0);
  const passed = ran.filter((r) => r.findings === 0).length;
  return {
    checksRun: ran.length, checksPassed: passed, issues,
    score: ran.length ? Math.round((passed / ran.length) * 100) : null,
    issueRatePerRecord: totalRecords ? Math.round((issues / totalRecords) * 100) / 100 : 0,
  };
}

export function writeDataQualityFallback(results: ReturnType<typeof runChecks> | null, score: ReturnType<typeof scoreQuality> | null, declined: string | null) {
  if (!results || !score) {
    return [
      '## Data Quality Audit',
      '',
      `The data-quality checks were prepared but **not executed**: the owner declined the execution request${declined ? ` ("${declined}")` : ''}. ` +
        'Data quality is therefore unverified for this reporting period.',
    ].join('\n');
  }
  return [
    '## Data Quality Audit',
    '',
    `${score.checksRun} automated checks ran against the live database on a read-only connection; ` +
      `${score.checksPassed} passed (quality score **${score.score ?? '—'}%**) and ${score.issues} issue(s) were found.`,
    '',
    '| Check | Findings | Author |',
    '|---|---|---|',
    ...results.map((r) => `| ${r.description} | ${r.findings < 0 ? `error: ${r.error}` : r.findings} | ${r.author} |`),
  ].join('\n');
}

// ---- System implementation audit ---------------------------------------------

export function researchSystem(db: Database.Database) {
  const tables = (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all() as { name: string }[])
    .map((t) => ({ name: t.name, rows: (db.prepare(`SELECT COUNT(*) AS n FROM "${t.name}"`).get() as { n: number }).n }));
  const audit = {
    total: (db.prepare('SELECT COUNT(*) AS n FROM AuditLogs').get() as { n: number }).n,
    last7Days: (db.prepare(`SELECT COUNT(*) AS n FROM AuditLogs WHERE timestamp >= datetime('now', '-7 days')`).get() as { n: number }).n,
    topActions: db.prepare(
      `SELECT CASE WHEN action LIKE 'Created member%' THEN 'Created member' WHEN action LIKE 'Submitted report%' THEN 'Submitted report' ELSE action END AS action, COUNT(*) AS n
       FROM AuditLogs GROUP BY 1 ORDER BY n DESC LIMIT 5`,
    ).all(),
  };
  return { tables, audit, sources: ['sqlite_master', 'AuditLogs', 'server.ts', 'src/pages'] };
}

const MODULES = [
  { module: 'Members', table: 'Members', resource: '/api/members' },
  { module: 'Cooperatives', table: 'Cooperatives', resource: '/api/cooperatives' },
  { module: 'M&E Reports', table: 'Reports', resource: '/api/reports' },
  { module: 'Activities', table: 'Activities', resource: '/api/activities' },
  { module: 'Attendance', table: 'Attendance', resource: '/api/attendance' },
  { module: 'Documents', table: 'Documents', resource: '/api/documents' },
  { module: 'Audit Logs', table: 'AuditLogs', resource: '/api/audit' },
];

export function analyzeSystem(tables: { name: string; rows: number }[]) {
  const root = process.cwd();
  let routes: { method: string; path: string }[] = [];
  let sourceAvailable = false;
  const serverFile = path.join(root, 'server.ts');
  if (fs.existsSync(serverFile)) {
    sourceAvailable = true;
    const src = fs.readFileSync(serverFile, 'utf8');
    routes = [...src.matchAll(/app\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g)]
      .map((m) => ({ method: m[1].toUpperCase(), path: m[2] }))
      .filter((r) => r.path.startsWith('/api/'));
  }
  const pagesDir = path.join(root, 'src', 'pages');
  const pages = fs.existsSync(pagesDir) ? fs.readdirSync(pagesDir).filter((f) => f.endsWith('.tsx')).map((f) => f.replace('.tsx', '')) : [];
  const coverage = MODULES.map((m) => {
    const methods = [...new Set(routes.filter((r) => r.path === m.resource || r.path.startsWith(m.resource + '/')).map((r) => r.method))];
    const rows = tables.find((t) => t.name === m.table)?.rows ?? 0;
    const status = !sourceAvailable ? 'Unknown' : methods.length === 0 ? 'Schema only' : methods.length >= 4 ? 'Complete' : 'Partial';
    return { module: m.module, rows, api: methods.join(', ') || '—', status };
  });
  const done = coverage.filter((c) => c.status === 'Complete' || c.status === 'Partial').length;
  return { routes, pages, coverage, sourceAvailable, implementedPct: pct(done, coverage.length) };
}

export function writeSystemFallback(r: ReturnType<typeof researchSystem>, a: ReturnType<typeof analyzeSystem>) {
  return [
    '## System Implementation Status',
    '',
    `The platform exposes ${a.routes.length} API route(s) and ${a.pages.length} UI page(s) (${a.pages.join(', ')}). ` +
      `${a.implementedPct}% of planned data modules have at least partial API support.`,
    '',
    '| Module | Records | API methods | Status |',
    '|---|---|---|---|',
    ...a.coverage.map((c) => `| ${c.module} | ${c.rows} | ${c.api} | ${c.status} |`),
    '',
    `- Audit log: ${r.audit.total} entries, ${r.audit.last7Days} in the last 7 days.`,
    ...(a.coverage.some((c) => c.status === 'Schema only')
      ? [`- Modules with tables but no API yet: ${a.coverage.filter((c) => c.status === 'Schema only').map((c) => c.module).join(', ')}.`]
      : []),
    ...(a.coverage.some((c) => c.status === 'Partial')
      ? ['- Partial modules support read/create only; update and delete endpoints are still to be built.']
      : []),
  ].join('\n');
}
