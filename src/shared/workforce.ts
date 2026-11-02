// Shared workforce model used by both the orchestration engine (server) and the
// virtual office (client). Keep this file free of Node or DOM imports.

export const EMPLOYEE_STATES = [
  'IDLE',
  'THINKING',
  'RESEARCHING',
  'WRITING',
  'CODING',
  'ANALYZING',
  'COMMUNICATING',
  'IN_MEETING',
  'AWAITING_APPROVAL',
  'COMPLETED',
  'ERROR',
  'OFFLINE',
] as const;

export type EmployeeState = (typeof EMPLOYEE_STATES)[number];

export type TaskStatus =
  | 'queued'
  | 'in_progress'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type DepartmentId = 'executive' | 'membership' | 'coop_dev' | 'mne' | 'data' | 'tech';

export interface Department {
  id: DepartmentId;
  name: string;
  short: string;
  color: string;
  mission: string;
}

// Six departments mapped to how an agricultural cooperative federation runs its
// membership database programme.
export const DEPARTMENTS: Department[] = [
  {
    id: 'executive',
    name: 'Executive Office',
    short: 'Executive',
    color: '#6366f1',
    mission: 'Plans projects, runs synthesis meetings and briefs the human owner.',
  },
  {
    id: 'membership',
    name: 'Membership Services',
    short: 'Membership',
    color: '#10b981',
    mission: 'Owns member records, member profiles and enrolment trends.',
  },
  {
    id: 'coop_dev',
    name: 'Cooperative Development',
    short: 'Coop Dev',
    color: '#f59e0b',
    mission: 'Reviews the cooperative portfolio and field coverage.',
  },
  {
    id: 'mne',
    name: 'Monitoring & Evaluation',
    short: 'M&E',
    color: '#0ea5e9',
    mission: 'Tracks CAPAR / CAIS report submission and compliance.',
  },
  {
    id: 'data',
    name: 'Data & Analytics',
    short: 'Data',
    color: '#a855f7',
    mission: 'Writes and runs data-quality checks against the live database.',
  },
  {
    id: 'tech',
    name: 'Technology & Systems',
    short: 'Tech',
    color: '#ef4444',
    mission: 'Audits the system build: schema, modules and usage.',
  },
];

export type HairStyle = 'short' | 'long' | 'bun' | 'curly' | 'buzz';
export type Accessory = 'none' | 'glasses' | 'headset';

// Avatar appearance is data, not code, so admins can customise it later
// without touching the 3D character asset.
export interface AvatarConfig {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  pants: string;
  accessory: Accessory;
}

export interface Employee {
  id: number;
  code: string;
  name: string;
  title: string;
  department: DepartmentId;
  avatar: AvatarConfig;
  state: EmployeeState;
  state_detail: string | null;
  current_task_id: number | null;
  target_employee_id: number | null;
  on_duty: number; // 1 = on duty, 0 = offline
  state_since: string;
}

export interface Task {
  id: number;
  project_id: number | null;
  kind: string;
  title: string;
  instructions: string | null;
  department: DepartmentId;
  preferred_employee: string | null;
  assignee_id: number | null;
  status: TaskStatus;
  depends_on: number[];
  step_index: number;
  step_count: number;
  step_label: string | null;
  output: string | null;
  error: string | null;
  requires_approval: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface Approval {
  id: number;
  task_id: number;
  employee_id: number;
  title: string;
  summary: string;
  details: string | null;
  status: ApprovalStatus;
  decided_by: string | null;
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface Project {
  id: number;
  kind: string;
  title: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ActivityEvent {
  id: number;
  employee_id: number | null;
  task_id: number | null;
  type: string;
  state: EmployeeState | null;
  message: string;
  created_at: string;
}

export interface ReportSummary {
  id: number;
  project_id: number | null;
  title: string;
  status: 'draft' | 'published';
  approved_by: string | null;
  created_at: string;
}

export interface Report extends ReportSummary {
  markdown: string;
}

export interface EngineInfo {
  llm: 'gemini' | 'rule-based';
  model: string | null;
  pacingMs: number;
}

export interface WorkforceSnapshot {
  departments: Department[];
  employees: Employee[];
  tasks: Task[];
  approvals: Approval[];
  projects: Project[];
  activity: ActivityEvent[];
  reports: ReportSummary[];
  engine: EngineInfo;
}

// Messages pushed over the live stream.
export type WorkforceEvent =
  | { type: 'employee'; employee: Employee }
  | { type: 'task'; task: Task }
  | { type: 'approval'; approval: Approval }
  | { type: 'project'; project: Project }
  | { type: 'activity'; activity: ActivityEvent }
  | { type: 'report'; report: ReportSummary };

export interface StateMeta {
  label: string;
  color: string;
  icon: string;
  description: string;
}

export const STATE_META: Record<EmployeeState, StateMeta> = {
  IDLE: { label: 'Idle', color: '#94a3b8', icon: '☕', description: 'Available for work' },
  THINKING: { label: 'Thinking', color: '#f472b6', icon: '💭', description: 'Planning the next step' },
  RESEARCHING: { label: 'Researching', color: '#38bdf8', icon: '🔎', description: 'Querying records' },
  WRITING: { label: 'Writing', color: '#facc15', icon: '✍️', description: 'Drafting a document' },
  CODING: { label: 'Coding', color: '#4ade80', icon: '⌨️', description: 'Writing queries or code' },
  ANALYZING: { label: 'Analyzing', color: '#c084fc', icon: '📊', description: 'Crunching numbers' },
  COMMUNICATING: { label: 'Communicating', color: '#2dd4bf', icon: '💬', description: 'Handing off to a colleague' },
  IN_MEETING: { label: 'In meeting', color: '#818cf8', icon: '👥', description: 'At the collaboration table' },
  AWAITING_APPROVAL: { label: 'Awaiting approval', color: '#fb923c', icon: '✋', description: 'Needs a human decision' },
  COMPLETED: { label: 'Completed', color: '#22c55e', icon: '✅', description: 'Just finished a task' },
  ERROR: { label: 'Error', color: '#ef4444', icon: '⚠️', description: 'A task failed' },
  OFFLINE: { label: 'Offline', color: '#475569', icon: '⏻', description: 'Off duty' },
};

export function departmentById(id: string): Department | undefined {
  return DEPARTMENTS.find((d) => d.id === id);
}
