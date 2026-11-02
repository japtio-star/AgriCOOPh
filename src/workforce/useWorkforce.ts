import { useCallback, useEffect, useReducer, useState } from 'react';
import type { WorkforceEvent, WorkforceSnapshot } from '../shared/workforce';

// Live connection to the orchestration engine: an initial snapshot followed by
// incremental events over Server-Sent Events. Reconnects automatically.

type Action = { type: 'snapshot'; snapshot: WorkforceSnapshot } | { type: 'event'; event: WorkforceEvent };

function upsert<T extends { id: number }>(list: T[], item: T, order: 'asc' | 'desc' = 'desc') {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) {
    const next = list.slice();
    next[i] = item;
    return next;
  }
  return order === 'desc' ? [item, ...list] : [...list, item];
}

function reducer(state: WorkforceSnapshot | null, action: Action): WorkforceSnapshot | null {
  if (action.type === 'snapshot') return action.snapshot;
  if (!state) return state;
  const ev = action.event;
  switch (ev.type) {
    case 'employee':
      return { ...state, employees: upsert(state.employees, ev.employee, 'asc') };
    case 'task':
      return { ...state, tasks: upsert(state.tasks, ev.task) };
    case 'approval':
      return { ...state, approvals: upsert(state.approvals, ev.approval) };
    case 'project':
      return { ...state, projects: upsert(state.projects, ev.project) };
    case 'report':
      return { ...state, reports: upsert(state.reports, ev.report) };
    case 'activity':
      return { ...state, activity: [...state.activity, ev.activity].slice(-250) };
    default:
      return state;
  }
}

export type Connection = 'connecting' | 'live' | 'reconnecting';

export function useWorkforce() {
  const [data, dispatch] = useReducer(reducer, null);
  const [connection, setConnection] = useState<Connection>('connecting');

  useEffect(() => {
    const token = localStorage.getItem('amds_token') || '';
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      es = new EventSource(`/api/workforce/stream?token=${encodeURIComponent(token)}`);
      es.addEventListener('snapshot', (e) => {
        dispatch({ type: 'snapshot', snapshot: JSON.parse((e as MessageEvent).data) });
        setConnection('live');
      });
      es.onmessage = (e) => dispatch({ type: 'event', event: JSON.parse(e.data) });
      es.onerror = () => {
        es?.close();
        if (closed) return;
        setConnection('reconnecting');
        retry = setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      closed = true;
      es?.close();
      clearTimeout(retry);
    };
  }, []);

  return { data, connection };
}

// POST helper that surfaces errors instead of logging the user out on 403
// (non-owners are allowed to watch but not to act).
export async function workforceAction<T = unknown>(path: string, body?: unknown): Promise<T> {
  const token = localStorage.getItem('amds_token');
  const res = await fetch(`/api/workforce${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as T;
}

export async function workforceGet<T = unknown>(path: string): Promise<T> {
  const token = localStorage.getItem('amds_token');
  const res = await fetch(`/api/workforce${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as T;
}

export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (path: string, body?: unknown) => {
    setPending(true);
    setError(null);
    try {
      return await workforceAction(path, body);
    } catch (e: any) {
      setError(e.message);
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);
  return { run, pending, error, setError };
}

// Server timestamps are UTC "YYYY-MM-DD HH:MM:SS".
export function parseTs(ts: string | null | undefined) {
  if (!ts) return null;
  return new Date(ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z');
}
