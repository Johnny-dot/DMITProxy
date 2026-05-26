import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const VALID_TOKEN = 'test-token-1234567890abcdef';
const SERVICE_ID = 168117;

async function bootApp(envOverrides: Record<string, string | undefined>) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmit-test-'));
  process.env.DATA_DIR = dataDir;
  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
  const { createApp } = await import('../app.js');
  const app = createApp();
  return { app, dataDir };
}

afterEach(() => {
  delete process.env.DMIT_SYNC_TOKEN;
  delete process.env.DMIT_SERVICE_ID;
});

describe('POST /local/dmit/traffic', () => {
  it('returns 503 when DMIT_SYNC_TOKEN is unset', async () => {
    const { app } = await bootApp({
      DMIT_SYNC_TOKEN: undefined,
      DMIT_SERVICE_ID: String(SERVICE_ID),
    });
    const r = await request(app).post('/local/dmit/traffic').send({ service_id: SERVICE_ID });
    expect(r.status).toBe(503);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const { app } = await bootApp({
      DMIT_SYNC_TOKEN: VALID_TOKEN,
      DMIT_SERVICE_ID: String(SERVICE_ID),
    });
    const r = await request(app).post('/local/dmit/traffic').send({ service_id: SERVICE_ID });
    expect(r.status).toBe(401);
  });

  it('returns 401 when the bearer token does not match', async () => {
    const { app } = await bootApp({
      DMIT_SYNC_TOKEN: VALID_TOKEN,
      DMIT_SERVICE_ID: String(SERVICE_ID),
    });
    const r = await request(app)
      .post('/local/dmit/traffic')
      .set('Authorization', 'Bearer wrong')
      .send({ service_id: SERVICE_ID, bwusage: 1, bwlimit: 1024000 });
    expect(r.status).toBe(401);
  });

  it('returns 400 when service_id does not match DMIT_SERVICE_ID', async () => {
    const { app } = await bootApp({
      DMIT_SYNC_TOKEN: VALID_TOKEN,
      DMIT_SERVICE_ID: String(SERVICE_ID),
    });
    const r = await request(app)
      .post('/local/dmit/traffic')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ service_id: 999999, bwusage: 1, bwlimit: 1024000 });
    expect(r.status).toBe(400);
  });

  it('returns 400 when bwusage / bwlimit are missing or negative', async () => {
    const { app } = await bootApp({
      DMIT_SYNC_TOKEN: VALID_TOKEN,
      DMIT_SERVICE_ID: String(SERVICE_ID),
    });
    const r = await request(app)
      .post('/local/dmit/traffic')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ service_id: SERVICE_ID, bwusage: -1, bwlimit: 1024000 });
    expect(r.status).toBe(400);
  });

  it('200s on a valid payload and writes the row', async () => {
    const { app } = await bootApp({
      DMIT_SYNC_TOKEN: VALID_TOKEN,
      DMIT_SERVICE_ID: String(SERVICE_ID),
    });
    const r = await request(app)
      .post('/local/dmit/traffic')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({
        service_id: SERVICE_ID,
        bwusage: 712482,
        bwlimit: 1024000,
        bwusage_in: 355266,
        bwusage_out: 357216,
        usage_percentage: 69.58,
      });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true });
    expect(typeof r.body.updated_at).toBe('number');

    const { getDmitTrafficSnapshot } = await import('../dmit-traffic-store.js');
    const snap = getDmitTrafficSnapshot(SERVICE_ID);
    expect(snap).not.toBeNull();
    expect(snap!.bwusageBytes).toBe(712482 * 1024 * 1024);
    expect(snap!.source).toBe('tampermonkey');
  });
});
