import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { AlertOctagon, AlertTriangle, ArrowDownRight, ArrowUpRight, Info, Table2, BarChart3 } from 'lucide-react';
import { fetchAPI, cn } from '../lib/utils';
import { StatusBadge, PeriodSelect, formatPHP, periodLabel, pct, serviceColor, CHART, card, cooLabel, STATUS_META } from '../lib/exec';

export default function CommandCenter() {
  const [data, setData] = useState<any>(null);
  const [period, setPeriod] = useState('');
  const [error, setError] = useState('');
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    fetchAPI(`/exec/overview${period ? `?period=${period}` : ''}`)
      .then((d) => { setData(d); setError(''); })
      .catch((e) => setError(e.message));
  }, [period]);

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!data) return <div className="text-slate-500 text-sm">Loading command center...</div>;

  const t = data.totals;
  const net = t.revenue - t.expenses;
  const ytdNet = t.ytdRevenue - t.ytdExpenses;
  const revVsTarget = pct(t.revenue, t.revenueTarget);
  const revChange = t.prevRevenue ? Math.round(((t.revenue - t.prevRevenue) / t.prevRevenue) * 100) : null;
  const critical = data.issueCounts.Critical || 0;
  const openIssues = Object.values(data.issueCounts).reduce((s: number, n: any) => s + n, 0) as number;
  const income = data.departments.filter((d: any) => d.category === 'Income');
  const support = data.departments.filter((d: any) => d.category === 'Support');
  const trend = data.revenueTrend.map((r: any) => ({ ...r, label: periodLabel(r.period, true) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">CEO Command Center</h1>
          <p className="mt-1 text-xs text-slate-500">
            {periodLabel(data.period)} · {cooLabel(data.settings)}
            {!data.settings.coo_name && ' — the 5 income services report to you until a COO is appointed.'}
          </p>
        </div>
        <PeriodSelect value={data.period} periods={data.periods} onChange={setPeriod} />
      </div>

      {data.settings.demo_data === '1' && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 text-blue-900 rounded-lg px-4 py-3 text-xs">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>These are <b>sample figures</b> so you can see how the dashboard works. Replace them as departments submit their actual monthly updates.</span>
        </div>
      )}

      {/* Headline numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Tile label="Revenue this month" value={formatPHP(t.revenue, true)}
          sub={revVsTarget !== null ? `${revVsTarget}% of ${formatPHP(t.revenueTarget, true)} target` : undefined}
          delta={revChange} deltaLabel="vs last month" />
        <Tile label="Net income this month" value={formatPHP(net, true)} sub={`Expenses ${formatPHP(t.expenses, true)}`} negative={net < 0} />
        <Tile label="Revenue year to date" value={formatPHP(t.ytdRevenue, true)}
          sub={`${pct(t.ytdRevenue, t.ytdRevenueTarget) ?? '—'}% of ${formatPHP(t.ytdRevenueTarget, true)} target · net ${formatPHP(ytdNet, true)}`} />
        <Tile label="Monthly updates in" value={`${t.submitted} / ${t.departments}`}
          sub={t.submitted < t.departments ? `${t.departments - t.submitted} department(s) missing` : 'All departments reported'} negative={t.submitted < t.departments} />
        <Tile label="Open issues" value={String(openIssues)} sub={`${critical} critical`} negative={critical > 0} link="/issues" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Attention list */}
        <section className={cn(card, 'xl:col-span-1 flex flex-col')}>
          <header className="p-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Needs your attention</h2>
            <p className="text-[11px] text-slate-500">Off-track KPIs, missing reports, critical or overdue issues</p>
          </header>
          <ul className="divide-y divide-slate-100 overflow-y-auto max-h-[460px] custom-scrollbar">
            {data.attention.length === 0 && <li className="p-4 text-xs text-slate-500">Nothing needs attention. All departments are on track.</li>}
            {data.attention.map((a: any, i: number) => {
              const crit = a.level === 'critical';
              const Icon = crit ? AlertOctagon : AlertTriangle;
              return (
                <li key={i}>
                  <Link to={a.issue_id ? '/issues' : `/departments/${a.dept_id}?period=${data.period}`} className="flex gap-3 p-4 hover:bg-slate-50">
                    <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: crit ? STATUS_META['off-track'].color : '#ec835a' }} aria-label={crit ? 'Critical' : 'Serious'} />
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{a.dept}</div>
                      <div className="text-xs text-slate-800">{a.text}</div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Scorecard */}
        <section className={cn(card, 'xl:col-span-2 overflow-hidden')}>
          <header className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Department scorecard</h2>
              <p className="text-[11px] text-slate-500">Status is the worst KPI result for the month</p>
            </div>
            <Link to="/departments" className="text-[11px] font-bold text-emerald-700 hover:underline">All departments →</Link>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="py-2 px-4 font-bold">Department</th>
                  <th className="py-2 px-4 font-bold">Status</th>
                  <th className="py-2 px-4 font-bold">KPIs on track</th>
                  <th className="py-2 px-4 font-bold text-right">Revenue</th>
                  <th className="py-2 px-4 font-bold text-right">vs target</th>
                  <th className="py-2 px-4 font-bold text-right">Issues</th>
                </tr>
              </thead>
              <ScoreGroup title={`Income services · reports to ${data.settings.coo_name ? 'COO' : 'COO (vacant)'}`} rows={income} period={data.period} showRevenue />
              <ScoreGroup title="Support units · reports to CEO" rows={support} period={data.period} />
            </table>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className={cn(card, 'xl:col-span-2')}>
          <header className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Revenue by income service</h2>
              <p className="text-[11px] text-slate-500">Last 12 months · dashed line = combined monthly target</p>
            </div>
            <button onClick={() => setShowTable(!showTable)} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-[11px] font-bold">
              {showTable ? <><BarChart3 className="w-3.5 h-3.5" /> Chart</> : <><Table2 className="w-3.5 h-3.5" /> Table</>}
            </button>
          </header>
          {showTable ? (
            <div className="overflow-x-auto p-4">
              <table className="min-w-full text-xs">
                <thead className="text-left text-[10px] uppercase tracking-widest text-slate-500">
                  <tr><th className="py-1 pr-3">Month</th>{data.incomeCodes.map((c: any) => <th key={c.code} className="py-1 px-2 text-right">{c.code}</th>)}<th className="py-1 pl-2 text-right">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trend.map((r: any) => (
                    <tr key={r.period}>
                      <td className="py-1.5 pr-3">{periodLabel(r.period)}</td>
                      {data.incomeCodes.map((c: any) => <td key={c.code} className="py-1.5 px-2 text-right tabular-nums">{formatPHP(r[c.code], true)}</td>)}
                      <td className="py-1.5 pl-2 text-right font-bold tabular-nums">{formatPHP(r.revenue, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-80 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="label" axisLine={{ stroke: CHART.axis }} tickLine={false} tick={CHART.tick} />
                  <YAxis axisLine={false} tickLine={false} tick={CHART.tick} tickFormatter={(v) => formatPHP(v, true)} width={56} />
                  <Tooltip contentStyle={CHART.tooltip} cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                    formatter={(v: any, name: any) => [formatPHP(v), data.incomeCodes.find((c: any) => c.code === name)?.name || name]} />
                  <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11, color: '#334155' }}
                    formatter={(code: string) => <span style={{ color: '#334155' }}>{data.incomeCodes.find((c: any) => c.code === code)?.name || code}</span>} />
                  <ReferenceLine y={t.revenueTarget} stroke={CHART.ink} strokeDasharray="4 4" />
                  {data.incomeCodes.map((c: any, i: number) => (
                    <Bar key={c.code} dataKey={c.code} stackId="rev" fill={serviceColor(c.code, i)} stroke="#fff" strokeWidth={1}
                      radius={i === data.incomeCodes.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={36} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className={card}>
          <header className="p-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Net income (revenue − expenses)</h2>
            <p className="text-[11px] text-slate-500">All departments, last 12 months</p>
          </header>
          <div className="h-80 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="label" axisLine={{ stroke: CHART.axis }} tickLine={false} tick={CHART.tick} />
                <YAxis axisLine={false} tickLine={false} tick={CHART.tick} tickFormatter={(v) => formatPHP(v, true)} width={56} />
                <ReferenceLine y={0} stroke={CHART.axis} />
                <Tooltip contentStyle={CHART.tooltip} formatter={(v: any) => [formatPHP(v), 'Net income']} />
                <Line type="monotone" dataKey="net" stroke="#0d366b" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, delta, deltaLabel, negative, link }: {
  label: string; value: string; sub?: string; delta?: number | null; deltaLabel?: string; negative?: boolean; link?: string;
}) {
  const body = (
    <div className={cn(card, 'p-4 h-full', link && 'hover:border-emerald-300')}>
      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">{label}</div>
      <div className={cn('text-2xl font-bold tabular-nums', negative ? 'text-red-700' : 'text-slate-900')}>{value}</div>
      {delta !== undefined && delta !== null && (
        <div className={cn('flex items-center gap-1 text-[11px] font-semibold mt-1', delta >= 0 ? 'text-green-800' : 'text-red-700')}>
          {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {delta >= 0 ? '+' : ''}{delta}% {deltaLabel}
        </div>
      )}
      {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
  return link ? <Link to={link}>{body}</Link> : body;
}

function ScoreGroup({ title, rows, period, showRevenue }: { title: string; rows: any[]; period: string; showRevenue?: boolean }) {
  return (
    <tbody className="divide-y divide-slate-100">
      <tr><td colSpan={6} className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</td></tr>
      {rows.map((d) => {
        const reported = d.kpiTotal - d.kpiCounts['no-data'];
        const vsTarget = showRevenue && d.revenue !== null ? pct(d.revenue, d.monthly_revenue_target) : null;
        return (
          <tr key={d.id} className="hover:bg-slate-50">
            <td className="py-2.5 px-4">
              <Link to={`/departments/${d.id}?period=${period}`} className="flex items-center gap-2 font-semibold text-slate-900 hover:text-emerald-700">
                {showRevenue && <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: serviceColor(d.code) }} aria-hidden />}
                {d.name}
              </Link>
            </td>
            <td className="py-2.5 px-4"><StatusBadge status={d.status} /></td>
            <td className="py-2.5 px-4">
              {reported > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="flex h-1.5 w-20 rounded-full overflow-hidden bg-slate-100 gap-px" aria-hidden>
                    {(['on-track', 'at-risk', 'off-track'] as const).map((s) =>
                      d.kpiCounts[s] > 0 ? <div key={s} style={{ width: `${(d.kpiCounts[s] / d.kpiTotal) * 100}%`, background: STATUS_META[s].color }} /> : null)}
                  </div>
                  <span className="tabular-nums text-slate-700">{d.kpiCounts['on-track']}/{d.kpiTotal}</span>
                </div>
              ) : <span className="text-slate-400">—</span>}
            </td>
            <td className="py-2.5 px-4 text-right tabular-nums">{showRevenue ? formatPHP(d.revenue, true) : <span className="text-slate-400">—</span>}</td>
            <td className={cn('py-2.5 px-4 text-right tabular-nums font-semibold', vsTarget !== null && vsTarget < 80 ? 'text-red-700' : 'text-slate-700')}>
              {vsTarget !== null ? `${vsTarget}%` : <span className="text-slate-400 font-normal">—</span>}
            </td>
            <td className="py-2.5 px-4 text-right tabular-nums">{d.openIssues || <span className="text-slate-400">0</span>}</td>
          </tr>
        );
      })}
    </tbody>
  );
}
