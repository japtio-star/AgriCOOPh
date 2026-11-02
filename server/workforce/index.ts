import type Database from 'better-sqlite3';
import { WorkforceEngine } from './engine';
import { PIPELINES } from './pipelines';
import { initWorkforceSchema } from './store';

export { workforceRouter } from './routes';

export function startWorkforce(db: Database.Database, dbFile: string) {
  initWorkforceSchema(db);
  const engine = new WorkforceEngine(db, dbFile);
  for (const p of PIPELINES) engine.register(p);
  engine.start();
  return engine;
}
