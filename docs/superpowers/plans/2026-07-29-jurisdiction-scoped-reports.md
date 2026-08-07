# Jurisdiction-Scoped Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reports submitted with only lat/lng get reverse-geocoded and matched to PSGC region/province/municipality codes server-side, so `GET /api/reports` can be scoped to each LGU account's jurisdiction.

**Architecture:** Report creation runs a reverse-geocode (Nominatim, throttled to 1 req/sec) → PSGC name-match pipeline that tags each report with its jurisdiction codes or marks it `UNASSIGNED`. A `requireUser` header-based stub (real auth is a follow-up spec) attaches the requesting user to `req.user`; `GET /api/reports` derives a Prisma `where` filter from that user's stored jurisdiction. `SUPER_ADMIN` bypasses the filter and can manually resolve `UNASSIGNED` reports.

**Tech Stack:** Express 5, Prisma 7 (`@prisma/adapter-pg`), PostgreSQL (Docker), Zod, native `fetch`, Node's built-in `node:test` runner (via `tsx`) — no new test framework.

## Global Constraints

- Nominatim reverse-geocode calls are throttled to 1 request/second, globally, across all concurrent submissions (per spec §Report intake flow).
- Reports outside the Philippines (`address.country_code !== 'ph'`) are rejected with `422 { error: "This service only accepts reports within the Philippines." }` (per spec).
- PSGC lookups hit the live API (`https://psgc.gitlab.io/api`) — no local caching (explicit decision in spec).
- `GET /api/reports` jurisdiction filter is always derived server-side from the authenticated user, never a client-supplied param (per spec §Visibility / scoping rule).
- `UNASSIGNED` reports are visible only to `SUPER_ADMIN` (per spec).

---

### Task 1: Schema — SUPER_ADMIN role, nullable User region, Report model

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: `Role` enum (`SUPER_ADMIN | ADMIN | LGU_AGENT`), `Report` model with fields `regionCode/Name`, `provinceCode/Name`, `municipalityCode/Name` (all `String?`) and `jurisdictionStatus: JurisdictionStatus`. Later tasks (`src/services/reportScope.ts`, `src/routes/reports.ts`) query these exact field names via `prisma.report`.

- [ ] **Step 1: Edit the schema**

Replace the `Role` enum and `User.regionCode`/`regionName` fields, and append the new models, in `backend/prisma/schema.prisma`:

```prisma
enum Role {
  SUPER_ADMIN
  ADMIN
  LGU_AGENT
}

enum UserStatus {
  ACTIVE
  PENDING
  BLOCKED
}

model User {
  id             String     @id @default(uuid())
  name           String
  email          String     @unique
  passwordHash   String
  role           Role
  status         UserStatus @default(PENDING)

  // Jurisdiction, from PSGC (https://psgc.gitlab.io/api/). Null region = SUPER_ADMIN
  // (no jurisdiction at all). Province/municipality null = "entire region" / "entire province".
  regionCode         String?
  regionName         String?
  provinceCode       String?
  provinceName       String?
  municipalityCode   String?
  municipalityName   String?

  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
}

enum Severity {
  HIGH
  LOW
}

enum ReportStatus {
  UNRESOLVED
  RESOLVED
  FLAGGED
}

enum FlagReason {
  FALSE_REPORT
  OUT_OF_CONTROL
}

enum JurisdictionStatus {
  ASSIGNED
  UNASSIGNED
}

model Report {
  id                   String              @id @default(uuid())
  lat                  Float
  lng                  Float
  severity             Severity
  details              String
  locationLabel        String?
  imageUrls            String[]
  status               ReportStatus        @default(UNRESOLVED)
  createdAt            DateTime            @default(now())
  resolvedAt           DateTime?
  flagReason           FlagReason?
  flaggedAt            DateTime?
  lguActionLogged      Boolean             @default(false)
  resolutionProofUrls  String[]

  regionCode           String?
  regionName           String?
  provinceCode         String?
  provinceName         String?
  municipalityCode     String?
  municipalityName     String?
  jurisdictionStatus   JurisdictionStatus  @default(UNASSIGNED)
}
```

- [ ] **Step 2: Run the migration**

Run: `cd backend && npx prisma migrate dev --name jurisdiction_and_reports`
Expected: `Your database is now in sync with your schema.` and a new folder under `prisma/migrations/`.

- [ ] **Step 3: Regenerate the client and typecheck**

Run: `cd backend && npx prisma generate && npx tsc --noEmit`
Expected: both commands exit 0 with no errors (existing `src/routes/users.ts` still compiles against the now-nullable `regionCode`/`regionName` — it always sets them, so this is safe).

- [ ] **Step 4: Commit**

```bash
cd backend
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add SUPER_ADMIN role and Report model with jurisdiction fields"
```

---

### Task 2: Throttled Nominatim reverse-geocode client

**Files:**
- Create: `backend/src/lib/nominatim.ts`
- Test: `backend/src/lib/nominatim.test.ts`

**Interfaces:**
- Consumes: none (leaf module).
- Produces: `export interface NominatimAddress { country_code?: string; country?: string; city?: string; town?: string; municipality?: string; county?: string; state_district?: string; state?: string; region?: string; }`, `export function createThrottle(minIntervalMs: number): () => Promise<void>`, `export async function reverseGeocode(lat: number, lng: number): Promise<NominatimAddress>`. Task 4 (`jurisdiction.ts`) calls `reverseGeocode`.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/lib/nominatim.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createThrottle, reverseGeocode } from './nominatim';

test('createThrottle enforces the minimum interval between waits', async () => {
    const wait = createThrottle(50);
    const start = performance.now();
    await wait();
    await wait();
    await wait();
    const elapsed = performance.now() - start;
    assert.ok(elapsed >= 100, `expected >=100ms between 3 throttled calls, got ${elapsed}ms`);
});

test('reverseGeocode returns the address block from Nominatim', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
        assert.ok(url.includes('lat=14.45'));
        assert.ok(url.includes('lon=120.95'));
        assert.ok(url.includes('addressdetails=1'));
        return new Response(JSON.stringify({
            address: { country_code: 'ph', country: 'Philippines', city: 'Naic' },
        }), { status: 200 });
    }) as typeof fetch;

    try {
        const address = await reverseGeocode(14.45, 120.95);
        assert.equal(address.country_code, 'ph');
        assert.equal(address.city, 'Naic');
    } finally {
        globalThis.fetch = originalFetch;
    }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx tsx --test src/lib/nominatim.test.ts`
Expected: FAIL — `Cannot find module './nominatim'`.

- [ ] **Step 3: Write the implementation**

```typescript
// backend/src/lib/nominatim.ts
export interface NominatimAddress {
    country_code?: string;
    country?: string;
    city?: string;
    town?: string;
    municipality?: string;
    county?: string;
    state_district?: string;
    state?: string;
    region?: string;
}

/** Returns a `wait()` that resolves only once `minIntervalMs` has passed since the last resolved call. */
export function createThrottle(minIntervalMs: number): () => Promise<void> {
    let nextAvailableAt = 0;
    return function wait(): Promise<void> {
        const now = Date.now();
        const delay = Math.max(0, nextAvailableAt - now);
        nextAvailableAt = Math.max(now, nextAvailableAt) + minIntervalMs;
        return new Promise((resolve) => setTimeout(resolve, delay));
    };
}

// Nominatim usage policy caps unauthenticated use at 1 request/second, globally.
const throttle = createThrottle(1000);

export async function reverseGeocode(lat: number, lng: number): Promise<NominatimAddress> {
    await throttle();
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'green-lens-backend/1.0' } });
    if (!res.ok) throw new Error(`Nominatim request failed: ${res.status}`);
    const data = (await res.json()) as { address?: NominatimAddress };
    return data.address ?? {};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx tsx --test src/lib/nominatim.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/lib/nominatim.ts src/lib/nominatim.test.ts
git commit -m "feat: add throttled Nominatim reverse-geocode client"
```

---

### Task 3: PSGC name-matching service

**Files:**
- Create: `backend/src/lib/psgc.ts`
- Test: `backend/src/lib/psgc.test.ts`

**Interfaces:**
- Consumes: none (leaf module).
- Produces: `export interface PsgcEntity { code: string; name: string }`, `export function normalizeName(name: string): string`, `export function findBestMatch(candidates: string[], options: PsgcEntity[]): PsgcEntity | null`, `export async function fetchRegions(): Promise<PsgcEntity[]>`, `export async function fetchProvinces(regionCode: string): Promise<PsgcEntity[]>`, `export async function fetchCitiesMunicipalitiesByProvince(provinceCode: string): Promise<PsgcEntity[]>`, `export async function fetchCitiesMunicipalitiesByRegion(regionCode: string): Promise<PsgcEntity[]>`. Task 4 calls all of these.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/lib/psgc.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, findBestMatch, fetchRegions } from './psgc';

test('normalizeName strips prefixes, accents, and casing', () => {
    assert.equal(normalizeName('City of Parañaque'), 'paranaque');
    assert.equal(normalizeName('Municipality of Naic'), 'naic');
    assert.equal(normalizeName('  Quezon   City  '), 'quezon city');
});

test('findBestMatch returns the first candidate that matches an option, normalized', () => {
    const options = [{ code: '1', name: 'Naic' }, { code: '2', name: 'Tanza' }];
    const match = findBestMatch(['Unknown Place', 'Municipality of Naic'], options);
    assert.deepEqual(match, { code: '1', name: 'Naic' });
});

test('findBestMatch returns null when nothing matches', () => {
    const options = [{ code: '1', name: 'Naic' }];
    assert.equal(findBestMatch(['Nowhere'], options), null);
});

test('fetchRegions calls the PSGC regions endpoint', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
        assert.equal(url, 'https://psgc.gitlab.io/api/regions/');
        return new Response(JSON.stringify([{ code: '040000000', name: 'Region IV-A' }]), { status: 200 });
    }) as typeof fetch;

    try {
        const regions = await fetchRegions();
        assert.deepEqual(regions, [{ code: '040000000', name: 'Region IV-A' }]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx tsx --test src/lib/psgc.test.ts`
Expected: FAIL — `Cannot find module './psgc'`.

- [ ] **Step 3: Write the implementation**

```typescript
// backend/src/lib/psgc.ts
const BASE = 'https://psgc.gitlab.io/api';

export interface PsgcEntity {
    code: string;
    name: string;
}

/** Lowercase, strip accents/diacritics, drop "City of"/"Municipality of" prefixes, collapse whitespace. */
export function normalizeName(name: string): string {
    return name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // strip accents
        .toLowerCase()
        .replace(/^(city of|municipality of)\s+/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Tries each candidate (in priority order) against every option; returns the first normalized match. */
export function findBestMatch(candidates: string[], options: PsgcEntity[]): PsgcEntity | null {
    for (const candidate of candidates) {
        const normalizedCandidate = normalizeName(candidate);
        const match = options.find((opt) => normalizeName(opt.name) === normalizedCandidate);
        if (match) return match;
    }
    return null;
}

async function getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) throw new Error(`PSGC request failed: ${path} -> ${res.status}`);
    return res.json() as Promise<T>;
}

export function fetchRegions(): Promise<PsgcEntity[]> {
    return getJson('/regions/');
}

export function fetchProvinces(regionCode: string): Promise<PsgcEntity[]> {
    return getJson(`/regions/${regionCode}/provinces/`);
}

export function fetchCitiesMunicipalitiesByProvince(provinceCode: string): Promise<PsgcEntity[]> {
    return getJson(`/provinces/${provinceCode}/cities-municipalities/`);
}

export function fetchCitiesMunicipalitiesByRegion(regionCode: string): Promise<PsgcEntity[]> {
    return getJson(`/regions/${regionCode}/cities-municipalities/`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx tsx --test src/lib/psgc.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/lib/psgc.ts src/lib/psgc.test.ts
git commit -m "feat: add PSGC name-matching service"
```

---

### Task 4: Jurisdiction resolution orchestrator

**Files:**
- Create: `backend/src/services/jurisdiction.ts`
- Test: `backend/src/services/jurisdiction.test.ts`

**Interfaces:**
- Consumes: `reverseGeocode` from `../lib/nominatim`, `fetchRegions`/`fetchProvinces`/`fetchCitiesMunicipalitiesByProvince`/`fetchCitiesMunicipalitiesByRegion`/`findBestMatch` from `../lib/psgc`.
- Produces: `export class NotInPhilippinesError extends Error {}`, `export interface JurisdictionResult { jurisdictionStatus: 'ASSIGNED' | 'UNASSIGNED'; regionCode: string | null; regionName: string | null; provinceCode: string | null; provinceName: string | null; municipalityCode: string | null; municipalityName: string | null }`, `export async function resolveJurisdiction(lat: number, lng: number): Promise<JurisdictionResult>`. Task 6 (`routes/reports.ts`) calls `resolveJurisdiction` and catches `NotInPhilippinesError`.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/services/jurisdiction.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as nominatim from '../lib/nominatim';
import * as psgc from '../lib/psgc';
import { resolveJurisdiction, NotInPhilippinesError } from './jurisdiction';

function stub<T extends object, K extends keyof T>(obj: T, key: K, impl: T[K]) {
    const original = obj[key];
    obj[key] = impl;
    return () => { obj[key] = original; };
}

test('resolveJurisdiction throws NotInPhilippinesError outside PH', async () => {
    const restore = stub(nominatim, 'reverseGeocode', async () => ({ country_code: 'us' }));
    try {
        await assert.rejects(() => resolveJurisdiction(37.7, -122.4), NotInPhilippinesError);
    } finally {
        restore();
    }
});

test('resolveJurisdiction returns ASSIGNED on a full region/province/municipality match', async () => {
    const restoreGeocode = stub(nominatim, 'reverseGeocode', async () => ({
        country_code: 'ph',
        city: 'Naic',
        state: 'Region IV-A',
    }));
    const restoreRegions = stub(psgc, 'fetchRegions', async () => [{ code: 'R4A', name: 'Region IV-A' }]);
    const restoreProvinces = stub(psgc, 'fetchProvinces', async () => [{ code: 'CAV', name: 'Cavite' }]);
    const restoreMunis = stub(psgc, 'fetchCitiesMunicipalitiesByProvince', async () => [{ code: 'NAIC', name: 'Naic' }]);

    try {
        const result = await resolveJurisdiction(14.32, 120.77);
        assert.deepEqual(result, {
            jurisdictionStatus: 'ASSIGNED',
            regionCode: 'R4A', regionName: 'Region IV-A',
            provinceCode: 'CAV', provinceName: 'Cavite',
            municipalityCode: 'NAIC', municipalityName: 'Naic',
        });
    } finally {
        restoreGeocode(); restoreRegions(); restoreProvinces(); restoreMunis();
    }
});

test('resolveJurisdiction returns UNASSIGNED when no region matches', async () => {
    const restoreGeocode = stub(nominatim, 'reverseGeocode', async () => ({ country_code: 'ph', state: 'Somewhere Unmapped' }));
    const restoreRegions = stub(psgc, 'fetchRegions', async () => [{ code: 'R4A', name: 'Region IV-A' }]);

    try {
        const result = await resolveJurisdiction(14.32, 120.77);
        assert.equal(result.jurisdictionStatus, 'UNASSIGNED');
        assert.equal(result.regionCode, null);
    } finally {
        restoreGeocode(); restoreRegions();
    }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx tsx --test src/services/jurisdiction.test.ts`
Expected: FAIL — `Cannot find module './jurisdiction'`.

- [ ] **Step 3: Write the implementation**

```typescript
// backend/src/services/jurisdiction.ts
import { reverseGeocode } from '../lib/nominatim';
import {
    fetchRegions, fetchProvinces, fetchCitiesMunicipalitiesByProvince, fetchCitiesMunicipalitiesByRegion,
    findBestMatch,
} from '../lib/psgc';

export class NotInPhilippinesError extends Error {
    constructor() {
        super('This service only accepts reports within the Philippines.');
        this.name = 'NotInPhilippinesError';
    }
}

export interface JurisdictionResult {
    jurisdictionStatus: 'ASSIGNED' | 'UNASSIGNED';
    regionCode: string | null;
    regionName: string | null;
    provinceCode: string | null;
    provinceName: string | null;
    municipalityCode: string | null;
    municipalityName: string | null;
}

const UNASSIGNED: JurisdictionResult = {
    jurisdictionStatus: 'UNASSIGNED',
    regionCode: null, regionName: null,
    provinceCode: null, provinceName: null,
    municipalityCode: null, municipalityName: null,
};

export async function resolveJurisdiction(lat: number, lng: number): Promise<JurisdictionResult> {
    const address = await reverseGeocode(lat, lng);
    if (address.country_code?.toLowerCase() !== 'ph') {
        throw new NotInPhilippinesError();
    }

    const regionCandidates = [address.state, address.region].filter((v): v is string => Boolean(v));
    const provinceCandidates = [address.state_district, address.county].filter((v): v is string => Boolean(v));
    const municipalityCandidates = [address.city, address.town, address.municipality, address.county]
        .filter((v): v is string => Boolean(v));

    const regions = await fetchRegions();
    const region = findBestMatch(regionCandidates, regions);
    if (!region) return UNASSIGNED;

    const provinces = await fetchProvinces(region.code);

    if (provinces.length === 0) {
        // Region has no provinces (e.g. NCR) — municipalities sit directly under the region.
        const municipalities = await fetchCitiesMunicipalitiesByRegion(region.code);
        const municipality = findBestMatch(municipalityCandidates, municipalities);
        if (!municipality) return UNASSIGNED;
        return {
            jurisdictionStatus: 'ASSIGNED',
            regionCode: region.code, regionName: region.name,
            provinceCode: null, provinceName: null,
            municipalityCode: municipality.code, municipalityName: municipality.name,
        };
    }

    const province = findBestMatch(provinceCandidates, provinces);
    if (!province) return UNASSIGNED;

    const municipalities = await fetchCitiesMunicipalitiesByProvince(province.code);
    const municipality = findBestMatch(municipalityCandidates, municipalities);
    if (!municipality) return UNASSIGNED;

    return {
        jurisdictionStatus: 'ASSIGNED',
        regionCode: region.code, regionName: region.name,
        provinceCode: province.code, provinceName: province.name,
        municipalityCode: municipality.code, municipalityName: municipality.name,
    };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx tsx --test src/services/jurisdiction.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/services/jurisdiction.ts src/services/jurisdiction.test.ts
git commit -m "feat: add jurisdiction resolution orchestrator"
```

---

### Task 5: `requireUser` auth stub middleware

**Files:**
- Create: `backend/src/middleware/requireUser.ts`
- Test: `backend/src/middleware/requireUser.test.ts`

**Interfaces:**
- Consumes: `prisma` from `../lib/prisma`.
- Produces: `export const requireUser: import('express').RequestHandler` (attaches `req.user: User` via Express `Request` interface augmentation), `export const requireSuperAdmin: import('express').RequestHandler` (must run after `requireUser`; 403s if `req.user.role !== 'SUPER_ADMIN'`). Task 6 mounts both on the reports router.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/middleware/requireUser.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { prisma } from '../lib/prisma';
import { requireUser, requireSuperAdmin } from './requireUser';

test('requireUser rejects requests with no x-user-id header', async () => {
    const app = express();
    app.get('/ping', requireUser, (_req, res) => res.json({ ok: true }));
    const server = app.listen(0);
    const { port } = server.address() as { port: number };

    try {
        const res = await fetch(`http://localhost:${port}/ping`);
        assert.equal(res.status, 401);
    } finally {
        server.close();
    }
});

test('requireUser attaches req.user for a valid header, requireSuperAdmin 403s a non-super-admin', async () => {
    const user = await prisma.user.create({
        data: {
            name: 'Test Agent', email: `agent-${Date.now()}@gov.ph`, passwordHash: 'x',
            role: 'LGU_AGENT', status: 'ACTIVE', regionCode: 'R1', regionName: 'Region I',
        },
    });

    const app = express();
    app.get('/whoami', requireUser, (req, res) => res.json({ id: req.user.id }));
    app.get('/admin-only', requireUser, requireSuperAdmin, (_req, res) => res.json({ ok: true }));
    const server = app.listen(0);
    const { port } = server.address() as { port: number };

    try {
        const whoami = await fetch(`http://localhost:${port}/whoami`, { headers: { 'x-user-id': user.id } });
        assert.equal(whoami.status, 200);
        assert.deepEqual(await whoami.json(), { id: user.id });

        const adminOnly = await fetch(`http://localhost:${port}/admin-only`, { headers: { 'x-user-id': user.id } });
        assert.equal(adminOnly.status, 403);
    } finally {
        server.close();
        await prisma.user.delete({ where: { id: user.id } });
    }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx tsx --test src/middleware/requireUser.test.ts`
Expected: FAIL — `Cannot find module './requireUser'`.

- [ ] **Step 3: Write the implementation**

```typescript
// backend/src/middleware/requireUser.ts
import type { RequestHandler } from 'express';
import { prisma } from '../lib/prisma';
import type { User } from '../generated/prisma/client';

declare global {
    namespace Express {
        interface Request {
            user: User;
        }
    }
}

// ponytail: dev-only stand-in for real auth (JWT/session) — the spec explicitly
// defers auth to a follow-up. Trusts an `x-user-id` header as-is; replace once
// login exists.
export const requireUser: RequestHandler = async (req, res, next) => {
    const userId = req.header('x-user-id');
    if (!userId) {
        res.status(401).json({ error: 'Missing x-user-id header' });
        return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        res.status(401).json({ error: 'Unknown user' });
        return;
    }

    req.user = user;
    next();
};

export const requireSuperAdmin: RequestHandler = (req, res, next) => {
    if (req.user.role !== 'SUPER_ADMIN') {
        res.status(403).json({ error: 'Requires SUPER_ADMIN' });
        return;
    }
    next();
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx tsx --test src/middleware/requireUser.test.ts`
Expected: PASS, 2 tests. (Requires the Docker Postgres container from `backend/docker-compose.yml` running — `docker compose up -d`.)

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/middleware/requireUser.ts src/middleware/requireUser.test.ts
git commit -m "feat: add requireUser/requireSuperAdmin auth stub middleware"
```

---

### Task 6: Jurisdiction scoping filter

**Files:**
- Create: `backend/src/services/reportScope.ts`
- Test: `backend/src/services/reportScope.test.ts`

**Interfaces:**
- Consumes: `User` type from `../generated/prisma/client`, `Prisma` namespace from `../generated/prisma/client`.
- Produces: `export function buildJurisdictionFilter(user: User): Prisma.ReportWhereInput`. Task 7 (`routes/reports.ts`) calls this in `GET /`.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/services/reportScope.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildJurisdictionFilter } from './reportScope';
import type { User } from '../generated/prisma/client';

function makeUser(overrides: Partial<User>): User {
    return {
        id: '1', name: 'x', email: 'x@gov.ph', passwordHash: 'x',
        role: 'LGU_AGENT', status: 'ACTIVE',
        regionCode: null, regionName: null, provinceCode: null, provinceName: null,
        municipalityCode: null, municipalityName: null,
        createdAt: new Date(), updatedAt: new Date(),
        ...overrides,
    };
}

test('SUPER_ADMIN gets no filter', () => {
    const filter = buildJurisdictionFilter(makeUser({ role: 'SUPER_ADMIN' }));
    assert.deepEqual(filter, {});
});

test('municipality-level jurisdiction filters by municipalityCode', () => {
    const filter = buildJurisdictionFilter(makeUser({
        regionCode: 'R4A', provinceCode: 'CAV', municipalityCode: 'NAIC',
    }));
    assert.deepEqual(filter, { municipalityCode: 'NAIC' });
});

test('province-level jurisdiction (no municipality) filters by provinceCode', () => {
    const filter = buildJurisdictionFilter(makeUser({ regionCode: 'R4A', provinceCode: 'CAV' }));
    assert.deepEqual(filter, { provinceCode: 'CAV' });
});

test('region-level jurisdiction (no province) filters by regionCode', () => {
    const filter = buildJurisdictionFilter(makeUser({ regionCode: 'R4A' }));
    assert.deepEqual(filter, { regionCode: 'R4A' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx tsx --test src/services/reportScope.test.ts`
Expected: FAIL — `Cannot find module './reportScope'`.

- [ ] **Step 3: Write the implementation**

```typescript
// backend/src/services/reportScope.ts
import type { User } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';

/** Derives the Report `where` filter for a user's jurisdiction. UNASSIGNED reports never match. */
export function buildJurisdictionFilter(user: User): Prisma.ReportWhereInput {
    if (user.role === 'SUPER_ADMIN') return {};
    if (user.municipalityCode) return { municipalityCode: user.municipalityCode };
    if (user.provinceCode) return { provinceCode: user.provinceCode };
    return { regionCode: user.regionCode };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx tsx --test src/services/reportScope.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/services/reportScope.ts src/services/reportScope.test.ts
git commit -m "feat: add jurisdiction filter for scoped report queries"
```

---

### Task 7: Reports routes (create, list, assign)

**Files:**
- Create: `backend/src/routes/reports.ts`
- Test: `backend/src/routes/reports.test.ts`
- Modify: `backend/src/app.ts`

**Interfaces:**
- Consumes: `resolveJurisdiction`/`NotInPhilippinesError` from `../services/jurisdiction`, `buildJurisdictionFilter` from `../services/reportScope`, `requireUser`/`requireSuperAdmin` from `../middleware/requireUser`, `prisma` from `../lib/prisma`.
- Produces: default-exported Express `Router` mounted at `/api/reports` in `app.ts`, routes `POST /`, `GET /`, `PATCH /:id/jurisdiction`.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/routes/reports.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as jurisdiction from '../services/jurisdiction';
import { prisma } from '../lib/prisma';
import { app } from '../app';

function stub<T extends object, K extends keyof T>(obj: T, key: K, impl: T[K]) {
    const original = obj[key];
    obj[key] = impl;
    return () => { obj[key] = original; };
}

async function withServer<T>(fn: (base: string) => Promise<T>): Promise<T> {
    const server = app.listen(0);
    const { port } = server.address() as { port: number };
    try {
        return await fn(`http://localhost:${port}`);
    } finally {
        server.close();
    }
}

test('POST /api/reports rejects points outside the Philippines', async () => {
    const restore = stub(jurisdiction, 'resolveJurisdiction', async () => {
        throw new jurisdiction.NotInPhilippinesError();
    });
    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat: 37.7, lng: -122.4, severity: 'LOW', details: 'test' }),
            });
            assert.equal(res.status, 422);
        });
    } finally {
        restore();
    }
});

test('GET /api/reports only returns reports within the caller jurisdiction', async () => {
    const agent = await prisma.user.create({
        data: {
            name: 'Naic Agent', email: `naic-${Date.now()}@gov.ph`, passwordHash: 'x',
            role: 'LGU_AGENT', status: 'ACTIVE',
            regionCode: 'R4A', regionName: 'Region IV-A', provinceCode: 'CAV', provinceName: 'Cavite',
            municipalityCode: 'NAIC', municipalityName: 'Naic',
        },
    });
    const inJurisdiction = await prisma.report.create({
        data: {
            lat: 14.32, lng: 120.77, severity: 'LOW', details: 'in scope',
            regionCode: 'R4A', regionName: 'Region IV-A', provinceCode: 'CAV', provinceName: 'Cavite',
            municipalityCode: 'NAIC', municipalityName: 'Naic', jurisdictionStatus: 'ASSIGNED',
        },
    });
    const outOfJurisdiction = await prisma.report.create({
        data: {
            lat: 10.3, lng: 123.9, severity: 'LOW', details: 'out of scope',
            regionCode: 'R7', regionName: 'Region VII', provinceCode: 'CEB', provinceName: 'Cebu',
            municipalityCode: 'CEBU_CITY', municipalityName: 'Cebu City', jurisdictionStatus: 'ASSIGNED',
        },
    });

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/reports`, { headers: { 'x-user-id': agent.id } });
            assert.equal(res.status, 200);
            const reports = (await res.json()) as { id: string }[];
            const ids = reports.map((r) => r.id);
            assert.ok(ids.includes(inJurisdiction.id));
            assert.ok(!ids.includes(outOfJurisdiction.id));
        });
    } finally {
        await prisma.report.deleteMany({ where: { id: { in: [inJurisdiction.id, outOfJurisdiction.id] } } });
        await prisma.user.delete({ where: { id: agent.id } });
    }
});

test('PATCH /api/reports/:id/jurisdiction requires SUPER_ADMIN', async () => {
    const agent = await prisma.user.create({
        data: {
            name: 'Non-Admin', email: `nonadmin-${Date.now()}@gov.ph`, passwordHash: 'x',
            role: 'LGU_AGENT', status: 'ACTIVE', regionCode: 'R4A', regionName: 'Region IV-A',
        },
    });
    const report = await prisma.report.create({
        data: { lat: 14.32, lng: 120.77, severity: 'LOW', details: 'unassigned', jurisdictionStatus: 'UNASSIGNED' },
    });

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/reports/${report.id}/jurisdiction`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-user-id': agent.id },
                body: JSON.stringify({ regionCode: 'R4A', regionName: 'Region IV-A' }),
            });
            assert.equal(res.status, 403);
        });
    } finally {
        await prisma.report.delete({ where: { id: report.id } });
        await prisma.user.delete({ where: { id: agent.id } });
    }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx tsx --test src/routes/reports.test.ts`
Expected: FAIL — `Cannot find module '../routes/reports'` (via `app.ts` not yet mounting it) or 404s on `/api/reports`.

- [ ] **Step 3: Write the implementation**

```typescript
// backend/src/routes/reports.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { resolveJurisdiction, NotInPhilippinesError } from '../services/jurisdiction';
import { buildJurisdictionFilter } from '../services/reportScope';
import { requireUser, requireSuperAdmin } from '../middleware/requireUser';

const router = Router();

const createReportSchema = z.object({
    lat: z.number(),
    lng: z.number(),
    severity: z.enum(['HIGH', 'LOW']),
    details: z.string().min(1),
    locationLabel: z.string().nullish(),
    imageUrls: z.array(z.string()).default([]),
});

router.post('/', async (req, res, next) => {
    try {
        const data = createReportSchema.parse(req.body);
        const jurisdiction = await resolveJurisdiction(data.lat, data.lng);

        const report = await prisma.report.create({
            data: { ...data, ...jurisdiction },
        });
        res.status(201).json(report);
    } catch (err) {
        if (err instanceof NotInPhilippinesError) {
            res.status(422).json({ error: err.message });
            return;
        }
        next(err);
    }
});

router.get('/', requireUser, async (req, res, next) => {
    try {
        const where = buildJurisdictionFilter(req.user);
        const reports = await prisma.report.findMany({ where, orderBy: { createdAt: 'desc' } });
        res.json(reports);
    } catch (err) {
        next(err);
    }
});

const assignJurisdictionSchema = z.object({
    regionCode: z.string().min(1),
    regionName: z.string().min(1),
    provinceCode: z.string().nullish(),
    provinceName: z.string().nullish(),
    municipalityCode: z.string().nullish(),
    municipalityName: z.string().nullish(),
});

router.patch('/:id/jurisdiction', requireUser, requireSuperAdmin, async (req, res, next) => {
    try {
        const data = assignJurisdictionSchema.parse(req.body);
        const report = await prisma.report.update({
            where: { id: req.params.id },
            data: { ...data, jurisdictionStatus: 'ASSIGNED' },
        });
        res.json(report);
    } catch (err) {
        next(err);
    }
});

export default router;
```

Mount it in `backend/src/app.ts` — add the import alongside the existing `usersRouter` import and the `app.use` call alongside the existing `/api/users` mount:

```typescript
import reportsRouter from './routes/reports';
// ...
app.use('/api/reports', reportsRouter);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx tsx --test src/routes/reports.test.ts`
Expected: PASS, 3 tests. (Requires Docker Postgres running.)

- [ ] **Step 5: Run the full test suite**

Run: `cd backend && npx tsx --test "src/**/*.test.ts"`
Expected: all tests across every task pass.

- [ ] **Step 6: Commit**

```bash
cd backend
git add src/routes/reports.ts src/app.ts src/routes/reports.test.ts
git commit -m "feat: add reports routes with jurisdiction-scoped GET and SUPER_ADMIN assign"
```

---

### Task 8: Seed script for the first SUPER_ADMIN

**Files:**
- Create: `backend/prisma/seed.ts`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: `prisma` from `../src/lib/prisma`, `bcrypt`.
- Produces: a runnable `npx prisma db seed` command; no other task depends on this one.

- [ ] **Step 1: Write the seed script**

```typescript
// backend/prisma/seed.ts
import bcrypt from 'bcrypt';
import { prisma } from '../src/lib/prisma';

async function main() {
    const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@greenlens.local';
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        console.log(`SUPER_ADMIN already exists: ${email}`);
        return;
    }

    const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'change-me-immediately';
    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
        data: {
            name: 'Super Admin', email, passwordHash,
            role: 'SUPER_ADMIN', status: 'ACTIVE',
        },
    });

    console.log(`Seeded SUPER_ADMIN: ${email} / ${password}`);
}

main()
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Wire up `prisma db seed`**

Run: `cd backend && npm pkg set prisma.seed="tsx prisma/seed.ts"`
Expected: `package.json` gains a top-level `"prisma": { "seed": "tsx prisma/seed.ts" }` block.

- [ ] **Step 3: Run the seed and verify**

Run: `cd backend && npx prisma db seed`
Expected: `Seeded SUPER_ADMIN: superadmin@greenlens.local / change-me-immediately`. Run it again — expected: `SUPER_ADMIN already exists: superadmin@greenlens.local` (idempotent).

- [ ] **Step 4: Commit**

```bash
cd backend
git add prisma/seed.ts package.json
git commit -m "feat: add SUPER_ADMIN seed script"
```

---

### Task 9: Add the `test` script and run everything together

**Files:**
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: every `*.test.ts` file created in Tasks 2–7.
- Produces: `npm test` as the standard entry point for the whole suite.

- [ ] **Step 1: Set the script**

Run: `cd backend && npm pkg set scripts.test="tsx --test \"src/**/*.test.ts\""`

- [ ] **Step 2: Run it**

Run: `cd backend && npm test`
Expected: all tests from Tasks 2, 3, 4, 5, 6, 7 pass (16 tests total). Requires Docker Postgres running (`docker compose up -d` in `backend/`).

- [ ] **Step 3: Commit**

```bash
cd backend
git add package.json
git commit -m "chore: wire up npm test to run the node:test suite"
```
