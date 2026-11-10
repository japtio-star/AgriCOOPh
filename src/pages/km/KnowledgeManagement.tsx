import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Plus, Search, ExternalLink, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { fetchAPI, cn } from '../../lib/utils';
import { Modal, Field, inputCls, btnPrimary, btnSecondary, card, CHART } from '../../lib/exec';

// Tools of the Knowledge Management unit, shown as tabs on its department page.
export const KM_TABS = [
  { id: 'library', label: 'Knowledge library' },
  { id: 'dissemination', label: 'Dissemination' },
  { id: 'requests', label: 'Information requests' },
  { id: 'prices', label: 'Market prices' },
  { id: 'data-quality', label: 'Member data quality' },
];

export function KMTab({ tab, departments }: { tab: string; departments: any[] }) {
  const [options, setOptions] = useState<any>(null);
  useEffect(() => { fetchAPI('/km/options').then(setOptions).catch(() => {}); }, []);
  if (!options) return <div className="text-sm text-slate-500">Loading...</div>;
  if (tab === 'library') return <Library options={options} departments={departments} />;
  if (tab === 'dissemination') return <Dissemination options={options} />;
  if (tab === 'requests') return <Requests options={options} departments={departments} />;
  if (tab === 'prices') return <Prices options={options} />;
  if (tab === 'data-quality') return <DataQuality />;
  return null;
}

// ---------- shared bits ----------
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const num = (v: number) => Math.round(v).toLocaleString('en-PH');

function Stat({ label, value, sub, alert }: { label: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div className={cn(card, 'p-4')}>
      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">{label}</div>
      <div className={cn('text-2xl font-bold tabular-nums', alert ? 'text-red-700' : 'text-slate-900')}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function Pill({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'green' | 'amber' | 'blue' | 'red' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700', green: 'bg-green-50 text-green-800', amber: 'bg-amber-50 text-amber-800',
    blue: 'bg-blue-50 text-blue-800', red: 'bg-red-50 text-red-800',
  };
  return <span className={cn('inline-block text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider whitespace-nowrap', tones[tone])}>{children}</span>;
}

function Select({ value, onChange, options, label, all }: { value: string; onChange: (v: string) => void; options: string[]; label: string; all: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
      className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none">
      <option value="">{all}</option>
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
}

function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {sub && <p className="text-[11px] text-slate-500 mt-0.5 max-w-2xl">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function useList(endpoint: string) {
  const [rows, setRows] = useState<any[] | null>(null);
  const load = () => fetchAPI(endpoint).then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, [endpoint]);
  return [rows, load] as const;
}

const COMMODITIES = ['Rice', 'Corn', 'Coconut', 'Cacao', 'Coffee', 'Banana', 'Vegetables', 'Fruits', 'Livestock', 'Poultry', 'Fisheries', 'Multiple', 'None'];
const LANGUAGES = ['English', 'Filipino', 'Cebuano', 'Ilocano', 'Hiligaynon', 'Waray', 'Bicolano'];

// ---------- Knowledge library ----------
function Library({ options, departments }: { options: any; departments: any[] }) {
  const [rows, load] = useList('/km/products');
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [commodity, setCommodity] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<any>(null);

  if (!rows) return <div className="text-sm text-slate-500">Loading library...</div>;
  const published = rows.filter((r) => r.status === 'Published');
  const pipeline = rows.filter((r) => r.status === 'Draft' || r.status === 'Under review');
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const thisYear = published.filter((r) => r.published_date >= yearStart);
  const views = rows.reduce((s, r) => s + (r.views || 0), 0);
  const languages = new Set(published.map((r) => r.language).filter(Boolean));
  const commodities = Array.from(new Set(rows.map((r) => r.commodity).filter(Boolean))).sort() as string[];
  const shown = rows.filter((r) =>
    (!q || `${r.title} ${r.topic} ${r.summary}`.toLowerCase().includes(q.toLowerCase())) &&
    (!type || r.type === type) && (!commodity || r.commodity === commodity) && (!status || r.status === status));
  const tone = (s: string) => (s === 'Published' ? 'green' : s === 'Under review' ? 'amber' : s === 'Draft' ? 'blue' : 'slate');

  return (
    <div className="space-y-5">
      <SectionHeader title="Knowledge library"
        sub="Every guide, bulletin, brief, training module and success story the federation produces, with where it came from and how far it reached."
        action={<button className={btnPrimary} onClick={() => setEditing({})}><Plus className="w-3 h-3 mr-2" /> Add product</button>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Published products" value={String(published.length)} sub={`${thisYear.length} this year`} />
        <Stat label="In the pipeline" value={String(pipeline.length)} sub="Draft or under review" />
        <Stat label="Total views" value={num(views)} />
        <Stat label="Languages covered" value={String(languages.size)} sub={Array.from(languages).join(', ')} />
      </div>

      <div className={card}>
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input aria-label="Search library" className={cn(inputCls, 'pl-9 bg-slate-100 border-none')} placeholder="Search title, topic or summary" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select label="Type" value={type} onChange={setType} options={options.productTypes} all="All types" />
          <Select label="Commodity" value={commodity} onChange={setCommodity} options={commodities} all="All commodities" />
          <Select label="Status" value={status} onChange={setStatus} options={options.productStatus} all="All statuses" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-widest text-slate-500">
              <tr>
                <th className="py-2 px-4 font-bold">Title</th>
                <th className="py-2 px-4 font-bold">Type</th>
                <th className="py-2 px-4 font-bold">Commodity</th>
                <th className="py-2 px-4 font-bold">Language</th>
                <th className="py-2 px-4 font-bold">Status</th>
                <th className="py-2 px-4 font-bold">Published</th>
                <th className="py-2 px-4 font-bold text-right">People reached</th>
                <th className="py-2 px-4 font-bold text-right">Views</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-500">No products match these filters.</td></tr>}
              {shown.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setEditing(r)}>
                  <td className="py-2.5 px-4 max-w-md">
                    <div className="font-semibold text-slate-900 flex items-center gap-1">
                      {r.title}
                      {r.link && <a href={r.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} aria-label="Open file"><ExternalLink className="w-3 h-3 text-slate-400" /></a>}
                    </div>
                    <div className="text-[11px] text-slate-500">{[r.topic, r.region, r.source_dept && `from ${r.source_dept}`].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap">{r.type}</td>
                  <td className="py-2.5 px-4">{r.commodity || '—'}</td>
                  <td className="py-2.5 px-4">{r.language || '—'}</td>
                  <td className="py-2.5 px-4"><Pill tone={tone(r.status)}>{r.status}</Pill></td>
                  <td className="py-2.5 px-4 whitespace-nowrap tabular-nums">{r.published_date || '—'}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">{r.people_reached ? num(r.people_reached) : '—'}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">{r.views ? num(r.views) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing && <ProductForm product={editing} options={options} departments={departments} onClose={(r) => { setEditing(null); if (r) load(); }} />}
    </div>
  );
}

function ProductForm({ product, options, departments, onClose }: { product: any; options: any; departments: any[]; onClose: (reload?: boolean) => void }) {
  const [f, setF] = useState({
    title: '', type: options.productTypes[0], commodity: '', topic: '', region: 'National', language: 'English', audience: '',
    summary: '', link: '', author: '', source_dept_id: '', status: 'Draft', published_date: '',
    ...Object.fromEntries(Object.entries(product).map(([k, v]) => [k, v ?? ''])),
  });
  const [error, setError] = useState('');
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchAPI(product.id ? `/km/products/${product.id}` : '/km/products', { method: product.id ? 'PUT' : 'POST', body: JSON.stringify(f) });
      onClose(true);
    } catch (err: any) { setError(err.message); }
  };
  return (
    <Modal title={product.id ? 'Edit knowledge product' : 'Add knowledge product'} onClose={() => onClose()} wide>
      <form onSubmit={save} className="space-y-3">
        <Field label="Title"><input id="kp-title" required className={inputCls} value={f.title} onChange={set('title')} /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Type"><select id="kp-type" className={inputCls} value={f.type} onChange={set('type')}>{options.productTypes.map((t: string) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Commodity"><select id="kp-commodity" className={inputCls} value={f.commodity} onChange={set('commodity')}><option value="">—</option>{COMMODITIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Topic"><input id="kp-topic" className={inputCls} value={f.topic} onChange={set('topic')} placeholder="e.g. Post-harvest, Marketing" /></Field>
          <Field label="Region"><select id="kp-region" className={inputCls} value={f.region} onChange={set('region')}>{options.regions.map((r: string) => <option key={r}>{r}</option>)}</select></Field>
          <Field label="Language"><select id="kp-language" className={inputCls} value={f.language} onChange={set('language')}>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}</select></Field>
          <Field label="Contributing unit">
            <select id="kp-dept" className={inputCls} value={f.source_dept_id} onChange={set('source_dept_id')}>
              <option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Summary"><textarea id="kp-summary" rows={3} className={inputCls} value={f.summary} onChange={set('summary')} /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Intended audience"><input id="kp-audience" className={inputCls} value={f.audience} onChange={set('audience')} placeholder="e.g. Rice farmers, coop treasurers" /></Field>
          <Field label="Author"><input id="kp-author" className={inputCls} value={f.author} onChange={set('author')} /></Field>
        </div>
        <Field label="Link to file" hint="Google Drive, website or platform link"><input id="kp-link" type="url" className={inputCls} value={f.link} onChange={set('link')} placeholder="https://" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status"><select id="kp-status" className={inputCls} value={f.status} onChange={set('status')}>{options.productStatus.map((s: string) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Published date" hint="Filled with today when published"><input id="kp-date" type="date" className={inputCls} value={f.published_date} onChange={set('published_date')} /></Field>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnSecondary} onClick={() => onClose()}>Cancel</button>
          <button type="submit" className={btnPrimary}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Dissemination ----------
const RANGES = [{ id: '30', label: 'Last 30 days' }, { id: '90', label: 'Last 90 days' }, { id: '365', label: 'Last 12 months' }];

function Dissemination({ options }: { options: any }) {
  const [rows, load] = useList('/km/disseminations');
  const [products] = useList('/km/products');
  const [range, setRange] = useState('90');
  const [adding, setAdding] = useState(false);

  const inRange = useMemo(() => (rows || []).filter((r) => r.date >= daysAgo(Number(range))), [rows, range]);
  if (!rows) return <div className="text-sm text-slate-500">Loading dissemination log...</div>;

  const people = inRange.reduce((s, r) => s + r.people_reached, 0);
  const women = inRange.reduce((s, r) => s + r.women_reached, 0);
  const youth = inRange.reduce((s, r) => s + r.youth_reached, 0);
  const rated = inRange.filter((r) => r.feedback_score !== null);
  const avgFeedback = rated.length ? rated.reduce((s, r) => s + r.feedback_score, 0) / rated.length : null;
  const byChannel = options.channels
    .map((c: string) => ({ channel: c, people: inRange.filter((r) => r.channel === c).reduce((s, r) => s + r.people_reached, 0) }))
    .filter((c: any) => c.people > 0)
    .sort((a: any, b: any) => b.people - a.people);
  const byRegion = ['Luzon', 'Visayas', 'Mindanao', 'National'].map((reg) => ({
    region: reg, people: inRange.filter((r) => r.region === reg).reduce((s, r) => s + r.people_reached, 0),
  })).filter((r) => r.people > 0);

  return (
    <div className="space-y-5">
      <SectionHeader title="Dissemination"
        sub="Each time knowledge reaches members: the channel, the region and who was reached, including women and youth."
        action={
          <div className="flex gap-2">
            <select aria-label="Date range" value={range} onChange={(e) => setRange(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold">
              {RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <button className={btnPrimary} onClick={() => setAdding(true)}><Plus className="w-3 h-3 mr-2" /> Log activity</button>
          </div>
        } />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Activities" value={String(inRange.length)} />
        <Stat label="People reached" value={num(people)} />
        <Stat label="Women reached" value={people ? `${Math.round((women / people) * 100)}%` : '—'} sub={`${num(women)} people`} />
        <Stat label="Youth reached" value={people ? `${Math.round((youth / people) * 100)}%` : '—'} sub={`${num(youth)} people`} />
        <Stat label="Average feedback" value={avgFeedback ? `${avgFeedback.toFixed(1)} / 5` : '—'} sub={`From ${rated.length} rated sessions`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <section className={cn(card, 'xl:col-span-2')}>
          <header className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">People reached by channel</h3>
            <p className="text-[11px] text-slate-500">{RANGES.find((r) => r.id === range)?.label}</p>
          </header>
          <div className="p-4" style={{ height: Math.max(160, byChannel.length * 36 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byChannel} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={CHART.grid} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={CHART.tick} tickFormatter={num} />
                <YAxis type="category" dataKey="channel" width={130} axisLine={{ stroke: CHART.axis }} tickLine={false} tick={{ ...CHART.tick, fill: '#334155' }} />
                <Tooltip contentStyle={CHART.tooltip} cursor={{ fill: 'rgba(15,23,42,0.04)' }} formatter={(v: any) => [num(v), 'People reached']} />
                <Bar dataKey="people" fill="#2a78d6" radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className={card}>
          <header className="p-4 border-b border-slate-100"><h3 className="text-sm font-bold text-slate-900">Reach by region</h3></header>
          <ul className="p-4 space-y-3">
            {byRegion.length === 0 && <li className="text-xs text-slate-500">No activities in this period.</li>}
            {byRegion.map((r) => (
              <li key={r.region} className="text-xs">
                <div className="flex justify-between mb-1"><span className="font-semibold text-slate-800">{r.region}</span><span className="tabular-nums text-slate-600">{num(r.people)}</span></div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-[#2a78d6]" style={{ width: `${(r.people / people) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={card}>
        <header className="p-4 border-b border-slate-100"><h3 className="text-sm font-bold text-slate-900">Activity log</h3></header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-widest text-slate-500">
              <tr>
                <th className="py-2 px-4 font-bold">Date</th><th className="py-2 px-4 font-bold">Product</th><th className="py-2 px-4 font-bold">Channel</th>
                <th className="py-2 px-4 font-bold">Region</th><th className="py-2 px-4 font-bold text-right">People</th>
                <th className="py-2 px-4 font-bold text-right">Women</th><th className="py-2 px-4 font-bold text-right">Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inRange.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 px-4 whitespace-nowrap tabular-nums">{r.date}</td>
                  <td className="py-2 px-4">{r.product_title || <span className="text-slate-400">General information</span>}</td>
                  <td className="py-2 px-4 whitespace-nowrap">{r.channel}</td>
                  <td className="py-2 px-4">{r.region || '—'}</td>
                  <td className="py-2 px-4 text-right tabular-nums">{num(r.people_reached)}</td>
                  <td className="py-2 px-4 text-right tabular-nums">{num(r.women_reached)}</td>
                  <td className="py-2 px-4 text-right tabular-nums">{r.feedback_score ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {adding && <DisseminationForm options={options} products={(products || []).filter((p) => p.status === 'Published')} onClose={(r) => { setAdding(false); if (r) load(); }} />}
    </div>
  );
}

function DisseminationForm({ options, products, onClose }: { options: any; products: any[]; onClose: (reload?: boolean) => void }) {
  const [f, setF] = useState({ product_id: '', date: today(), channel: options.channels[0], region: 'Luzon', coops_reached: '', people_reached: '', women_reached: '', youth_reached: '', feedback_score: '', notes: '' });
  const [error, setError] = useState('');
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await fetchAPI('/km/disseminations', { method: 'POST', body: JSON.stringify(f) }); onClose(true); } catch (err: any) { setError(err.message); }
  };
  return (
    <Modal title="Log dissemination activity" onClose={() => onClose()}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Knowledge product"><select id="kd-product" className={inputCls} value={f.product_id} onChange={set('product_id')}><option value="">General information (no product)</option>{products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><input id="kd-date" type="date" required className={inputCls} value={f.date} onChange={set('date')} /></Field>
          <Field label="Channel"><select id="kd-channel" className={inputCls} value={f.channel} onChange={set('channel')}>{options.channels.map((c: string) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Region"><select id="kd-region" className={inputCls} value={f.region} onChange={set('region')}>{options.regions.map((r: string) => <option key={r}>{r}</option>)}</select></Field>
          <Field label="Coops reached"><input id="kd-coops" type="number" min="0" className={inputCls} value={f.coops_reached} onChange={set('coops_reached')} /></Field>
          <Field label="People reached"><input id="kd-people" type="number" min="0" required className={inputCls} value={f.people_reached} onChange={set('people_reached')} /></Field>
          <Field label="Women reached"><input id="kd-women" type="number" min="0" className={inputCls} value={f.women_reached} onChange={set('women_reached')} /></Field>
          <Field label="Youth reached" hint="Ages 15–30"><input id="kd-youth" type="number" min="0" className={inputCls} value={f.youth_reached} onChange={set('youth_reached')} /></Field>
          <Field label="Feedback score" hint="Average rating 1–5, if collected"><input id="kd-feedback" type="number" min="1" max="5" step="0.1" className={inputCls} value={f.feedback_score} onChange={set('feedback_score')} /></Field>
        </div>
        <Field label="Notes"><textarea id="kd-notes" rows={2} className={inputCls} value={f.notes} onChange={set('notes')} /></Field>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnSecondary} onClick={() => onClose()}>Cancel</button>
          <button type="submit" className={btnPrimary}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Information requests ----------
const REQUESTER_TYPES = ['Internal unit', 'Member coop', 'Board', 'Partner', 'Government agency'];
const REQUEST_CATEGORIES = ['Data / statistics', 'Analysis', 'Report', 'Technical information'];

function Requests({ options, departments }: { options: any; departments: any[] }) {
  const [rows, load] = useList('/km/requests');
  const [filter, setFilter] = useState('open');
  const [adding, setAdding] = useState(false);
  const [answering, setAnswering] = useState<any>(null);
  if (!rows) return <div className="text-sm text-slate-500">Loading requests...</div>;

  const isOpen = (r: any) => r.status === 'New' || r.status === 'In progress';
  const open = rows.filter(isOpen);
  const overdue = open.filter((r) => r.date_needed && r.date_needed < today());
  const monthStart = today().slice(0, 8) + '01';
  const answeredMonth = rows.filter((r) => r.date_answered && r.date_answered >= monthStart);
  const recent = rows.filter((r) => r.date_answered && r.date_answered >= daysAgo(90));
  const days = (r: any) => (new Date(r.date_answered).getTime() - new Date(r.date_received).getTime()) / 86400000;
  const avgDays = recent.length ? recent.reduce((s, r) => s + days(r), 0) / recent.length : null;
  const shown = rows.filter((r) => (filter === 'open' ? isOpen(r) : filter === 'done' ? !isOpen(r) : true));
  const setStatus = async (r: any, status: string) => {
    if (status === 'Answered' && !r.response) return setAnswering(r);
    await fetchAPI(`/km/requests/${r.id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    load();
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Information requests"
        sub="Questions for data, analysis or technical information from units, member coops, the board and partners, tracked until answered."
        action={<button className={btnPrimary} onClick={() => setAdding(true)}><Plus className="w-3 h-3 mr-2" /> Log request</button>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Open requests" value={String(open.length)} />
        <Stat label="Past due date" value={String(overdue.length)} alert={overdue.length > 0} />
        <Stat label="Answered this month" value={String(answeredMonth.length)} />
        <Stat label="Average days to answer" value={avgDays !== null ? avgDays.toFixed(1) : '—'} sub="Last 90 days" />
      </div>
      <div className="flex gap-2">
        {[['open', 'Open'], ['done', 'Answered / closed'], ['all', 'All']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} className={cn('px-3 py-1.5 rounded-lg text-xs font-bold border', filter === v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300')}>{l}</button>
        ))}
      </div>
      <section className={card}>
        <ul className="divide-y divide-slate-100">
          {shown.length === 0 && <li className="p-6 text-center text-xs text-slate-500">No requests.</li>}
          {shown.map((r) => {
            const late = isOpen(r) && r.date_needed && r.date_needed < today();
            return (
              <li key={r.id} className="p-4 flex flex-col sm:flex-row gap-3 text-xs">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="blue">{r.category}</Pill>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{r.requester}{r.requesting_dept ? ` · ${r.requesting_dept}` : ` · ${r.requester_type}`}</span>
                    {late && <Pill tone="red">Past due</Pill>}
                  </div>
                  <div className="font-semibold text-slate-900">{r.request}</div>
                  <div className="text-[11px] text-slate-500">
                    Received {r.date_received}{r.date_needed ? ` · needed by ${r.date_needed}` : ''}{r.assigned_to ? ` · ${r.assigned_to}` : ''}
                    {r.date_answered ? ` · answered ${r.date_answered} (${Math.round(days(r))} days)` : ''}
                  </div>
                  {r.response && <p className="text-slate-700 bg-slate-50 rounded p-2 mt-1"><b>Answer:</b> {r.response}</p>}
                </div>
                <div className="flex sm:flex-col gap-2 shrink-0">
                  <select aria-label="Request status" value={r.status} onChange={(e) => setStatus(r, e.target.value)} className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-semibold">
                    {options.requestStatus.map((s: string) => <option key={s}>{s}</option>)}
                  </select>
                  {isOpen(r) && <button className="text-[11px] font-bold text-emerald-700 hover:underline" onClick={() => setAnswering(r)}>Write answer</button>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      {adding && <RequestForm departments={departments} onClose={(x) => { setAdding(false); if (x) load(); }} />}
      {answering && <AnswerForm request={answering} onClose={(x) => { setAnswering(null); if (x) load(); }} />}
    </div>
  );
}

function RequestForm({ departments, onClose }: { departments: any[]; onClose: (reload?: boolean) => void }) {
  const [f, setF] = useState({ requester: '', requester_type: 'Internal unit', requesting_dept_id: '', category: REQUEST_CATEGORIES[0], request: '', date_received: today(), date_needed: '', assigned_to: '' });
  const [error, setError] = useState('');
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await fetchAPI('/km/requests', { method: 'POST', body: JSON.stringify(f) }); onClose(true); } catch (err: any) { setError(err.message); }
  };
  return (
    <Modal title="Log information request" onClose={() => onClose()}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Requested by"><input id="kr-requester" required className={inputCls} value={f.requester} onChange={set('requester')} placeholder="Name or coop" /></Field>
          <Field label="Requester type"><select id="kr-type" className={inputCls} value={f.requester_type} onChange={set('requester_type')}>{REQUESTER_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        </div>
        {f.requester_type === 'Internal unit' && (
          <Field label="Unit"><select id="kr-dept" className={inputCls} value={f.requesting_dept_id} onChange={set('requesting_dept_id')}><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        )}
        <Field label="Category"><select id="kr-category" className={inputCls} value={f.category} onChange={set('category')}>{REQUEST_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="What is needed"><textarea id="kr-request" required rows={3} className={inputCls} value={f.request} onChange={set('request')} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Received"><input id="kr-received" type="date" className={inputCls} value={f.date_received} onChange={set('date_received')} /></Field>
          <Field label="Needed by"><input id="kr-needed" type="date" className={inputCls} value={f.date_needed} onChange={set('date_needed')} /></Field>
          <Field label="Assigned to"><input id="kr-assigned" className={inputCls} value={f.assigned_to} onChange={set('assigned_to')} /></Field>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnSecondary} onClick={() => onClose()}>Cancel</button>
          <button type="submit" className={btnPrimary}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

function AnswerForm({ request, onClose }: { request: any; onClose: (reload?: boolean) => void }) {
  const [response, setResponse] = useState(request.response || '');
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchAPI(`/km/requests/${request.id}`, { method: 'PUT', body: JSON.stringify({ status: 'Answered', response }) });
    onClose(true);
  };
  return (
    <Modal title="Answer request" onClose={() => onClose()}>
      <form onSubmit={save} className="space-y-3">
        <p className="text-xs text-slate-700"><b>{request.requester}:</b> {request.request}</p>
        <Field label="Answer or where it was sent" hint="Marks the request as answered today"><textarea id="ka-response" required rows={4} className={inputCls} value={response} onChange={(e) => setResponse(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={() => onClose()}>Cancel</button>
          <button type="submit" className={btnPrimary}>Mark answered</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Market prices ----------
const REGION_COLORS: Record<string, string> = { Luzon: '#2a78d6', Visayas: '#eb6834', Mindanao: '#1baf7a', National: '#6250d6' };
const PRICE_TYPES = ['Farmgate', 'Wholesale', 'Retail'];

function Prices({ options }: { options: any }) {
  const [rows, load] = useList('/km/prices');
  const [priceType, setPriceType] = useState('Farmgate');
  const [commodity, setCommodity] = useState('');
  const [adding, setAdding] = useState(false);
  if (!rows) return <div className="text-sm text-slate-500">Loading prices...</div>;

  const typed = rows.filter((r) => r.price_type === priceType);
  const commodities = Array.from(new Set(typed.map((r) => r.commodity))).sort() as string[];
  const selected = commodity && commodities.includes(commodity) ? commodity : commodities[0];
  const regions = Array.from(new Set(typed.map((r) => r.region))) as string[];

  // Latest price per commodity and region, compared with about 4 weeks earlier.
  const latest = commodities.flatMap((c) => regions.map((reg) => {
    const series = typed.filter((r) => r.commodity === c && r.region === reg).sort((a, b) => b.date.localeCompare(a.date));
    if (!series.length) return null;
    const now = series[0];
    const before = series.find((r) => r.date <= new Date(new Date(now.date).getTime() - 26 * 86400000).toISOString().slice(0, 10));
    return { ...now, change: before ? ((now.price - before.price) / before.price) * 100 : null };
  }).filter(Boolean)) as any[];

  const dates = Array.from(new Set(typed.filter((r) => r.commodity === selected).map((r) => r.date))).sort() as string[];
  const trend = dates.map((d) => {
    const row: any = { date: d };
    typed.filter((r) => r.commodity === selected && r.date === d).forEach((r) => { row[r.region] = r.price; });
    return row;
  });
  const unit = typed.find((r) => r.commodity === selected)?.unit || 'kg';

  return (
    <div className="space-y-5">
      <SectionHeader title="Market prices"
        sub="Prices of members' main commodities by region, collected weekly. Shared with members through the market bulletin and used by SMS for buying decisions."
        action={
          <div className="flex gap-2">
            <select aria-label="Price type" value={priceType} onChange={(e) => setPriceType(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold">
              {PRICE_TYPES.map((p) => <option key={p}>{p}</option>)}
            </select>
            <button className={btnPrimary} onClick={() => setAdding(true)}><Plus className="w-3 h-3 mr-2" /> Record price</button>
          </div>
        } />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 xl:items-start">
        <section className={cn(card, 'xl:col-span-2 overflow-hidden')}>
          <header className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Latest {priceType.toLowerCase()} prices</h3>
            <p className="text-[11px] text-slate-500">Change compared with about 4 weeks earlier</p>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-widest text-slate-500">
                <tr><th className="py-2 px-4 font-bold">Commodity</th><th className="py-2 px-4 font-bold">Region</th><th className="py-2 px-4 font-bold text-right">Price</th><th className="py-2 px-4 font-bold text-right">4-week change</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {latest.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-500">No prices recorded.</td></tr>}
                {latest.map((r) => (
                  <tr key={`${r.commodity}-${r.region}`} className={cn('cursor-pointer hover:bg-slate-50', r.commodity === selected && 'bg-emerald-50/50')} onClick={() => setCommodity(r.commodity)}>
                    <td className="py-2 px-4 font-semibold text-slate-900">{r.commodity}</td>
                    <td className="py-2 px-4">{r.region}</td>
                    <td className="py-2 px-4 text-right tabular-nums">₱{r.price.toFixed(2)}<span className="text-slate-400">/{r.unit}</span></td>
                    <td className="py-2 px-4 text-right tabular-nums">
                      {r.change === null ? '—' : (
                        <span className="inline-flex items-center gap-0.5 font-semibold text-slate-700">
                          {r.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {r.change >= 0 ? '+' : ''}{r.change.toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={cn(card, 'xl:col-span-3')}>
          <header className="p-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{selected || 'Price trend'}</h3>
              <p className="text-[11px] text-slate-500">{priceType} price per {unit}, by region</p>
            </div>
            <select aria-label="Commodity" value={selected || ''} onChange={(e) => setCommodity(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold">
              {commodities.map((c) => <option key={c}>{c}</option>)}
            </select>
          </header>
          <div className="h-80 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="date" axisLine={{ stroke: CHART.axis }} tickLine={false} tick={CHART.tick}
                  tickFormatter={(d) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} minTickGap={24} />
                <YAxis axisLine={false} tickLine={false} tick={CHART.tick} domain={['auto', 'auto']} tickFormatter={(v) => `₱${v}`} width={48} />
                <Tooltip contentStyle={CHART.tooltip} labelFormatter={(d) => new Date(d).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                  formatter={(v: any, n: any) => [`₱${Number(v).toFixed(2)}/${unit}`, n]} />
                <Legend iconType="plainline" formatter={(n: string) => <span style={{ color: '#334155', fontSize: 11 }}>{n}</span>} />
                {regions.map((reg) => (
                  <Line key={reg} type="monotone" dataKey={reg} stroke={REGION_COLORS[reg] || '#52514e'} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      {adding && <PriceForm options={options} commodities={Array.from(new Set(rows.map((r) => r.commodity)))} onClose={(x) => { setAdding(false); if (x) load(); }} />}
    </div>
  );
}

function PriceForm({ options, commodities, onClose }: { options: any; commodities: string[]; onClose: (reload?: boolean) => void }) {
  const [f, setF] = useState({ commodity: commodities[0] || '', unit: 'kg', price_type: 'Farmgate', region: 'Luzon', market: '', price: '', date: today(), source: '' });
  const [error, setError] = useState('');
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await fetchAPI('/km/prices', { method: 'POST', body: JSON.stringify(f) }); onClose(true); } catch (err: any) { setError(err.message); }
  };
  return (
    <Modal title="Record a price" onClose={() => onClose()}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Commodity" hint="Pick from the list or type a new one">
          <input id="kpr-commodity" list="kpr-commodities" required className={inputCls} value={f.commodity} onChange={set('commodity')} />
          <datalist id="kpr-commodities">{commodities.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (₱)"><input id="kpr-price" type="number" min="0.01" step="0.01" required className={inputCls} value={f.price} onChange={set('price')} /></Field>
          <Field label="Per"><select id="kpr-unit" className={inputCls} value={f.unit} onChange={set('unit')}>{['kg', 'cavan (50 kg)', 'piece', 'head', 'liter'].map((u) => <option key={u}>{u}</option>)}</select></Field>
          <Field label="Price type"><select id="kpr-type" className={inputCls} value={f.price_type} onChange={set('price_type')}>{PRICE_TYPES.map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Region"><select id="kpr-region" className={inputCls} value={f.region} onChange={set('region')}>{options.regions.map((r: string) => <option key={r}>{r}</option>)}</select></Field>
          <Field label="Market / location"><input id="kpr-market" className={inputCls} value={f.market} onChange={set('market')} /></Field>
          <Field label="Date"><input id="kpr-date" type="date" required className={inputCls} value={f.date} onChange={set('date')} /></Field>
        </div>
        <Field label="Source"><input id="kpr-source" className={inputCls} value={f.source} onChange={set('source')} placeholder="e.g. Member coop report, DA price monitoring" /></Field>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnSecondary} onClick={() => onClose()}>Cancel</button>
          <button type="submit" className={btnPrimary}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Member data quality ----------
function DataQuality() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetchAPI('/km/data-quality').then(setData).catch(() => setData({ overall: 0, coops: [] })); }, []);
  if (!data) return <div className="text-sm text-slate-500">Checking member data...</div>;
  const weak = data.coops.filter((c: any) => c.score < 85);
  const noReport = data.coops.filter((c: any) => !c.reports_last_12m);
  const members = data.coops.reduce((s: number, c: any) => s + c.members, 0);
  const bar = (v: number) => (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden" aria-hidden>
        <div className="h-full" style={{ width: `${v}%`, background: v >= 85 ? '#0ca30c' : v >= 70 ? '#fab219' : '#d03b3b' }} />
      </div>
      <span className="tabular-nums">{v}%</span>
    </div>
  );
  return (
    <div className="space-y-5">
      <SectionHeader title="Member data quality"
        sub="Checks the membership database for missing member details, incomplete coop profiles and coops without recent M&E reports. Good data here is what makes every other report reliable." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Member data complete" value={`${data.overall}%`} sub={`${num(members)} member records`} alert={data.overall < 70} />
        <Stat label="Coops checked" value={String(data.coops.length)} />
        <Stat label="Coops needing follow-up" value={String(weak.length)} sub="Quality score below 85" alert={weak.length > 0} />
        <Stat label="No report in 12 months" value={String(noReport.length)} alert={noReport.length > 0} />
      </div>
      <section className={card}>
        <header className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Cooperatives, lowest quality first</h3>
          <p className="text-[11px] text-slate-500">Score = member details 60% + coop profile 20% + report in last 12 months 20%</p>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-widest text-slate-500">
              <tr>
                <th className="py-2 px-4 font-bold">Cooperative</th><th className="py-2 px-4 font-bold text-right">Members</th>
                <th className="py-2 px-4 font-bold">Member details</th><th className="py-2 px-4 font-bold">Coop profile</th>
                <th className="py-2 px-4 font-bold">Last report</th><th className="py-2 px-4 font-bold text-right">Score</th><th className="py-2 px-4 font-bold">To fix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.coops.map((c: any) => (
                <tr key={c.coop_id}>
                  <td className="py-2.5 px-4"><div className="font-semibold text-slate-900">{c.name}</div><div className="text-[11px] text-slate-500">{c.location || 'No location'}</div></td>
                  <td className="py-2.5 px-4 text-right tabular-nums">{c.members}</td>
                  <td className="py-2.5 px-4">{bar(c.member_completeness)}</td>
                  <td className="py-2.5 px-4">{bar(c.profile_completeness)}</td>
                  <td className="py-2.5 px-4 whitespace-nowrap tabular-nums">{c.last_report || <span className="text-slate-400">None</span>}</td>
                  <td className={cn('py-2.5 px-4 text-right font-bold tabular-nums', c.score < 85 ? 'text-red-700' : 'text-slate-900')}>{c.score}</td>
                  <td className="py-2.5 px-4 text-[11px] text-slate-600">{c.missing.length ? c.missing.join('; ') : <span className="text-green-800 font-semibold">Complete</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
