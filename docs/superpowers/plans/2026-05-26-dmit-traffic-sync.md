# DMIT Traffic Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync real DMIT bandwidth data into DMITProxy via a Tampermonkey userscript so the subscription's `机器余量` line matches DMIT billing, with auto-detected billing day applied to `xui_inbound_billing` on first sync.

**Architecture:** Tampermonkey script runs on `dmit.io/clientarea.php`, same-origin fetches `/index.php?m=reset_traffic&modaction=get_rules&service_id=…`, then `GM_xmlhttpRequest` POSTs `traffic_info` + parsed `next_reset_*` to a token-protected DMITProxy backend route. Backend UPSERTs the row in a new `dmit_traffic` SQLite table, lazily auto-applies the billing day to inbounds with no existing config, and `subscription-builder.ts` reads the snapshot to override `machineRemaining`/`machineTotal` in subscription decorations (everything else stays on the 3X-UI app-layer counters).

**Tech Stack:** Express, better-sqlite3 (`server/db.ts`), Vitest + supertest, React 19 + Tailwind 4 + Recharts (`src/pages/*.tsx`), Tampermonkey (Greasemonkey-API).

**Spec:** [`docs/superpowers/specs/2026-05-26-dmit-traffic-sync-design.md`](../specs/2026-05-26-dmit-traffic-sync-design.md)

---

## File Structure

### Backend (new)

- `server/dmit-traffic-store.ts` — SQLite CRUD + 30s in-memory cache for the `dmit_traffic` table
- `server/dmit-traffic-store.test.ts` — Unit tests
- `server/dmit-billing-sync.ts` — Pure logic that decides what to do with `next_reset_day` on a sync
- `server/dmit-billing-sync.test.ts` — Unit tests for the decision logic
- `server/routes/dmit.ts` — Public `POST /local/dmit/traffic` (Bearer token)
- `server/routes/dmit.test.ts` — Supertest integration tests
- `scripts/userscripts/dmit-traffic-sync.user.js` — Tampermonkey script template with placeholders

### Backend (modify)

- `server/db.ts` — Add `dmit_traffic` table to schema bootstrap
- `server/subscription-usage.ts` — Add `dmitMachineUsed`/`dmitMachineTotal` to `SubscriptionUsageSummaryInput`; honor them in `buildSubscriptionUsageSummary`
- `server/subscription-usage.test.ts` — Add tests for the new override
- `server/subscription-builder.ts` — Read DMIT snapshot once per build, pass bytes into the decorations call
- `server/routes/admin.ts` — Add `GET /xui-inbounds-billing` cousin: `GET /dmit/traffic`, `POST /dmit/traffic/manual`, `POST /dmit/billing-day/sync`, `GET /dmit/userscript`
- `server/app.ts` — Mount the new DMIT router under `/local/dmit`, add CORS allowance for `https://www.dmit.io` on that mount
- `.env.example` — Document `DMIT_SYNC_TOKEN`, `DMIT_SERVICE_ID`

### Frontend (new)

- `src/api/dmit.ts` — API client for `/local/admin/dmit/*` and shared types
- `src/pages/DmitSync.tsx` — Admin page with status cards, billing day card, manual form, copy-script button

### Frontend (modify)

- `src/api/client.ts` — Add `export * from './dmit'`
- `src/App.tsx` — Lazy-load `DmitSyncPage`, register route
- `src/components/layout/Layout.tsx` — Sidebar entry (path discovered by exploration; if absent, defer to a follow-up)

---

## Task 1: Create the `dmit_traffic` SQLite table

**Files:**

- Modify: `server/db.ts:79-83` (extend the `CREATE TABLE … xui_inbound_billing` block)

- [ ] **Step 1.1: Add the new table to the schema bootstrap**

In `server/db.ts`, append to the existing `db.exec(` … `);` block (right after `CREATE TABLE IF NOT EXISTS xui_inbound_billing (…);`):

```sql
CREATE TABLE IF NOT EXISTS dmit_traffic (
  service_id              INTEGER PRIMARY KEY,
  bwusage_mb              INTEGER NOT NULL,
  bwlimit_mb              INTEGER NOT NULL,
  bwusage_in_mb           INTEGER,
  bwusage_out_mb          INTEGER,
  usage_percentage        REAL,
  next_reset_day          INTEGER,
  next_reset_at           INTEGER,
  auto_applied_billing_day INTEGER,
  updated_at              INTEGER NOT NULL,
  source                  TEXT NOT NULL CHECK (source IN ('tampermonkey','manual'))
);
```

- [ ] **Step 1.2: Verify the schema applies on boot**

Run:

```bash
npm run typecheck
```

Expected: PASS (no TS errors introduced by the SQL string).

Then manually verify in a Node REPL or quick script (one-shot, do not commit):

```bash
node -e "import('./server/db.js').then(({db})=>{console.log(db.prepare('SELECT name FROM sqlite_master WHERE type=\"table\" AND name=\"dmit_traffic\"').all())})"
```

Expected: `[ { name: 'dmit_traffic' } ]`

- [ ] **Step 1.3: Commit**

```bash
git add server/db.ts
git commit -m "feat(db): add dmit_traffic table for DMIT bandwidth sync"
```

---

## Task 2: dmit-traffic-store.ts — CRUD + cache

**Files:**

- Create: `server/dmit-traffic-store.ts`
- Create: `server/dmit-traffic-store.test.ts`

- [ ] **Step 2.1: Write the failing test**

Create `server/dmit-traffic-store.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const MB = 1024 * 1024;

async function freshStore() {
  vi.resetModules();
  const dbModule = await import('./db.js');
  dbModule.db.exec('DELETE FROM dmit_traffic');
  return await import('./dmit-traffic-store.js');
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('dmit-traffic-store', () => {
  it('upserts a row and reads it back as bytes', async () => {
    const store = await freshStore();
    store.upsertDmitTraffic({
      serviceId: 168117,
      bwusageMb: 712482,
      bwlimitMb: 1024000,
      bwusageInMb: 355266,
      bwusageOutMb: 357216,
      usagePercentage: 69.58,
      source: 'tampermonkey',
      now: 1000,
    });

    const snap = store.getDmitTrafficSnapshot(168117);
    expect(snap).not.toBeNull();
    expect(snap!.serviceId).toBe(168117);
    expect(snap!.bwusageBytes).toBe(712482 * MB);
    expect(snap!.bwlimitBytes).toBe(1024000 * MB);
    expect(snap!.updatedAt).toBe(1000);
    expect(snap!.source).toBe('tampermonkey');
  });

  it('UPSERT overwrites the existing row on same service_id', async () => {
    const store = await freshStore();
    store.upsertDmitTraffic({
      serviceId: 168117,
      bwusageMb: 100,
      bwlimitMb: 1024000,
      source: 'tampermonkey',
      now: 1,
    });
    store.upsertDmitTraffic({
      serviceId: 168117,
      bwusageMb: 200,
      bwlimitMb: 1024000,
      source: 'manual',
      now: 2,
    });
    const snap = store.getDmitTrafficSnapshot(168117);
    expect(snap!.bwusageBytes).toBe(200 * MB);
    expect(snap!.source).toBe('manual');
    expect(snap!.updatedAt).toBe(2);
  });

  it('returns null when the service_id has no row', async () => {
    const store = await freshStore();
    expect(store.getDmitTrafficSnapshot(999999)).toBeNull();
  });

  it('caches reads for 30s and invalidates on write', async () => {
    const store = await freshStore();
    store.upsertDmitTraffic({
      serviceId: 168117,
      bwusageMb: 100,
      bwlimitMb: 1024000,
      source: 'tampermonkey',
      now: 1,
    });
    const first = store.getDmitTrafficSnapshot(168117);
    expect(first!.bwusageBytes).toBe(100 * MB);

    // Mutate the DB outside the store API so a cache hit would return stale data.
    const { db } = await import('./db.js');
    db.prepare('UPDATE dmit_traffic SET bwusage_mb = 500 WHERE service_id = ?').run(168117);

    const cached = store.getDmitTrafficSnapshot(168117);
    expect(cached!.bwusageBytes).toBe(100 * MB); // cache still warm

    // A write through the store invalidates the cache.
    store.upsertDmitTraffic({
      serviceId: 168117,
      bwusageMb: 300,
      bwlimitMb: 1024000,
      source: 'manual',
      now: 2,
    });
    const fresh = store.getDmitTrafficSnapshot(168117);
    expect(fresh!.bwusageBytes).toBe(300 * MB);
  });

  it('persists billing day fields (next_reset_day / auto_applied_billing_day)', async () => {
    const store = await freshStore();
    store.upsertDmitTraffic({
      serviceId: 168117,
      bwusageMb: 100,
      bwlimitMb: 1024000,
      nextResetDay: 3,
      nextResetAt: 1780358400000,
      source: 'tampermonkey',
      now: 1,
    });
    expect(store.getDmitTrafficSnapshot(168117)!.nextResetDay).toBe(3);
    expect(store.getDmitTrafficSnapshot(168117)!.nextResetAt).toBe(1780358400000);
    expect(store.getDmitTrafficSnapshot(168117)!.autoAppliedBillingDay).toBeNull();

    store.markAutoAppliedBillingDay(168117, 3);
    expect(store.getDmitTrafficSnapshot(168117)!.autoAppliedBillingDay).toBe(3);
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `npx vitest run server/dmit-traffic-store.test.ts`
Expected: FAIL — module `./dmit-traffic-store.js` not found.

- [ ] **Step 2.3: Implement the store**

Create `server/dmit-traffic-store.ts`:

```typescript
import { db } from './db.js';

const MB = 1024 * 1024;
const CACHE_TTL_MS = 30_000;

export type DmitTrafficSource = 'tampermonkey' | 'manual';

export interface DmitTrafficUpsertInput {
  serviceId: number;
  bwusageMb: number;
  bwlimitMb: number;
  bwusageInMb?: number | null;
  bwusageOutMb?: number | null;
  usagePercentage?: number | null;
  nextResetDay?: number | null;
  nextResetAt?: number | null;
  source: DmitTrafficSource;
  now?: number;
}

export interface DmitTrafficSnapshot {
  serviceId: number;
  bwusageBytes: number;
  bwlimitBytes: number;
  bwusageInBytes: number | null;
  bwusageOutBytes: number | null;
  usagePercentage: number | null;
  nextResetDay: number | null;
  nextResetAt: number | null;
  autoAppliedBillingDay: number | null;
  updatedAt: number;
  source: DmitTrafficSource;
}

interface Row {
  service_id: number;
  bwusage_mb: number;
  bwlimit_mb: number;
  bwusage_in_mb: number | null;
  bwusage_out_mb: number | null;
  usage_percentage: number | null;
  next_reset_day: number | null;
  next_reset_at: number | null;
  auto_applied_billing_day: number | null;
  updated_at: number;
  source: DmitTrafficSource;
}

const selectStmt = db.prepare(
  `SELECT service_id, bwusage_mb, bwlimit_mb, bwusage_in_mb, bwusage_out_mb,
          usage_percentage, next_reset_day, next_reset_at, auto_applied_billing_day,
          updated_at, source
     FROM dmit_traffic WHERE service_id = ?`,
);

const upsertStmt = db.prepare(
  `INSERT INTO dmit_traffic (
     service_id, bwusage_mb, bwlimit_mb, bwusage_in_mb, bwusage_out_mb,
     usage_percentage, next_reset_day, next_reset_at, updated_at, source
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(service_id) DO UPDATE SET
     bwusage_mb = excluded.bwusage_mb,
     bwlimit_mb = excluded.bwlimit_mb,
     bwusage_in_mb = excluded.bwusage_in_mb,
     bwusage_out_mb = excluded.bwusage_out_mb,
     usage_percentage = excluded.usage_percentage,
     next_reset_day = excluded.next_reset_day,
     next_reset_at = excluded.next_reset_at,
     updated_at = excluded.updated_at,
     source = excluded.source`,
);

const markAutoAppliedStmt = db.prepare(
  `UPDATE dmit_traffic SET auto_applied_billing_day = ? WHERE service_id = ?`,
);

const cache = new Map<number, { snapshot: DmitTrafficSnapshot | null; expiresAt: number }>();

function rowToSnapshot(row: Row | undefined): DmitTrafficSnapshot | null {
  if (!row) return null;
  return {
    serviceId: row.service_id,
    bwusageBytes: row.bwusage_mb * MB,
    bwlimitBytes: row.bwlimit_mb * MB,
    bwusageInBytes: row.bwusage_in_mb == null ? null : row.bwusage_in_mb * MB,
    bwusageOutBytes: row.bwusage_out_mb == null ? null : row.bwusage_out_mb * MB,
    usagePercentage: row.usage_percentage,
    nextResetDay: row.next_reset_day,
    nextResetAt: row.next_reset_at,
    autoAppliedBillingDay: row.auto_applied_billing_day,
    updatedAt: row.updated_at,
    source: row.source,
  };
}

export function getDmitTrafficSnapshot(serviceId: number): DmitTrafficSnapshot | null {
  const now = Date.now();
  const cached = cache.get(serviceId);
  if (cached && cached.expiresAt > now) return cached.snapshot;

  const row = selectStmt.get(serviceId) as Row | undefined;
  const snapshot = rowToSnapshot(row);
  cache.set(serviceId, { snapshot, expiresAt: now + CACHE_TTL_MS });
  return snapshot;
}

export function upsertDmitTraffic(input: DmitTrafficUpsertInput): void {
  const updatedAt = input.now ?? Date.now();
  upsertStmt.run(
    input.serviceId,
    input.bwusageMb,
    input.bwlimitMb,
    input.bwusageInMb ?? null,
    input.bwusageOutMb ?? null,
    input.usagePercentage ?? null,
    input.nextResetDay ?? null,
    input.nextResetAt ?? null,
    updatedAt,
    input.source,
  );
  cache.delete(input.serviceId);
}

export function markAutoAppliedBillingDay(serviceId: number, day: number): void {
  markAutoAppliedStmt.run(day, serviceId);
  cache.delete(serviceId);
}

export function invalidateDmitTrafficCache(): void {
  cache.clear();
}
```

- [ ] **Step 2.4: Run tests to verify they pass**

Run: `npx vitest run server/dmit-traffic-store.test.ts`
Expected: PASS — 5 tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add server/dmit-traffic-store.ts server/dmit-traffic-store.test.ts
git commit -m "feat(dmit): store + 30s cache for dmit_traffic rows"
```

---

## Task 3: subscription-usage.ts — honor DMIT machine overrides

**Files:**

- Modify: `server/subscription-usage.ts:22-30` (input interface), `server/subscription-usage.ts:85-111` (builder)
- Modify: `server/subscription-usage.test.ts` (add cases)

- [ ] **Step 3.1: Write the failing test cases**

Append to `server/subscription-usage.test.ts` inside the existing `describe('buildSubscriptionUsageSummary', …)` block (just under the existing `it(...)`):

```typescript
it('overrides machineRemaining/machineTotal when DMIT machine fields are provided', () => {
  const ownUp = Math.trunc(12.34 * GB);
  const ownDown = Math.trunc(177.34 * GB);
  const totalUp = Math.trunc(132.34 * GB);
  const totalDown = Math.trunc(449.95 * GB);
  const xuiMachineTotal = 1000 * GB;
  const dmitMachineTotal = 1000 * GB;
  const dmitMachineUsed = Math.trunc(695.32 * GB);

  const summary = buildSubscriptionUsageSummary({
    resetDay: 3,
    expiryTime: null,
    ownUp,
    ownDown,
    allClientUp: totalUp,
    allClientDown: totalDown,
    machineTotal: xuiMachineTotal,
    dmitMachineUsed,
    dmitMachineTotal,
  });

  // own/others remain on 3X-UI numbers
  expect(summary.ownUp).toBe(ownUp);
  expect(summary.ownDown).toBe(ownDown);
  expect(summary.otherUsersUp).toBe(totalUp - ownUp);
  expect(summary.otherUsersDown).toBe(totalDown - ownDown);

  // machine fields come from DMIT
  expect(summary.machineTotal).toBe(dmitMachineTotal);
  expect(summary.machineRemaining).toBe(dmitMachineTotal - dmitMachineUsed);
});

it('falls back to 3X-UI machineTotal when dmitMachineTotal is undefined', () => {
  const summary = buildSubscriptionUsageSummary({
    resetDay: 3,
    expiryTime: null,
    ownUp: 0,
    ownDown: 0,
    allClientUp: 0,
    allClientDown: 0,
    machineTotal: 500 * GB,
  });
  expect(summary.machineTotal).toBe(500 * GB);
  expect(summary.machineRemaining).toBe(500 * GB);
});

it('clamps machineRemaining to 0 when DMIT used exceeds DMIT total', () => {
  const summary = buildSubscriptionUsageSummary({
    resetDay: null,
    ownUp: 0,
    ownDown: 0,
    allClientUp: 0,
    allClientDown: 0,
    machineTotal: 0,
    dmitMachineUsed: 1100 * GB,
    dmitMachineTotal: 1000 * GB,
  });
  expect(summary.machineRemaining).toBe(0);
});
```

- [ ] **Step 3.2: Run tests, expect failure**

Run: `npx vitest run server/subscription-usage.test.ts`
Expected: FAIL — type error on `dmitMachineUsed` / `dmitMachineTotal` (field not on `SubscriptionUsageSummaryInput`).

- [ ] **Step 3.3: Add the new fields to the input interface**

In `server/subscription-usage.ts`, replace the existing `SubscriptionUsageSummaryInput`:

```typescript
export interface SubscriptionUsageSummaryInput {
  resetDay: number | null;
  expiryTime?: number | null;
  ownUp: number;
  ownDown: number;
  allClientUp: number;
  allClientDown: number;
  machineTotal: number;
  /** Bytes consumed at DMIT (network-layer) — overrides totalUsed when present. */
  dmitMachineUsed?: number;
  /** Bytes of DMIT plan total — overrides machineTotal when present. */
  dmitMachineTotal?: number;
}
```

- [ ] **Step 3.4: Update `buildSubscriptionUsageSummary` to honor the overrides**

Replace the body of `buildSubscriptionUsageSummary` in `server/subscription-usage.ts` with:

```typescript
export function buildSubscriptionUsageSummary(
  input: SubscriptionUsageSummaryInput,
): SubscriptionUsageSummary {
  const ownUp = safeNonNegativeInt(input.ownUp);
  const ownDown = safeNonNegativeInt(input.ownDown);
  const totalUp = safeNonNegativeInt(input.allClientUp);
  const totalDown = safeNonNegativeInt(input.allClientDown);
  const ownUsed = ownUp + ownDown;
  const totalUsed = totalUp + totalDown;

  const machineTotal =
    input.dmitMachineTotal !== undefined
      ? safeNonNegativeInt(input.dmitMachineTotal)
      : safeNonNegativeInt(input.machineTotal);

  const usedForRemaining =
    input.dmitMachineUsed !== undefined ? safeNonNegativeInt(input.dmitMachineUsed) : totalUsed;

  return {
    resetDay: Number.isInteger(input.resetDay) && (input.resetDay ?? 0) > 0 ? input.resetDay : null,
    expiryDate: formatExpiryDate(input.expiryTime),
    ownUp,
    ownDown,
    ownUsed,
    otherUsersUp: Math.max(0, totalUp - ownUp),
    otherUsersDown: Math.max(0, totalDown - ownDown),
    otherUsersUsed: Math.max(0, totalUsed - ownUsed),
    totalUp,
    totalDown,
    totalUsed,
    machineRemaining: Math.max(0, machineTotal - usedForRemaining),
    machineTotal,
  };
}
```

- [ ] **Step 3.5: Run tests, expect pass**

Run: `npx vitest run server/subscription-usage.test.ts`
Expected: PASS — all (existing + new) tests pass.

- [ ] **Step 3.6: Commit**

```bash
git add server/subscription-usage.ts server/subscription-usage.test.ts
git commit -m "feat(usage): accept DMIT machine overrides in subscription summary"
```

---

## Task 4: subscription-builder.ts — feed DMIT bytes into decorations

**Files:**

- Modify: `server/subscription-builder.ts:13-19` (imports), `server/subscription-builder.ts:406-451` (buildSubscriptionPayload)

- [ ] **Step 4.1: Read the DMIT_SERVICE_ID env once at module init**

In `server/subscription-builder.ts`, just above `export async function buildSubscriptionPayload`, add:

```typescript
import { getDmitTrafficSnapshot } from './dmit-traffic-store.js';

function getConfiguredDmitServiceId(): number | null {
  const raw = (process.env.DMIT_SERVICE_ID ?? '').trim();
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
```

Also extend the existing `import { getBillingConfig } from './xui-billing.js';` line — leave that as-is and add the new import on its own line (avoid touching unrelated imports).

- [ ] **Step 4.2: Read the snapshot once per `buildSubscriptionPayload` call and pass into decorations**

Inside `buildSubscriptionPayload`, right after `const inbounds = await loginAndListInbounds(creds.username, creds.password);`, add:

```typescript
const dmitServiceId = getConfiguredDmitServiceId();
const dmitSnapshot = dmitServiceId != null ? getDmitTrafficSnapshot(dmitServiceId) : null;
```

Then locate the existing `buildSubscriptionDecorations({…})` call (around line 434) and append two fields to the argument object:

```typescript
const decorations = buildSubscriptionDecorations({
  resetDay: getBillingConfig(inbound.id)?.billingDay ?? null,
  expiryTime: stats?.expiryTime ?? (client.expiryTime as number | undefined) ?? null,
  ownUp: clientTraffic.up,
  ownDown: clientTraffic.down,
  allClientUp: inboundTraffic.up,
  allClientDown: inboundTraffic.down,
  machineTotal: inbound.total ?? 0,
  dmitMachineUsed: dmitSnapshot?.bwusageBytes,
  dmitMachineTotal: dmitSnapshot?.bwlimitBytes,
});
```

- [ ] **Step 4.3: Run the existing builder + usage tests**

Run: `npx vitest run server/subscription-builder.test.ts server/subscription-usage.test.ts`
Expected: PASS — existing tests must remain green.

- [ ] **Step 4.4: Commit**

```bash
git add server/subscription-builder.ts
git commit -m "feat(sub): override machineRemaining with DMIT snapshot when present"
```

---

## Task 5: POST `/local/dmit/traffic` — token-auth sync route (no billing day logic yet)

**Files:**

- Create: `server/routes/dmit.ts`
- Create: `server/routes/dmit.test.ts`
- Modify: `server/app.ts:174-181` (mount the new router under `/local/dmit`)
- Modify: `.env.example` (add `DMIT_SYNC_TOKEN`, `DMIT_SERVICE_ID`)

- [ ] **Step 5.1: Write the failing integration test**

Create `server/routes/dmit.test.ts`:

```typescript
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
```

- [ ] **Step 5.2: Run the test, expect failure**

Run: `npx vitest run server/routes/dmit.test.ts`
Expected: FAIL — route returns 404.

- [ ] **Step 5.3: Implement the router**

Create `server/routes/dmit.ts`:

```typescript
import { Router, type Request, type Response, type NextFunction } from 'express';
import { upsertDmitTraffic } from '../dmit-traffic-store.js';

const router = Router();

function getSyncToken(): string | null {
  const raw = (process.env.DMIT_SYNC_TOKEN ?? '').trim();
  return raw.length > 0 ? raw : null;
}

function getServiceId(): number | null {
  const raw = (process.env.DMIT_SERVICE_ID ?? '').trim();
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function requireSyncToken(req: Request, res: Response, next: NextFunction) {
  const token = getSyncToken();
  if (!token) {
    return res.status(503).json({ error: 'DMIT sync is not configured' });
  }
  const header = req.header('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || match[1].trim() !== token) {
    return res.status(401).json({ error: 'Invalid sync token' });
  }
  return next();
}

interface SyncBody {
  service_id?: unknown;
  bwusage?: unknown;
  bwlimit?: unknown;
  bwusage_in?: unknown;
  bwusage_out?: unknown;
  usage_percentage?: unknown;
  next_reset_at?: unknown;
  next_reset_day?: unknown;
}

function isNonNegInt(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isInteger(value)
  );
}

function asOptionalNonNegInt(value: unknown): number | null {
  return isNonNegInt(value) ? value : null;
}

function asOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asOptionalBillingDay(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return value >= 1 && value <= 31 ? value : null;
}

function asOptionalFutureMs(value: unknown, now: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  // Allow up to 60 seconds of clock skew in the past, but otherwise must be in the future.
  if (value < now - 60_000) return null;
  return Math.floor(value);
}

router.post('/traffic', requireSyncToken, (req: Request, res: Response) => {
  const body = (req.body ?? {}) as SyncBody;
  const expectedServiceId = getServiceId();
  if (expectedServiceId == null) {
    return res.status(400).json({ error: 'DMIT_SERVICE_ID is not configured' });
  }
  if (body.service_id !== expectedServiceId) {
    return res.status(400).json({ error: 'service_id does not match DMIT_SERVICE_ID' });
  }
  if (!isNonNegInt(body.bwusage) || !isNonNegInt(body.bwlimit)) {
    return res.status(400).json({ error: 'bwusage and bwlimit must be non-negative integers' });
  }
  if (body.bwlimit === 0) {
    return res.status(400).json({ error: 'bwlimit must be positive' });
  }

  const now = Date.now();
  upsertDmitTraffic({
    serviceId: expectedServiceId,
    bwusageMb: body.bwusage,
    bwlimitMb: body.bwlimit,
    bwusageInMb: asOptionalNonNegInt(body.bwusage_in),
    bwusageOutMb: asOptionalNonNegInt(body.bwusage_out),
    usagePercentage: asOptionalNumber(body.usage_percentage),
    nextResetDay: asOptionalBillingDay(body.next_reset_day),
    nextResetAt: asOptionalFutureMs(body.next_reset_at, now),
    source: 'tampermonkey',
    now,
  });

  return res.json({ ok: true, updated_at: now, billing_day_action: 'noop' });
});

export default router;
```

- [ ] **Step 5.4: Mount the router in `app.ts`**

In `server/app.ts`, at the imports block (around line 8), add:

```typescript
import dmitRouter from './routes/dmit.js';
```

Then in `createApp`, after the existing `app.use('/local/admin', adminLimiter, adminRouter);` line, add:

```typescript
app.use(
  '/local/dmit',
  cors({ origin: ['https://www.dmit.io'], methods: ['POST'], credentials: false }),
  dmitRouter,
);
```

- [ ] **Step 5.5: Run the tests, expect pass**

Run: `npx vitest run server/routes/dmit.test.ts`
Expected: PASS — all 6 tests pass.

- [ ] **Step 5.6: Update `.env.example`**

Append to `.env.example`:

```
# DMIT 流量同步（可选）。token 用于 Tampermonkey 脚本鉴权；service_id 是 DMIT 后台的服务编号。
# DMIT_SYNC_TOKEN=  (generate with: openssl rand -hex 32)
# DMIT_SERVICE_ID=
```

- [ ] **Step 5.7: Commit**

```bash
git add server/routes/dmit.ts server/routes/dmit.test.ts server/app.ts .env.example
git commit -m "feat(dmit): POST /local/dmit/traffic with bearer-token auth"
```

---

## Task 6: Billing-day auto-sync logic

**Files:**

- Create: `server/dmit-billing-sync.ts`
- Create: `server/dmit-billing-sync.test.ts`
- Modify: `server/routes/dmit.ts` (wire the logic into the POST handler)
- Modify: `server/routes/dmit.test.ts` (add test cases)

- [ ] **Step 6.1: Write the failing test for the pure decision helper**

Create `server/dmit-billing-sync.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { decideBillingDayAction } from './dmit-billing-sync.js';

describe('decideBillingDayAction', () => {
  it('returns noop when nextResetDay is missing', () => {
    const result = decideBillingDayAction({
      nextResetDay: null,
      autoAppliedBillingDay: null,
      currentBillingDays: [3, 3],
    });
    expect(result).toEqual({ action: 'noop', applyTo: null });
  });

  it('returns applied + day to mark when first sync and no inbound has billing_day', () => {
    const result = decideBillingDayAction({
      nextResetDay: 3,
      autoAppliedBillingDay: null,
      currentBillingDays: [], // no inbound has billing day configured
    });
    expect(result).toEqual({ action: 'applied', applyTo: 3 });
  });

  it("returns applied when first sync and only some inbounds have billing_day (apply to the ones that don't)", () => {
    const result = decideBillingDayAction({
      nextResetDay: 3,
      autoAppliedBillingDay: null,
      currentBillingDays: [5], // one inbound already has day=5, others unset
    });
    expect(result).toEqual({ action: 'applied', applyTo: 3 });
  });

  it('returns mismatch when auto-applied previously but DMIT changed its reset day', () => {
    const result = decideBillingDayAction({
      nextResetDay: 5,
      autoAppliedBillingDay: 3,
      currentBillingDays: [3, 3],
    });
    expect(result).toEqual({ action: 'mismatch', applyTo: null });
  });

  it('returns mismatch when auto-applied previously and inbound billing days drift', () => {
    const result = decideBillingDayAction({
      nextResetDay: 3,
      autoAppliedBillingDay: 3,
      currentBillingDays: [3, 5], // user manually changed one
    });
    expect(result).toEqual({ action: 'mismatch', applyTo: null });
  });

  it('returns noop when previously applied and everything still matches', () => {
    const result = decideBillingDayAction({
      nextResetDay: 3,
      autoAppliedBillingDay: 3,
      currentBillingDays: [3, 3],
    });
    expect(result).toEqual({ action: 'noop', applyTo: null });
  });
});
```

- [ ] **Step 6.2: Run, expect failure**

Run: `npx vitest run server/dmit-billing-sync.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 6.3: Implement the pure decision helper**

Create `server/dmit-billing-sync.ts`:

```typescript
export type BillingDayAction = 'applied' | 'noop' | 'mismatch';

export interface BillingDayDecisionInput {
  nextResetDay: number | null;
  autoAppliedBillingDay: number | null;
  /** billing_day for every inbound that has one configured (empty array if none). */
  currentBillingDays: number[];
}

export interface BillingDayDecision {
  action: BillingDayAction;
  /** Day to apply when action === 'applied'; null otherwise. */
  applyTo: number | null;
}

export function decideBillingDayAction(input: BillingDayDecisionInput): BillingDayDecision {
  const { nextResetDay, autoAppliedBillingDay, currentBillingDays } = input;
  if (nextResetDay == null) return { action: 'noop', applyTo: null };

  if (autoAppliedBillingDay == null) {
    // First sync: apply DMIT's day to inbounds that have no billing_day yet.
    return { action: 'applied', applyTo: nextResetDay };
  }

  // Already auto-applied previously.
  if (autoAppliedBillingDay !== nextResetDay) {
    return { action: 'mismatch', applyTo: null };
  }
  if (currentBillingDays.some((day) => day !== nextResetDay)) {
    return { action: 'mismatch', applyTo: null };
  }
  return { action: 'noop', applyTo: null };
}
```

- [ ] **Step 6.4: Run, expect pass**

Run: `npx vitest run server/dmit-billing-sync.test.ts`
Expected: PASS — 6 tests pass.

- [ ] **Step 6.5: Wire the decision into POST /local/dmit/traffic**

Modify `server/routes/dmit.ts` — replace the `router.post('/traffic', …)` handler with:

```typescript
import { listBillingConfigs, setBillingDay } from '../xui-billing.js';
import {
  getDmitTrafficSnapshot,
  markAutoAppliedBillingDay,
  upsertDmitTraffic,
} from '../dmit-traffic-store.js';
import { loginAndListInbounds, getXuiCredentials } from '../xui-admin.js';
import { decideBillingDayAction, type BillingDayAction } from '../dmit-billing-sync.js';

// …keep existing helpers above…

router.post('/traffic', requireSyncToken, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as SyncBody;
  const expectedServiceId = getServiceId();
  if (expectedServiceId == null) {
    return res.status(400).json({ error: 'DMIT_SERVICE_ID is not configured' });
  }
  if (body.service_id !== expectedServiceId) {
    return res.status(400).json({ error: 'service_id does not match DMIT_SERVICE_ID' });
  }
  if (!isNonNegInt(body.bwusage) || !isNonNegInt(body.bwlimit)) {
    return res.status(400).json({ error: 'bwusage and bwlimit must be non-negative integers' });
  }
  if (body.bwlimit === 0) {
    return res.status(400).json({ error: 'bwlimit must be positive' });
  }

  const now = Date.now();
  const nextResetDay = asOptionalBillingDay(body.next_reset_day);
  const nextResetAt = asOptionalFutureMs(body.next_reset_at, now);

  upsertDmitTraffic({
    serviceId: expectedServiceId,
    bwusageMb: body.bwusage,
    bwlimitMb: body.bwlimit,
    bwusageInMb: asOptionalNonNegInt(body.bwusage_in),
    bwusageOutMb: asOptionalNonNegInt(body.bwusage_out),
    usagePercentage: asOptionalNumber(body.usage_percentage),
    nextResetDay,
    nextResetAt,
    source: 'tampermonkey',
    now,
  });

  let billingDayAction: BillingDayAction = 'noop';
  const snapshot = getDmitTrafficSnapshot(expectedServiceId);
  const currentBillingDays = listBillingConfigs().map((c) => c.billingDay);
  const decision = decideBillingDayAction({
    nextResetDay,
    autoAppliedBillingDay: snapshot?.autoAppliedBillingDay ?? null,
    currentBillingDays,
  });

  if (decision.action === 'applied' && decision.applyTo != null) {
    const creds = getXuiCredentials();
    if (creds) {
      try {
        const inbounds = await loginAndListInbounds(creds.username, creds.password);
        const configured = new Set(listBillingConfigs().map((c) => c.inboundId));
        for (const inbound of inbounds) {
          if (configured.has(inbound.id)) continue; // respect manual config
          setBillingDay(inbound.id, decision.applyTo);
        }
        markAutoAppliedBillingDay(expectedServiceId, decision.applyTo);
        billingDayAction = 'applied';
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Unknown error';
        console.warn(`[dmit] auto-apply billing day failed: ${detail}`);
        billingDayAction = 'noop';
      }
    }
  } else {
    billingDayAction = decision.action;
  }

  return res.json({ ok: true, updated_at: now, billing_day_action: billingDayAction });
});
```

- [ ] **Step 6.6: Add integration tests for the new branches**

Append to `server/routes/dmit.test.ts`:

```typescript
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
```

- [ ] **Step 6.7: Run all DMIT tests, expect pass**

Run: `npx vitest run server/routes/dmit.test.ts server/dmit-billing-sync.test.ts`
Expected: PASS — all tests pass.

- [ ] **Step 6.8: Commit**

```bash
git add server/dmit-billing-sync.ts server/dmit-billing-sync.test.ts server/routes/dmit.ts server/routes/dmit.test.ts
git commit -m "feat(dmit): auto-apply billing day on first sync, surface mismatches"
```

---

## Task 7: Admin routes — GET status, manual POST, billing-day force-sync

**Files:**

- Modify: `server/routes/admin.ts` (add the routes)

- [ ] **Step 7.1: Add imports at the top of `server/routes/admin.ts`**

Find the existing import block in `server/routes/admin.ts` and add:

```typescript
import {
  getDmitTrafficSnapshot,
  upsertDmitTraffic,
  markAutoAppliedBillingDay,
  type DmitTrafficSnapshot,
} from '../dmit-traffic-store.js';
import { getXuiCredentials, loginAndListInbounds } from '../xui-admin.js';
```

(Some of these are already imported in other places — only add the ones not yet present.)

- [ ] **Step 7.2: Add a helper to read service id**

Just above `router.get('/invite', …)` in `server/routes/admin.ts`, add:

```typescript
function dmitServiceIdFromEnv(): number | null {
  const raw = (process.env.DMIT_SERVICE_ID ?? '').trim();
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const DMIT_STALE_THRESHOLD_MS = 7 * 24 * 3600 * 1000;

function serializeDmitSnapshot(snap: DmitTrafficSnapshot, now: number) {
  const MB = 1024 * 1024;
  return {
    service_id: snap.serviceId,
    bwusage_mb: Math.round(snap.bwusageBytes / MB),
    bwlimit_mb: Math.round(snap.bwlimitBytes / MB),
    bwusage_in_mb: snap.bwusageInBytes == null ? null : Math.round(snap.bwusageInBytes / MB),
    bwusage_out_mb: snap.bwusageOutBytes == null ? null : Math.round(snap.bwusageOutBytes / MB),
    usage_percentage: snap.usagePercentage,
    next_reset_day: snap.nextResetDay,
    next_reset_at: snap.nextResetAt,
    auto_applied_billing_day: snap.autoAppliedBillingDay,
    updated_at: snap.updatedAt,
    source: snap.source,
    is_stale: now - snap.updatedAt > DMIT_STALE_THRESHOLD_MS,
  };
}
```

- [ ] **Step 7.3: Add the GET / manual POST / billing-day sync routes**

In `server/routes/admin.ts`, just above `export default router;` at the bottom, add:

```typescript
// GET /local/admin/dmit/traffic — current DMIT snapshot for the configured service id
router.get('/dmit/traffic', requireAdmin, (_req, res) => {
  const serviceId = dmitServiceIdFromEnv();
  if (serviceId == null) {
    return res.json({ exists: false, configured: false });
  }
  const snap = getDmitTrafficSnapshot(serviceId);
  if (!snap) {
    return res.json({ exists: false, configured: true, service_id: serviceId });
  }
  return res.json({
    exists: true,
    configured: true,
    data: serializeDmitSnapshot(snap, Date.now()),
  });
});

// POST /local/admin/dmit/traffic/manual — admin pastes traffic numbers as a fallback
router.post('/dmit/traffic/manual', requireAdmin, (req, res) => {
  const serviceId = dmitServiceIdFromEnv();
  if (serviceId == null) {
    return res.status(400).json({ error: 'DMIT_SERVICE_ID is not configured' });
  }
  const body = (req.body ?? {}) as {
    bwusage?: unknown;
    bwlimit?: unknown;
    bwusage_in?: unknown;
    bwusage_out?: unknown;
    usage_percentage?: unknown;
  };
  const bwusage = Number(body.bwusage);
  const bwlimit = Number(body.bwlimit);
  if (!Number.isFinite(bwusage) || !Number.isFinite(bwlimit) || bwusage < 0 || bwlimit <= 0) {
    return res.status(400).json({ error: 'bwusage and bwlimit must be valid (MB)' });
  }
  upsertDmitTraffic({
    serviceId,
    bwusageMb: Math.round(bwusage),
    bwlimitMb: Math.round(bwlimit),
    bwusageInMb: Number.isFinite(Number(body.bwusage_in))
      ? Math.round(Number(body.bwusage_in))
      : null,
    bwusageOutMb: Number.isFinite(Number(body.bwusage_out))
      ? Math.round(Number(body.bwusage_out))
      : null,
    usagePercentage: Number.isFinite(Number(body.usage_percentage))
      ? Number(body.usage_percentage)
      : null,
    source: 'manual',
  });
  return res.json({ ok: true });
});

// POST /local/admin/dmit/billing-day/sync — force-apply DMIT reset day to all inbounds
router.post('/dmit/billing-day/sync', requireAdmin, async (_req, res) => {
  const serviceId = dmitServiceIdFromEnv();
  if (serviceId == null) {
    return res.status(400).json({ error: 'DMIT_SERVICE_ID is not configured' });
  }
  const snap = getDmitTrafficSnapshot(serviceId);
  if (!snap || snap.nextResetDay == null) {
    return res
      .status(400)
      .json({ error: 'No DMIT next_reset_day available; sync from Tampermonkey first' });
  }
  const creds = getXuiCredentials();
  if (!creds) return res.status(400).json({ error: 'XUI credentials missing' });

  try {
    const inbounds = await loginAndListInbounds(creds.username, creds.password);
    let updated = 0;
    for (const inbound of inbounds) {
      setBillingDay(inbound.id, snap.nextResetDay);
      updated += 1;
    }
    markAutoAppliedBillingDay(serviceId, snap.nextResetDay);
    return res.json({ ok: true, updated, billing_day: snap.nextResetDay });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: detail });
  }
});

// GET /local/admin/dmit/userscript — render the Tampermonkey script with token / serviceId / backend URL filled in
router.get('/dmit/userscript', requireAdmin, (req, res) => {
  const token = (process.env.DMIT_SYNC_TOKEN ?? '').trim();
  const serviceId = dmitServiceIdFromEnv();
  if (!token || serviceId == null) {
    return res.status(400).json({ error: 'DMIT_SYNC_TOKEN or DMIT_SERVICE_ID is not configured' });
  }
  const proto = (req.header('x-forwarded-proto') ?? req.protocol).split(',')[0]?.trim() || 'https';
  const host = req.header('x-forwarded-host') ?? req.header('host') ?? '';
  const backend = `${proto}://${host}/local/dmit/traffic`;
  const template = fs.readFileSync(
    path.join(process.cwd(), 'scripts/userscripts/dmit-traffic-sync.user.js'),
    'utf8',
  );
  const rendered = template
    .replace(/__DMIT_BACKEND_URL__/g, backend)
    .replace(/__DMIT_SERVICE_ID__/g, String(serviceId))
    .replace(/__DMIT_SYNC_TOKEN__/g, token)
    .replace(/__DMIT_BACKEND_HOST__/g, host);
  res.type('application/javascript; charset=utf-8').send(rendered);
});
```

(`setBillingDay` is already imported at the top of `admin.ts`; if not, add it to the existing `from '../xui-billing.js'` import.)

- [ ] **Step 7.4: Smoke-test by typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7.5: Commit**

```bash
git add server/routes/admin.ts
git commit -m "feat(admin): DMIT traffic status, manual override, force billing sync"
```

---

## Task 8: Tampermonkey script template

**Files:**

- Create: `scripts/userscripts/dmit-traffic-sync.user.js`

- [ ] **Step 8.1: Create the template file**

Create `scripts/userscripts/dmit-traffic-sync.user.js`:

```javascript
// ==UserScript==
// @name         DMITProxy Traffic Sync
// @namespace    https://github.com/yourname/dmitproxy
// @version      1.0.0
// @description  Auto-sync DMIT bandwidth + reset day to DMITProxy backend.
// @match        https://www.dmit.io/clientarea.php*
// @grant        GM_xmlhttpRequest
// @connect      __DMIT_BACKEND_HOST__
// @run-at       document-idle
// ==/UserScript==

(async function () {
  'use strict';
  const SERVICE_ID = __DMIT_SERVICE_ID__;
  const BACKEND = '__DMIT_BACKEND_URL__';
  const TOKEN = '__DMIT_SYNC_TOKEN__';

  try {
    const r = await fetch(
      `/index.php?m=reset_traffic&modaction=get_rules&service_id=${SERVICE_ID}`,
      { credentials: 'same-origin' },
    );
    const j = await r.json();
    if (!j || j.code !== 0 || !j.data || !j.data.traffic_info) {
      console.warn('[DMITProxy Sync] Unexpected DMIT API payload', j);
      return;
    }

    const t = j.data.traffic_info;

    let next_reset_at = null;
    let next_reset_day = null;
    const rules = Array.isArray(j.data.rules) ? j.data.rules : [];
    for (const rule of rules) {
      const conds = Array.isArray(rule.conditions) ? rule.conditions : [];
      const cond = conds.find((c) => c && c.key === 'auto_min_days_until_due');
      if (!cond) continue;
      const m = typeof cond.current === 'string' && cond.current.match(/^([\d.]+)\s*天/);
      if (!m) continue;
      const days = parseFloat(m[1]);
      if (!Number.isFinite(days) || days < 0) continue;
      next_reset_at = Date.now() + Math.round(days * 86400000);
      next_reset_day = new Date(next_reset_at).getUTCDate();
      break;
    }

    GM_xmlhttpRequest({
      method: 'POST',
      url: BACKEND,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + TOKEN,
      },
      data: JSON.stringify({
        service_id: SERVICE_ID,
        bwusage: t.bwusage,
        bwlimit: t.bwlimit,
        bwusage_in: t.bwusage_in,
        bwusage_out: t.bwusage_out,
        usage_percentage: t.usage_percentage,
        next_reset_at,
        next_reset_day,
      }),
      onload: function (res) {
        if (res.status === 200) {
          console.log('[DMITProxy Sync] OK', res.responseText);
        } else {
          console.error('[DMITProxy Sync] backend returned', res.status, res.responseText);
        }
      },
      onerror: function (err) {
        console.error('[DMITProxy Sync] request failed', err);
      },
    });
  } catch (e) {
    console.error('[DMITProxy Sync] script error', e);
  }
})();
```

- [ ] **Step 8.2: Verify the template parses as JavaScript (sanity)**

Run:

```bash
node --check scripts/userscripts/dmit-traffic-sync.user.js
```

Expected: silently exits with code 0. (The placeholders cause a parse error since `__DMIT_SERVICE_ID__` is not a valid identifier value — if `node --check` fails on the placeholder, that's expected; just verify the syntax around the placeholders by visual inspection instead. Skip this step on failure and rely on the rendering in Task 7.3 / manual run in Task 11.)

Note: the placeholders intentionally make the raw file unrunnable; only the rendered output from `/local/admin/dmit/userscript` is valid JS.

- [ ] **Step 8.3: Commit**

```bash
git add scripts/userscripts/dmit-traffic-sync.user.js
git commit -m "feat(dmit): Tampermonkey userscript template with placeholders"
```

---

## Task 9: Frontend API client for DMIT

**Files:**

- Create: `src/api/dmit.ts`
- Modify: `src/api/client.ts`

- [ ] **Step 9.1: Inspect the existing API base pattern**

Read the first 30 lines of `src/api/admin.ts` and `src/api/base.ts` to confirm the request helper name (typically `apiRequest` or `localFetch`). Use whichever pattern is already used by the codebase (e.g. `getAdminSettings` in `Settings.tsx`).

- [ ] **Step 9.2: Create the API module**

Create `src/api/dmit.ts`:

```typescript
import { localFetch } from './base';

export interface AdminDmitTraffic {
  service_id: number;
  bwusage_mb: number;
  bwlimit_mb: number;
  bwusage_in_mb: number | null;
  bwusage_out_mb: number | null;
  usage_percentage: number | null;
  next_reset_day: number | null;
  next_reset_at: number | null;
  auto_applied_billing_day: number | null;
  updated_at: number;
  source: 'tampermonkey' | 'manual';
  is_stale: boolean;
}

export interface AdminDmitTrafficResponse {
  exists: boolean;
  configured: boolean;
  service_id?: number;
  data?: AdminDmitTraffic;
}

export interface AdminDmitManualInput {
  bwusage: number;
  bwlimit: number;
  bwusage_in?: number;
  bwusage_out?: number;
  usage_percentage?: number;
}

export interface AdminDmitBillingSyncResponse {
  ok: true;
  updated: number;
  billing_day: number;
}

export async function getAdminDmitTraffic(): Promise<AdminDmitTrafficResponse> {
  const res = await localFetch('/local/admin/dmit/traffic');
  if (!res.ok) throw new Error(`getAdminDmitTraffic failed: ${res.status}`);
  return (await res.json()) as AdminDmitTrafficResponse;
}

export async function postAdminDmitTrafficManual(input: AdminDmitManualInput): Promise<void> {
  const res = await localFetch('/local/admin/dmit/traffic/manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`postAdminDmitTrafficManual failed: ${res.status} ${body}`);
  }
}

export async function postAdminDmitBillingSync(): Promise<AdminDmitBillingSyncResponse> {
  const res = await localFetch('/local/admin/dmit/billing-day/sync', { method: 'POST' });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`postAdminDmitBillingSync failed: ${res.status} ${body}`);
  }
  return (await res.json()) as AdminDmitBillingSyncResponse;
}

/** URL to fetch the rendered Tampermonkey script (admin-only). */
export const ADMIN_DMIT_USERSCRIPT_URL = '/local/admin/dmit/userscript';
```

(If `localFetch` does not exist in `src/api/base.ts`, replace it with whatever wrapper the codebase uses — e.g. `apiFetch` / `request`. Do not invent a new helper; match the existing pattern from one of the working API modules like `admin.ts`.)

- [ ] **Step 9.3: Add to the barrel re-export**

In `src/api/client.ts`, append:

```typescript
export * from './dmit';
```

- [ ] **Step 9.4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 9.5: Commit**

```bash
git add src/api/dmit.ts src/api/client.ts
git commit -m "feat(api): DMIT admin client wrappers"
```

---

## Task 10: Admin DmitSync page

**Files:**

- Create: `src/pages/DmitSync.tsx`
- Modify: `src/App.tsx` (lazy-load + route)
- Modify: `src/components/layout/Layout.tsx` (sidebar entry — if the Layout file exposes a nav list. Otherwise document a manual TODO at the top of `DmitSync.tsx`.)

- [ ] **Step 10.1: Build the page component**

Create `src/pages/DmitSync.tsx`:

```typescript
import React, { useCallback, useEffect, useState } from 'react';
import { Copy, RefreshCw, Save, ShieldAlert } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { useToast } from '@/src/components/ui/Toast';
import {
  getAdminDmitTraffic,
  postAdminDmitBillingSync,
  postAdminDmitTrafficManual,
  ADMIN_DMIT_USERSCRIPT_URL,
  type AdminDmitTraffic,
} from '@/src/api/client';

const GB = 1024;
const MB_PER_GB = 1024;

function formatGB(mb: number | null | undefined): string {
  if (mb == null) return '—';
  return `${(mb / MB_PER_GB).toFixed(2)} GB`;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  return `${Math.floor(diff / 86400_000)} 天前`;
}

export function DmitSyncPage() {
  const [data, setData] = useState<AdminDmitTraffic | null>(null);
  const [exists, setExists] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState({ bwusage: '', bwlimit: '', bwusage_in: '', bwusage_out: '' });
  const { showToast } = useToast();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getAdminDmitTraffic();
      setExists(r.exists);
      setConfigured(r.configured);
      setData(r.data ?? null);
    } catch (err) {
      showToast({ tone: 'error', message: err instanceof Error ? err.message : 'load failed' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onSubmitManual(e: React.FormEvent) {
    e.preventDefault();
    const bwusage = Number(manual.bwusage) * MB_PER_GB;
    const bwlimit = Number(manual.bwlimit) * MB_PER_GB;
    if (!Number.isFinite(bwusage) || !Number.isFinite(bwlimit) || bwlimit <= 0) {
      showToast({ tone: 'error', message: '请填写合法的 GB 值' });
      return;
    }
    try {
      await postAdminDmitTrafficManual({
        bwusage: Math.round(bwusage),
        bwlimit: Math.round(bwlimit),
        bwusage_in: manual.bwusage_in ? Math.round(Number(manual.bwusage_in) * MB_PER_GB) : undefined,
        bwusage_out: manual.bwusage_out ? Math.round(Number(manual.bwusage_out) * MB_PER_GB) : undefined,
      });
      showToast({ tone: 'success', message: '已保存' });
      void refresh();
    } catch (err) {
      showToast({ tone: 'error', message: err instanceof Error ? err.message : 'save failed' });
    }
  }

  async function onForceBillingSync() {
    try {
      const r = await postAdminDmitBillingSync();
      showToast({
        tone: 'success',
        message: `已为 ${r.updated} 个 inbound 设置 billing_day = ${r.billing_day}`,
      });
      void refresh();
    } catch (err) {
      showToast({ tone: 'error', message: err instanceof Error ? err.message : 'sync failed' });
    }
  }

  async function onCopyScript() {
    try {
      const r = await fetch(ADMIN_DMIT_USERSCRIPT_URL, { credentials: 'include' });
      if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
      const text = await r.text();
      await navigator.clipboard.writeText(text);
      showToast({ tone: 'success', message: 'Tampermonkey 脚本已复制' });
    } catch (err) {
      showToast({ tone: 'error', message: err instanceof Error ? err.message : 'copy failed' });
    }
  }

  if (!configured) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>DMIT 同步未启用</CardTitle>
            <CardDescription>请在 .env 中配置 DMIT_SYNC_TOKEN 与 DMIT_SERVICE_ID 后重启服务</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>DMIT 流量同步</CardTitle>
            <CardDescription>
              {exists && data
                ? `最后同步：${relativeTime(data.updated_at)}（${data.source}）${data.is_stale ? '⚠ 已超过 7 天' : ''}`
                : '尚未同步过任何数据'}
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} /> 刷新
          </Button>
        </CardHeader>
        {exists && data && (
          <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="已用" value={formatGB(data.bwusage_mb)} />
            <Stat label="总量" value={formatGB(data.bwlimit_mb)} />
            <Stat label="入站" value={formatGB(data.bwusage_in_mb)} />
            <Stat label="出站" value={formatGB(data.bwusage_out_mb)} />
          </CardContent>
        )}
      </Card>

      {exists && data && data.next_reset_day != null && (
        <Card>
          <CardHeader>
            <CardTitle>Billing Day 状态</CardTitle>
            <CardDescription>
              DMIT 重置日：每月 {data.next_reset_day} 日 UTC
              {data.auto_applied_billing_day != null
                ? `（已自动同步至 3X-UI = ${data.auto_applied_billing_day}）`
                : '（尚未自动同步）'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void onForceBillingSync()}>
              <ShieldAlert className="mr-2" /> 强制同步所有 inbound 的 billing_day
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tampermonkey 同步脚本</CardTitle>
          <CardDescription>
            装好 Tampermonkey 扩展后，复制下面的脚本新建一个用户脚本粘贴保存即可。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void onCopyScript()}>
            <Copy className="mr-2" /> 复制脚本到剪贴板
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>手动同步（兜底）</CardTitle>
          <CardDescription>仅在 Tampermonkey 失效时使用，单位为 GB</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-2 gap-3" onSubmit={(e) => void onSubmitManual(e)}>
            <FormField
              label="已用 (GB)"
              value={manual.bwusage}
              onChange={(v) => setManual((m) => ({ ...m, bwusage: v }))}
            />
            <FormField
              label="总量 (GB)"
              value={manual.bwlimit}
              onChange={(v) => setManual((m) => ({ ...m, bwlimit: v }))}
            />
            <FormField
              label="入站 (GB, 可选)"
              value={manual.bwusage_in}
              onChange={(v) => setManual((m) => ({ ...m, bwusage_in: v }))}
            />
            <FormField
              label="出站 (GB, 可选)"
              value={manual.bwusage_out}
              onChange={(v) => setManual((m) => ({ ...m, bwusage_out: v }))}
            />
            <div className="col-span-2">
              <Button type="submit">
                <Save className="mr-2" /> 保存
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00" />
    </label>
  );
}
```

- [ ] **Step 10.2: Register the route in `App.tsx`**

In `src/App.tsx`, near the other `const … = lazy(...)` declarations (around line 32), add:

```typescript
const DmitSyncPage = lazy(() =>
  import('./pages/DmitSync').then((m) => ({ default: m.DmitSyncPage })),
);
```

Then locate the `<Routes>` block (search for `<Route path="/settings"`) and add a new route inside the admin-only segment (same protection level as `/settings`):

```typescript
<Route path="/admin/dmit-sync" element={<DmitSyncPage />} />
```

If the existing routes use a layout wrapper, place this route inside the same wrapper so it inherits the sidebar/header.

- [ ] **Step 10.3: Sidebar entry (best-effort)**

Open `src/components/layout/Layout.tsx`. If it has an array of nav items (look for `path: '/settings'`), add an entry:

```typescript
{ path: '/admin/dmit-sync', label: 'DMIT 同步', icon: ShieldAlert }
```

(Import the icon at the top of `Layout.tsx` if not already present.)

If the sidebar items are not data-driven, skip this step and add a TODO comment at the top of `DmitSync.tsx`:

```typescript
// TODO: add nav entry once the sidebar component is data-driven.
```

- [ ] **Step 10.4: Typecheck + smoke build**

Run:

```bash
npm run typecheck
npm run build
```

Expected: PASS for both.

- [ ] **Step 10.5: Commit**

```bash
git add src/pages/DmitSync.tsx src/App.tsx src/components/layout/Layout.tsx
git commit -m "feat(admin-ui): DMIT sync page with status, billing day, manual entry"
```

---

## Task 11: End-to-end manual verification

This task has no automated tests — it's the manual run on the real environment. Each step is a checkbox the operator marks once observed.

- [ ] **Step 11.1: Generate token and configure `.env`**

```bash
openssl rand -hex 32
```

Copy the hex string to the Linux server's `.env`:

```
DMIT_SYNC_TOKEN=<the-generated-hex>
DMIT_SERVICE_ID=168117
```

Restart the DMITProxy service.

- [ ] **Step 11.2: Verify admin page loads with no data**

Open `https://<your-host>/admin/dmit-sync` in the browser.

Expected:

- Status card: "尚未同步过任何数据"
- "Tampermonkey 同步脚本" card visible with the "复制脚本" button
- "手动同步" form visible

- [ ] **Step 11.3: Install Tampermonkey + copy script**

In the browser:

1. Install [Tampermonkey](https://www.tampermonkey.net/) if not already installed.
2. On the admin page, click "复制脚本到剪贴板".
3. Open Tampermonkey → "Create new script" → paste → save (Ctrl+S).

- [ ] **Step 11.4: Trigger first sync by visiting DMIT**

Navigate to `https://www.dmit.io/clientarea.php?action=productdetails&id=168117`.

Open the browser console. Expected:

```
[DMITProxy Sync] OK { ok: true, updated_at: …, billing_day_action: 'applied' }
```

- [ ] **Step 11.5: Verify admin page now shows real data**

Refresh `/admin/dmit-sync`. Expected:

- Status card: 已用 ≈ 695 GB, 总量 ≈ 1000 GB, 入站/出站 ≈ 347 GB each, "最后同步：刚刚（tampermonkey）"
- Billing Day card: "DMIT 重置日：每月 3 日 UTC（已自动同步至 3X-UI = 3）"

- [ ] **Step 11.6: Verify `xui_inbound_billing` has been populated**

On the Linux server:

```bash
sqlite3 data/prism.db "SELECT * FROM xui_inbound_billing;"
```

Expected: every inbound row has `billing_day = 3`.

- [ ] **Step 11.7: Verify the subscription line now uses DMIT data**

Refresh the subscription in v2rayN (right-click subscription group → "更新订阅"). Click any node and look at the bottom-right "节点信息" lines.

Expected: `机器余量` shows a number close to 304 GB / 1000 GB (matching DMIT) — not the previous ~367 GB.

- [ ] **Step 11.8: Trigger second sync, expect noop**

Reload `https://www.dmit.io/clientarea.php?action=productdetails&id=168117`. Console:

```
[DMITProxy Sync] OK { ok: true, …, billing_day_action: 'noop' }
```

- [ ] **Step 11.9: Verify manual entry path works**

In admin → "手动同步" form, enter dummy values (e.g. 100 GB used / 1000 GB total) and submit. Status card updates immediately to those numbers with `source = manual`.

Then trigger a Tampermonkey sync again to restore real data.

- [ ] **Step 11.10: Verify 401 / 503 paths**

```bash
curl -i -X POST https://<your-host>/local/dmit/traffic -H 'Content-Type: application/json' -d '{}'
# expected: 401

# temporarily unset DMIT_SYNC_TOKEN in .env, restart, then:
curl -i -X POST https://<your-host>/local/dmit/traffic -H 'Authorization: Bearer wrong' -d '{}'
# expected: 503
```

Restore the token after testing.

---

## Self-Review

### Spec coverage

- ✅ `dmit_traffic` SQLite table — Task 1
- ✅ Store with cache — Task 2
- ✅ `subscription-usage.ts` overrides — Task 3
- ✅ `subscription-builder.ts` wiring — Task 4
- ✅ POST `/local/dmit/traffic` with token + CORS + validation — Task 5
- ✅ Billing day auto-sync (applied/noop/mismatch) — Task 6
- ✅ Admin GET / manual POST / force billing sync routes — Task 7
- ✅ Tampermonkey template (with `auto_min_days_until_due` parsing) — Tasks 8 + 10 (copy button)
- ✅ Admin UI page — Task 10
- ✅ `.env.example` documented — Task 5.6
- ✅ End-to-end manual verification — Task 11

### Placeholder scan

- Tampermonkey template intentionally uses `__DMIT_*__` placeholders — these are documented as placeholders, replaced by the admin route in Task 7.3. Not a plan-level placeholder.
- Task 9.2 includes a fallback note about `localFetch` — explicitly documented to match the codebase pattern. Verified by reading existing `src/api/admin.ts` in Task 9.1.
- Task 10.3 has a fallback "if sidebar is not data-driven, leave a TODO" — acceptable because the sidebar shape is unknown without further exploration; explicit TODO is left in code.

### Type consistency

- `DmitTrafficSnapshot` fields used in `dmit-traffic-store.ts` (camelCase) → mapped to API JSON (snake_case) in `serializeDmitSnapshot` in Task 7.2.
- `BillingDayAction` from `dmit-billing-sync.ts` matches the response `billing_day_action` string union exactly.
- API client types in `src/api/dmit.ts` (snake_case JSON) match server response shape in Task 7.3.

### Scope check

- Single subsystem (DMIT traffic sync) — appropriate for one plan.
- Backend + UI + userscript are tightly coupled — splitting them would make either side untestable in isolation.

No outstanding gaps.
