// Executive management layer: departments, KPIs, monthly updates, issues and decisions.
// Every department plugs into the same structure so the CEO (and later a COO) can
// compare them on one screen. Department-specific tools are added on top of this.
import type { Express, RequestHandler } from "express";
import type Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { initKmSchema, seedKmDemo, kmKpiValue } from "./km";

type DB = Database.Database;

export const EXEC_ROLES = ["Super Admin", "Executive"];
export const isExec = (user: any) => EXEC_ROLES.includes(user?.role);

// ---------- Period helpers (periods are 'YYYY-MM') ----------
export function periodOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
export function shiftPeriod(period: string, months: number) {
  const [y, m] = period.split("-").map(Number);
  return periodOf(new Date(y, m - 1 + months, 1));
}
function periodRange(end: string, count: number) {
  return Array.from({ length: count }, (_, i) => shiftPeriod(end, i - count + 1));
}
const isPeriod = (p: any) => typeof p === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(p);

// ---------- Status logic ----------
export type Status = "on-track" | "at-risk" | "off-track" | "no-data";
const STATUS_RANK: Record<Status, number> = { "no-data": 0, "on-track": 1, "at-risk": 2, "off-track": 3 };

export function kpiStatus(value: number | null | undefined, target: number | null, direction: string): Status {
  if (value === null || value === undefined || target === null || target === undefined) return "no-data";
  let ratio: number;
  if (direction === "lower") {
    if (value <= target) return "on-track";
    ratio = value === 0 ? 1 : target / value;
  } else {
    if (target === 0) return "on-track";
    ratio = value / target;
  }
  if (ratio >= 0.95) return "on-track";
  if (ratio >= 0.8) return "at-risk";
  return "off-track";
}

// ---------- Schema ----------
function migrateUsers(db: DB) {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='Users'").get() as any;
  if (!row || row.sql.includes("Department Head")) return;
  // Older databases: widen the role list and add dept_id. SQLite can't alter a CHECK, so rebuild.
  db.pragma("foreign_keys = OFF");
  db.transaction(() => {
    db.exec(`
      CREATE TABLE Users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('Super Admin', 'Executive', 'Department Head', 'Cooperative Admin', 'Data Encoder', 'Viewer')) NOT NULL,
        coop_id INTEGER,
        dept_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(coop_id) REFERENCES Cooperatives(id)
      );
      INSERT INTO Users_new (id, name, email, password, role, coop_id, created_at)
        SELECT id, name, email, password, role, coop_id, created_at FROM Users;
      DROP TABLE Users;
      ALTER TABLE Users_new RENAME TO Users;
    `);
  })();
  db.pragma("foreign_keys = ON");
}

function createTables(db: DB) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT CHECK(category IN ('Income', 'Support')) NOT NULL,
      reports_to TEXT CHECK(reports_to IN ('CEO', 'COO')) NOT NULL,
      head_name TEXT,
      mandate TEXT,
      monthly_revenue_target REAL DEFAULT 0,
      finance_tracking TEXT NOT NULL DEFAULT 'expenses',
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS KPIs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dept_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'count',
      target REAL,
      direction TEXT CHECK(direction IN ('higher', 'lower')) NOT NULL DEFAULT 'higher',
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      source TEXT,
      FOREIGN KEY(dept_id) REFERENCES Departments(id)
    );

    CREATE TABLE IF NOT EXISTS KPIEntries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kpi_id INTEGER NOT NULL,
      period TEXT NOT NULL,
      value REAL NOT NULL,
      note TEXT,
      entered_by INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(kpi_id, period),
      FOREIGN KEY(kpi_id) REFERENCES KPIs(id)
    );

    CREATE TABLE IF NOT EXISTS DeptFinancials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dept_id INTEGER NOT NULL,
      period TEXT NOT NULL,
      revenue REAL NOT NULL DEFAULT 0,
      expenses REAL NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(dept_id, period),
      FOREIGN KEY(dept_id) REFERENCES Departments(id)
    );

    CREATE TABLE IF NOT EXISTS DeptUpdates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dept_id INTEGER NOT NULL,
      period TEXT NOT NULL,
      highlights TEXT,
      challenges TEXT,
      support_needed TEXT,
      submitted_by INTEGER,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(dept_id, period),
      FOREIGN KEY(dept_id) REFERENCES Departments(id)
    );

    CREATE TABLE IF NOT EXISTS Issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dept_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT CHECK(severity IN ('Low', 'Medium', 'High', 'Critical')) NOT NULL DEFAULT 'Medium',
      status TEXT CHECK(status IN ('Open', 'In Progress', 'Resolved')) NOT NULL DEFAULT 'Open',
      owner TEXT,
      due_date TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY(dept_id) REFERENCES Departments(id)
    );

    CREATE TABLE IF NOT EXISTS Decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dept_id INTEGER,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      decision TEXT NOT NULL,
      evidence TEXT,
      expected_result TEXT,
      review_date TEXT,
      outcome TEXT,
      decided_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(dept_id) REFERENCES Departments(id)
    );

    CREATE TABLE IF NOT EXISTS OrgSettings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

// ---------- Seed: org structure (always) and demo figures (optional) ----------
// source: KPIs calculated from records (e.g. KM library) instead of typed in each month.
type KpiSeed = [name: string, unit: string, target: number, direction: "higher" | "lower", description: string, source?: string];
type DeptSeed = {
  code: string; name: string; category: "Income" | "Support"; reports_to: "CEO" | "COO";
  mandate: string; revenueTarget: number; expenseRatio: number; performance: number; kpis: KpiSeed[];
};

const DEPARTMENTS: DeptSeed[] = [
  {
    code: "SMS", name: "Supply & Marketing Services", category: "Income", reports_to: "COO",
    mandate: "Purchase member produce, link member products to markets, engage institutional buyers.",
    revenueTarget: 1_200_000, expenseRatio: 0.78, performance: 1.02,
    kpis: [
      ["Produce purchased from members", "MT", 120, "higher", "Metric tons bought from member coops this month"],
      ["Sales to institutional buyers", "PHP", 1_000_000, "higher", "Value of sales to institutional buyers"],
      ["Active institutional buyers", "count", 12, "higher", "Buyers with at least one order this month"],
      ["Member coops supplying", "count", 25, "higher", "Member coops that delivered produce"],
      ["Gross margin", "%", 15, "higher", "(Sales - cost of produce) / sales"],
    ],
  },
  {
    code: "TRN", name: "Training & Consultancy", category: "Income", reports_to: "COO",
    mandate: "Provide training and consultancy to member cooperatives.",
    revenueTarget: 250_000, expenseRatio: 0.7, performance: 0.97,
    kpis: [
      ["Trainings conducted", "count", 6, "higher", "Training sessions delivered"],
      ["Participants trained", "count", 150, "higher", "Total participants across sessions"],
      ["Consultancy engagements", "count", 4, "higher", "Paid consultancy engagements active this month"],
      ["Participant satisfaction", "score", 4.5, "higher", "Average post-training rating (1-5)"],
    ],
  },
  {
    code: "DIG", name: "Digital Services", category: "Income", reports_to: "COO",
    mandate: "Sell and support the digital platform for production records and coop/member profiles.",
    revenueTarget: 150_000, expenseRatio: 0.9, performance: 0.84,
    kpis: [
      ["Coops subscribed to platform", "count", 40, "higher", "Paying subscriber coops"],
      ["Coop profiles completed", "%", 80, "higher", "Share of member coops with a complete profile"],
      ["Subscription renewal rate", "%", 90, "higher", "Renewals / subscriptions due"],
      ["Monthly active users", "count", 300, "higher", "Users who logged in this month"],
    ],
  },
  {
    code: "AGB", name: "Agribusiness Development", category: "Income", reports_to: "COO",
    mandate: "Provide technical advice and develop the businesses of member coops.",
    revenueTarget: 180_000, expenseRatio: 0.75, performance: 0.95,
    kpis: [
      ["Coops under business development", "count", 20, "higher", "Coops with an active development plan"],
      ["Business plans completed", "count", 3, "higher", "Business plans finished this month"],
      ["Technical advisory visits", "count", 15, "higher", "Field visits made"],
      ["Assisted coops with sales growth", "%", 60, "higher", "Assisted coops whose sales grew vs last year"],
    ],
  },
  {
    code: "CRD", name: "Credit Services", category: "Income", reports_to: "COO",
    mandate: "Provide loans to member cooperatives.",
    revenueTarget: 300_000, expenseRatio: 0.55, performance: 0.9,
    kpis: [
      ["Loan portfolio outstanding", "PHP", 15_000_000, "higher", "Total principal outstanding at month end"],
      ["Loans released", "PHP", 1_500_000, "higher", "New loans released this month"],
      ["Portfolio at risk (>30 days)", "%", 5, "lower", "Outstanding balance of loans >30 days late / total portfolio"],
      ["Repayment rate", "%", 95, "higher", "Amount collected / amount due"],
      ["Borrowing coops", "count", 30, "higher", "Coops with an active loan"],
    ],
  },
  {
    code: "HR", name: "Human Resources & Admin", category: "Support", reports_to: "CEO",
    mandate: "Recruit, develop and keep staff; run administration.",
    revenueTarget: 0, expenseRatio: 0, performance: 0.98,
    kpis: [
      ["Headcount", "count", 45, "higher", "Filled positions"],
      ["Vacant positions", "count", 3, "lower", "Approved positions not yet filled"],
      ["Staff turnover (annualised)", "%", 10, "lower", "Separations in last 12 months / average headcount"],
      ["Training hours per staff", "hours", 4, "higher", "Learning hours per staff this month"],
    ],
  },
  {
    code: "ACC", name: "Accounting & Finance", category: "Support", reports_to: "CEO",
    mandate: "Process all financial transactions and produce financial reports.",
    revenueTarget: 0, expenseRatio: 0, performance: 0.93,
    kpis: [
      ["Days to close the books", "days", 10, "lower", "Working days after month end to close"],
      ["Cash on hand and in bank", "PHP", 5_000_000, "higher", "Total cash position at month end"],
      ["Overdue payables", "PHP", 100_000, "lower", "Payables past due date"],
      ["Reports submitted on time", "%", 100, "higher", "Required reports filed by deadline"],
    ],
  },
  {
    code: "KM", name: "Knowledge Management", category: "Support", reports_to: "CEO",
    mandate: "Store, disseminate, monitor and analyse information.",
    revenueTarget: 0, expenseRatio: 0, performance: 1.0,
    kpis: [
      ["Knowledge products published", "count", 2, "higher", "Guides, bulletins, briefs and other products published this month", "km.products_published"],
      ["Information requests answered", "count", 2, "higher", "Requests from units, member coops and partners answered this month", "km.requests_served"],
      ["People reached with knowledge products", "count", 1200, "higher", "Total reach of all dissemination activities this month", "km.people_reached"],
      ["Average days to answer a request", "days", 5, "lower", "From request received to answer sent", "km.request_turnaround"],
      ["Member data completeness", "%", 85, "higher", "Share of member records with birthdate, gender and contact filled", "km.member_data_completeness"],
    ],
  },
  {
    code: "MRD", name: "Member Relations & Development", category: "Support", reports_to: "CEO",
    mandate: "Monitor and evaluate members, invite new members, advocacy.",
    revenueTarget: 0, expenseRatio: 0, performance: 0.96,
    kpis: [
      ["Active member coops", "count", 60, "higher", "Coops in good standing"],
      ["New member coops", "count", 2, "higher", "Coops admitted this month"],
      ["Member retention", "%", 95, "higher", "Coops retained over the last 12 months"],
      ["Coops assessed (M&E)", "count", 10, "higher", "Coops visited or assessed this month"],
    ],
  },
  {
    code: "SHS", name: "Social & Health Services", category: "Support", reports_to: "CEO",
    mandate: "Social protection and health programs for members.",
    revenueTarget: 0, expenseRatio: 0, performance: 0.92,
    kpis: [
      ["Members enrolled in programs", "count", 500, "higher", "Members covered by social/health programs"],
      ["Assistance cases served", "count", 40, "higher", "Claims or assistance requests served"],
      ["Average days to serve a claim", "days", 7, "lower", "From request to release"],
    ],
  },
];

// Small deterministic random generator so demo data is the same on every machine.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function seed(db: DB) {
  const deptCount = (db.prepare("SELECT count(*) AS c FROM Departments").get() as any).c;
  if (deptCount === 0) {
    const insDept = db.prepare(
      "INSERT INTO Departments (code, name, category, reports_to, mandate, monthly_revenue_target, sort_order, finance_tracking) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const insKpi = db.prepare(
      "INSERT INTO KPIs (dept_id, name, unit, target, direction, description, sort_order, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    db.transaction(() => {
      DEPARTMENTS.forEach((d, i) => {
        const id = insDept.run(d.code, d.name, d.category, d.reports_to, d.mandate, d.revenueTarget, i,
          d.category === "Income" ? "revenue_expenses" : "none").lastInsertRowid;
        d.kpis.forEach((k, j) => insKpi.run(id, k[0], k[1], k[2], k[3], k[4], j, k[5] ?? null));
      });
      db.prepare("INSERT OR IGNORE INTO OrgSettings (key, value) VALUES ('coo_name', ''), ('demo_data', '0')").run();
    })();
  }

  // Demo login accounts for the executive layer (password: admin123, same as existing demo accounts).
  const hashed = bcrypt.hashSync("admin123", 10);
  const insUser = db.prepare("INSERT OR IGNORE INTO Users (name, email, password, role, dept_id) VALUES (?, ?, ?, ?, ?)");
  const smsId = (db.prepare("SELECT id FROM Departments WHERE code = 'SMS'").get() as any)?.id;
  insUser.run("Chief Executive Officer", "ceo@agricooph.com", hashed, "Executive", null);
  insUser.run("SMS Unit Head", "sms.head@agricooph.com", hashed, "Department Head", smsId ?? null);
  const kmId = (db.prepare("SELECT id FROM Departments WHERE code = 'KM'").get() as any)?.id;
  insUser.run("KM Unit Head", "km.head@agricooph.com", hashed, "Department Head", kmId ?? null);

  if (process.env.SEED_DEMO_DATA === "false") return;
  const hasEntries = (db.prepare("SELECT count(*) AS c FROM KPIEntries").get() as any).c > 0;
  if (!hasEntries) seedDemoFigures(db);
  if ((db.prepare("SELECT value FROM OrgSettings WHERE key = 'demo_data'").get() as any)?.value === "1") seedKmDemo(db);
}

// Bring databases created by earlier versions up to date.
function migrateColumns(db: DB) {
  const cols = (table: string) => (db.prepare(`PRAGMA table_info(${table})`).all() as any[]).map((c) => c.name);
  if (!cols("Departments").includes("finance_tracking")) {
    db.exec(`ALTER TABLE Departments ADD COLUMN finance_tracking TEXT NOT NULL DEFAULT 'expenses';
      UPDATE Departments SET finance_tracking = CASE category WHEN 'Income' THEN 'revenue_expenses' ELSE 'none' END;`);
  }
  if (!cols("KPIs").includes("source")) db.exec("ALTER TABLE KPIs ADD COLUMN source TEXT");

  // KM KPIs that are now calculated from KM records.
  const km = db.prepare("SELECT id FROM Departments WHERE code = 'KM'").get() as any;
  const def = DEPARTMENTS.find((d) => d.code === "KM");
  if (!km || !def) return;
  const oldNames: Record<string, string[]> = { "km.requests_served": ["Data/analysis requests served"] };
  def.kpis.forEach((k, j) => {
    const source = k[5]!;
    if (db.prepare("SELECT 1 FROM KPIs WHERE dept_id = ? AND source = ?").get(km.id, source)) return;
    const names = [k[0], ...(oldNames[source] || [])];
    const existing = db.prepare(`SELECT id FROM KPIs WHERE dept_id = ? AND name IN (${names.map(() => "?").join(",")})`).get(km.id, ...names) as any;
    if (existing) db.prepare("UPDATE KPIs SET source = ?, name = ?, description = ? WHERE id = ?").run(source, k[0], k[4], existing.id);
    else db.prepare("INSERT INTO KPIs (dept_id, name, unit, target, direction, description, sort_order, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(km.id, k[0], k[1], k[2], k[3], k[4], j, source);
  });
}

function seedDemoFigures(db: DB) {
  const rand = rng(42);
  const lastPeriod = shiftPeriod(periodOf(new Date()), -1);
  const periods = periodRange(lastPeriod, 12);
  const depts = db.prepare("SELECT * FROM Departments").all() as any[];
  const insEntry = db.prepare("INSERT OR REPLACE INTO KPIEntries (kpi_id, period, value) VALUES (?, ?, ?)");
  const insFin = db.prepare("INSERT OR REPLACE INTO DeptFinancials (dept_id, period, revenue, expenses) VALUES (?, ?, ?, ?)");
  const insUpd = db.prepare(
    "INSERT OR REPLACE INTO DeptUpdates (dept_id, period, highlights, challenges, support_needed) VALUES (?, ?, ?, ?, ?)"
  );

  db.transaction(() => {
    for (const dept of depts) {
      const def = DEPARTMENTS.find((d) => d.code === dept.code);
      if (!def) continue;
      const kpis = db.prepare("SELECT * FROM KPIs WHERE dept_id = ?").all(dept.id) as any[];
      periods.forEach((period, idx) => {
        // Social & Health has not submitted the latest month, to show a missing update.
        if (dept.code === "SHS" && idx === periods.length - 1) return;
        const trend = 0.9 + (idx / periods.length) * 0.12; // gentle improvement over the year
        for (const k of kpis) {
          if (k.source) continue; // calculated from records
          let perf = def.performance * trend * (0.92 + rand() * 0.16);
          if (k.direction === "lower") perf = 1 / perf;
          // Credit: portfolio at risk worsens in recent months, so it shows as off track.
          if (dept.code === "CRD" && k.name.startsWith("Portfolio at risk")) perf = 0.8 + idx * 0.08;
          let value = k.target * perf;
          if (k.unit === "%") value = Math.min(value, 100);
          if (k.unit === "score") value = Math.min(value, 5);
          const decimals = k.unit === "%" || k.unit === "score" ? 1 : 0;
          insEntry.run(k.id, period, Number(value.toFixed(decimals)));
        }
        const seasonal = 1 + 0.15 * Math.sin((idx / 12) * Math.PI * 2);
        const revenue = Math.round(def.revenueTarget * def.performance * trend * seasonal * (0.9 + rand() * 0.2));
        if (dept.finance_tracking === "revenue_expenses") {
          insFin.run(dept.id, period, revenue, Math.round(revenue * def.expenseRatio * (0.95 + rand() * 0.1)));
        }
        if (idx === periods.length - 1) {
          insUpd.run(dept.id, period, "Demo: key activities completed this month.", "Demo: main challenge this month.", "");
        }
      });
    }

    const id = (code: string) => depts.find((d) => d.code === code)?.id;
    const today = new Date();
    const day = (offset: number) => new Date(today.getTime() + offset * 86400000).toISOString().slice(0, 10);
    const insIssue = db.prepare(
      "INSERT INTO Issues (dept_id, title, description, severity, status, owner, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    insIssue.run(id("CRD"), "Rising late payments from 3 borrower coops", "Portfolio at risk above 5% for two months.", "Critical", "Open", "Credit Unit Head", day(7));
    insIssue.run(id("DIG"), "Platform renewals below target", "Several coops did not renew after the free period.", "High", "In Progress", "Digital Unit Head", day(-3));
    insIssue.run(id("HR"), "Vacant IT specialist position", "Affects platform support.", "Medium", "Open", "HR Officer", day(14));
    insIssue.run(id("SMS"), "Need cold storage for vegetables", "Losses on highland vegetables during transport.", "High", "Open", "SMS Unit Head", day(21));

    db.prepare(
      "INSERT INTO Decisions (dept_id, date, title, decision, evidence, expected_result, review_date) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
      id("CRD"), day(-10), "Tighten loan approval for new borrowers",
      "Require 6 months of SMS delivery records before releasing a new loan.",
      "Portfolio at risk rose from 4% to above 7% over the last quarter; most late accounts are first-time borrowers.",
      "Portfolio at risk back under 5% within 3 months.", day(80)
    );
    db.prepare("INSERT OR REPLACE INTO OrgSettings (key, value) VALUES ('demo_data', '1')").run();
  })();
}

export function initExecutive(db: DB) {
  migrateUsers(db);
  createTables(db);
  initKmSchema(db);
  migrateColumns(db);
  seed(db);
}

// ---------- Queries ----------
function getSettings(db: DB) {
  const rows = db.prepare("SELECT key, value FROM OrgSettings").all() as any[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function latestPeriod(db: DB) {
  const row = db.prepare(
    "SELECT max(period) AS p FROM (SELECT period FROM KPIEntries UNION SELECT period FROM DeptFinancials)"
  ).get() as any;
  return row?.p || shiftPeriod(periodOf(new Date()), -1);
}

function deptSummary(db: DB, dept: any, period: string) {
  const kpis = db.prepare(
    `SELECT k.*, e.value, e.note, p.value AS prev_value
       FROM KPIs k
       LEFT JOIN KPIEntries e ON e.kpi_id = k.id AND e.period = ?
       LEFT JOIN KPIEntries p ON p.kpi_id = k.id AND p.period = ?
      WHERE k.dept_id = ? AND k.active = 1
      ORDER BY k.sort_order, k.id`
  ).all(period, shiftPeriod(period, -1), dept.id) as any[];

  // KPIs with a source are calculated from records when nobody typed a value.
  const withStatus = kpis.map((k) => {
    let value = k.value;
    let prev = k.prev_value;
    let auto = false;
    if (k.source) {
      if (value === null) { value = kmKpiValue(db, k.source, period); auto = value !== null; }
      if (prev === null) prev = kmKpiValue(db, k.source, shiftPeriod(period, -1));
    }
    return { ...k, value, prev_value: prev, auto, manual: k.value !== null, status: kpiStatus(value, k.target, k.direction) };
  });
  const reported = withStatus.filter((k) => k.status !== "no-data");
  const tracking = dept.finance_tracking || "expenses";
  const fin = tracking === "none" ? null
    : db.prepare("SELECT revenue, expenses FROM DeptFinancials WHERE dept_id = ? AND period = ?").get(dept.id, period) as any;
  const update = db.prepare("SELECT submitted_at FROM DeptUpdates WHERE dept_id = ? AND period = ?").get(dept.id, period) as any;

  let status: Status | "no-update" = "no-update";
  if (reported.length > 0) {
    status = reported.reduce<Status>((w, k) => (STATUS_RANK[k.status as Status] > STATUS_RANK[w] ? k.status : w), "on-track");
  }
  const counts = { "on-track": 0, "at-risk": 0, "off-track": 0, "no-data": 0 } as Record<Status, number>;
  withStatus.forEach((k) => counts[k.status as Status]++);
  const openIssues = (db.prepare("SELECT count(*) AS c FROM Issues WHERE dept_id = ? AND status != 'Resolved'").get(dept.id) as any).c;

  return {
    ...dept,
    status,
    kpiCounts: counts,
    kpiTotal: withStatus.length,
    kpis: withStatus,
    revenue: tracking === "revenue_expenses" ? fin?.revenue ?? null : null,
    expenses: fin?.expenses ?? null,
    submitted: withStatus.some((k) => k.manual) || !!fin || !!update,
    narrativeSubmitted: !!update,
    openIssues,
  };
}

function formatNum(v: number, unit: string) {
  if (unit === "PHP") return `₱${Math.round(v).toLocaleString("en-PH")}`;
  if (unit === "%") return `${v}%`;
  return `${v.toLocaleString("en-PH")}${unit === "count" ? "" : " " + unit}`;
}

// ---------- Routes ----------
export function registerExecutiveRoutes(app: Express, db: DB, auth: RequestHandler) {
  const requireExec: RequestHandler = (req: any, res, next) => {
    if (!isExec(req.user)) return res.status(403).json({ error: "Executive access only." });
    next();
  };
  const canEditDept = (user: any, deptId: number) =>
    isExec(user) || (user?.role === "Department Head" && Number(user.dept_id) === Number(deptId));
  const log = (userId: number, action: string) =>
    db.prepare("INSERT INTO AuditLogs (user_id, action) VALUES (?, ?)").run(userId, action);
  const allDepts = () => db.prepare("SELECT * FROM Departments ORDER BY category, sort_order").all() as any[];

  // CEO command center
  app.get("/api/exec/overview", auth, requireExec, (req: any, res) => {
    const period = isPeriod(req.query.period) ? req.query.period : latestPeriod(db);
    const settings = getSettings(db);
    const depts = allDepts().map((d) => deptSummary(db, d, period));
    const income = depts.filter((d) => d.category === "Income");

    const sum = (rows: any[], key: string) => rows.reduce((s, r) => s + (r[key] || 0), 0);
    const year = period.slice(0, 4);
    const ytd = db.prepare(
      `SELECT coalesce(sum(f.revenue),0) AS revenue, coalesce(sum(f.expenses),0) AS expenses
         FROM DeptFinancials f JOIN Departments d ON d.id = f.dept_id
        WHERE d.finance_tracking != 'none' AND f.period BETWEEN ? AND ?`
    ).get(`${year}-01`, period) as any;
    const monthsElapsed = Number(period.slice(5, 7));
    const prev = db.prepare(
      "SELECT coalesce(sum(f.revenue),0) AS r FROM DeptFinancials f JOIN Departments d ON d.id = f.dept_id WHERE d.finance_tracking != 'none' AND f.period = ?"
    ).get(shiftPeriod(period, -1)) as any;

    const trendPeriods = periodRange(period, 12);
    const finRows = db.prepare(
      `SELECT d.code, f.period, f.revenue, f.expenses FROM DeptFinancials f JOIN Departments d ON d.id = f.dept_id
        WHERE d.finance_tracking != 'none' AND f.period BETWEEN ? AND ?`
    ).all(trendPeriods[0], period) as any[];
    const revenueTrend = trendPeriods.map((p) => {
      const row: any = { period: p, expenses: 0, revenue: 0 };
      for (const d of income) row[d.code] = 0;
      for (const f of finRows.filter((r) => r.period === p)) {
        if (f.code in row) row[f.code] = f.revenue;
        row.revenue += f.revenue;
        row.expenses += f.expenses;
      }
      row.net = row.revenue - row.expenses;
      return row;
    });

    // Things that need the CEO's attention, most severe first.
    const attention: any[] = [];
    const today = new Date().toISOString().slice(0, 10);
    for (const d of depts) {
      if (!d.submitted) {
        attention.push({ level: "serious", dept_id: d.id, dept: d.name, text: `No ${period} update submitted yet.` });
      }
      for (const k of d.kpis.filter((k: any) => k.status === "off-track")) {
        const sign = k.direction === "lower" ? "≤" : "";
        attention.push({
          level: "critical", dept_id: d.id, dept: d.name,
          text: `${k.name}: ${formatNum(k.value, k.unit)} vs target ${sign}${formatNum(k.target, k.unit)}`,
        });
      }
      if (d.category === "Income" && d.monthly_revenue_target > 0 && d.revenue !== null && d.revenue < d.monthly_revenue_target * 0.8) {
        attention.push({
          level: "serious", dept_id: d.id, dept: d.name,
          text: `Revenue ${formatNum(d.revenue, "PHP")} is below 80% of the ${formatNum(d.monthly_revenue_target, "PHP")} target.`,
        });
      }
    }
    const issues = db.prepare(
      `SELECT i.*, d.name AS dept_name FROM Issues i LEFT JOIN Departments d ON d.id = i.dept_id
        WHERE i.status != 'Resolved' AND (i.severity = 'Critical' OR (i.due_date IS NOT NULL AND i.due_date < ?))`
    ).all(today) as any[];
    for (const i of issues) {
      const overdue = i.due_date && i.due_date < today;
      attention.push({
        level: i.severity === "Critical" ? "critical" : "serious", dept_id: i.dept_id, dept: i.dept_name || "Federation",
        text: `${overdue ? "Overdue issue" : "Critical issue"}: ${i.title}`, issue_id: i.id,
      });
    }
    const rank: any = { critical: 0, serious: 1, warning: 2 };
    attention.sort((a, b) => rank[a.level] - rank[b.level]);

    const issueCounts = db.prepare(
      "SELECT severity, count(*) AS c FROM Issues WHERE status != 'Resolved' GROUP BY severity"
    ).all() as any[];
    const periods = (db.prepare("SELECT DISTINCT period FROM DeptFinancials UNION SELECT DISTINCT period FROM KPIEntries ORDER BY 1 DESC").all() as any[]).map((r) => r.period);

    res.json({
      period,
      periods,
      settings,
      totals: {
        revenue: sum(depts, "revenue"),
        expenses: sum(depts, "expenses"),
        revenueTarget: sum(income, "monthly_revenue_target"),
        prevRevenue: prev.r,
        ytdRevenue: ytd.revenue,
        ytdExpenses: ytd.expenses,
        ytdRevenueTarget: sum(income, "monthly_revenue_target") * monthsElapsed,
        submitted: depts.filter((d) => d.submitted).length,
        departments: depts.length,
      },
      departments: depts.map(({ kpis, ...d }) => d),
      revenueTrend,
      incomeCodes: income.map((d) => ({ code: d.code, name: d.name })),
      attention,
      issueCounts: Object.fromEntries(issueCounts.map((r) => [r.severity, r.c])),
    });
  });

  // Department list (department heads see only their own)
  app.get("/api/exec/departments", auth, (req: any, res) => {
    const period = isPeriod(req.query.period) ? req.query.period : latestPeriod(db);
    let depts = allDepts();
    if (!isExec(req.user)) {
      if (req.user.role !== "Department Head") return res.status(403).json({ error: "Not allowed." });
      depts = depts.filter((d) => d.id === Number(req.user.dept_id));
    }
    res.json({ period, settings: getSettings(db), departments: depts.map((d) => {
      const { kpis, ...rest } = deptSummary(db, d, period);
      return rest;
    }) });
  });

  // Department detail
  app.get("/api/exec/departments/:id", auth, (req: any, res) => {
    const dept = db.prepare("SELECT * FROM Departments WHERE id = ?").get(req.params.id) as any;
    if (!dept) return res.status(404).json({ error: "Department not found." });
    if (!canEditDept(req.user, dept.id)) return res.status(403).json({ error: "Not allowed." });

    const period = isPeriod(req.query.period) ? req.query.period : latestPeriod(db);
    const range = periodRange(period, 12);
    const summary = deptSummary(db, dept, period);
    const history = db.prepare(
      `SELECT e.kpi_id, e.period, e.value FROM KPIEntries e JOIN KPIs k ON k.id = e.kpi_id
        WHERE k.dept_id = ? AND e.period BETWEEN ? AND ? ORDER BY e.period`
    ).all(dept.id, range[0], period) as any[];
    const kpis = summary.kpis.map((k: any) => ({
      ...k,
      history: range.map((p) => ({
        period: p,
        value: history.find((h) => h.kpi_id === k.id && h.period === p)?.value ?? (k.source ? kmKpiValue(db, k.source, p) : null),
      })),
    }));
    const finRows = db.prepare("SELECT * FROM DeptFinancials WHERE dept_id = ? AND period BETWEEN ? AND ?").all(dept.id, range[0], period) as any[];
    const financials = range.map((p) => {
      const f = finRows.find((r) => r.period === p);
      return { period: p, revenue: f?.revenue ?? null, expenses: f?.expenses ?? null };
    });
    const narrative = db.prepare("SELECT * FROM DeptUpdates WHERE dept_id = ? AND period = ?").get(dept.id, period) || null;
    const issues = db.prepare("SELECT * FROM Issues WHERE dept_id = ? ORDER BY status = 'Resolved', created_at DESC").all(dept.id);
    const decisions = db.prepare("SELECT * FROM Decisions WHERE dept_id = ? ORDER BY date DESC").all(dept.id);

    res.json({ period, settings: getSettings(db), department: { ...summary, kpis }, financials, narrative, issues, decisions });
  });

  // Edit department profile (executive only)
  app.put("/api/exec/departments/:id", auth, requireExec, (req: any, res) => {
    const { head_name, mandate, monthly_revenue_target, reports_to, category, finance_tracking } = req.body;
    if (reports_to && !["CEO", "COO"].includes(reports_to)) return res.status(400).json({ error: "Invalid reporting line." });
    if (finance_tracking && !["revenue_expenses", "expenses", "none"].includes(finance_tracking)) return res.status(400).json({ error: "Invalid finance setting." });
    if (category && !["Income", "Support"].includes(category)) return res.status(400).json({ error: "Invalid category." });
    db.prepare(
      `UPDATE Departments SET head_name = coalesce(?, head_name), mandate = coalesce(?, mandate),
         monthly_revenue_target = coalesce(?, monthly_revenue_target), reports_to = coalesce(?, reports_to),
         category = coalesce(?, category), finance_tracking = coalesce(?, finance_tracking) WHERE id = ?`
    ).run(head_name ?? null, mandate ?? null, monthly_revenue_target ?? null, reports_to ?? null, category ?? null, finance_tracking ?? null, req.params.id);
    log(req.user.id, `Updated department ${req.params.id}`);
    res.json({ ok: true });
  });

  // Monthly update: KPI values, revenue/expenses and narrative, saved together.
  app.post("/api/exec/departments/:id/update", auth, (req: any, res) => {
    const deptId = Number(req.params.id);
    if (!canEditDept(req.user, deptId)) return res.status(403).json({ error: "Not allowed." });
    const { period, kpis = [], revenue, expenses, highlights, challenges, support_needed } = req.body;
    if (!isPeriod(period)) return res.status(400).json({ error: "Period must be YYYY-MM." });
    const dept = db.prepare("SELECT finance_tracking FROM Departments WHERE id = ?").get(deptId) as any;
    if (!dept) return res.status(404).json({ error: "Department not found." });

    const validKpi = db.prepare("SELECT id FROM KPIs WHERE id = ? AND dept_id = ?");
    const upsertEntry = db.prepare(
      `INSERT INTO KPIEntries (kpi_id, period, value, note, entered_by, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(kpi_id, period) DO UPDATE SET value = excluded.value, note = excluded.note,
         entered_by = excluded.entered_by, updated_at = CURRENT_TIMESTAMP`
    );
    const deleteEntry = db.prepare("DELETE FROM KPIEntries WHERE kpi_id = ? AND period = ?");
    try {
      db.transaction(() => {
        for (const k of kpis) {
          if (!validKpi.get(k.kpi_id, deptId)) throw new Error(`KPI ${k.kpi_id} is not in this department.`);
          if (k.value === null || k.value === "" || k.value === undefined) deleteEntry.run(k.kpi_id, period);
          else {
            const v = Number(k.value);
            if (!Number.isFinite(v)) throw new Error("KPI values must be numbers.");
            upsertEntry.run(k.kpi_id, period, v, k.note || null, req.user.id);
          }
        }
        const hasMoney = (revenue !== undefined && revenue !== "") || (expenses !== undefined && expenses !== "");
        if (dept.finance_tracking !== "none" && hasMoney) {
          db.prepare(
            `INSERT INTO DeptFinancials (dept_id, period, revenue, expenses) VALUES (?, ?, ?, ?)
             ON CONFLICT(dept_id, period) DO UPDATE SET revenue = excluded.revenue, expenses = excluded.expenses, updated_at = CURRENT_TIMESTAMP`
          ).run(deptId, period, dept.finance_tracking === "revenue_expenses" ? Number(revenue) || 0 : 0, Number(expenses) || 0);
        }
        if (highlights || challenges || support_needed) {
          db.prepare(
            `INSERT INTO DeptUpdates (dept_id, period, highlights, challenges, support_needed, submitted_by) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(dept_id, period) DO UPDATE SET highlights = excluded.highlights, challenges = excluded.challenges,
               support_needed = excluded.support_needed, submitted_by = excluded.submitted_by, submitted_at = CURRENT_TIMESTAMP`
          ).run(deptId, period, highlights || null, challenges || null, support_needed || null, req.user.id);
        }
      })();
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
    log(req.user.id, `Submitted ${period} update for department ${deptId}`);
    res.json({ ok: true });
  });

  // KPI definitions (executive sets targets)
  app.post("/api/exec/departments/:id/kpis", auth, requireExec, (req: any, res) => {
    const { name, unit, target, direction, description } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required." });
    const order = (db.prepare("SELECT coalesce(max(sort_order), -1) + 1 AS o FROM KPIs WHERE dept_id = ?").get(req.params.id) as any).o;
    const info = db.prepare(
      "INSERT INTO KPIs (dept_id, name, unit, target, direction, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(req.params.id, name, unit || "count", target === "" || target == null ? null : Number(target), direction === "lower" ? "lower" : "higher", description || null, order);
    log(req.user.id, `Added KPI ${info.lastInsertRowid}`);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/exec/kpis/:id", auth, requireExec, (req: any, res) => {
    const { name, unit, target, direction, description, active } = req.body;
    db.prepare(
      `UPDATE KPIs SET name = coalesce(?, name), unit = coalesce(?, unit), target = ?, direction = coalesce(?, direction),
         description = coalesce(?, description), active = coalesce(?, active) WHERE id = ?`
    ).run(name ?? null, unit ?? null, target === "" || target == null ? null : Number(target),
      direction ?? null, description ?? null, active === undefined ? null : active ? 1 : 0, req.params.id);
    log(req.user.id, `Updated KPI ${req.params.id}`);
    res.json({ ok: true });
  });

  // Issues / escalations
  app.get("/api/exec/issues", auth, (req: any, res) => {
    const where: string[] = [];
    const params: any[] = [];
    if (!isExec(req.user)) {
      if (req.user.role !== "Department Head") return res.status(403).json({ error: "Not allowed." });
      where.push("i.dept_id = ?");
      params.push(req.user.dept_id);
    }
    const rows = db.prepare(
      `SELECT i.*, d.name AS dept_name, d.code AS dept_code FROM Issues i LEFT JOIN Departments d ON d.id = i.dept_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY i.status = 'Resolved', CASE i.severity WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END, i.due_date`
    ).all(...params);
    res.json(rows);
  });

  app.post("/api/exec/issues", auth, (req: any, res) => {
    const { dept_id, title, description, severity, owner, due_date } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required." });
    const dept = dept_id ? Number(dept_id) : null;
    if (!isExec(req.user) && !(dept && canEditDept(req.user, dept))) return res.status(403).json({ error: "Not allowed." });
    const info = db.prepare(
      "INSERT INTO Issues (dept_id, title, description, severity, owner, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(dept, title, description || null, ["Low", "Medium", "High", "Critical"].includes(severity) ? severity : "Medium", owner || null, due_date || null, req.user.id);
    log(req.user.id, `Raised issue ${info.lastInsertRowid}`);
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/exec/issues/:id", auth, (req: any, res) => {
    const issue = db.prepare("SELECT * FROM Issues WHERE id = ?").get(req.params.id) as any;
    if (!issue) return res.status(404).json({ error: "Issue not found." });
    if (!isExec(req.user) && !(issue.dept_id && canEditDept(req.user, issue.dept_id))) return res.status(403).json({ error: "Not allowed." });
    const { status, severity, owner, due_date } = req.body;
    if (status && !["Open", "In Progress", "Resolved"].includes(status)) return res.status(400).json({ error: "Invalid status." });
    if (severity && !["Low", "Medium", "High", "Critical"].includes(severity)) return res.status(400).json({ error: "Invalid severity." });
    db.prepare(
      `UPDATE Issues SET status = coalesce(?, status), severity = coalesce(?, severity), owner = coalesce(?, owner),
         due_date = coalesce(?, due_date),
         resolved_at = CASE WHEN ? = 'Resolved' THEN CURRENT_TIMESTAMP WHEN ? IS NOT NULL THEN NULL ELSE resolved_at END
       WHERE id = ?`
    ).run(status ?? null, severity ?? null, owner ?? null, due_date ?? null, status ?? null, status ?? null, req.params.id);
    log(req.user.id, `Updated issue ${req.params.id}`);
    res.json({ ok: true });
  });

  // Decision log: what was decided, on what evidence, and whether it worked.
  app.get("/api/exec/decisions", auth, requireExec, (_req, res) => {
    res.json(db.prepare(
      `SELECT x.*, d.name AS dept_name FROM Decisions x LEFT JOIN Departments d ON d.id = x.dept_id ORDER BY x.date DESC, x.id DESC`
    ).all());
  });

  app.post("/api/exec/decisions", auth, requireExec, (req: any, res) => {
    const { dept_id, date, title, decision, evidence, expected_result, review_date } = req.body;
    if (!title || !decision || !date) return res.status(400).json({ error: "Date, title and decision are required." });
    const info = db.prepare(
      `INSERT INTO Decisions (dept_id, date, title, decision, evidence, expected_result, review_date, decided_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(dept_id || null, date, title, decision, evidence || null, expected_result || null, review_date || null, req.user.id);
    log(req.user.id, `Logged decision ${info.lastInsertRowid}`);
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/exec/decisions/:id", auth, requireExec, (req: any, res) => {
    db.prepare("UPDATE Decisions SET outcome = ? WHERE id = ?").run(req.body.outcome ?? null, req.params.id);
    log(req.user.id, `Recorded outcome for decision ${req.params.id}`);
    res.json({ ok: true });
  });

  // Org settings (e.g. COO name; empty = vacant)
  app.put("/api/exec/settings", auth, requireExec, (req: any, res) => {
    const allowed = ["coo_name"];
    const ins = db.prepare("INSERT INTO OrgSettings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    for (const k of allowed) if (k in req.body) ins.run(k, String(req.body[k] ?? ""));
    log(req.user.id, "Updated org settings");
    res.json(getSettings(db));
  });
}
