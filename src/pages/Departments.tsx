import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchAPI, cn } from '../lib/utils';
import { StatusBadge, formatPHP, periodLabel, pct, serviceColor, card, cooLabel, currentUser, isExecutive, inputCls, btnPrimary, btnSecondary, STATUS_META } from '../lib/exec';

export default function Departments() {
  const [data, setData] = useState<any>(null);
  const [editingCoo, setEditingCoo] = useState(false);
  const [cooName, setCooName] = useState('');
  const exec = isExecutive(currentUser());

  const load = () => fetchAPI('/exec/departments').then((d) => { setData(d); setCooName(d.settings.coo_name || ''); });
  useEffect(() => { load(); }, []);

  if (!data) return <div className="text-slate-500 text-sm">Loading departments...</div>;

  const saveCoo = async () => {
    await fetchAPI('/exec/settings', { method: 'PUT', body: JSON.stringify({ coo_name: cooName.trim() }) });
    setEditingCoo(false);
    load();
  };

  const groups = [
    { title: 'Income services', sub: `Generate revenue · report to the COO (${data.settings.coo_name || 'vacant — CEO acting'})`, rows: data.departments.filter((d: any) => d.category === 'Income') },
    { title: 'Support units', sub: 'Report directly to the CEO', rows: data.departments.filter((d: any) => d.category === 'Support') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Departments</h1>
          <p className="mt-1 text-xs text-slate-500">Status for {periodLabel(data.period)} · {cooLabel(data.settings)}</p>
        </div>
        {exec && (editingCoo ? (
          <div className="flex gap-2 items-center">
            <input className={cn(inputCls, 'w-56')} placeholder="COO name (blank = vacant)" value={cooName} onChange={(e) => setCooName(e.target.value)} />
            <button className={btnPrimary} onClick={saveCoo}>Save</button>
            <button className={btnSecondary} onClick={() => setEditingCoo(false)}>Cancel</button>
          </div>
        ) : (
          <button className={btnSecondary} onClick={() => setEditingCoo(true)}>{data.settings.coo_name ? 'Change COO' : 'Appoint COO'}</button>
        ))}
      </div>

      {groups.map((g) => g.rows.length > 0 && (
        <section key={g.title}>
          <h2 className="text-sm font-bold text-slate-900">{g.title}</h2>
          <p className="text-[11px] text-slate-500 mb-3">{g.sub}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {g.rows.map((d: any) => (
              <Link key={d.id} to={`/departments/${d.id}`} className={cn(card, 'p-4 hover:border-emerald-300 transition-colors flex flex-col gap-3')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {d.category === 'Income' && <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: serviceColor(d.code) }} aria-hidden />}
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{d.name}</div>
                      <div className="text-[11px] text-slate-500">{d.head_name || 'Unit head not set'}</div>
                    </div>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
                <p className="text-[11px] text-slate-600 line-clamp-2">{d.mandate}</p>
                <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100 gap-px" aria-hidden>
                  {(['on-track', 'at-risk', 'off-track'] as const).map((s) =>
                    d.kpiCounts[s] > 0 ? <div key={s} style={{ width: `${(d.kpiCounts[s] / d.kpiTotal) * 100}%`, background: STATUS_META[s].color }} /> : null)}
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <Stat label="KPIs on track" value={`${d.kpiCounts['on-track']}/${d.kpiTotal}`} />
                  {d.category === 'Income'
                    ? <Stat label="Revenue" value={`${formatPHP(d.revenue, true)}${d.revenue !== null ? ` (${pct(d.revenue, d.monthly_revenue_target)}%)` : ''}`} />
                    : <Stat label="Monthly update" value={d.submitted ? 'Submitted' : 'Missing'} />}
                  <Stat label="Open issues" value={String(d.openIssues)} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{label}</div>
      <div className="text-slate-800 font-semibold tabular-nums">{value}</div>
    </div>
  );
}
