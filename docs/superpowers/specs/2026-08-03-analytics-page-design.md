# Analytics Module — Design

## Problem

`AnalyticsPage.tsx` is a stub (just a heading). Admins/LGU agents have no dedicated place to see trends over time, cross-jurisdiction comparisons, or a status breakdown — only Dashboard's compressed 3-item previews and Reports' raw list.

## Goal

A full Analytics page reusing already-computed stats where they exist, adding real charts (via a new charting dependency — Recharts) for the views Dashboard only teases.

## Scope

- Frontend only, no backend changes. All data already flows through `ReportsContext` → `TrashReport[]`, same as Dashboard/Reports.
- New dependency: `recharts` (React-first, SVG-based, composable — matches React 19, no other charting lib in the project).

## Layout

Top to bottom, one page (`frontend/src/pages/admin/AnalyticsPage.tsx`):

1. **Filter row** — reuses `LguFilter`/`useLguFilter` and `DateRangeFilter` from `frontend/src/components/admin/`, identical wiring to `ReportsPage.tsx`. Keeps Analytics in sync with the same filtering vocabulary as Reports/Dashboard instead of inventing new filter UI.
2. **Stat row** — 4 `StatCard`s, full-width: Total Reports, Resolution Rate, Avg. Resolution Time, LGU Response Rate. Same metrics Dashboard already computes (`formatAvgResolutionTime`, `lguActionLogged`-based rate from `reportStats.ts`), just given the full row instead of Dashboard's compressed version.
3. **Reports Over Time** — line chart, always shown.
4. **Per-Jurisdiction Resolution Rate** — bar chart, `ADMIN`/`SUPER_ADMIN` only (hidden for `LGU_AGENT`, who only ever sees their own municipality server-side — a "compare jurisdictions" chart would render one bar for them).
5. **Status Breakdown** — bar chart, always shown.

Each chart lives in its own Level-1 card (`rounded-xl border border-light-dark bg-white p-4`), matching `AdminDesign.md`'s card spec.

## Chart 1: Reports Over Time

**Form:** line chart, 2 series (Filed, Resolved) — change-over-time is a line chart's job, and 2 series stays under the "small multiples over more lines" threshold.

**Bucketing** (auto-adjusts to the active `DatePreset` so "today" never renders as a single point):
- `today` → hourly buckets
- `week` → daily buckets
- `month` → weekly buckets
- `custom` → daily if span ≤ 31 days, weekly otherwise

**Data:** grouped from `filteredReports` by `createdAt` (Filed) and `resolvedAt` (Resolved), each bucketed per the rule above. New util `frontend/src/utils/analyticsStats.ts` exports `bucketReportsOverTime(reports, preset, customFrom, customTo)`.

**Colors** (validated via `dataviz` skill's `validate_palette.js` — both modes pass all checks):
- Resolved: `#16a34a` light / `#16a34a` dark (primary green, unchanged — reused everywhere else as "resolved")
- Filed: `#0ea5e9` light / `#0284c7` dark (sky blue — a real second hue, not a near-black neutral, so the two lines stay distinguishable for colorblind users; ΔE 21.5+ on every check)

**Single Y axis** (count) — both series share the same unit, so no dual-axis. Legend always shown (2 series). Hover crosshair + tooltip per `dataviz`'s interaction spec.

## Chart 2: Per-Jurisdiction Resolution Rate

**Form:** bar chart, single series (resolution rate %) — this is a magnitude comparison across categories (jurisdictions), so single-hue bars, not a categorical palette.

**Data:** extracted from `DashboardPage.tsx`'s existing `jurisdictionStats` `useMemo` (lines ~110-134) into the same `analyticsStats.ts` util as `computeJurisdictionStats(reports)`, so Dashboard and Analytics compute it identically instead of duplicating the logic. Dashboard's `performanceGrades` (top-3 slice) and Analytics' full bar chart both derive from this one function.

**Colors:** `#16a34a` (primary green) for all bars — single-hue magnitude encoding needs no categorical validation. Sorted descending by resolution rate.

**Visibility:** only rendered when `user?.role !== 'LGU_AGENT'`, same gating pattern as Dashboard's `isSuperAdmin`-only sections — except this one only needs to exclude `LGU_AGENT`, not restrict further to `SUPER_ADMIN`, since a plain `ADMIN` still oversees multiple jurisdictions.

## Chart 3: Status Breakdown

**Form:** bar chart, one bar per status (Pending, Unresolved, Flagged, Resolved) — explicitly **not a pie**, per `AdminDesign.md`'s existing status-badge vocabulary and the `dataviz` skill's "color follows entity, categorical hues in fixed order" rule; a 4-slice pie also reads worse than 4 bars at a glance.

**Data:** simple count-by-`status` over `filteredReports`.

**Colors — deviates from `ReportCard.tsx`'s `STATUS_CLASSES` tints, and this is deliberate:**

`ReportCard`'s badge colors (`pending`=raw Tailwind yellow-100/700, `unresolved`=neutral gray, `flagged`=secondary amber, `resolved`=primary green) work fine as single badges seen one at a time, but fail the `dataviz` validator as a *simultaneous* 4-color categorical set — `pending` and `flagged` sit too close in hue/lightness to reliably tell apart (ΔE 8.0, below the 15 normal-vision floor) once they're side-by-side bars instead of isolated pills.

Validated replacement set (all 4 checks pass in both modes):

| Status | Light | Dark |
|---|---|---|
| Resolved | `#16a34a` | `#16a34a` |
| Flagged | `#f59e0b` (secondary.DEFAULT) | `#d97706` (secondary.dark) |
| Pending | `#0ea5e9` | `#0284c7` |
| Unresolved | `#8b5cf6` | `#7c3aed` |

Legend always shown (4 series, at the "≤4 also direct-labeled" threshold per the skill) — each bar also gets a value label above it, so status identity is carried by the x-axis category label + legend, never color alone.

## Data flow

No new API calls. `AnalyticsPage` reads `useReports()` (existing `ReportsContext`) exactly like `ReportsPage`/`DashboardPage`, applies the same `useLguFilter` + `isWithinDatePreset` filtering already used elsewhere, then feeds the filtered array into the three new `analyticsStats.ts` functions.

## Error handling

- No reports in range → each chart shows its existing empty state pattern (e.g. `"No jurisdiction data yet."` from `DashboardPage.tsx:266`, reused as `"No data for this period."` across all 3 charts) instead of an empty/broken chart.
- Same `loading`/`error` handling already in `ReportsContext` (`loading`, `error` fields) — reused verbatim, no new error states needed since no new data source is introduced.

## Out of scope / explicit cuts

- **No alt data-table view per chart.** The `dataviz` skill's accessibility checklist calls for one; cut here because every chart already avoids color-only encoding (direct labels, legend, axis categories), and adding a full table toggle per chart is disproportionate to a 3-chart v1 page. Flagging as a known gap, not silently dropped.
- **No texture/pattern fills** for the CVD/print fallback — same reasoning; labels already carry identity.
- **No drill-down** (e.g. clicking a jurisdiction bar to jump to filtered Reports) — nice-to-have, not requested.
- **No CSV/image export** — not requested.

## Testing

- Manual: verify each chart against real seeded data (Manila/Mandaluyong/Naic) across each `DatePreset`, confirm bucket sizes switch correctly at each boundary.
- Manual: verify LGU_AGENT login hides the per-jurisdiction chart, ADMIN/SUPER_ADMIN see it.
- Unit test for `bucketReportsOverTime` and `computeJurisdictionStats` in `analyticsStats.ts` (pure functions, easy to test with fixed report fixtures) — via the same assert-based `tsx` self-check pattern already used for `geo.ts` (`frontend/src/utils/geo.selfcheck.ts`), since no test framework exists in `frontend/`.
