import type Database from 'better-sqlite3';
import type {
  ActivityEvent,
  Approval,
  AvatarConfig,
  DepartmentId,
  Employee,
  EmployeeState,
  Project,
  Report,
  ReportSummary,
  Task,
} from '../../src/shared/workforce';

// Persistence layer for the AI workforce: employees, projects, tasks,
// approvals, activity events and published reports.

export function initWorkforceSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS AgentEmployees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      department TEXT NOT NULL,
      avatar TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'IDLE',
      state_detail TEXT,
      current_task_id INTEGER,
      target_employee_id INTEGER,
      on_duty INTEGER NOT NULL DEFAULT 1,
      state_since DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS AgentProjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS AgentTasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      instructions TEXT,
      department TEXT NOT NULL,
      preferred_employee TEXT,
      assignee_id INTEGER,
      status TEXT NOT NULL DEFAULT 'queued',
      depends_on TEXT NOT NULL DEFAULT '[]',
      step_index INTEGER NOT NULL DEFAULT 0,
      step_count INTEGER NOT NULL DEFAULT 0,
      step_label TEXT,
      context TEXT NOT NULL DEFAULT '{}',
      output TEXT,
      error TEXT,
      requires_approval INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME,
      completed_at DATETIME,
      FOREIGN KEY(project_id) REFERENCES AgentProjects(id)
    );

    CREATE TABLE IF NOT EXISTS AgentApprovals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      step_key TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      decided_by TEXT,
      decision_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      decided_at DATETIME,
      FOREIGN KEY(task_id) REFERENCES AgentTasks(id)
    );

    CREATE TABLE IF NOT EXISTS AgentEvents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      task_id INTEGER,
      type TEXT NOT NULL,
      state TEXT,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS AgentReports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      title TEXT NOT NULL,
      markdown TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      approved_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seedRoster(db);
}

interface RosterEntry {
  code: string;
  name: string;
  title: string;
  department: DepartmentId;
  avatar: AvatarConfig;
}

const ROSTER: RosterEntry[] = [
  { code: 'exec-lead', name: 'Amihan Reyes', title: 'Chief of Staff', department: 'executive',
    avatar: { skin: '#c68a5e', hair: '#1f1a17', hairStyle: 'bun', shirt: '#4f46e5', pants: '#1e293b', accessory: 'none' } },
  { code: 'exec-pm', name: 'Dado Santos', title: 'Project Coordinator', department: 'executive',
    avatar: { skin: '#b97a4f', hair: '#2b2118', hairStyle: 'short', shirt: '#818cf8', pants: '#334155', accessory: 'headset' } },
  { code: 'mem-lead', name: 'Liza Mercado', title: 'Membership Officer', department: 'membership',
    avatar: { skin: '#d9a47a', hair: '#3b2a20', hairStyle: 'long', shirt: '#059669', pants: '#1f2937', accessory: 'none' } },
  { code: 'mem-rec', name: 'Paolo Villanueva', title: 'Member Records Specialist', department: 'membership',
    avatar: { skin: '#a8714a', hair: '#141414', hairStyle: 'buzz', shirt: '#34d399', pants: '#374151', accessory: 'glasses' } },
  { code: 'coop-lead', name: 'Ramon Bautista', title: 'Cooperative Development Specialist', department: 'coop_dev',
    avatar: { skin: '#9c6644', hair: '#262626', hairStyle: 'short', shirt: '#d97706', pants: '#292524', accessory: 'none' } },
  { code: 'coop-field', name: 'Tess Navarro', title: 'Field Liaison', department: 'coop_dev',
    avatar: { skin: '#e0b48c', hair: '#5a3825', hairStyle: 'curly', shirt: '#fbbf24', pants: '#44403c', accessory: 'none' } },
  { code: 'mne-lead', name: 'Grace Lim', title: 'M&E Officer', department: 'mne',
    avatar: { skin: '#f0c9a0', hair: '#0f0f0f', hairStyle: 'long', shirt: '#0284c7', pants: '#1e293b', accessory: 'glasses' } },
  { code: 'mne-comp', name: 'Nonoy Aquino', title: 'Compliance Analyst', department: 'mne',
    avatar: { skin: '#b5835a', hair: '#1c1c1c', hairStyle: 'short', shirt: '#38bdf8', pants: '#0f172a', accessory: 'none' } },
  { code: 'data-lead', name: 'Bea Castillo', title: 'Data Analyst', department: 'data',
    avatar: { skin: '#cf9a6e', hair: '#4a2c1d', hairStyle: 'bun', shirt: '#9333ea', pants: '#1f2937', accessory: 'glasses' } },
  { code: 'data-eng', name: 'Migs Flores', title: 'Data Engineer', department: 'data',
    avatar: { skin: '#a0694a', hair: '#111111', hairStyle: 'curly', shirt: '#c084fc', pants: '#312e81', accessory: 'headset' } },
  { code: 'tech-lead', name: 'Kai Domingo', title: 'Systems Engineer', department: 'tech',
    avatar: { skin: '#c48b62', hair: '#222222', hairStyle: 'buzz', shirt: '#dc2626', pants: '#111827', accessory: 'headset' } },
  { code: 'tech-doc', name: 'Rina Torres', title: 'Technical Writer', department: 'tech',
    avatar: { skin: '#e3b088', hair: '#6b3e26', hairStyle: 'long', shirt: '#f87171', pants: '#374151', accessory: 'none' } },
];

function seedRoster(db: Database.Database) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO AgentEmployees (code, name, title, department, avatar) VALUES (?, ?, ?, ?, ?)`,
  );
  for (const r of ROSTER) insert.run(r.code, r.name, r.title, r.department, JSON.stringify(r.avatar));
}

// ---- Row mappers -------------------------------------------------------------

export function toEmployee(row: any): Employee {
  return { ...row, avatar: JSON.parse(row.avatar) };
}

export function toTask(row: any): Task {
  const { context: _context, ...rest } = row;
  return { ...rest, depends_on: JSON.parse(row.depends_on || '[]') };
}

export class WorkforceStore {
  constructor(private db: Database.Database) {}

  employees(): Employee[] {
    return this.db.prepare('SELECT * FROM AgentEmployees ORDER BY id').all().map(toEmployee);
  }

  employee(id: number): Employee | undefined {
    const row = this.db.prepare('SELECT * FROM AgentEmployees WHERE id = ?').get(id);
    return row ? toEmployee(row) : undefined;
  }

  updateEmployee(id: number, patch: Partial<Omit<Employee, 'id' | 'avatar'>>, touchState = false): Employee {
    const keys = Object.keys(patch);
    if (keys.length) {
      const sets = keys.map((k) => `${k} = @${k}`);
      if (touchState) sets.push('state_since = CURRENT_TIMESTAMP');
      this.db.prepare(`UPDATE AgentEmployees SET ${sets.join(', ')} WHERE id = @id`).run({ ...patch, id });
    }
    return this.employee(id)!;
  }

  tasks(limit = 150): Task[] {
    return this.db.prepare('SELECT * FROM AgentTasks ORDER BY id DESC LIMIT ?').all(limit).map(toTask);
  }

  task(id: number): Task | undefined {
    const row = this.db.prepare('SELECT * FROM AgentTasks WHERE id = ?').get(id);
    return row ? toTask(row) : undefined;
  }

  taskContext(id: number): Record<string, any> {
    const row = this.db.prepare('SELECT context FROM AgentTasks WHERE id = ?').get(id) as { context: string } | undefined;
    return row ? JSON.parse(row.context) : {};
  }

  saveTaskContext(id: number, ctx: Record<string, any>) {
    this.db.prepare('UPDATE AgentTasks SET context = ? WHERE id = ?').run(JSON.stringify(ctx), id);
  }

  tasksWithStatus(...statuses: string[]): Task[] {
    const q = statuses.map(() => '?').join(',');
    return this.db.prepare(`SELECT * FROM AgentTasks WHERE status IN (${q}) ORDER BY id`).all(...statuses).map(toTask);
  }

  insertTask(t: {
    project_id: number | null; kind: string; title: string; instructions?: string | null;
    department: DepartmentId; preferred_employee?: string | null; depends_on?: number[];
    step_count: number; requires_approval?: boolean;
  }): Task {
    const info = this.db.prepare(
      `INSERT INTO AgentTasks (project_id, kind, title, instructions, department, preferred_employee, depends_on, step_count, requires_approval)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      t.project_id, t.kind, t.title, t.instructions ?? null, t.department, t.preferred_employee ?? null,
      JSON.stringify(t.depends_on ?? []), t.step_count, t.requires_approval ? 1 : 0,
    );
    return this.task(Number(info.lastInsertRowid))!;
  }

  updateTask(id: number, patch: Record<string, any>): Task {
    const keys = Object.keys(patch);
    if (keys.length) {
      const sets = keys.map((k) => (patch[k] === 'CURRENT_TIMESTAMP' ? `${k} = CURRENT_TIMESTAMP` : `${k} = @${k}`));
      const params = Object.fromEntries(keys.filter((k) => patch[k] !== 'CURRENT_TIMESTAMP').map((k) => [k, patch[k]]));
      this.db.prepare(`UPDATE AgentTasks SET ${sets.join(', ')} WHERE id = @id`).run({ ...params, id });
    }
    return this.task(id)!;
  }

  projects(limit = 30): Project[] {
    return this.db.prepare('SELECT * FROM AgentProjects ORDER BY id DESC LIMIT ?').all(limit) as Project[];
  }

  project(id: number): Project | undefined {
    return this.db.prepare('SELECT * FROM AgentProjects WHERE id = ?').get(id) as Project | undefined;
  }

  insertProject(kind: string, title: string, createdBy: string | null): Project {
    const info = this.db.prepare('INSERT INTO AgentProjects (kind, title, created_by) VALUES (?, ?, ?)').run(kind, title, createdBy);
    return this.project(Number(info.lastInsertRowid))!;
  }

  updateProject(id: number, status: Project['status']): Project {
    this.db.prepare(
      `UPDATE AgentProjects SET status = ?, completed_at = CASE WHEN ? = 'running' THEN NULL ELSE CURRENT_TIMESTAMP END WHERE id = ?`,
    ).run(status, status, id);
    return this.project(id)!;
  }

  projectTasks(projectId: number): Task[] {
    return this.db.prepare('SELECT * FROM AgentTasks WHERE project_id = ? ORDER BY id').all(projectId).map(toTask);
  }

  approvals(limit = 60): Approval[] {
    return this.db.prepare(
      `SELECT * FROM AgentApprovals ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, id DESC LIMIT ?`,
    ).all(limit) as Approval[];
  }

  approval(id: number): (Approval & { step_key: string }) | undefined {
    return this.db.prepare('SELECT * FROM AgentApprovals WHERE id = ?').get(id) as any;
  }

  insertApproval(a: { task_id: number; employee_id: number; step_key: string; title: string; summary: string; details?: string }): Approval {
    const info = this.db.prepare(
      'INSERT INTO AgentApprovals (task_id, employee_id, step_key, title, summary, details) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(a.task_id, a.employee_id, a.step_key, a.title, a.summary, a.details ?? null);
    return this.approval(Number(info.lastInsertRowid))!;
  }

  decideApproval(id: number, status: 'approved' | 'rejected', by: string, note: string | null): Approval {
    this.db.prepare(
      `UPDATE AgentApprovals SET status = ?, decided_by = ?, decision_note = ?, decided_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`,
    ).run(status, by, note, id);
    return this.approval(id)!;
  }

  pendingApprovalsForTask(taskId: number): Approval[] {
    return this.db.prepare(`SELECT * FROM AgentApprovals WHERE task_id = ? AND status = 'pending'`).all(taskId) as Approval[];
  }

  activity(limit = 80): ActivityEvent[] {
    return (this.db.prepare('SELECT * FROM AgentEvents ORDER BY id DESC LIMIT ?').all(limit) as ActivityEvent[]).reverse();
  }

  taskActivity(taskId: number): ActivityEvent[] {
    return this.db.prepare('SELECT * FROM AgentEvents WHERE task_id = ? ORDER BY id').all(taskId) as ActivityEvent[];
  }

  insertActivity(e: { employee_id: number | null; task_id: number | null; type: string; state: EmployeeState | null; message: string }): ActivityEvent {
    const info = this.db.prepare(
      'INSERT INTO AgentEvents (employee_id, task_id, type, state, message) VALUES (?, ?, ?, ?, ?)',
    ).run(e.employee_id, e.task_id, e.type, e.state, e.message);
    return this.db.prepare('SELECT * FROM AgentEvents WHERE id = ?').get(info.lastInsertRowid) as ActivityEvent;
  }

  reports(): ReportSummary[] {
    return this.db.prepare(
      'SELECT id, project_id, title, status, approved_by, created_at FROM AgentReports ORDER BY id DESC LIMIT 30',
    ).all() as ReportSummary[];
  }

  report(id: number): Report | undefined {
    return this.db.prepare('SELECT * FROM AgentReports WHERE id = ?').get(id) as Report | undefined;
  }

  upsertProjectReport(projectId: number | null, title: string, markdown: string, status: 'draft' | 'published', approvedBy: string | null): ReportSummary {
    const existing = projectId != null
      ? (this.db.prepare('SELECT id FROM AgentReports WHERE project_id = ?').get(projectId) as { id: number } | undefined)
      : undefined;
    let id: number;
    if (existing) {
      this.db.prepare('UPDATE AgentReports SET title = ?, markdown = ?, status = ?, approved_by = ? WHERE id = ?')
        .run(title, markdown, status, approvedBy, existing.id);
      id = existing.id;
    } else {
      const info = this.db.prepare('INSERT INTO AgentReports (project_id, title, markdown, status, approved_by) VALUES (?, ?, ?, ?, ?)')
        .run(projectId, title, markdown, status, approvedBy);
      id = Number(info.lastInsertRowid);
    }
    const { markdown: _m, ...summary } = this.report(id)!;
    return summary;
  }
}
