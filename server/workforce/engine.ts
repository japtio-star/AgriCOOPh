import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import type { Employee, EmployeeState, Task, WorkforceEvent, WorkforceSnapshot } from '../../src/shared/workforce';
import { DEPARTMENTS } from '../../src/shared/workforce';
import { WorkforceStore } from './store';
import { llmInfo } from './llm';

// The orchestration engine. It owns the task queue, assigns work to available
// AI employees, runs each task's pipeline step by step, and drives employee
// state from what the step is doing. Every state change is persisted and
// broadcast to the virtual office over the live stream.

export interface StepContext {
  task: Task;
  employee: Employee;
  ctx: Record<string, any>; // persisted across steps, restarts and approvals
  engine: WorkforceEngine;
  log: (message: string) => void;
}

export type StepResult = void | { pause: true } | { goto: string };

export interface Step {
  key: string;
  state: EmployeeState;
  label: string | ((c: StepContext) => string);
  when?: (c: StepContext) => boolean;
  paced?: boolean; // default true; set false when the step paces itself
  run: (c: StepContext) => Promise<StepResult> | StepResult;
}

export interface Pipeline {
  kind: string;
  steps: Step[];
}

// Minimum time a step stays visible so humans can follow along. The work runs
// in parallel with this timer; it never replaces the work.
export const PACING_MS = Number(process.env.WORKFORCE_STEP_PACING_MS ?? 3000);
const COMPLETED_HOLD_MS = 4000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class WorkforceEngine extends EventEmitter {
  readonly store: WorkforceStore;
  readonly readonlyDb: Database.Database;
  private pipelines = new Map<string, Pipeline>();
  private busy = new Map<number, number>(); // employeeId -> taskId
  private running = new Set<number>(); // taskIds currently executing
  private lastWorked = new Map<number, number>();
  private timer: NodeJS.Timeout | null = null;

  constructor(readonly db: Database.Database, dbFile: string) {
    super();
    this.setMaxListeners(200);
    this.store = new WorkforceStore(db);
    this.readonlyDb = new Database(dbFile, { readonly: true, fileMustExist: true });
  }

  register(p: Pipeline) {
    this.pipelines.set(p.kind, p);
  }

  pipeline(kind: string): Pipeline {
    const p = this.pipelines.get(kind);
    if (!p) throw new Error(`Unknown task kind: ${kind}`);
    return p;
  }

  // ---- Lifecycle --------------------------------------------------------------

  start() {
    this.recover();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  // Bring persisted state back in line after a restart.
  private recover() {
    for (const t of this.store.tasksWithStatus('in_progress')) {
      this.store.updateTask(t.id, { status: 'queued', assignee_id: null });
    }
    const waiting = this.store.tasksWithStatus('awaiting_approval');
    for (const e of this.store.employees()) {
      const holding = waiting.find((t) => t.assignee_id === e.id);
      if (holding) {
        this.busy.set(e.id, holding.id);
        this.store.updateEmployee(e.id, { state: 'AWAITING_APPROVAL', current_task_id: holding.id, target_employee_id: null });
      } else if (!e.on_duty) {
        this.store.updateEmployee(e.id, { state: 'OFFLINE', current_task_id: null, target_employee_id: null });
      } else if (e.state !== 'ERROR') {
        this.store.updateEmployee(e.id, { state: 'IDLE', state_detail: null, current_task_id: null, target_employee_id: null });
      }
    }
  }

  snapshot(): WorkforceSnapshot {
    return {
      departments: DEPARTMENTS,
      employees: this.store.employees(),
      tasks: this.store.tasks(),
      approvals: this.store.approvals(),
      projects: this.store.projects(),
      activity: this.store.activity(),
      reports: this.store.reports(),
      engine: { llm: llmInfo().mode, model: llmInfo().model, pacingMs: PACING_MS },
    };
  }

  // ---- Broadcasting -----------------------------------------------------------

  broadcast(ev: WorkforceEvent) {
    this.emit('event', ev);
  }

  activity(employeeId: number | null, taskId: number | null, type: string, state: EmployeeState | null, message: string) {
    const activity = this.store.insertActivity({ employee_id: employeeId, task_id: taskId, type, state, message });
    this.broadcast({ type: 'activity', activity });
  }

  setState(employeeId: number, state: EmployeeState, detail: string | null, taskId: number | null, targetId: number | null = null) {
    const before = this.store.employee(employeeId)!;
    const employee = this.store.updateEmployee(
      employeeId,
      { state, state_detail: detail, current_task_id: taskId, target_employee_id: targetId },
      before.state !== state,
    );
    this.broadcast({ type: 'employee', employee });
    if (before.state !== state || before.state_detail !== detail) {
      this.activity(employeeId, taskId, 'state', state, detail ?? state);
    }
  }

  updateTask(id: number, patch: Record<string, any>): Task {
    const task = this.store.updateTask(id, patch);
    this.broadcast({ type: 'task', task });
    return task;
  }

  // ---- Scheduling -------------------------------------------------------------

  private available(e: Employee) {
    return e.on_duty === 1 && e.state === 'IDLE' && !this.busy.has(e.id);
  }

  private pickEmployee(task: Task, employees: Employee[]): Employee | undefined {
    const pool = employees.filter((e) => e.department === task.department && this.available(e));
    const preferred = task.preferred_employee ? pool.find((e) => e.code === task.preferred_employee) : undefined;
    if (preferred) return preferred;
    // If the preferred specialist exists and is on duty, wait for them.
    if (task.preferred_employee) {
      const p = employees.find((e) => e.code === task.preferred_employee);
      if (p && p.on_duty && p.state !== 'ERROR') return undefined;
    }
    return pool.sort((a, b) => (this.lastWorked.get(a.id) ?? 0) - (this.lastWorked.get(b.id) ?? 0))[0];
  }

  private tick() {
    const queued = this.store.tasksWithStatus('queued');
    if (!queued.length) return;
    const employees = this.store.employees();
    for (const task of queued) {
      if (this.running.has(task.id)) continue;
      const deps = task.depends_on.map((id) => this.store.task(id));
      if (deps.some((d) => !d || d.status !== 'completed')) continue;
      const emp = this.pickEmployee(task, employees);
      if (!emp) continue;
      this.busy.set(emp.id, task.id);
      this.updateTask(task.id, { assignee_id: emp.id, status: 'in_progress', started_at: task.started_at ?? 'CURRENT_TIMESTAMP' });
      this.activity(emp.id, task.id, 'assigned', null, `${emp.name} picked up "${task.title}"`);
      void this.execute(task.id, emp.id);
    }
  }

  // ---- Execution --------------------------------------------------------------

  private async execute(taskId: number, employeeId: number) {
    this.running.add(taskId);
    const ctx = this.store.taskContext(taskId);
    try {
      let task = this.store.task(taskId)!;
      const { steps } = this.pipeline(task.kind);
      while (task.step_index < steps.length) {
        if (this.store.task(taskId)!.status === 'cancelled') return;
        const step = steps[task.step_index];
        const employee = this.store.employee(employeeId)!;
        const c: StepContext = {
          task, employee, ctx, engine: this,
          log: (m) => this.activity(employeeId, taskId, 'log', null, m),
        };
        if (step.when && !step.when(c)) {
          task = this.updateTask(taskId, { step_index: task.step_index + 1 });
          continue;
        }
        const label = typeof step.label === 'function' ? step.label(c) : step.label;
        this.setState(employeeId, step.state, label, taskId);
        task = this.updateTask(taskId, { step_label: label });

        const paced = step.paced !== false && step.state !== 'AWAITING_APPROVAL';
        const [result] = await Promise.all([step.run(c), paced ? sleep(PACING_MS) : Promise.resolve()]);
        this.store.saveTaskContext(taskId, ctx);
        if (this.store.task(taskId)!.status === 'cancelled') return;

        if (result && 'pause' in result) {
          this.updateTask(taskId, { status: 'awaiting_approval' });
          this.setState(employeeId, 'AWAITING_APPROVAL', label, taskId);
          return; // employee stays reserved until the owner decides
        }
        const next = result && 'goto' in result ? steps.findIndex((s) => s.key === result.goto) : task.step_index + 1;
        if (next < 0) throw new Error(`Pipeline step not found: ${(result as any).goto}`);
        task = this.updateTask(taskId, { step_index: next });
      }
      this.complete(taskId, employeeId);
    } catch (err: any) {
      this.fail(taskId, employeeId, err);
    } finally {
      this.running.delete(taskId);
    }
  }

  private complete(taskId: number, employeeId: number) {
    const task = this.updateTask(taskId, { status: 'completed', step_label: 'Done', completed_at: 'CURRENT_TIMESTAMP' });
    this.release(employeeId);
    this.setState(employeeId, 'COMPLETED', `Finished "${task.title}"`, taskId);
    setTimeout(() => {
      const e = this.store.employee(employeeId);
      if (e && e.state === 'COMPLETED' && !this.busy.has(employeeId)) this.setState(employeeId, 'IDLE', null, null);
    }, COMPLETED_HOLD_MS);
    if (task.project_id) this.checkProject(task.project_id);
  }

  private fail(taskId: number, employeeId: number, err: any) {
    const message = String(err?.message || err).slice(0, 500);
    console.error(`[workforce] task ${taskId} failed:`, err);
    this.updateTask(taskId, { status: 'failed', error: message });
    this.release(employeeId);
    this.setState(employeeId, 'ERROR', message, taskId);
  }

  private release(employeeId: number) {
    this.busy.delete(employeeId);
    this.lastWorked.set(employeeId, Date.now());
  }

  private checkProject(projectId: number) {
    const tasks = this.store.projectTasks(projectId);
    if (tasks.every((t) => t.status === 'completed')) {
      this.broadcast({ type: 'project', project: this.store.updateProject(projectId, 'completed') });
      this.activity(null, null, 'project', null, `Project #${projectId} completed`);
    }
  }

  // ---- Helpers used by pipeline steps -------------------------------------------

  employeeByCode(code: string): Employee | undefined {
    return this.store.employees().find((e) => e.code === code);
  }

  // Visible hand-off: the sender faces the recipient and a line is drawn between them.
  handoff(c: StepContext, toCode: string, message: string) {
    const to = this.employeeByCode(toCode);
    if (!to) return;
    this.setState(c.employee.id, 'COMMUNICATING', `Briefing ${to.name}: ${message}`, c.task.id, to.id);
    this.activity(c.employee.id, c.task.id, 'handoff', 'COMMUNICATING', `${c.employee.name} → ${to.name}: ${message}`);
  }

  // Gathers free participants at the collaboration table for the duration of `work`.
  async meeting<T>(c: StepContext, participantCodes: string[], topic: string, work: () => Promise<T>): Promise<T> {
    const joined: Employee[] = [];
    for (const code of participantCodes) {
      const e = this.employeeByCode(code);
      const free = e && e.on_duty === 1 && !this.busy.has(e.id) && (e.state === 'IDLE' || e.state === 'COMPLETED');
      if (!e || e.id === c.employee.id || !free) continue;
      this.busy.set(e.id, c.task.id);
      joined.push(e);
      this.setState(e.id, 'IN_MEETING', topic, c.task.id, c.employee.id);
    }
    this.activity(c.employee.id, c.task.id, 'meeting', 'IN_MEETING',
      `${c.employee.name} opened a meeting: ${topic}${joined.length ? ` with ${joined.map((e) => e.name).join(', ')}` : ''}`);
    c.ctx.meetingParticipants = joined.map((e) => e.name);
    try {
      // Long enough for attendees to walk to the table and back in the office view.
      const [result] = await Promise.all([work(), sleep(Math.max(PACING_MS * 3, 300))]);
      return result;
    } finally {
      for (const e of joined) {
        this.busy.delete(e.id);
        this.setState(e.id, 'IDLE', null, null);
      }
    }
  }

  requestApproval(c: StepContext, stepKey: string, req: { title: string; summary: string; details?: string }): StepResult {
    const approval = this.store.insertApproval({ task_id: c.task.id, employee_id: c.employee.id, step_key: stepKey, ...req });
    this.broadcast({ type: 'approval', approval });
    this.activity(c.employee.id, c.task.id, 'approval', 'AWAITING_APPROVAL', `${c.employee.name} requested approval: ${req.title}`);
    return { pause: true };
  }

  // ---- Owner actions ------------------------------------------------------------

  decide(approvalId: number, decision: 'approved' | 'rejected', by: string, note: string | null) {
    const current = this.store.approval(approvalId);
    if (!current) throw new HttpError(404, 'Approval not found');
    if (current.status !== 'pending') throw new HttpError(409, 'Approval already decided');
    const approval = this.store.decideApproval(approvalId, decision, by, note);
    this.broadcast({ type: 'approval', approval });
    this.activity(null, approval.task_id, 'decision', null,
      `${by} ${decision} "${approval.title}"${note ? ` — "${note}"` : ''}`);

    const ctx = this.store.taskContext(approval.task_id);
    ctx.approvals = { ...(ctx.approvals || {}), [current.step_key]: { status: decision, note, by } };
    this.store.saveTaskContext(approval.task_id, ctx);

    const task = this.store.task(approval.task_id)!;
    if (task.status === 'awaiting_approval' && task.assignee_id) {
      this.updateTask(task.id, { status: 'in_progress' });
      void this.execute(task.id, task.assignee_id);
    }
    return approval;
  }

  retry(taskId: number) {
    const task = this.store.task(taskId);
    if (!task) throw new HttpError(404, 'Task not found');
    if (task.status !== 'failed') throw new HttpError(409, 'Only failed tasks can be retried');
    if (task.assignee_id) {
      const e = this.store.employee(task.assignee_id);
      if (e?.state === 'ERROR' && e.current_task_id === taskId) this.setState(e.id, 'IDLE', null, null);
    }
    this.activity(null, taskId, 'retry', null, `Task "${task.title}" re-queued from step ${task.step_index + 1}`);
    return this.updateTask(taskId, { status: 'queued', error: null, assignee_id: null });
  }

  cancel(taskId: number, by: string) {
    const task = this.store.task(taskId);
    if (!task) throw new HttpError(404, 'Task not found');
    if (task.status === 'completed' || task.status === 'cancelled') throw new HttpError(409, 'Task already finished');
    const targets = task.project_id
      ? this.store.projectTasks(task.project_id).filter((t) => !['completed', 'cancelled'].includes(t.status))
      : [task];
    for (const t of targets) {
      for (const a of this.store.pendingApprovalsForTask(t.id)) {
        this.broadcast({ type: 'approval', approval: this.store.decideApproval(a.id, 'rejected', by, 'Task cancelled') });
      }
      this.updateTask(t.id, { status: 'cancelled', completed_at: 'CURRENT_TIMESTAMP' });
      if (t.assignee_id && this.busy.get(t.assignee_id) === t.id) {
        this.release(t.assignee_id);
        this.setState(t.assignee_id, 'IDLE', null, null);
      }
    }
    // Free any meeting participants held by a cancelled task.
    for (const [empId, tId] of this.busy) {
      if (targets.some((t) => t.id === tId)) {
        this.busy.delete(empId);
        this.setState(empId, 'IDLE', null, null);
      }
    }
    if (task.project_id) this.broadcast({ type: 'project', project: this.store.updateProject(task.project_id, 'cancelled') });
    this.activity(null, taskId, 'cancel', null, `${by} cancelled "${task.title}"${task.project_id ? ' and its project' : ''}`);
  }

  setDuty(employeeId: number, onDuty: boolean) {
    const e = this.store.employee(employeeId);
    if (!e) throw new HttpError(404, 'Employee not found');
    if (!onDuty && this.busy.has(employeeId)) throw new HttpError(409, `${e.name} is busy; wait until the current task finishes`);
    this.store.updateEmployee(employeeId, { on_duty: onDuty ? 1 : 0 });
    this.setState(employeeId, onDuty ? 'IDLE' : 'OFFLINE', onDuty ? 'Back on duty' : 'Signed off by owner', null);
  }

  acknowledge(employeeId: number) {
    const e = this.store.employee(employeeId);
    if (!e) throw new HttpError(404, 'Employee not found');
    if (e.state !== 'ERROR') throw new HttpError(409, 'Employee is not in an error state');
    this.setState(employeeId, 'IDLE', 'Error acknowledged', null);
  }
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}
