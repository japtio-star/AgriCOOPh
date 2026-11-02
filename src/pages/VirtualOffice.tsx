import { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { Briefcase, Loader2, Plus, Radio, Maximize2 } from 'lucide-react';
import { EMPLOYEE_STATES, STATE_META } from '../shared/workforce';
import { cn } from '../lib/utils';
import { useAction, useWorkforce } from '../workforce/useWorkforce';
import { ActivityPanel, ApprovalsPanel, EmployeeCard, NewTaskModal, ReportModal, ReportsPanel, TasksPanel } from '../workforce/panels';
import type { FocusTarget } from '../workforce/office/OfficeScene';
import { ZONE_CENTERS, deskFor, deskIndexMap } from '../workforce/office/layout';

const OfficeScene = lazy(() => import('../workforce/office/OfficeScene'));

type Tab = 'approvals' | 'tasks' | 'activity' | 'reports';

export default function VirtualOffice() {
  const { data, connection } = useWorkforce();
  const user = JSON.parse(localStorage.getItem('amds_user') || '{}');
  const isOwner = user.role === 'Super Admin';
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('approvals');
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const [reportId, setReportId] = useState<number | null>(null);
  const [newTask, setNewTask] = useState(false);
  const [stateFilter, setStateFilter] = useState<string | null>(null);
  const commission = useAction();

  const employees = data?.employees ?? [];
  const deskIndex = useMemo(() => deskIndexMap(employees), [employees]);
  const pendingApprovals = data?.approvals.filter((a) => a.status === 'pending').length ?? 0;
  const runningProject = data?.projects.find((p) => p.status === 'running');

  const focusOn = useCallback((x: number, z: number, zoomFactor: number) => setFocus({ x, z, zoomFactor, nonce: Date.now() }), []);

  const selectEmployee = useCallback((id: number | null) => {
    setSelectedId(id);
    const e = id != null ? employees.find((x) => x.id === id) : undefined;
    if (e) {
      const { seat } = deskFor(e.department, deskIndex.get(e.id) ?? 0);
      const [x, , z] = e.state === 'IN_MEETING' ? [0, 0, 0] : seat.position;
      focusOn(x, z, 2.6);
    }
  }, [employees, deskIndex, focusOn]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of employees) c[e.state] = (c[e.state] || 0) + 1;
    return c;
  }, [employees]);

  const selected = employees.find((e) => e.id === selectedId);
  const openReportSummary = data?.reports.find((r) => r.id === reportId);

  if (!data) {
    return (
      <div className="flex h-96 items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        {connection === 'reconnecting' ? 'Reconnecting to the orchestration engine…' : 'Connecting to the orchestration engine…'}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100vh-9.5rem)]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-lg font-bold text-slate-900">Virtual Office</h1>
          <p className="text-xs text-slate-500">AI workforce for the AgriCOOPh–CSA DGD Programme 2022–2026: every avatar mirrors its employee's real execution state.</p>
        </div>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
          connection === 'live' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
          <Radio className={cn('h-3.5 w-3.5', connection === 'live' && 'animate-pulse')} />
          {connection === 'live' ? 'Live' : 'Reconnecting'}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600" title="Text generation engine used by the workforce">
          Writer: {data.engine.llm === 'gemini' ? `Gemini (${data.engine.model})` : 'rule-based (no GEMINI_API_KEY)'}
        </span>
        {isOwner && (
          <>
            <button onClick={() => setNewTask(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <Plus className="h-3.5 w-3.5" /> Assign task
            </button>
            <button
              disabled={commission.pending || !!runningProject}
              onClick={async () => { if (await commission.run('/projects', { kind: 'implementation_report' })) setTab('tasks'); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              title={runningProject ? `Project #${runningProject.id} is in progress` : undefined}
            >
              <Briefcase className="h-3.5 w-3.5" />
              {runningProject ? `Report #${runningProject.id} in progress` : 'Commission terminal report'}
            </button>
          </>
        )}
      </div>
      {commission.error && <p className="rounded bg-red-50 px-3 py-1.5 text-xs text-red-700">{commission.error}</p>}

      {/* State legend (click to highlight) */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        {EMPLOYEE_STATES.map((s) => {
          const m = STATE_META[s];
          const n = counts[s] || 0;
          return (
            <button
              key={s}
              onClick={() => setStateFilter(stateFilter === s ? null : s)}
              className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition',
                stateFilter === s ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600',
                n === 0 && stateFilter !== s && 'opacity-50')}
              title={m.description}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
              {m.label}
              <span className="font-bold">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        {/* 3D office */}
        <div className="relative h-[62vh] min-h-[380px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-[#e9eef6] lg:h-auto lg:min-h-0 lg:flex-1 lg:shrink">
          <Suspense fallback={<div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading office…</div>}>
            <OfficeScene departments={data.departments} employees={employees} selectedId={selectedId} onSelect={selectEmployee} focus={focus} />
          </Suspense>

          {selected && (
            <div className="absolute left-3 top-3 z-30">
              <EmployeeCard employee={selected} tasks={data.tasks} activity={data.activity} isOwner={isOwner} onClose={() => setSelectedId(null)} />
            </div>
          )}

          {stateFilter && (
            <div className="absolute right-3 top-3 z-30 max-w-[220px] rounded-xl bg-white/95 p-3 shadow-lg">
              <p className="text-[10px] font-bold uppercase text-slate-400">{STATE_META[stateFilter as keyof typeof STATE_META].label}</p>
              <ul className="mt-1 space-y-1">
                {employees.filter((e) => e.state === stateFilter).map((e) => (
                  <li key={e.id}><button onClick={() => selectEmployee(e.id)} className="text-xs font-semibold text-slate-700 hover:underline">{e.name}</button></li>
                ))}
                {!counts[stateFilter] && <li className="text-xs text-slate-400">Nobody right now.</li>}
              </ul>
            </div>
          )}

          {/* Department navigation */}
          <div className="absolute inset-x-3 bottom-3 z-30 flex gap-1.5 overflow-x-auto custom-scrollbar">
            <button onClick={() => { setSelectedId(null); focusOn(0, 0, 1); }} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-900/85 px-2.5 py-1.5 text-[11px] font-semibold text-white">
              <Maximize2 className="h-3 w-3" /> Overview
            </button>
            <button onClick={() => focusOn(0, 0, 2.2)} className="shrink-0 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 shadow-sm">Meeting table</button>
            {data.departments.map((d) => (
              <button key={d.id} onClick={() => focusOn(ZONE_CENTERS[d.id][0], ZONE_CENTERS[d.id][1], 2)}
                className="shrink-0 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm" style={{ borderBottom: `3px solid ${d.color}` }}>
                {d.short}
              </button>
            ))}
          </div>
          <p className="pointer-events-none absolute bottom-14 right-3 z-20 hidden text-[10px] text-slate-500 sm:block">Drag to pan · right-drag to rotate · scroll to zoom · click an avatar</p>
        </div>

        {/* Control panel */}
        <aside className="flex min-h-[420px] flex-col rounded-xl border border-slate-200 bg-white lg:w-[380px] lg:min-h-0">
          <div className="flex border-b border-slate-100 px-2">
            {([
              ['approvals', `Approvals${pendingApprovals ? ` (${pendingApprovals})` : ''}`],
              ['tasks', 'Tasks'],
              ['activity', 'Activity'],
              ['reports', 'Reports'],
            ] as [Tab, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={cn('relative px-3 py-2.5 text-xs font-semibold', tab === id ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600')}>
                {label}
                {id === 'approvals' && pendingApprovals > 0 && <span className="absolute right-1 top-2 h-1.5 w-1.5 rounded-full bg-orange-500" />}
                {tab === id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded bg-emerald-500" />}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
            {tab === 'approvals' && <ApprovalsPanel approvals={data.approvals} employees={employees} reports={data.reports} isOwner={isOwner} openReport={setReportId} />}
            {tab === 'tasks' && <TasksPanel projects={data.projects} tasks={data.tasks} employees={employees} isOwner={isOwner} onSelectEmployee={selectEmployee} />}
            {tab === 'activity' && <ActivityPanel activity={data.activity} employees={employees} onSelectEmployee={selectEmployee} />}
            {tab === 'reports' && <ReportsPanel reports={data.reports} openReport={setReportId} />}
          </div>
        </aside>
      </div>

      {reportId != null && <ReportModal id={reportId} version={`${openReportSummary?.status}-${openReportSummary?.approved_by}`} onClose={() => setReportId(null)} />}
      {newTask && <NewTaskModal onClose={() => setNewTask(false)} />}
    </div>
  );
}
