import type React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Plus, AlertOctagon, AlertTriangle, Circle } from 'lucide-react';
import { fetchAPI, cn } from '../lib/utils';
import { Modal, Field, inputCls, btnPrimary, card, currentUser, isExecutive } from '../lib/exec';

const SEVERITY: Record<string, { color: string; Icon: any; cls: string }> = {
  Critical: { color: '#d03b3b', Icon: AlertOctagon, cls: 'bg-red-50 text-red-800' },
  High: { color: '#ec835a', Icon: AlertTriangle, cls: 'bg-orange-50 text-orange-800' },
  Medium: { color: '#fab219', Icon: AlertTriangle, cls: 'bg-amber-50 text-amber-800' },
  Low: { color: '#94a3b8', Icon: Circle, cls: 'bg-slate-100 text-slate-600' },
};

export function SeverityBadge({ severity }: { severity: string }) {
  const s = SEVERITY[severity] || SEVERITY.Low;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider', s.cls)}>
      <s.Icon className="w-3 h-3" style={{ color: s.color }} aria-hidden /> {severity}
    </span>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export function IssueRow({ issue, onChange, showDept }: { issue: any; onChange: () => void; showDept?: boolean; key?: any }) {
  const overdue = issue.status !== 'Resolved' && issue.due_date && issue.due_date < today();
  const setStatus = async (status: string) => {
    await fetchAPI(`/exec/issues/${issue.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    onChange();
  };
  return (
    <li className={cn('p-4 flex flex-col sm:flex-row sm:items-start gap-3 text-xs', issue.status === 'Resolved' && 'opacity-60')}>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <SeverityBadge severity={issue.severity} />
          {showDept && issue.dept_id && <Link to={`/departments/${issue.dept_id}`} className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-emerald-700">{issue.dept_name}</Link>}
          {overdue && <span className="text-[10px] font-bold uppercase tracking-wider text-red-700">Overdue</span>}
        </div>
        <div className="font-semibold text-slate-900">{issue.title}</div>
        {issue.description && <p className="text-slate-600">{issue.description}</p>}
        <div className="text-[11px] text-slate-500">
          {issue.owner ? `Owner: ${issue.owner}` : 'No owner'}{issue.due_date ? ` · Due ${issue.due_date}` : ''}
        </div>
      </div>
      <select value={issue.status} onChange={(e) => setStatus(e.target.value)} aria-label="Issue status"
        className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-semibold shrink-0">
        <option>Open</option><option>In Progress</option><option>Resolved</option>
      </select>
    </li>
  );
}

export function IssueForm({ deptId, departments, onDone }: { deptId?: number; departments?: any[]; onDone: () => void }) {
  const [f, setF] = useState({ dept_id: deptId ? String(deptId) : '', title: '', description: '', severity: 'Medium', owner: '', due_date: '' });
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchAPI('/exec/issues', { method: 'POST', body: JSON.stringify(f) });
      onDone();
    } catch (err: any) {
      setError(err.message);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      {departments && (
        <Field label="Department">
          <select className={inputCls} value={f.dept_id} onChange={(e) => setF({ ...f, dept_id: e.target.value })}>
            <option value="">Federation-wide</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Issue"><input required className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Details"><textarea rows={3} className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Severity">
          <select className={inputCls} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>
            {['Low', 'Medium', 'High', 'Critical'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Due date"><input type="date" className={inputCls} value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
      </div>
      <Field label="Owner"><input className={inputCls} value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} placeholder="Who will resolve it" /></Field>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="submit" className={btnPrimary}>Raise issue</button>
      </div>
    </form>
  );
}

export default function Issues() {
  const [issues, setIssues] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('open');
  const [deptFilter, setDeptFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const exec = isExecutive(currentUser());

  const load = () => fetchAPI('/exec/issues').then(setIssues);
  useEffect(() => {
    load();
    fetchAPI('/exec/departments').then((d) => setDepartments(d.departments));
  }, []);

  const shown = issues.filter((i) =>
    (statusFilter === 'all' || (statusFilter === 'open' ? i.status !== 'Resolved' : i.status === 'Resolved')) &&
    (!deptFilter || String(i.dept_id) === deptFilter));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Issues & escalations</h1>
          <p className="mt-1 text-xs text-slate-500">Problems that need a decision or support, tracked until resolved.</p>
        </div>
        <button className={btnPrimary} onClick={() => setAdding(true)}><Plus className="w-3 h-3 mr-2" /> Raise issue</button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[['open', 'Open'], ['resolved', 'Resolved'], ['all', 'All']].map(([v, l]) => (
          <button key={v} onClick={() => setStatusFilter(v)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-bold border', statusFilter === v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300')}>{l}</button>
        ))}
        {exec && (
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold" aria-label="Department filter">
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
      </div>

      <section className={card}>
        <ul className="divide-y divide-slate-100">
          {shown.length === 0 && <li className="p-6 text-center text-xs text-slate-500">No issues.</li>}
          {shown.map((i) => <IssueRow key={i.id} issue={i} onChange={load} showDept />)}
        </ul>
      </section>

      {adding && (
        <Modal title="Raise an issue" onClose={() => setAdding(false)}>
          <IssueForm
            departments={exec ? departments : undefined}
            deptId={!exec ? departments[0]?.id : undefined}
            onDone={() => { setAdding(false); load(); }} />
        </Modal>
      )}
    </div>
  );
}
