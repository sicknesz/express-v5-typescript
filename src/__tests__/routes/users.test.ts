import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import usersRouter from '../../routes/users.ts';

/**
 * Tests for GET /users route defined in routes/users.ts
 *
 * The route calls `res.send('respond with a resource')`.
 */
describe('routes/users', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use('/', usersRouter);
  });

  it('GET / should return 200', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });

  it('GET / should return the expected text body', async () => {
    const res = await request(app).get('/');
    expect(res.text).toBe('respond with a resource');
  });

  it('GET / should have content-type text/html', async () => {
    const res = await request(app).get('/');
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  it('POST / should return 404 or 405 (only GET is defined)', async () => {
    const res = await request(app).post('/');
    expect([404, 405]).toContain(res.status);
  });

  it('GET /nonexistent should return 404', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
  });
});
