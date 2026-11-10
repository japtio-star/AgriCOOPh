import type React from 'react';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { LineChart, Line, ResponsiveContainer, ReferenceLine, Tooltip, YAxis, BarChart, Bar, XAxis, CartesianGrid, Legend } from 'recharts';
import { ArrowLeft, ArrowDownRight, ArrowUpRight, Pencil, Plus, Send, Settings2 } from 'lucide-react';
import { fetchAPI, cn } from '../lib/utils';
import {
  StatusBadge, PeriodSelect, Modal, Field, formatPHP, formatValue, periodLabel, pct, card, cooLabel, currentUser, isExecutive,
  inputCls, btnPrimary, btnSecondary, CHART,
} from '../lib/exec';
import { IssueForm, IssueRow } from './Issues';

export default function DepartmentDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'update' | 'edit' | 'kpis' | 'issue' | null>(null);
  const user = currentUser();
  const exec = isExecutive(user);
  const period = params.get('period') || '';

  const load = () =>
    fetchAPI(`/exec/departments/${id}${period ? `?period=${period}` : ''}`)
      .then((d) => { setData(d); setError(''); })
      .catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id, period]);

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!data) return <div className="text-slate-500 text-sm">Loading department...</div>;

  const d = data.department;
  const periods = data.financials.map((f: any) => f.period).reverse();
  const isIncome = d.category === 'Income';
  const close = (reload = false) => { setModal(null); if (reload) load(); };
  const fin = data.financials.map((f: any) => ({ ...f, label: periodLabel(f.period, true) }));

  return (
    <div className="space-y-6">
      {exec && <Link to="/departments" className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800"><ArrowLeft className="w-3 h-3" /> All departments</Link>}

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{d.name}</h1>
            <StatusBadge status={d.status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {d.category === 'Income' ? 'Income service' : 'Support unit'} · Reports to {d.reports_to === 'COO' ? cooLabel(data.settings).replace('COO: ', 'COO — ') : 'CEO'}
            {' · '}Head: {d.head_name || <i>not set</i>}
          </p>
          <p className="mt-2 text-xs text-slate-700 max-w-2xl">{d.mandate}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelect value={data.period} periods={periods} onChange={(p) => setParams({ period: p })} />
          <button className={btnPrimary} onClick={() => setModal('update')}><Send className="w-3 h-3 mr-2" /> Monthly update</button>
          {exec && <button className={btnSecondary} onClick={() => setModal('kpis')}><Settings2 className="w-3 h-3 mr-2" /> KPIs & targets</button>}
          {exec && <button className={btnSecondary} onClick={() => setModal('edit')}><Pencil className="w-3 h-3 mr-2" /> Edit</button>}
        </div>
      </div>

      {!d.submitted && (
        <div className="bg-amber-50 border border-amber-100 text-amber-900 rounded-lg px-4 py-3 text-xs">
          No update for {periodLabel(data.period)} yet. Use <b>Monthly update</b> to enter this month's figures.
        </div>
      )}

      {/* KPI cards */}
      <section>
        <h2 className="text-sm font-bold text-slate-900 mb-3">Key performance indicators · {periodLabel(data.period)}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {d.kpis.map((k: any) => <KpiCard key={k.id} k={k} />)}
          {d.kpis.length === 0 && <div className="text-xs text-slate-500">No KPIs defined yet.{exec && ' Use “KPIs & targets” to add them.'}</div>}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className={cn(card, 'xl:col-span-2')}>
          <header className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">{isIncome ? 'Revenue and expenses' : 'Expenses'}</h2>
              <p className="text-[11px] text-slate-500">
                Last 12 months{isIncome && d.monthly_revenue_target ? ` · dashed line = monthly revenue target ${formatPHP(d.monthly_revenue_target, true)}` : ''}
              </p>
            </div>
            {isIncome && d.revenue !== null && (
              <div className="text-right">
                <div className="text-lg font-bold tabular-nums">{formatPHP(d.revenue, true)}</div>
                <div className="text-[11px] text-slate-500">{pct(d.revenue, d.monthly_revenue_target) ?? '—'}% of target</div>
              </div>
            )}
          </header>
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fin} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="label" axisLine={{ stroke: CHART.axis }} tickLine={false} tick={CHART.tick} />
                <YAxis axisLine={false} tickLine={false} tick={CHART.tick} tickFormatter={(v) => formatPHP(v, true)} width={56} />
                <Tooltip contentStyle={CHART.tooltip} cursor={{ fill: 'rgba(15,23,42,0.04)' }} formatter={(v: any, n: any) => [formatPHP(v), n === 'revenue' ? 'Revenue' : 'Expenses']} />
                {isIncome && <Legend iconType="square" iconSize={10} formatter={(n: string) => <span style={{ color: '#334155', fontSize: 11 }}>{n === 'revenue' ? 'Revenue' : 'Expenses'}</span>} />}
                {isIncome && d.monthly_revenue_target > 0 && <ReferenceLine y={d.monthly_revenue_target} stroke={CHART.ink} strokeDasharray="4 4" />}
                {isIncome && <Bar dataKey="revenue" fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={22} />}
                <Bar dataKey="expenses" fill={isIncome ? '#eb6834' : '#2a78d6'} radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={card}>
          <header className="p-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Unit head's report</h2>
            <p className="text-[11px] text-slate-500">{periodLabel(data.period)}</p>
          </header>
          <div className="p-4 space-y-4 text-xs">
            {data.narrative ? (
              <>
                <Narr label="Highlights" text={data.narrative.highlights} />
                <Narr label="Challenges" text={data.narrative.challenges} />
                <Narr label="Support needed from CEO" text={data.narrative.support_needed} />
              </>
            ) : <p className="text-slate-500">No written report for this month.</p>}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className={card}>
          <header className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Issues & escalations</h2>
            <button className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1" onClick={() => setModal('issue')}><Plus className="w-3 h-3" /> Raise issue</button>
          </header>
          <ul className="divide-y divide-slate-100">
            {data.issues.length === 0 && <li className="p-4 text-xs text-slate-500">No issues raised.</li>}
            {data.issues.map((i: any) => <IssueRow key={i.id} issue={i} onChange={load} />)}
          </ul>
        </section>
        <section className={card}>
          <header className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Decisions</h2>
            {exec && <Link to="/decisions" className="text-[11px] font-bold text-emerald-700 hover:underline">Decision log →</Link>}
          </header>
          <ul className="divide-y divide-slate-100">
            {data.decisions.length === 0 && <li className="p-4 text-xs text-slate-500">No decisions logged for this department.</li>}
            {data.decisions.map((x: any) => (
              <li key={x.id} className="p-4 text-xs space-y-1">
                <div className="flex justify-between gap-2"><span className="font-bold text-slate-900">{x.title}</span><span className="text-slate-500 shrink-0">{x.date}</span></div>
                <p className="text-slate-700">{x.decision}</p>
                {x.evidence && <p className="text-slate-500"><b>Evidence:</b> {x.evidence}</p>}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {modal === 'update' && <UpdateForm deptId={d.id} initialPeriod={data.period} isIncome={isIncome} onClose={close} />}
      {modal === 'edit' && <EditDept dept={d} onClose={close} />}
      {modal === 'kpis' && <KpiManager dept={d} onClose={close} />}
      {modal === 'issue' && <Modal title={`Raise an issue · ${d.name}`} onClose={() => close()}><IssueForm deptId={d.id} onDone={() => close(true)} /></Modal>}
    </div>
  );
}

function Narr({ label, text }: { label: string; text?: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">{label}</div>
      <p className="text-slate-800 whitespace-pre-line">{text || <span className="text-slate-400">—</span>}</p>
    </div>
  );
}

function KpiCard({ k }: { k: any; key?: any }) {
  const change = k.value !== null && k.prev_value !== null && k.prev_value !== 0 ? ((k.value - k.prev_value) / Math.abs(k.prev_value)) * 100 : null;
  const better = change === null ? null : k.direction === 'lower' ? change <= 0 : change >= 0;
  const hist = k.history.map((h: any) => ({ ...h, label: periodLabel(h.period) }));
  return (
    <div className={cn(card, 'p-4 flex flex-col gap-2')}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold text-slate-800" title={k.description}>{k.name}</div>
        <StatusBadge status={k.status} />
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{formatValue(k.value, k.unit, true)}</div>
          <div className="text-[11px] text-slate-500">
            Target {k.direction === 'lower' ? '≤ ' : ''}{formatValue(k.target, k.unit, true)}
          </div>
        </div>
        {change !== null && (
          <div className={cn('flex items-center gap-0.5 text-[11px] font-semibold', better ? 'text-green-800' : 'text-red-700')}>
            {change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {change >= 0 ? '+' : ''}{change.toFixed(1)}% vs last month
          </div>
        )}
      </div>
      <div className="h-14 -mx-1" aria-label={`${k.name} last 12 months`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={hist} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <YAxis hide domain={['auto', 'auto']} />
            {k.target !== null && <ReferenceLine y={k.target} stroke={CHART.axis} strokeDasharray="3 3" />}
            <Tooltip contentStyle={CHART.tooltip} labelFormatter={(_, p: any) => p?.[0]?.payload?.label} formatter={(v: any) => [formatValue(v, k.unit), k.name]} />
            <Line type="monotone" dataKey="value" stroke="#0d366b" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Monthly update: one form for KPI values, money, and the written report.
function UpdateForm({ deptId, initialPeriod, isIncome, onClose }: { deptId: number; initialPeriod: string; isIncome: boolean; onClose: (reload?: boolean) => void }) {
  const [period, setPeriod] = useState(initialPeriod);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(null);
    fetchAPI(`/exec/departments/${deptId}?period=${period}`).then((d) => {
      const f = d.financials.find((x: any) => x.period === period);
      setForm({
        kpis: d.department.kpis.map((k: any) => ({ kpi_id: k.id, name: k.name, unit: k.unit, target: k.target, direction: k.direction, value: k.value ?? '', note: k.note ?? '' })),
        revenue: f?.revenue ?? '',
        expenses: f?.expenses ?? '',
        highlights: d.narrative?.highlights ?? '',
        challenges: d.narrative?.challenges ?? '',
        support_needed: d.narrative?.support_needed ?? '',
      });
    }).catch((e) => setError(e.message));
  }, [period]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await fetchAPI(`/exec/departments/${deptId}/update`, { method: 'POST', body: JSON.stringify({ period, ...form }) });
      onClose(true);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };
  const setKpi = (i: number, key: string, v: string) =>
    setForm({ ...form, kpis: form.kpis.map((k: any, j: number) => (j === i ? { ...k, [key]: v } : k)) });

  return (
    <Modal title="Monthly update" onClose={() => onClose()} wide>
      <form onSubmit={submit} className="space-y-5">
        <Field label="Reporting month">
          <input type="month" required className={cn(inputCls, 'w-48')} value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} />
        </Field>
        {!form ? <p className="text-xs text-slate-500">Loading...</p> : (
          <>
            <div>
              <h4 className="text-xs font-bold text-slate-900 mb-2">KPI results</h4>
              <div className="space-y-2">
                {form.kpis.map((k: any, i: number) => (
                  <div key={k.kpi_id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-5 text-xs">
                      <div className="font-semibold text-slate-800">{k.name}</div>
                      <div className="text-[10px] text-slate-500">Target {k.direction === 'lower' ? '≤ ' : ''}{formatValue(k.target, k.unit)} · unit: {k.unit === 'PHP' ? '₱' : k.unit}</div>
                    </div>
                    <input type="number" step="any" className={cn(inputCls, 'sm:col-span-3')} placeholder="Value" value={k.value} onChange={(e) => setKpi(i, 'value', e.target.value)} />
                    <input className={cn(inputCls, 'sm:col-span-4')} placeholder="Note (optional)" value={k.note} onChange={(e) => setKpi(i, 'note', e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isIncome && (
                <Field label="Revenue (₱)">
                  <input type="number" step="any" min="0" className={inputCls} value={form.revenue} onChange={(e) => setForm({ ...form, revenue: e.target.value })} />
                </Field>
              )}
              <Field label="Expenses (₱)">
                <input type="number" step="any" min="0" className={inputCls} value={form.expenses} onChange={(e) => setForm({ ...form, expenses: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Highlights"><textarea rows={2} className={inputCls} value={form.highlights} onChange={(e) => setForm({ ...form, highlights: e.target.value })} /></Field>
              <Field label="Challenges"><textarea rows={2} className={inputCls} value={form.challenges} onChange={(e) => setForm({ ...form, challenges: e.target.value })} /></Field>
              <Field label="Support needed from CEO"><textarea rows={2} className={inputCls} value={form.support_needed} onChange={(e) => setForm({ ...form, support_needed: e.target.value })} /></Field>
            </div>
          </>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={() => onClose()}>Cancel</button>
          <button type="submit" className={btnPrimary} disabled={!form || saving}>{saving ? 'Saving...' : 'Submit update'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditDept({ dept, onClose }: { dept: any; onClose: (reload?: boolean) => void }) {
  const [f, setF] = useState({
    head_name: dept.head_name || '', mandate: dept.mandate || '', monthly_revenue_target: dept.monthly_revenue_target ?? 0,
    category: dept.category, reports_to: dept.reports_to,
  });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchAPI(`/exec/departments/${dept.id}`, { method: 'PUT', body: JSON.stringify({ ...f, monthly_revenue_target: Number(f.monthly_revenue_target) || 0 }) });
    onClose(true);
  };
  return (
    <Modal title={`Edit · ${dept.name}`} onClose={() => onClose()}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Unit head"><input className={inputCls} value={f.head_name} onChange={(e) => setF({ ...f, head_name: e.target.value })} /></Field>
        <Field label="Mandate"><textarea rows={3} className={inputCls} value={f.mandate} onChange={(e) => setF({ ...f, mandate: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              <option>Income</option><option>Support</option>
            </select>
          </Field>
          <Field label="Reports to">
            <select className={inputCls} value={f.reports_to} onChange={(e) => setF({ ...f, reports_to: e.target.value })}>
              <option>COO</option><option>CEO</option>
            </select>
          </Field>
        </div>
        <Field label="Monthly revenue target (₱)" hint="Leave 0 for units that do not earn revenue.">
          <input type="number" min="0" step="any" className={inputCls} value={f.monthly_revenue_target} onChange={(e) => setF({ ...f, monthly_revenue_target: e.target.value as any })} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnSecondary} onClick={() => onClose()}>Cancel</button>
          <button type="submit" className={btnPrimary}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

const UNITS = ['count', 'PHP', '%', 'MT', 'days', 'hours', 'score'];

function KpiManager({ dept, onClose }: { dept: any; onClose: (reload?: boolean) => void }) {
  const [rows, setRows] = useState<any[]>(dept.kpis.map((k: any) => ({ ...k, target: k.target ?? '' })));
  const [changed, setChanged] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (i: number, key: string, v: any) => setRows(rows.map((r, j) => (j === i ? { ...r, [key]: v, _dirty: true } : r)));
  const add = () => setRows([...rows, { id: null, name: '', unit: 'count', target: '', direction: 'higher', description: '', _dirty: true }]);

  const saveAll = async () => {
    setSaving(true);
    for (const r of rows.filter((r) => r._dirty && r.name.trim())) {
      const body = JSON.stringify({ name: r.name, unit: r.unit, target: r.target, direction: r.direction, description: r.description });
      if (r.id) await fetchAPI(`/exec/kpis/${r.id}`, { method: 'PUT', body });
      else await fetchAPI(`/exec/departments/${dept.id}/kpis`, { method: 'POST', body });
    }
    setSaving(false);
    onClose(true);
  };
  const remove = async (r: any, i: number) => {
    if (r.id) {
      if (!confirm(`Stop tracking “${r.name}”? Past values are kept.`)) return;
      await fetchAPI(`/exec/kpis/${r.id}`, { method: 'PUT', body: JSON.stringify({ active: false, target: r.target }) });
      setChanged(true);
    }
    setRows(rows.filter((_, j) => j !== i));
  };

  return (
    <Modal title={`KPIs & targets · ${dept.name}`} onClose={() => onClose(changed)} wide>
      <p className="text-[11px] text-slate-500 mb-3">Targets are monthly. “Lower is better” is for KPIs like late payments or days to close books.</p>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.id ?? `new-${i}`} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end border-b border-slate-100 pb-3">
            <div className="col-span-2 sm:col-span-5"><Field label="KPI"><input className={inputCls} value={r.name} onChange={(e) => set(i, 'name', e.target.value)} /></Field></div>
            <div className="sm:col-span-2"><Field label="Unit">
              <select className={inputCls} value={r.unit} onChange={(e) => set(i, 'unit', e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
            </Field></div>
            <div className="sm:col-span-2"><Field label="Target"><input type="number" step="any" className={inputCls} value={r.target} onChange={(e) => set(i, 'target', e.target.value)} /></Field></div>
            <div className="sm:col-span-2"><Field label="Better if">
              <select className={inputCls} value={r.direction} onChange={(e) => set(i, 'direction', e.target.value)}>
                <option value="higher">Higher</option><option value="lower">Lower</option>
              </select>
            </Field></div>
            <button type="button" className="sm:col-span-1 text-[11px] text-red-600 hover:underline pb-2" onClick={() => remove(r, i)}>Remove</button>
          </div>
        ))}
      </div>
      <div className="flex justify-between gap-2 pt-4">
        <button type="button" className={btnSecondary} onClick={add}><Plus className="w-3 h-3 mr-1" /> Add KPI</button>
        <div className="flex gap-2">
          <button type="button" className={btnSecondary} onClick={() => onClose(changed)}>Cancel</button>
          <button type="button" className={btnPrimary} onClick={saveAll} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </Modal>
  );
}
