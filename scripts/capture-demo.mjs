// Captures API responses from a running dev server (npm run dev) into
// src/demo-data.json for the static preview build (npm run build:demo).
import fs from 'fs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const login = async (email) => {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'admin123' }),
  });
  return r.json();
};

const ceo = await login('ceo@agricooph.com');
const head = await login('sms.head@agricooph.com');
const get = async (ep) => {
  const r = await fetch(`${BASE}/api${ep}`, { headers: { authorization: `Bearer ${ceo.token}` } });
  if (!r.ok) throw new Error(`${ep}: ${r.status}`);
  return r.json();
};

const responses = {};
const grab = async (ep) => { responses[ep] = await get(ep); return responses[ep]; };

for (const ep of ['/dashboard', '/members', '/cooperatives', '/reports', '/exec/issues', '/exec/decisions']) await grab(ep);
const overview = await grab('/exec/overview');
const depts = await grab('/exec/departments');
const [y, m] = overview.period.split('-').map(Number);
const next = `${m === 12 ? y + 1 : y}-${String((m % 12) + 1).padStart(2, '0')}`;
const periods = [next, ...overview.periods];
for (const p of overview.periods) await grab(`/exec/overview?period=${p}`);
for (const d of depts.departments) {
  await grab(`/exec/departments/${d.id}`);
  for (const p of periods) await grab(`/exec/departments/${d.id}?period=${p}`);
}

fs.writeFileSync('src/demo-data.json', JSON.stringify({ responses, users: [ceo.user, head.user] }));
console.log(`Saved ${Object.keys(responses).length} responses to src/demo-data.json`);
