import express from 'express';
import jwt from 'jsonwebtoken';
import { DEPARTMENTS, type DepartmentId, type WorkforceEvent } from '../../src/shared/workforce';
import { HttpError, type WorkforceEngine } from './engine';
import { createCustomTask, createImplementationReport } from './pipelines';

// REST + Server-Sent Events API for the virtual office. Any signed-in user can
// observe; only the owner (Super Admin) can commission work, decide approvals,
// or change who is on duty.

export function workforceRouter(engine: WorkforceEngine, jwtSecret: string) {
  const router = express.Router();

  const auth = (req: any, res: any, next: any) => {
    const header = req.headers['authorization'];
    // EventSource cannot send headers, so the stream passes the token as a query param.
    const token = (header && header.split(' ')[1]) || (typeof req.query.token === 'string' ? req.query.token : null);
    if (!token) return res.sendStatus(401);
    jwt.verify(token, jwtSecret, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  const owner = (req: any, res: any, next: any) => {
    if (req.user?.role !== 'Super Admin') return res.status(403).json({ error: 'Only the owner (Super Admin) can do this' });
    next();
  };

  const who = (req: any) => {
    const row = engine.db.prepare('SELECT name FROM Users WHERE id = ?').get(req.user.id) as { name: string } | undefined;
    return row?.name ?? `user ${req.user.id}`;
  };

  const handle = (fn: (req: any, res: any) => any) => (req: any, res: any) => {
    try {
      const out = fn(req, res);
      if (out !== undefined) res.json(out);
    } catch (e: any) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
      console.error(e);
      res.status(500).json({ error: 'Internal error' });
    }
  };

  router.use(auth);

  router.get('/snapshot', handle(() => engine.snapshot()));

  router.get('/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`event: snapshot\ndata: ${JSON.stringify(engine.snapshot())}\n\n`);
    const onEvent = (ev: WorkforceEvent) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
    engine.on('event', onEvent);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => {
      clearInterval(ping);
      engine.off('event', onEvent);
    });
  });

  router.get('/tasks/:id', handle((req) => {
    const task = engine.store.task(Number(req.params.id));
    if (!task) throw new HttpError(404, 'Task not found');
    return { task, activity: engine.store.taskActivity(task.id) };
  }));

  router.get('/reports/:id', handle((req) => {
    const report = engine.store.report(Number(req.params.id));
    if (!report) throw new HttpError(404, 'Report not found');
    return report;
  }));

  router.post('/projects', owner, handle((req) => {
    const kind = req.body?.kind ?? 'implementation_report';
    if (kind !== 'implementation_report') throw new HttpError(400, `Unknown project kind: ${kind}`);
    const running = engine.store.projects().find((p) => p.kind === kind && p.status === 'running');
    if (running) throw new HttpError(409, `Project #${running.id} is already in progress`);
    return createImplementationReport(engine, who(req));
  }));

  router.post('/tasks', owner, handle((req) => {
    const { title, instructions, department, requires_approval } = req.body ?? {};
    if (!title || typeof title !== 'string') throw new HttpError(400, 'title is required');
    if (!DEPARTMENTS.some((d) => d.id === department)) throw new HttpError(400, 'department is invalid');
    return createCustomTask(engine, who(req), {
      title: title.slice(0, 200), instructions: typeof instructions === 'string' ? instructions.slice(0, 4000) : undefined,
      department: department as DepartmentId, requires_approval: !!requires_approval,
    });
  }));

  router.post('/tasks/:id/retry', owner, handle((req) => engine.retry(Number(req.params.id))));
  router.post('/tasks/:id/cancel', owner, handle((req) => {
    engine.cancel(Number(req.params.id), who(req));
    return { ok: true };
  }));

  router.post('/approvals/:id/decision', owner, handle((req) => {
    const { decision, note } = req.body ?? {};
    if (decision !== 'approved' && decision !== 'rejected') throw new HttpError(400, 'decision must be approved or rejected');
    return engine.decide(Number(req.params.id), decision, who(req), typeof note === 'string' && note.trim() ? note.trim().slice(0, 1000) : null);
  }));

  router.post('/employees/:id/duty', owner, handle((req) => {
    engine.setDuty(Number(req.params.id), !!req.body?.on_duty);
    return engine.store.employee(Number(req.params.id));
  }));

  router.post('/employees/:id/acknowledge', owner, handle((req) => {
    engine.acknowledge(Number(req.params.id));
    return engine.store.employee(Number(req.params.id));
  }));

  return router;
}
