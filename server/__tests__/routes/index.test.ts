import { describe, it, expect, vi, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import indexRouter from '../../routes/index.ts';

/**
 * Tests for GET / route defined in routes/index.ts
 *
 * The route calls `res.render('index', { title: ... })`.
 * To avoid needing a real view engine, we set a custom `render`
 * implementation on the app that returns JSON, allowing us to
 * assert on the template name and locals that were passed.
 */
describe('routes/index', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();

    // Stub the view engine: intercept res.render and return JSON
    app.use((req, res, next) => {
      res.render = ((view: string, options?: object) => {
        res.json({ view, options });
      }) as any;
      next();
    });

    app.use('/', indexRouter);
  });

  it('GET / should return 200', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });

  it('GET / should render the "index" template', async () => {
    const res = await request(app).get('/');
    expect(res.body.view).toBe('index');
  });

  it('GET / should pass a title to the template', async () => {
    const res = await request(app).get('/');
    expect(res.body.options).toHaveProperty('title');
    expect(res.body.options.title).toBe('Hello from express v5 running in typescript');
  });

  it('POST / should return 404 or 405 (only GET is defined)', async () => {
    const res = await request(app).post('/');
    // Express returns 404 for undefined method+path combos
    expect([404, 405]).toContain(res.status);
  });
});
