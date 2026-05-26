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

describe('POST /local/dmit/traffic — billing day auto-sync', () => {
  it('returns billing_day_action: applied on first sync and writes billing day to xui_inbound_billing', async () => {
    const { app } = await bootApp({
      DMIT_SYNC_TOKEN: VALID_TOKEN,
      DMIT_SERVICE_ID: String(SERVICE_ID),
    });

    // Mock the 3X-UI fetch so the handler can enumerate inbounds without network.
    const xuiAdmin = await import('../xui-admin.js');
    vi.spyOn(xuiAdmin, 'getXuiCredentials').mockReturnValue({
      username: 'u',
      password: 'p',
    });
    vi.spyOn(xuiAdmin, 'loginAndListInbounds').mockResolvedValue([
      { id: 11, enable: true } as never,
      { id: 12, enable: true } as never,
    ]);

    const r = await request(app)
      .post('/local/dmit/traffic')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({
        service_id: SERVICE_ID,
        bwusage: 100,
        bwlimit: 1024000,
        next_reset_day: 3,
        next_reset_at: Date.now() + 8 * 86400_000,
      });

    expect(r.status).toBe(200);
    expect(r.body.billing_day_action).toBe('applied');

    const { listBillingConfigs } = await import('../xui-billing.js');
    const configs = listBillingConfigs();
    expect(configs.find((c) => c.inboundId === 11)?.billingDay).toBe(3);
    expect(configs.find((c) => c.inboundId === 12)?.billingDay).toBe(3);

    const { getDmitTrafficSnapshot } = await import('../dmit-traffic-store.js');
    expect(getDmitTrafficSnapshot(SERVICE_ID)!.autoAppliedBillingDay).toBe(3);
  });

  it('does not overwrite an inbound that already has billing_day set', async () => {
    const { app } = await bootApp({
      DMIT_SYNC_TOKEN: VALID_TOKEN,
      DMIT_SERVICE_ID: String(SERVICE_ID),
    });

    // Pre-configure inbound 11 with billing day = 7
    const { setBillingDay, listBillingConfigs } = await import('../xui-billing.js');
    setBillingDay(11, 7);

    const xuiAdmin = await import('../xui-admin.js');
    vi.spyOn(xuiAdmin, 'getXuiCredentials').mockReturnValue({
      username: 'u',
      password: 'p',
    });
    vi.spyOn(xuiAdmin, 'loginAndListInbounds').mockResolvedValue([
      { id: 11, enable: true } as never,
      { id: 12, enable: true } as never,
    ]);

    await request(app)
      .post('/local/dmit/traffic')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({
        service_id: SERVICE_ID,
        bwusage: 100,
        bwlimit: 1024000,
        next_reset_day: 3,
        next_reset_at: Date.now() + 8 * 86400_000,
      });

    const configs = listBillingConfigs();
    expect(configs.find((c) => c.inboundId === 11)?.billingDay).toBe(7); // untouched
    expect(configs.find((c) => c.inboundId === 12)?.billingDay).toBe(3); // newly applied
  });

  it('returns billing_day_action: mismatch on subsequent sync when DMIT changes day', async () => {
    const { app } = await bootApp({
      DMIT_SYNC_TOKEN: VALID_TOKEN,
      DMIT_SERVICE_ID: String(SERVICE_ID),
    });
    const xuiAdmin = await import('../xui-admin.js');
    vi.spyOn(xuiAdmin, 'getXuiCredentials').mockReturnValue({
      username: 'u',
      password: 'p',
    });
    vi.spyOn(xuiAdmin, 'loginAndListInbounds').mockResolvedValue([
      { id: 11, enable: true } as never,
    ]);

    // First sync — applied
    await request(app)
      .post('/local/dmit/traffic')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({
        service_id: SERVICE_ID,
        bwusage: 100,
        bwlimit: 1024000,
        next_reset_day: 3,
        next_reset_at: Date.now() + 8 * 86400_000,
      });

    // Second sync with a different reset day
    const r = await request(app)
      .post('/local/dmit/traffic')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({
        service_id: SERVICE_ID,
        bwusage: 200,
        bwlimit: 1024000,
        next_reset_day: 5,
        next_reset_at: Date.now() + 8 * 86400_000,
      });

    expect(r.body.billing_day_action).toBe('mismatch');
  });
});
