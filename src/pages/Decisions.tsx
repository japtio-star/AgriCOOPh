import type React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { fetchAPI, cn } from '../lib/utils';
import { Modal, Field, inputCls, btnPrimary, btnSecondary, card } from '../lib/exec';

// Decision log: records what was decided, the data behind it, and whether it worked.
// Over time this is the evidence base for data-driven management.
export default function Decisions() {
  const [rows, setRows] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [outcomeFor, setOutcomeFor] = useState<any>(null);

  const load = () => fetchAPI('/exec/decisions').then(setRows);
  useEffect(() => {
    load();
    fetchAPI('/exec/departments').then((d) => setDepartments(d.departments));
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Decision log</h1>
          <p className="mt-1 text-xs text-slate-500">Each decision with the data behind it, the result expected, and what actually happened.</p>
        </div>
        <button className={btnPrimary} onClick={() => setAdding(true)}><Plus className="w-3 h-3 mr-2" /> Log decision</button>
      </div>

      <div className="space-y-4">
        {rows.length === 0 && <div className={cn(card, 'p-6 text-center text-xs text-slate-500')}>No decisions logged yet.</div>}
        {rows.map((x) => {
          const due = !x.outcome && x.review_date && x.review_date <= today;
          return (
            <article key={x.id} className={cn(card, 'p-5 text-xs space-y-3')}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {x.dept_id ? <Link to={`/departments/${x.dept_id}`} className="hover:text-emerald-700">{x.dept_name}</Link> : 'Federation-wide'} · {x.date}
                  </div>
                  <h2 className="text-sm font-bold text-slate-900">{x.title}</h2>
                </div>
                {x.outcome
                  ? <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-green-50 text-green-800 self-start">Reviewed</span>
                  : <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider self-start', due ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600')}>
                      {due ? 'Review due' : x.review_date ? `Review ${x.review_date}` : 'No review date'}
                    </span>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Block label="Decision" text={x.decision} />
                <Block label="Evidence / data used" text={x.evidence} />
                <Block label="Expected result" text={x.expected_result} />
                <Block label="Actual outcome" text={x.outcome} />
              </div>
              {!x.outcome && <button className="text-[11px] font-bold text-emerald-700 hover:underline" onClick={() => setOutcomeFor(x)}>Record outcome</button>}
            </article>
          );
        })}
      </div>

      {adding && <DecisionForm departments={departments} onClose={(r) => { setAdding(false); if (r) load(); }} />}
      {outcomeFor && <OutcomeForm decision={outcomeFor} onClose={(r) => { setOutcomeFor(null); if (r) load(); }} />}
    </div>
  );
}

function Block({ label, text }: { label: string; text?: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">{label}</div>
      <p className="text-slate-800 whitespace-pre-line">{text || <span className="text-slate-400">—</span>}</p>
    </div>
  );
}

function DecisionForm({ departments, onClose }: { departments: any[]; onClose: (reload?: boolean) => void }) {
  const [f, setF] = useState({ dept_id: '', date: new Date().toISOString().slice(0, 10), title: '', decision: '', evidence: '', expected_result: '', review_date: '' });
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchAPI('/exec/decisions', { method: 'POST', body: JSON.stringify(f) });
      onClose(true);
    } catch (err: any) {
      setError(err.message);
    }
  };
  return (
    <Modal title="Log a decision" onClose={() => onClose()}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Department">
            <select className={inputCls} value={f.dept_id} onChange={(e) => setF({ ...f, dept_id: e.target.value })}>
              <option value="">Federation-wide</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Date"><input type="date" required className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        </div>
        <Field label="Title"><input required className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="What was decided"><textarea required rows={2} className={inputCls} value={f.decision} onChange={(e) => setF({ ...f, decision: e.target.value })} /></Field>
        <Field label="Evidence / data used" hint="Which numbers or reports supported this decision?">
          <textarea rows={2} className={inputCls} value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })} />
        </Field>
        <Field label="Expected result"><textarea rows={2} className={inputCls} value={f.expected_result} onChange={(e) => setF({ ...f, expected_result: e.target.value })} /></Field>
        <Field label="Review date" hint="When to check whether it worked"><input type="date" className={inputCls} value={f.review_date} onChange={(e) => setF({ ...f, review_date: e.target.value })} /></Field>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnSecondary} onClick={() => onClose()}>Cancel</button>
          <button type="submit" className={btnPrimary}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

function OutcomeForm({ decision, onClose }: { decision: any; onClose: (reload?: boolean) => void }) {
  const [outcome, setOutcome] = useState('');
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchAPI(`/exec/decisions/${decision.id}`, { method: 'PATCH', body: JSON.stringify({ outcome }) });
    onClose(true);
  };
  return (
    <Modal title={`Outcome · ${decision.title}`} onClose={() => onClose()}>
      <form onSubmit={save} className="space-y-3">
        <p className="text-xs text-slate-600"><b>Expected:</b> {decision.expected_result || '—'}</p>
        <Field label="What actually happened"><textarea required rows={3} className={inputCls} value={outcome} onChange={(e) => setOutcome(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={() => onClose()}>Cancel</button>
          <button type="submit" className={btnPrimary}>Save</button>
        </div>
      </form>
    </Modal>
  );
}
