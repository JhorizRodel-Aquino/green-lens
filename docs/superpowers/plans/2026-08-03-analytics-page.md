# Analytics Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the empty `AnalyticsPage.tsx` stub with a full page: shared filters, a stat row, and 3 Recharts-based charts (Reports Over Time, Per-Jurisdiction Resolution Rate, Status Breakdown).

**Architecture:** Frontend only, no backend/API changes. New pure-function utilities in `frontend/src/utils/analyticsStats.ts` compute chart-ready data from the same `TrashReport[]` already flowing through `ReportsContext`. `DashboardPage.tsx`'s existing per-jurisdiction calculation is extracted into that same util (deduped, not copy-pasted) so Dashboard and Analytics compute it identically. Charts render via the new `recharts` dependency, styled with colors validated by the `dataviz` skill's palette validator.

**Tech Stack:** React 19 + TypeScript, Vite, Tailwind, `recharts` (new dependency). No test framework in `frontend/` — the two new pure-logic functions get an assert-based self-check run via `tsx`, same pattern as `frontend/src/utils/geo.selfcheck.ts`.

## Global Constraints

- No dark mode in this app (`tailwind.config.js` has no `darkMode` config) — light-mode colors only, no dark variants.
- Colors must be exactly these (validated via `dataviz` skill's `validate_palette.js`, all checks pass):
  - Reports Over Time line chart: Resolved = `#16a34a`, Filed = `#0ea5e9`.
  - Status Breakdown bars: Resolved = `#16a34a`, Flagged = `#f59e0b`, Pending = `#0ea5e9`, Unresolved = `#8b5cf6`.
  - Per-Jurisdiction bar chart: single hue `#16a34a` for all bars (magnitude, not categorical).
- Per-Jurisdiction chart only renders when `user?.role !== 'LGU_AGENT'`.
- Reports Over Time bucket granularity: `today` → hourly, `week` → daily, `month` → weekly, `custom` → daily if span ≤ 31 days else weekly.
- Reuse existing components verbatim: `LguFilter`/`useLguFilter`, `DateRangeFilter`, `StatCard` — no new filter UI.
- Legend always shown for ≥2 series charts; bars get direct value labels — status/series identity must never rely on color alone.
- Empty-state text for all 3 charts when no data: `"No data for this period."`

---

## Task 1: `analyticsStats.ts` — time-bucketing utility

**Files:**
- Create: `frontend/src/utils/analyticsStats.ts`
- Create: `frontend/src/utils/analyticsStats.selfcheck.ts`

**Interfaces:**
- Consumes: `type TrashReport` from `@/components/map/TrashMap` (has `createdAt: string`, `resolvedAt?: string`, `status: 'resolved' | 'flagged' | 'unresolved' | 'pending'`); `type DatePreset`, `getPeriodBounds`, `type PeriodBounds` from `@/utils/reportStats`.
- Produces: `type TimeBucket = { key: string; label: string; filed: number; resolved: number }`, `bucketReportsOverTime(reports: TrashReport[], preset: DatePreset, customFrom: string, customTo: string): TimeBucket[]` (sorted ascending by `key`).

- [ ] **Step 1: Write `analyticsStats.ts` with the bucketing function**

```typescript
// frontend/src/utils/analyticsStats.ts
import type { TrashReport } from '@/components/map/TrashMap';
import { getPeriodBounds, type DatePreset, type PeriodBounds } from '@/utils/reportStats';

type Granularity = 'hour' | 'day' | 'week';

function bucketKeyAndLabel(date: Date, granularity: Granularity): { key: string; label: string } {
    if (granularity === 'hour') {
        const key = date.toISOString().slice(0, 13); // YYYY-MM-DDTHH
        const label = date.toLocaleTimeString('en-US', { hour: 'numeric' });
        return { key, label };
    }
    if (granularity === 'day') {
        const key = date.toISOString().slice(0, 10); // YYYY-MM-DD
        const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return { key, label };
    }
    // week: bucket by the Monday of that week
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    d.setDate(d.getDate() - diffToMonday);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { key, label };
}

function granularityFor(preset: DatePreset, bounds: PeriodBounds | null): Granularity {
    if (preset === 'today') return 'hour';
    if (preset === 'week') return 'day';
    if (preset === 'month') return 'week';
    if (!bounds) return 'week';
    const spanDays = (bounds.end.getTime() - bounds.start.getTime()) / 86_400_000;
    return spanDays <= 31 ? 'day' : 'week';
}

export type TimeBucket = { key: string; label: string; filed: number; resolved: number };

/** Buckets reports by createdAt (Filed) and resolvedAt (Resolved) into a time series.
 * Granularity auto-adjusts to the date preset so "today" never renders as one point. */
export function bucketReportsOverTime(
    reports: TrashReport[],
    preset: DatePreset,
    customFrom: string,
    customTo: string
): TimeBucket[] {
    const bounds = getPeriodBounds(preset, customFrom, customTo);
    const granularity = granularityFor(preset, bounds);
    const buckets = new Map<string, TimeBucket>();

    for (const r of reports) {
        const { key, label } = bucketKeyAndLabel(new Date(r.createdAt), granularity);
        const bucket = buckets.get(key) ?? { key, label, filed: 0, resolved: 0 };
        bucket.filed += 1;
        buckets.set(key, bucket);

        if (r.status === 'resolved' && r.resolvedAt) {
            const rKeyLabel = bucketKeyAndLabel(new Date(r.resolvedAt), granularity);
            const rBucket = buckets.get(rKeyLabel.key) ?? { key: rKeyLabel.key, label: rKeyLabel.label, filed: 0, resolved: 0 };
            rBucket.resolved += 1;
            buckets.set(rKeyLabel.key, rBucket);
        }
    }

    return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}
```

- [ ] **Step 2: Write the self-check**

```typescript
// frontend/src/utils/analyticsStats.selfcheck.ts
// Run with: npx tsx frontend/src/utils/analyticsStats.selfcheck.ts
import { bucketReportsOverTime } from './analyticsStats';
import type { TrashReport } from '../components/map/TrashMap';

function report(overrides: Partial<TrashReport>): TrashReport {
    return {
        id: overrides.id ?? Math.random().toString(),
        lat: 14.6, lng: 121.0,
        severity: 'LOW',
        details: 'test',
        status: 'pending',
        createdAt: new Date().toISOString(),
        ...overrides,
    } as TrashReport;
}

// "week" preset -> daily granularity. Two reports on the same day should merge into one bucket.
const reports: TrashReport[] = [
    report({ id: '1', createdAt: '2026-01-05T08:00:00.000Z' }),
    report({ id: '2', createdAt: '2026-01-05T18:00:00.000Z' }),
    report({ id: '3', createdAt: '2026-01-06T09:00:00.000Z', status: 'resolved', resolvedAt: '2026-01-07T09:00:00.000Z' }),
];

const buckets = bucketReportsOverTime(reports, 'week', '', '');
console.assert(buckets.length === 3, `expected 3 buckets (Jan 5, 6, 7), got ${buckets.length}`);

const jan5 = buckets.find((b) => b.key === '2026-01-05');
console.assert(jan5?.filed === 2, `expected 2 filed on Jan 5, got ${jan5?.filed}`);

const jan7 = buckets.find((b) => b.key === '2026-01-07');
console.assert(jan7?.resolved === 1, `expected 1 resolved on Jan 7 (resolvedAt date), got ${jan7?.resolved}`);

// Sorted ascending by key.
console.assert(
    buckets.every((b, i) => i === 0 || buckets[i - 1].key < b.key),
    'buckets must be sorted ascending by key'
);

// "today" preset -> hourly granularity, same-day reports at different hours stay separate.
const hourlyReports: TrashReport[] = [
    report({ id: '4', createdAt: new Date(new Date().setHours(9, 0, 0, 0)).toISOString() }),
    report({ id: '5', createdAt: new Date(new Date().setHours(14, 0, 0, 0)).toISOString() }),
];
const hourlyBuckets = bucketReportsOverTime(hourlyReports, 'today', '', '');
console.assert(hourlyBuckets.length === 2, `expected 2 hourly buckets, got ${hourlyBuckets.length}`);

console.log('analyticsStats.selfcheck.ts: all assertions passed');
```

- [ ] **Step 3: Run the self-check**

Run: `npx tsx frontend/src/utils/analyticsStats.selfcheck.ts`
Expected: `analyticsStats.selfcheck.ts: all assertions passed`, no assertion errors, exit code 0.

- [ ] **Step 4: Verify it builds**

Run: `cd frontend && npx tsc -b --noEmit 2>&1 | grep -i analyticsStats`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/analyticsStats.ts frontend/src/utils/analyticsStats.selfcheck.ts
git commit -m "feat: add time-bucketing utility for analytics charts"
```

---

## Task 2: `analyticsStats.ts` — jurisdiction stats (extracted from Dashboard) + status breakdown

**Files:**
- Modify: `frontend/src/utils/analyticsStats.ts`
- Modify: `frontend/src/utils/analyticsStats.selfcheck.ts`
- Modify: `frontend/src/pages/admin/DashboardPage.tsx:111-139` (replace inline `jurisdictionStats` useMemo body with a call to the extracted function)

**Interfaces:**
- Consumes: `jurisdictionLabel` from `@/utils/reportStats`; `TrashReport` from Task 1's imports.
- Produces: `type JurisdictionStat = { name: string; total: number; resolved: number; resolutionRate: number; avgResolutionHours: number | null }`, `computeJurisdictionStats(reports: TrashReport[]): JurisdictionStat[]`; `type StatusCount = { status: TrashReport['status']; label: string; count: number }`, `computeStatusBreakdown(reports: TrashReport[]): StatusCount[]` (always 4 entries in fixed order: pending, unresolved, flagged, resolved — 0 count if none).

- [ ] **Step 1: Add both functions to `analyticsStats.ts`**

Append to `frontend/src/utils/analyticsStats.ts`:

```typescript
import { jurisdictionLabel } from '@/utils/reportStats';

export type JurisdictionStat = {
    name: string;
    total: number;
    resolved: number;
    resolutionRate: number;
    avgResolutionHours: number | null;
};

/** Per-jurisdiction totals/resolution rate/avg resolution time. Flagged reports don't count
 * toward a jurisdiction's grade. Extracted from DashboardPage so Dashboard and Analytics
 * compute this identically instead of duplicating the logic. */
export function computeJurisdictionStats(reports: TrashReport[]): JurisdictionStat[] {
    type Bucket = { total: number; resolved: number; resolutionHoursSum: number; resolutionCount: number };
    const buckets = new Map<string, Bucket>();
    for (const r of reports) {
        if (r.status === 'flagged') continue;
        const key = jurisdictionLabel(r);
        const b = buckets.get(key) ?? { total: 0, resolved: 0, resolutionHoursSum: 0, resolutionCount: 0 };
        b.total += 1;
        if (r.status === 'resolved') {
            b.resolved += 1;
            if (r.resolvedAt) {
                const hours = (new Date(r.resolvedAt).getTime() - new Date(r.createdAt).getTime()) / 3_600_000;
                if (hours >= 0) {
                    b.resolutionHoursSum += hours;
                    b.resolutionCount += 1;
                }
            }
        }
        buckets.set(key, b);
    }
    return [...buckets.entries()].map(([name, b]) => ({
        name,
        total: b.total,
        resolved: b.resolved,
        resolutionRate: b.total > 0 ? (b.resolved / b.total) * 100 : 0,
        avgResolutionHours: b.resolutionCount > 0 ? b.resolutionHoursSum / b.resolutionCount : null,
    }));
}

export type StatusCount = { status: TrashReport['status']; label: string; count: number };

const STATUS_ORDER: { status: TrashReport['status']; label: string }[] = [
    { status: 'pending', label: 'Pending' },
    { status: 'unresolved', label: 'Unresolved' },
    { status: 'flagged', label: 'Flagged' },
    { status: 'resolved', label: 'Resolved' },
];

/** Count of reports per status, always returning all 4 statuses in a fixed order (0 if none),
 * so the chart's bar order/colors never shift based on which statuses happen to be present. */
export function computeStatusBreakdown(reports: TrashReport[]): StatusCount[] {
    const counts = new Map<TrashReport['status'], number>();
    for (const r of reports) {
        counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
    }
    return STATUS_ORDER.map(({ status, label }) => ({ status, label, count: counts.get(status) ?? 0 }));
}
```

- [ ] **Step 2: Replace `DashboardPage.tsx`'s inline calculation with the extracted function**

In `frontend/src/pages/admin/DashboardPage.tsx`, add the import:

```typescript
import { computeJurisdictionStats } from '@/utils/analyticsStats';
```

Replace the `jurisdictionStats` useMemo (currently lines 111-139) with:

```typescript
    // Per-jurisdiction stats, only meaningful for SUPER_ADMIN (sees all LGUs)
    const jurisdictionStats = useMemo(() => computeJurisdictionStats(filteredReports), [filteredReports]);
```

- [ ] **Step 3: Add assertions for both new functions to the self-check**

Append to `frontend/src/utils/analyticsStats.selfcheck.ts`, before the final `console.log`:

```typescript
import { computeJurisdictionStats, computeStatusBreakdown } from './analyticsStats';

// computeJurisdictionStats: flagged reports excluded, resolution rate and avg hours correct.
const jReports: TrashReport[] = [
    report({ id: 'j1', municipalityName: 'Manila', status: 'resolved', createdAt: '2026-01-01T00:00:00.000Z', resolvedAt: '2026-01-02T00:00:00.000Z' } as Partial<TrashReport>),
    report({ id: 'j2', municipalityName: 'Manila', status: 'pending' } as Partial<TrashReport>),
    report({ id: 'j3', municipalityName: 'Manila', status: 'flagged' } as Partial<TrashReport>),
];
const jStats = computeJurisdictionStats(jReports);
console.assert(jStats.length === 1, `expected 1 jurisdiction, got ${jStats.length}`);
console.assert(jStats[0].total === 2, `flagged report must not count toward total, got ${jStats[0].total}`);
console.assert(jStats[0].resolutionRate === 50, `expected 50% resolution rate, got ${jStats[0].resolutionRate}`);
console.assert(jStats[0].avgResolutionHours === 24, `expected 24h avg resolution, got ${jStats[0].avgResolutionHours}`);

// computeStatusBreakdown: always 4 statuses, fixed order, correct counts.
const sReports: TrashReport[] = [
    report({ id: 's1', status: 'pending' }),
    report({ id: 's2', status: 'pending' }),
    report({ id: 's3', status: 'resolved' }),
];
const sBreakdown = computeStatusBreakdown(sReports);
console.assert(sBreakdown.length === 4, `expected 4 statuses always, got ${sBreakdown.length}`);
console.assert(
    sBreakdown.map((s) => s.status).join(',') === 'pending,unresolved,flagged,resolved',
    `expected fixed order pending,unresolved,flagged,resolved, got ${sBreakdown.map((s) => s.status).join(',')}`
);
console.assert(sBreakdown[0].count === 2, `expected 2 pending, got ${sBreakdown[0].count}`);
console.assert(sBreakdown[1].count === 0, `expected 0 unresolved, got ${sBreakdown[1].count}`);
```

- [ ] **Step 4: Run the self-check**

Run: `npx tsx frontend/src/utils/analyticsStats.selfcheck.ts`
Expected: `analyticsStats.selfcheck.ts: all assertions passed`, no assertion errors, exit code 0.

- [ ] **Step 5: Verify it builds**

Run: `cd frontend && npx tsc -b --noEmit 2>&1 | grep -iE "analyticsStats|DashboardPage"`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/analyticsStats.ts frontend/src/utils/analyticsStats.selfcheck.ts frontend/src/pages/admin/DashboardPage.tsx
git commit -m "refactor: extract jurisdiction stats into shared util, add status breakdown"
```

---

## Task 3: Install recharts, scaffold `AnalyticsPage.tsx` (filters + stat row, no charts yet)

**Files:**
- Modify: `frontend/package.json` (add `recharts` dependency)
- Modify: `frontend/src/pages/admin/AnalyticsPage.tsx` (full rewrite)

**Interfaces:**
- Consumes: `useReports` from `@/context/ReportsContext`; `useAuth` from `@/context/AuthContext`; `useLguFilter`, `LguFilter` (default export) from `@/components/admin/LguFilter`; `DateRangeFilter` (default export) from `@/components/admin/DateRangeFilter`; `StatCard` (default export) from `@/components/admin/StatCard`; `formatAvgResolutionTime`, `isWithinDatePreset`, `type DatePreset` from `@/utils/reportStats`.
- Produces: default-exported `AnalyticsPage` component. Later tasks (4, 5, 6) insert chart JSX into this file's return statement — this task establishes `filteredReports`, `datePreset`, `customFrom`, `customTo` as the state every chart consumes.

- [ ] **Step 1: Install recharts**

Run: `cd frontend && npm install recharts`
Expected: `recharts` added to `frontend/package.json` dependencies, install succeeds with no errors.

- [ ] **Step 2: Rewrite `AnalyticsPage.tsx`**

```typescript
// frontend/src/pages/admin/AnalyticsPage.tsx
import { useMemo, useState } from 'react';
import { FileText, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';
import { useReports } from '@/context/ReportsContext';
import { useAuth } from '@/context/AuthContext';
import StatCard from '@/components/admin/StatCard';
import DateRangeFilter from '@/components/admin/DateRangeFilter';
import LguFilter, { useLguFilter } from '@/components/admin/LguFilter';
import { formatAvgResolutionTime, isWithinDatePreset, type DatePreset } from '@/utils/reportStats';

export default function AnalyticsPage() {
    const { reports } = useReports();
    const { user } = useAuth();
    const [datePreset, setDatePreset] = useState<DatePreset>('month');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const { selectedLgu, setSelectedLgu, lguOptions, filteredReports: lguFilteredReports } = useLguFilter(reports, user?.role !== 'LGU_AGENT');

    const filteredReports = useMemo(
        () => lguFilteredReports.filter((r) => isWithinDatePreset(r.createdAt, datePreset, customFrom, customTo)),
        [lguFilteredReports, datePreset, customFrom, customTo]
    );

    const stats = useMemo(() => {
        const totalReports = filteredReports.length;
        const resolved = filteredReports.filter((r) => r.status === 'resolved').length;
        const resolutionRate = totalReports === 0 ? '—' : `${Math.round((resolved / totalReports) * 100)}%`;
        const avgResolution = formatAvgResolutionTime(filteredReports);
        const lguResponseRate = totalReports === 0
            ? '—'
            : `${Math.round((filteredReports.filter((r) => r.lguActionLogged).length / totalReports) * 100)}%`;
        return { totalReports, resolutionRate, avgResolution, lguResponseRate };
    }, [filteredReports]);

    return (
        <div className="p-4 md:p-6 space-y-6">
            <h1 className="text-2xl font-bold text-dark">Analytics</h1>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <LguFilter value={selectedLgu} onChange={setSelectedLgu} options={lguOptions} />
                    <DateRangeFilter
                        preset={datePreset}
                        onPresetChange={setDatePreset}
                        customFrom={customFrom}
                        onCustomFromChange={setCustomFrom}
                        customTo={customTo}
                        onCustomToChange={setCustomTo}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Total Reports" value={String(stats.totalReports)} icon={FileText} tone="default" />
                <StatCard label="Resolution Rate" value={stats.resolutionRate} icon={CheckCircle2} tone="success" />
                <StatCard label="Avg. Resolution Time" value={stats.avgResolution} icon={Clock3} tone="accent" />
                <StatCard label="LGU Response Rate" value={stats.lguResponseRate} icon={ShieldCheck} tone="default" />
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Verify it builds**

Run: `cd frontend && npx tsc -b --noEmit 2>&1 | grep -i AnalyticsPage`
Expected: no output.

- [ ] **Step 4: Manually verify in the browser**

Run: `cd frontend && npm run dev`, navigate to `/admin/analytics`. Confirm: page loads, LGU/date filters work, 4 stat cards show real numbers matching what Reports page shows for the same filter state.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/pages/admin/AnalyticsPage.tsx
git commit -m "feat: scaffold Analytics page with filters and stat row"
```

---

## Task 4: Reports Over Time line chart

**Files:**
- Modify: `frontend/src/pages/admin/AnalyticsPage.tsx`

**Interfaces:**
- Consumes: `bucketReportsOverTime`, `type TimeBucket` from `@/utils/analyticsStats` (Task 1); `filteredReports`, `datePreset`, `customFrom`, `customTo` from Task 3's component state.
- Produces: nothing consumed by other tasks (each chart task is independent once Task 3's scaffold exists).

- [ ] **Step 1: Add the import and data hook**

In `frontend/src/pages/admin/AnalyticsPage.tsx`, add to the imports:

```typescript
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { bucketReportsOverTime } from '@/utils/analyticsStats';
```

Add after the `stats` useMemo:

```typescript
    const timeBuckets = useMemo(
        () => bucketReportsOverTime(filteredReports, datePreset, customFrom, customTo),
        [filteredReports, datePreset, customFrom, customTo]
    );
```

- [ ] **Step 2: Add the chart card to the JSX**

Insert after the stat row `<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">...</div>` block, before the closing `</div>` of the page:

```typescript
            <div className="rounded-xl border border-light-dark bg-white p-4">
                <h3 className="text-sm font-semibold text-dark mb-4">Reports Over Time</h3>
                {timeBuckets.length === 0 ? (
                    <p className="text-sm text-dark-light py-10 text-center">No data for this period.</p>
                ) : (
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={timeBuckets}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
                            <Legend wrapperStyle={{ fontSize: 13 }} />
                            <Line type="monotone" dataKey="filed" name="Filed" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
```

- [ ] **Step 3: Verify it builds**

Run: `cd frontend && npx tsc -b --noEmit 2>&1 | grep -i AnalyticsPage`
Expected: no output.

- [ ] **Step 4: Manually verify in the browser**

Run: `cd frontend && npm run dev`, navigate to `/admin/analytics`. Confirm: line chart renders with two colored lines (blue = Filed, green = Resolved), legend shown, switching date preset changes the x-axis bucket granularity (e.g. "Today" shows hourly labels, "This Month" shows weekly labels), tooltip appears on hover.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/AnalyticsPage.tsx
git commit -m "feat: add Reports Over Time line chart to Analytics page"
```

---

## Task 5: Per-Jurisdiction Resolution Rate bar chart

**Files:**
- Modify: `frontend/src/pages/admin/AnalyticsPage.tsx`

**Interfaces:**
- Consumes: `computeJurisdictionStats`, `type JurisdictionStat` from `@/utils/analyticsStats` (Task 2); `filteredReports` from Task 3; `user` from `useAuth()` (already imported in Task 3).
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Add the import and data hook**

Add to imports:

```typescript
import { BarChart, Bar, Cell } from 'recharts';
import { computeJurisdictionStats } from '@/utils/analyticsStats';
```

(`BarChart`, `Bar`, `Cell` join the existing recharts import from Task 4 — combine into one `import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';` line instead of a second import statement.)

Add after the `timeBuckets` useMemo:

```typescript
    const jurisdictionStats = useMemo(
        () => [...computeJurisdictionStats(filteredReports)].sort((a, b) => b.resolutionRate - a.resolutionRate),
        [filteredReports]
    );
    const showJurisdictionChart = user?.role !== 'LGU_AGENT';
```

- [ ] **Step 2: Add the chart card to the JSX**

Insert after the Reports Over Time chart card, still inside the page's outer `<div className="p-4 md:p-6 space-y-6">`:

```typescript
            {showJurisdictionChart && (
                <div className="rounded-xl border border-light-dark bg-white p-4">
                    <h3 className="text-sm font-semibold text-dark mb-4">Per-Jurisdiction Resolution Rate</h3>
                    {jurisdictionStats.length === 0 ? (
                        <p className="text-sm text-dark-light py-10 text-center">No data for this period.</p>
                    ) : (
                        <ResponsiveContainer width="100%" height={Math.max(200, jurisdictionStats.length * 40)}>
                            <BarChart data={jurisdictionStats} layout="vertical" margin={{ left: 24 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} unit="%" />
                                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: '#0f172a' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                                    formatter={(value: number) => [`${Math.round(value)}%`, 'Resolution Rate']}
                                />
                                <Bar dataKey="resolutionRate" radius={[0, 4, 4, 0]}>
                                    {jurisdictionStats.map((j) => <Cell key={j.name} fill="#16a34a" />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            )}
```

- [ ] **Step 3: Verify it builds**

Run: `cd frontend && npx tsc -b --noEmit 2>&1 | grep -i AnalyticsPage`
Expected: no output.

- [ ] **Step 4: Manually verify in the browser**

Run: `cd frontend && npm run dev`. Log in as `admin@greenlens.local` / `admin123`, navigate to `/admin/analytics` — confirm the jurisdiction bar chart renders, sorted descending by resolution rate. Log out, log in as `lgu.naic@greenlens.local` / `naic123` — confirm the chart is entirely absent (not just empty).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/AnalyticsPage.tsx
git commit -m "feat: add per-jurisdiction resolution rate bar chart to Analytics page"
```

---

## Task 6: Status Breakdown bar chart

**Files:**
- Modify: `frontend/src/pages/admin/AnalyticsPage.tsx`

**Interfaces:**
- Consumes: `computeStatusBreakdown`, `type StatusCount` from `@/utils/analyticsStats` (Task 2); `filteredReports` from Task 3.
- Produces: nothing consumed by other tasks (final chart task).

- [ ] **Step 1: Add the import and data hook**

Add to the existing `@/utils/analyticsStats` import (combine with Task 4/5's imports from that module into one line): `import { bucketReportsOverTime, computeJurisdictionStats, computeStatusBreakdown } from '@/utils/analyticsStats';`

Add after the `jurisdictionStats`/`showJurisdictionChart` block:

```typescript
    const statusBreakdown = useMemo(() => computeStatusBreakdown(filteredReports), [filteredReports]);

    const STATUS_COLORS: Record<string, string> = {
        pending: '#0ea5e9',
        unresolved: '#8b5cf6',
        flagged: '#f59e0b',
        resolved: '#16a34a',
    };
```

- [ ] **Step 2: Add the chart card to the JSX**

Insert after the Per-Jurisdiction chart block (inside or after the `{showJurisdictionChart && (...)}` block, still a sibling within the page's outer container):

```typescript
            <div className="rounded-xl border border-light-dark bg-white p-4">
                <h3 className="text-sm font-semibold text-dark mb-4">Status Breakdown</h3>
                {statusBreakdown.every((s) => s.count === 0) ? (
                    <p className="text-sm text-dark-light py-10 text-center">No data for this period.</p>
                ) : (
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={statusBreakdown}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
                            <Bar dataKey="count" name="Reports" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 12, fill: '#0f172a' }}>
                                {statusBreakdown.map((s) => <Cell key={s.status} fill={STATUS_COLORS[s.status]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
```

- [ ] **Step 3: Verify it builds**

Run: `cd frontend && npx tsc -b --noEmit 2>&1 | grep -i AnalyticsPage`
Expected: no output.

- [ ] **Step 4: Manually verify in the browser**

Run: `cd frontend && npm run dev`, navigate to `/admin/analytics`. Confirm: 4 bars (Pending/Unresolved/Flagged/Resolved) in that order, each its own color per `STATUS_COLORS`, value label above each bar, counts match what the Reports page's tab counts show for the same filter state.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/AnalyticsPage.tsx
git commit -m "feat: add status breakdown bar chart to Analytics page"
```

---

## Self-Review Notes

- Spec coverage: filter row reuse ✓ (Task 3), stat row ✓ (Task 3), Reports Over Time line chart with auto bucketing ✓ (Task 1, Task 4), Per-Jurisdiction bar chart with LGU_AGENT gating ✓ (Task 2, Task 5), Status Breakdown bar chart with validated non-badge colors ✓ (Task 2, Task 6), jurisdiction-stats dedup with Dashboard ✓ (Task 2), empty states ✓ (all chart tasks), no dark mode ✓ (Global Constraints), no new backend/API calls ✓.
- No placeholders — every step has full code, no TBDs.
- Type consistency checked: `TimeBucket`, `JurisdictionStat`, `StatusCount` defined once in Task 1/2, imported by exact name in Tasks 4/5/6; `computeStatusBreakdown`'s `StatusCount.label` used directly as the bar chart's `dataKey="label"` in Task 6, matching the field name from Task 2.
- Out-of-scope items from the spec (alt data table, texture fills, drill-down, export) intentionally have no task — confirmed not silently dropped, they're listed in the spec's "Out of scope" section.
