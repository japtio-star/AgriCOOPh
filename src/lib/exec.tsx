import type React from 'react';
import { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, Clock } from 'lucide-react';
import { cn } from './utils';
import { session } from './session';

export type Status = 'on-track' | 'at-risk' | 'off-track' | 'no-data' | 'no-update';

export const currentUser = () => session.user() || {};
export const isExecutive = (user: any) => user?.role === 'Super Admin' || user?.role === 'Executive';

// Reserved status colors. Always shown with an icon and a label, never color alone.
export const STATUS_META: Record<Status, { label: string; color: string; bg: string; text: string; Icon: any }> = {
  'on-track': { label: 'On track', color: '#0ca30c', bg: 'bg-green-50', text: 'text-green-800', Icon: CheckCircle2 },
  'at-risk': { label: 'At risk', color: '#fab219', bg: 'bg-amber-50', text: 'text-amber-800', Icon: AlertTriangle },
  'off-track': { label: 'Off track', color: '#d03b3b', bg: 'bg-red-50', text: 'text-red-800', Icon: XCircle },
  'no-data': { label: 'No data', color: '#94a3b8', bg: 'bg-slate-100', text: 'text-slate-600', Icon: MinusCircle },
  'no-update': { label: 'No update', color: '#94a3b8', bg: 'bg-slate-100', text: 'text-slate-600', Icon: Clock },
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const m = STATUS_META[status] || STATUS_META['no-data'];
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider whitespace-nowrap', m.bg, m.text, className)}>
      <m.Icon className="w-3 h-3" style={{ color: m.color }} aria-hidden />
      {m.label}
    </span>
  );
}

// Fixed identity colors for the income services (validated categorical order).
export const SERVICE_COLORS: Record<string, string> = {
  SMS: '#2a78d6',
  TRN: '#eb6834',
  DIG: '#1baf7a',
  AGB: '#eda100',
  CRD: '#e87ba4',
};
export const serviceColor = (code: string, i = 0) =>
  SERVICE_COLORS[code] || ['#008300', '#6250d6', '#e34948'][i % 3];

export const CHART = {
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  tick: { fill: '#64748B', fontSize: 10 },
  ink: '#52514e',
  tooltip: { borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontSize: 12 },
};

export function formatPHP(v: number | null | undefined, compact = false) {
  if (v === null || v === undefined) return '—';
  if (compact) {
    const abs = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}₱${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
    if (abs >= 1_000) return `${sign}₱${Math.round(abs / 1_000)}K`;
  }
  return `${v < 0 ? '-' : ''}₱${Math.round(Math.abs(v)).toLocaleString('en-PH')}`;
}

export function formatValue(v: number | null | undefined, unit: string, compact = false) {
  if (v === null || v === undefined) return '—';
  if (unit === 'PHP') return formatPHP(v, compact);
  if (unit === '%') return `${Number(v.toFixed(1))}%`;
  if (unit === 'count') return Math.round(v).toLocaleString('en-PH');
  return `${Number(v.toFixed(1)).toLocaleString('en-PH')} ${unit}`;
}

export function periodLabel(p: string, short = false) {
  if (!p) return '';
  const [y, m] = p.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-PH', short ? { month: 'short' } : { month: 'long', year: 'numeric' });
}

export function pct(a: number, b: number) {
  if (!b) return null;
  return Math.round((a / b) * 100);
}

export const cooLabel = (settings: any) =>
  settings?.coo_name ? `COO: ${settings.coo_name}` : 'COO: vacant (CEO acting)';

export const inputCls =
  'block w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500';
export const btnPrimary =
  'inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg shadow-sm hover:bg-emerald-700 transition-colors uppercase tracking-tight disabled:opacity-50';
export const btnSecondary =
  'inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-colors uppercase tracking-tight';
export const card = 'bg-white rounded-xl border border-slate-200 shadow-sm';

export function PeriodSelect({ value, periods, onChange }: { value: string; periods: string[]; onChange: (p: string) => void }) {
  const list = periods.includes(value) ? periods : [value, ...periods];
  return (
    <label className="flex items-center gap-2 text-xs text-slate-600">
      <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Period</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none">
        {list.map((p) => (
          <option key={p} value={p}>{periodLabel(p)}</option>
        ))}
      </select>
    </label>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 overflow-y-auto" onClick={onClose}>
      <div className={cn('bg-white rounded-xl shadow-xl w-full my-8', wide ? 'max-w-3xl' : 'max-w-lg')} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg leading-none" aria-label="Close">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}
