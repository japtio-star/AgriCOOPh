// Static preview: answers API calls from a snapshot of the sample data
// (src/demo-data.json, made by `npm run demo:capture`). Changes are not saved.
import { session } from './session';

const files = import.meta.glob('../demo-data.json', { eager: true, import: 'default' }) as Record<string, any>;
const snapshot: { responses: Record<string, any>; users: any[] } = Object.values(files)[0] || { responses: {}, users: [] };

export const demoUsers = snapshot.users;

const clone = (v: any) => JSON.parse(JSON.stringify(v));

export async function demoFetch(endpoint: string, options: RequestInit = {}) {
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET') return { ok: true, id: 0 };

  const user = session.user() || {};
  const exec = user.role === 'Executive' || user.role === 'Super Admin';
  const [path] = endpoint.split('?');
  const r = snapshot.responses;
  let data = r[endpoint] ?? r[path];
  if (data === undefined) throw new Error('Not available in this preview.');
  data = clone(data);

  if (!exec) {
    if (path === '/exec/overview' || path === '/exec/decisions') throw new Error('Executive access only.');
    const m = path.match(/^\/exec\/departments\/(\d+)$/);
    if (m && Number(m[1]) !== Number(user.dept_id)) throw new Error('Not allowed.');
    if (path === '/exec/departments') data.departments = data.departments.filter((d: any) => d.id === Number(user.dept_id));
    if (path === '/exec/issues') data = data.filter((i: any) => i.dept_id === Number(user.dept_id));
  }
  return data;
}
