/// <reference types="vite/client" />
// Login session storage. In the static preview build (VITE_DEMO=1) nothing is kept
// between visits, and storage errors (private mode, blocked storage) are tolerated.
export const DEMO = import.meta.env.VITE_DEMO === '1';

const memory: Record<string, string> = {};
const read = (k: string) => {
  if (DEMO) return memory[k] ?? null;
  try { return localStorage.getItem(k); } catch { return memory[k] ?? null; }
};
const write = (k: string, v: string) => {
  memory[k] = v;
  if (!DEMO) try { localStorage.setItem(k, v); } catch { /* memory only */ }
};
const remove = (k: string) => {
  delete memory[k];
  if (!DEMO) try { localStorage.removeItem(k); } catch { /* ignore */ }
};

export const session = {
  token: () => read('amds_token'),
  user: (): any => JSON.parse(read('amds_user') || 'null'),
  save(token: string, user: any) {
    write('amds_token', token);
    write('amds_user', JSON.stringify(user));
  },
  clear() {
    remove('amds_token');
    remove('amds_user');
  },
};
