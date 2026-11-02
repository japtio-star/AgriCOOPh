import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { CheckCircle2, ChevronDown, ChevronRight, FileText, Loader2, RotateCcw, X, XCircle } from 'lucide-react';
import type { ActivityEvent, Approval, Department, Employee, Project, Report, ReportSummary, Task, TaskStatus } from '../shared/workforce';
import { DEPARTMENTS, STATE_META, departmentById } from '../shared/workforce';
import { cn } from '../lib/utils';
import { Markdown } from './Markdown';
import { parseTs, useAction, workforceGet } from './useWorkforce';

export function ago(ts: string | null | undefined) {
  const d = parseTs(ts);
  return d ? formatDistanceToNowStrict(d, { addSuffix: true }) : '';
}

export function StatePill({ state, className }: { state: Employee['state']; className?: string }) {
  const m = STATE_META[state];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', className)}
      style={{ background: `${m.color}22`, color: m.color === '#94a3b8' ? '#475569' : m.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

const STATUS_STYLE: Record<TaskStatus, string> = {
  queued: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-sky-100 text-sky-700',
  awaiting_approval: 'bg-orange-100 text-orange-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-200 text-slate-500',
};

function TaskStatusChip({ status }: { status: TaskStatus }) {
  return <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', STATUS_STYLE[status])}>{status.replace('_', ' ')}</span>;
}

function ErrorText({ error }: { error: string | null }) {
  return error ? <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p> : null;
}

// ---- Employee detail card ---------------------------------------------------------

export function EmployeeCard({ employee, tasks, activity, isOwner, onClose }: {
  employee: Employee; tasks: Task[]; activity: ActivityEvent[]; isOwner: boolean; onClose: () => void;
}) {
  const dept = departmentById(employee.department)!;
  const task = tasks.find((t) => t.id === employee.current_task_id);
  const history = activity.filter((a) => a.employee_id === employee.id).slice(-6).reverse();
  const completed = tasks.filter((t) => t.assignee_id === employee.id && t.status === 'completed').length;
  const { run, pending, error } = useAction();

  return (
    <div className="w-[min(340px,calc(100vw-3rem))] rounded-xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: employee.avatar.shirt }}>
          {employee.name.split(' ').map((p) => p[0]).join('')}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{employee.name}</p>
          <p className="truncate text-xs text-slate-500">{employee.title}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase" style={{ color: dept.color }}>{dept.name}</p>
        </div>
        <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X className="h-4 w-4" /></button>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <StatePill state={employee.state} />
        <span className="text-[10px] text-slate-400">since {ago(employee.state_since)}</span>
      </div>
      {employee.state_detail && <p className="mt-2 text-xs text-slate-600">{employee.state_detail}</p>}

      {task && (
        <div className="mt-3 rounded-lg bg-slate-50 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-semibold text-slate-800">{task.title}</p>
            <TaskStatusChip status={task.status} />
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.round((Math.min(task.step_index + 1, task.step_count) / Math.max(task.step_count, 1)) * 100)}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-slate-500">Step {Math.min(task.step_index + 1, task.step_count)} of {task.step_count} · {task.step_label}</p>
        </div>
      )}

      <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Recent activity · {completed} tasks completed</p>
      <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto custom-scrollbar">
        {history.length === 0 && <li className="text-xs text-slate-400">No activity yet.</li>}
        {history.map((a) => (
          <li key={a.id} className="flex gap-2 text-xs text-slate-600">
            <span>{a.state ? STATE_META[a.state].icon : '•'}</span>
            <span className="min-w-0 flex-1 truncate" title={a.message}>{a.message}</span>
            <span className="shrink-0 text-[10px] text-slate-400">{ago(a.created_at)}</span>
          </li>
        ))}
      </ul>

      {isOwner && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {employee.state === 'ERROR' && (
            <button disabled={pending} onClick={() => run(`/employees/${employee.id}/acknowledge`)} className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">Acknowledge error</button>
          )}
          {task?.status === 'failed' && (
            <button disabled={pending} onClick={() => run(`/tasks/${task.id}/retry`)} className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">Retry task</button>
          )}
          <button
            disabled={pending}
            onClick={() => run(`/employees/${employee.id}/duty`, { on_duty: !employee.on_duty })}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {employee.on_duty ? 'Sign off (offline)' : 'Bring on duty'}
          </button>
        </div>
      )}
      <ErrorText error={error} />
    </div>
  );
}

// ---- Approvals -------------------------------------------------------------------

function ApprovalCard({ approval, employee, report, isOwner, openReport }: {
  approval: Approval; employee?: Employee; report?: ReportSummary; isOwner: boolean; openReport: (id: number) => void;
}) {
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  const { run, pending, error } = useAction();
  const dept = employee ? departmentById(employee.department) : undefined;
  const reportId = approval.details?.startsWith('report:') ? Number(approval.details.slice(7)) : null;
  const decide = (decision: 'approved' | 'rejected') => run(`/approvals/${approval.id}/decision`, { decision, note });

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase text-orange-700">
        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" /></span>
        Awaiting your decision · {ago(approval.created_at)}
      </div>
      <p className="mt-1.5 text-sm font-semibold text-slate-900">{approval.title}</p>
      <p className="mt-1 text-xs text-slate-600">{approval.summary}</p>
      {employee && <p className="mt-1 text-[11px] text-slate-500">Requested by <span className="font-semibold" style={{ color: dept?.color }}>{employee.name}</span>, {employee.title}</p>}

      {reportId != null && (
        <button onClick={() => openReport(reportId)} className="mt-2 inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50">
          <FileText className="h-3.5 w-3.5" /> Read draft {report?.status === 'draft' ? 'report' : ''}
        </button>
      )}
      {approval.details && reportId == null && (
        <div className="mt-2">
          <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} Review details
          </button>
          {open && <pre className="mt-1 max-h-56 overflow-auto rounded-lg bg-slate-900 p-2 text-[10px] leading-relaxed text-slate-100 custom-scrollbar">{approval.details}</pre>}
        </div>
      )}

      {isOwner ? (
        <>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note (used as revision feedback if you reject)"
            rows={2}
            className="mt-2 w-full resize-none rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="mt-2 flex gap-2">
            <button disabled={pending} onClick={() => decide('approved')} className="flex-1 rounded-md bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Approve</button>
            <button disabled={pending} onClick={() => decide('rejected')} className="flex-1 rounded-md bg-white py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50">Reject</button>
          </div>
        </>
      ) : (
        <p className="mt-2 text-[11px] italic text-slate-500">Only the owner (Super Admin) can decide.</p>
      )}
      <ErrorText error={error} />
    </div>
  );
}

export function ApprovalsPanel({ approvals, employees, reports, isOwner, openReport }: {
  approvals: Approval[]; employees: Employee[]; reports: ReportSummary[]; isOwner: boolean; openReport: (id: number) => void;
}) {
  const pending = approvals.filter((a) => a.status === 'pending');
  const decided = approvals.filter((a) => a.status !== 'pending').slice(0, 15);
  const emp = (id: number) => employees.find((e) => e.id === id);
  return (
    <div className="space-y-3">
      {pending.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">No decisions waiting. Employees raise a hand ✋ here when they need you.</p>}
      {pending.map((a) => (
        <ApprovalCard key={a.id} approval={a} employee={emp(a.employee_id)} isOwner={isOwner} openReport={openReport}
          report={a.details?.startsWith('report:') ? reports.find((r) => r.id === Number(a.details!.slice(7))) : undefined} />
      ))}
      {decided.length > 0 && <p className="pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">History</p>}
      {decided.map((a) => (
        <div key={a.id} className="flex items-start gap-2 rounded-lg border border-slate-100 p-2 text-xs">
          {a.status === 'approved' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
          <div className="min-w-0">
            <p className="font-medium text-slate-800">{a.title}</p>
            <p className="text-[11px] text-slate-500">{a.status} by {a.decided_by} {ago(a.decided_at)}{a.decision_note ? ` — “${a.decision_note}”` : ''}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Task board ------------------------------------------------------------------

function TaskRow({ task, employees, isOwner, onSelectEmployee }: {
  task: Task; employees: Employee[]; isOwner: boolean; onSelectEmployee: (id: number) => void;
}) {
  const assignee = employees.find((e) => e.id === task.assignee_id);
  const dept = departmentById(task.department)!;
  const { run, pending, error } = useAction();
  const progress = task.status === 'completed' ? 100 : Math.round((task.step_index / Math.max(task.step_count, 1)) * 100);
  return (
    <li className="rounded-lg border border-slate-100 p-2">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dept.color }} title={dept.name} />
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800" title={task.title}>{task.title}</p>
        <TaskStatusChip status={task.status} />
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
        {assignee ? (
          <button onClick={() => onSelectEmployee(assignee.id)} className="font-semibold hover:underline" style={{ color: dept.color }}>{assignee.name}</button>
        ) : (
          <span>{dept.short} · unassigned</span>
        )}
        {task.status !== 'completed' && task.step_label && <span className="truncate">· {task.step_label}</span>}
      </div>
      {task.status !== 'cancelled' && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
          <div className={cn('h-full rounded-full transition-all', task.status === 'failed' ? 'bg-red-400' : 'bg-emerald-500')} style={{ width: `${progress}%` }} />
        </div>
      )}
      {task.error && <p className="mt-1 text-[11px] text-red-600">{task.error}</p>}
      {isOwner && task.status === 'failed' && (
        <button disabled={pending} onClick={() => run(`/tasks/${task.id}/retry`)} className="mt-1.5 inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white disabled:opacity-50">
          <RotateCcw className="h-3 w-3" /> Retry from step {task.step_index + 1}
        </button>
      )}
      <ErrorText error={error} />
    </li>
  );
}

export function TasksPanel({ projects, tasks, employees, isOwner, onSelectEmployee }: {
  projects: Project[]; tasks: Task[]; employees: Employee[]; isOwner: boolean; onSelectEmployee: (id: number) => void;
}) {
  const { run, pending, error } = useAction();
  const adhoc = tasks.filter((t) => t.project_id == null);
  return (
    <div className="space-y-4">
      {projects.length === 0 && adhoc.length === 0 && (
        <p className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">No work yet. Commission the implementation report to put the workforce to work.</p>
      )}
      {projects.map((p) => {
        const pt = tasks.filter((t) => t.project_id === p.id).sort((a, b) => a.id - b.id);
        const done = pt.filter((t) => t.status === 'completed').length;
        return (
          <section key={p.id}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-900">#{p.id} {p.title}</p>
                <p className="text-[10px] text-slate-500">{p.status} · {done}/{pt.length} tasks · started {ago(p.created_at)}</p>
              </div>
              {isOwner && p.status === 'running' && pt.length > 0 && (
                <button disabled={pending} onClick={() => run(`/tasks/${pt[0].id}/cancel`)} className="shrink-0 rounded border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              )}
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pt.length ? (done / pt.length) * 100 : 0}%` }} />
            </div>
            <ul className="mt-2 space-y-1.5">
              {pt.map((t) => <TaskRow key={t.id} task={t} employees={employees} isOwner={isOwner} onSelectEmployee={onSelectEmployee} />)}
            </ul>
          </section>
        );
      })}
      {adhoc.length > 0 && (
        <section>
          <p className="text-xs font-bold text-slate-900">Ad-hoc tasks</p>
          <ul className="mt-2 space-y-1.5">
            {adhoc.map((t) => <TaskRow key={t.id} task={t} employees={employees} isOwner={isOwner} onSelectEmployee={onSelectEmployee} />)}
          </ul>
        </section>
      )}
      <ErrorText error={error} />
    </div>
  );
}

// ---- Activity feed -----------------------------------------------------------------

export function ActivityPanel({ activity, employees, onSelectEmployee }: {
  activity: ActivityEvent[]; employees: Employee[]; onSelectEmployee: (id: number) => void;
}) {
  const items = useMemo(() => [...activity].reverse().slice(0, 120), [activity]);
  return (
    <ul className="space-y-1.5">
      {items.length === 0 && <li className="text-center text-xs text-slate-500">Nothing has happened yet.</li>}
      {items.map((a) => {
        const e = employees.find((x) => x.id === a.employee_id);
        const dept = e ? departmentById(e.department) : undefined;
        return (
          <li key={a.id} className="flex gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-slate-50">
            <span className="w-4 shrink-0 text-center">{a.state ? STATE_META[a.state].icon : a.type === 'decision' ? '🧑‍💼' : '•'}</span>
            <div className="min-w-0 flex-1">
              {e && <button onClick={() => onSelectEmployee(e.id)} className="mr-1 font-semibold hover:underline" style={{ color: dept?.color }}>{e.name.split(' ')[0]}</button>}
              <span className="text-slate-600">{a.type === 'state' && e ? `${STATE_META[a.state!].label.toLowerCase()} — ${a.message}` : a.message}</span>
            </div>
            <span className="shrink-0 text-[10px] text-slate-400">{ago(a.created_at)}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ---- Reports -------------------------------------------------------------------------

export function ReportsPanel({ reports, openReport }: { reports: ReportSummary[]; openReport: (id: number) => void }) {
  return (
    <ul className="space-y-2">
      {reports.length === 0 && <li className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">Reports appear here once the Executive Office assembles them.</li>}
      {reports.map((r) => (
        <li key={r.id}>
          <button onClick={() => openReport(r.id)} className="flex w-full items-center gap-3 rounded-lg border border-slate-100 p-2.5 text-left hover:bg-slate-50">
            <FileText className="h-5 w-5 shrink-0 text-indigo-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-800">{r.title} · project #{r.project_id}</p>
              <p className="text-[10px] text-slate-500">{r.status === 'published' ? `Published · approved by ${r.approved_by}` : 'Draft awaiting sign-off'} · {ago(r.created_at)}</p>
            </div>
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', r.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>{r.status}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ReportModal({ id, version, onClose }: { id: number; version: string; onClose: () => void }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    workforceGet<Report>(`/reports/${id}`).then(setReport).catch((e) => setError(e.message));
  }, [id, version]);
  return (
    <Modal onClose={onClose} wide>
      {!report && !error && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading report…</div>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {report && (
        <>
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', report.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>{report.status}</span>
          <Markdown source={report.markdown} />
        </>
      )}
    </Modal>
  );
}

// ---- New task --------------------------------------------------------------------

export function NewTaskModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [department, setDepartment] = useState<Department['id']>('inclusion');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const { run, pending, error } = useAction();
  const submit = async () => {
    const ok = await run('/tasks', { title, instructions, department, requires_approval: requiresApproval });
    if (ok) onClose();
  };
  return (
    <Modal onClose={onClose}>
      <h3 className="text-base font-bold text-slate-900">Assign a task</h3>
      <p className="mt-1 text-xs text-slate-500">The next available employee in the department picks it up and works against the live database.</p>
      <label className="mt-4 block text-xs font-semibold text-slate-700">Title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. Which cooperatives lack sex-disaggregated records?" />
      <label className="mt-3 block text-xs font-semibold text-slate-700">Department</label>
      <select value={department} onChange={(e) => setDepartment(e.target.value as Department['id'])} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
        {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <label className="mt-3 block text-xs font-semibold text-slate-700">Instructions</label>
      <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} className="mt-1 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
      <label className="mt-3 flex items-center gap-2 text-xs text-slate-700">
        <input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} /> Require my sign-off before it is delivered
      </label>
      <ErrorText error={error} />
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
        <button disabled={pending || !title.trim()} onClick={submit} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Assign</button>
      </div>
    </Modal>
  );
}

export function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className={cn('relative max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-5 shadow-2xl custom-scrollbar', wide ? 'max-w-3xl' : 'max-w-md')} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close"><X className="h-4 w-4" /></button>
        {children}
      </div>
    </div>
  );
}
