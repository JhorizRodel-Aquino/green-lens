# Admin Multi-Report Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin/LGU-agent select multiple reports on `/admin/reports` and generate one Google Maps route covering all of them.

**Architecture:** Pure frontend. `ReportsPage` owns a `Set<string>` of selected report IDs. `ReportCard` gets a checkbox. A floating action bar appears when ≥1 is selected. "Make Route" opens `RouteModal`, which orders the selected reports by nearest-neighbor from the user's geolocation (reusing `DirectionsModal`'s location logic) and renders a Google Maps embed + external link, same chrome as the existing single-report `DirectionsModal`.

**Tech Stack:** React 19 + TypeScript, Vite, Tailwind, lucide-react icons. No new dependencies.

## Global Constraints

- Cap selection at 10 reports (Google's no-API-key directions URL reliably supports ~10 total stops).
- "Make Route" disabled below 2 selected reports.
- Selection clears whenever `activeTab`, `datePreset`, `customFrom`, `customTo`, or `selectedLgu` changes.
- `TrashReport.lat`/`lng` are non-optional numbers already (see `frontend/src/components/map/TrashMap.tsx:151-152`) — no "missing coordinates" guard needed, every report is routable.
- No test framework exists in `frontend/` (confirmed: no `*.test.*`, no vitest/jest config, no `test` script in `frontend/package.json`). The one non-trivial piece of logic (nearest-neighbor ordering) gets a standalone assert-based self-check runnable via the already-installed `tsx`, not a new test framework.

---

## Task 1: Geo utility — Haversine distance + nearest-neighbor ordering

**Files:**
- Create: `frontend/src/utils/geo.ts`
- Create: `frontend/src/utils/geo.selfcheck.ts`

**Interfaces:**
- Produces: `type LatLng = { lat: number; lng: number }`, `haversineDistanceMeters(a: LatLng, b: LatLng): number`, `orderByNearestNeighbor(origin: LatLng, points: LatLng[]): LatLng[]` (returns `points` reordered, same array elements, starting from whichever is nearest `origin` and each subsequent stop nearest to the previous stop; does not mutate the input array).

- [ ] **Step 1: Write `geo.ts`**

```typescript
// frontend/src/utils/geo.ts

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_METERS = 6371000;

export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

// Greedy nearest-neighbor: not optimal TSP, but good enough for ≤10 stops and
// avoids pulling in a solver for a "roughly sensible order" requirement.
export function orderByNearestNeighbor<T extends LatLng>(origin: LatLng, points: T[]): T[] {
    const remaining = [...points];
    const ordered: T[] = [];
    let current = origin;

    while (remaining.length > 0) {
        let nearestIdx = 0;
        let nearestDist = haversineDistanceMeters(current, remaining[0]);
        for (let i = 1; i < remaining.length; i++) {
            const dist = haversineDistanceMeters(current, remaining[i]);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestIdx = i;
            }
        }
        const [next] = remaining.splice(nearestIdx, 1);
        ordered.push(next);
        current = next;
    }

    return ordered;
}
```

- [ ] **Step 2: Write the self-check**

```typescript
// frontend/src/utils/geo.selfcheck.ts
// Run with: npx tsx frontend/src/utils/geo.selfcheck.ts
import { haversineDistanceMeters, orderByNearestNeighbor } from './geo';

// Manila to Cebu is ~570km — sanity check the formula is in the right ballpark.
const manila = { lat: 14.5995, lng: 120.9842 };
const cebu = { lat: 10.3157, lng: 123.8854 };
const distKm = haversineDistanceMeters(manila, cebu) / 1000;
console.assert(distKm > 550 && distKm < 600, `expected ~570km, got ${distKm}`);

console.assert(haversineDistanceMeters(manila, manila) === 0, 'distance to self must be 0');

// Nearest-neighbor: origin at 0,0; points at increasing distance along same axis.
// Order should be near->far regardless of input order.
const origin = { lat: 0, lng: 0 };
const points = [
    { id: 'far', lat: 0, lng: 3 },
    { id: 'near', lat: 0, lng: 1 },
    { id: 'mid', lat: 0, lng: 2 },
];
const ordered = orderByNearestNeighbor(origin, points);
console.assert(
    ordered.map((p) => p.id).join(',') === 'near,mid,far',
    `expected near,mid,far — got ${ordered.map((p) => p.id).join(',')}`
);

// Must not mutate the input array.
console.assert(points[0].id === 'far', 'input array must not be mutated');

console.log('geo.selfcheck.ts: all assertions passed');
```

- [ ] **Step 3: Run the self-check**

Run: `npx tsx frontend/src/utils/geo.selfcheck.ts`
Expected: `geo.selfcheck.ts: all assertions passed` printed, no assertion errors, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/geo.ts frontend/src/utils/geo.selfcheck.ts
git commit -m "feat: add haversine distance and nearest-neighbor ordering utility"
```

---

## Task 2: Selectable checkbox on `ReportCard`

**Files:**
- Modify: `frontend/src/components/admin/ReportCard.tsx`

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces: `ReportCard` props gain `selected?: boolean` and `onToggleSelect?: () => void`. When `onToggleSelect` is provided, a checkbox renders in the card's top-right corner; clicking it calls `onToggleSelect` and does not fire the card's `onClick`.

- [ ] **Step 1: Modify `ReportCard.tsx`**

Update the props type and add the checkbox. Full new file:

```typescript
import { MapPin, Clock, ImageOff, MapPinOff, ShieldAlert, RotateCcw, UserX } from 'lucide-react';
import { cn } from '@/utils/cn';
import { FLAG_REASON_LABELS, type TrashReport } from '@/components/map/TrashMap';

type ReportCardProps = {
    report: TrashReport;
    onClick: () => void;
    orphaned?: boolean;
    selected?: boolean;
    onToggleSelect?: () => void;
};

const STATUS_CLASSES: Record<TrashReport['status'], string> = {
    resolved: 'bg-primary-light/20 text-primary-dark',
    flagged: 'bg-secondary-light/30 text-secondary-dark',
    unresolved: 'bg-light-dark text-dark-light',
    pending: 'bg-yellow-100 text-yellow-700',
};

function timeAgo(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

export default function ReportCard({ report, onClick, orphaned, selected, onToggleSelect }: ReportCardProps) {
    const thumbnail = report.imageUrls?.[0];

    return (
        <button
            type="button"
            onClick={onClick}
            className="relative flex gap-3 rounded-xl border border-light-dark bg-white p-3 text-left hover:border-primary hover:shadow-md transition-all"
        >
            {onToggleSelect && (
                <input
                    type="checkbox"
                    checked={!!selected}
                    onChange={onToggleSelect}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Select report for route"
                    className="absolute right-2 top-2 h-4 w-4 rounded border-light-dark text-primary accent-primary"
                />
            )}

            <div className="h-16 w-16 shrink-0 rounded-lg overflow-hidden bg-light flex items-center justify-center">
                {thumbnail ? (
                    <img src={thumbnail} alt="" className="h-full w-full object-cover" />
                ) : (
                    <ImageOff size={20} className="text-dark-light" />
                )}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span
                        className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            report.severity === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-secondary-light/30 text-secondary-dark'
                        )}
                    >
                        {report.severity}
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize', STATUS_CLASSES[report.status])}>
                        {report.status}
                    </span>
                    {report.status === 'flagged' && report.flagReason && (
                        <span className="flex items-center gap-1 rounded-full bg-secondary-light/30 px-2 py-0.5 text-[11px] font-semibold text-secondary-dark">
                            <ShieldAlert size={11} />
                            {FLAG_REASON_LABELS[report.flagReason]}
                        </span>
                    )}
                    {report.wasReopened && (
                        <span className="flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-700">
                            <RotateCcw size={11} />
                            Reopened
                        </span>
                    )}
                    {report.jurisdictionStatus === 'UNASSIGNED' && (
                        <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                            <MapPinOff size={11} />
                            Unassigned
                        </span>
                    )}
                    {orphaned && (
                        <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                            <UserX size={11} />
                            No LGU Coverage
                        </span>
                    )}
                </div>

                <p className="text-sm text-dark truncate">{report.details}</p>

                <div className="mt-1 flex items-center gap-3 text-xs text-dark-light">
                    <span className="flex items-center gap-1 truncate">
                        <MapPin size={12} className="shrink-0" />
                        <span className="truncate">{report.locationLabel ?? 'Unknown location'}</span>
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                        <Clock size={12} />
                        {timeAgo(report.createdAt)}
                    </span>
                </div>
            </div>
        </button>
    );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/ReportCard.tsx
git commit -m "feat: add optional selection checkbox to ReportCard"
```

---

## Task 3: `RouteModal` component

**Files:**
- Create: `frontend/src/components/admin/RouteModal.tsx`

**Interfaces:**
- Consumes: `getUserLocation` from `frontend/src/utils/location.ts` (returns `Promise<LocationResult>` with `.lat`/`.lng`, throws on failure — see `frontend/src/utils/location.ts:14`); `orderByNearestNeighbor`, `type LatLng` from `frontend/src/utils/geo.ts` (Task 1); `type TrashReport` from `frontend/src/components/map/TrashMap.tsx`.
- Produces: `RouteModal` component with props `{ reports: TrashReport[]; onClose: () => void }`.

- [ ] **Step 1: Write `RouteModal.tsx`**

```typescript
// frontend/src/components/admin/RouteModal.tsx
import { useEffect, useState } from 'react';
import { X, ExternalLink, LoaderCircle } from 'lucide-react';
import { getUserLocation } from '@/utils/location';
import { orderByNearestNeighbor, type LatLng } from '@/utils/geo';
import type { TrashReport } from '@/components/map/TrashMap';

type RouteModalProps = {
    reports: TrashReport[];
    onClose: () => void;
};

// Same relaxed fallback as DirectionsModal — accepts a cached/network-based
// position instead of demanding a fresh high-accuracy GPS lock.
function getRelaxedLocation(): Promise<LatLng> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
            (err) => reject(err instanceof Error ? err : new Error('Could not get your location')),
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
    });
}

function coordsParam(p: LatLng): string {
    return `${p.lat},${p.lng}`;
}

export default function RouteModal({ reports, onClose }: RouteModalProps) {
    const [origin, setOrigin] = useState<LatLng | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const loc = await getUserLocation().catch(() => getRelaxedLocation());
                if (!cancelled) setOrigin({ lat: loc.lat, lng: loc.lng });
            } catch (err) {
                if (!cancelled) {
                    setLocationError(err instanceof Error ? err.message : 'Could not get your location');
                    // No sane "destination only" fallback for a multi-stop route —
                    // route from the first selected report instead of true geolocation.
                    setOrigin({ lat: reports[0].lat, lng: reports[0].lng });
                }
            }
        })();
        return () => { cancelled = true; };
    }, [reports]);

    const stops = origin ? orderByNearestNeighbor(origin, reports) : [];
    const destination = stops[stops.length - 1];
    const waypoints = stops.slice(0, -1);

    const externalUrl = origin && destination
        ? `https://www.google.com/maps/dir/?api=1&origin=${coordsParam(origin)}&destination=${coordsParam(destination)}` +
          (waypoints.length > 0 ? `&waypoints=${waypoints.map(coordsParam).join('|')}` : '')
        : undefined;

    const embedSrc = origin && destination
        ? `https://maps.google.com/maps?saddr=${coordsParam(origin)}&daddr=${stops.map(coordsParam).join('+to+')}&output=embed`
        : undefined;

    return (
        <div className="fixed inset-0 z-[2001] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 h-14 border-b border-light-dark">
                    <h3 className="text-sm font-bold text-dark">Route for {reports.length} reports</h3>
                    <div className="flex items-center gap-3">
                        {externalUrl && (
                            <a
                                href={externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                                Open in Google Maps
                                <ExternalLink size={12} />
                            </a>
                        )}
                        <button type="button" onClick={onClose} aria-label="Close" className="text-dark-light hover:text-dark">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {locationError && (
                    <p className="px-4 py-2 text-xs text-secondary-dark bg-secondary-light/20 border-b border-light-dark">
                        {locationError} — routing from the first selected report instead.
                    </p>
                )}

                {!embedSrc ? (
                    <div className="w-full h-[70vh] flex items-center justify-center text-dark-light gap-2 text-sm">
                        <LoaderCircle size={18} className="animate-spin" />
                        Getting your location...
                    </div>
                ) : (
                    <iframe title="Route" className="w-full h-[70vh] border-0" src={embedSrc} />
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/RouteModal.tsx
git commit -m "feat: add RouteModal for multi-report Google Maps routing"
```

---

## Task 4: Wire selection + floating action bar into `ReportsPage`

**Files:**
- Modify: `frontend/src/pages/admin/ReportsPage.tsx`

**Interfaces:**
- Consumes: `ReportCard` props `selected`/`onToggleSelect` (Task 2), `RouteModal` (Task 3).
- Produces: nothing consumed by later tasks (this is the last task).

- [ ] **Step 1: Add selection state, clear-on-filter-change, and wire the checkbox**

In `frontend/src/pages/admin/ReportsPage.tsx`, add the import and state:

```typescript
import RouteModal from '@/components/admin/RouteModal';
```

Add near the other `useState` calls (after `selectedReportId`):

```typescript
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showRouteModal, setShowRouteModal] = useState(false);

    const toggleSelected = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else if (next.size < 10) {
                next.add(id);
            }
            return next;
        });
    };
```

Clear selection whenever the filters change — add this effect near the existing `useEffect`:

```typescript
    useEffect(() => {
        setSelectedIds(new Set());
    }, [activeTab, datePreset, customFrom, customTo, selectedLgu]);
```

Pass the new props to `ReportCard`:

```typescript
                {filteredReports.map((report) => (
                    <ReportCard
                        key={report.id}
                        report={report}
                        onClick={() => setSelectedReportId(report.id)}
                        orphaned={isSuperAdmin && isOrphaned(report)}
                        selected={selectedIds.has(report.id)}
                        onToggleSelect={() => toggleSelected(report.id)}
                    />
                ))}
```

- [ ] **Step 2: Add the floating action bar and `RouteModal`**

Add the floating bar right after the closing `</div>` of the `p-4 md:p-6 space-y-6` container (i.e. as a sibling, before the `selectedReportId && <ReportDetailPanel .../>` block), and the `RouteModal` render at the end:

```typescript
        {selectedIds.size > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-[1500] flex justify-center px-4 pb-4">
                <div className="flex items-center gap-3 rounded-xl border border-light-dark bg-white px-4 py-3 shadow-xl">
                    <span className="text-sm font-medium text-dark">{selectedIds.size} selected</span>
                    <button
                        type="button"
                        onClick={() => setSelectedIds(new Set())}
                        className="text-sm font-medium text-dark-light hover:text-dark"
                    >
                        Clear
                    </button>
                    <button
                        type="button"
                        disabled={selectedIds.size < 2}
                        onClick={() => setShowRouteModal(true)}
                        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Make Route
                    </button>
                </div>
            </div>
        )}

        {selectedReportId && (
            <ReportDetailPanel reportId={selectedReportId} onClose={() => setSelectedReportId(null)} />
        )}

        {showRouteModal && (
            <RouteModal
                reports={reports.filter((r) => selectedIds.has(r.id))}
                onClose={() => setShowRouteModal(false)}
            />
        )}
```

- [ ] **Step 3: Verify it builds and behaves**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no type errors.

Run: `cd frontend && npm run dev`, open `/admin/reports`, check:
- checkbox appears on each card, clicking it doesn't open the detail panel
- floating bar appears once ≥1 selected, shows correct count
- "Make Route" disabled at 1 selected, enabled at 2+
- selecting an 11th report is a no-op (cap holds)
- switching tabs clears the selection and hides the bar
- "Make Route" opens `RouteModal` with a route drawn through all selected stops; "Open in Google Maps" link opens correctly in a new tab

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/admin/ReportsPage.tsx
git commit -m "feat: multi-select reports and generate a route across them"
```

---

## Self-Review Notes

- Spec coverage: selection scope (current-view only, Task 4 Step 1 effect) ✓, cap at 10 (Task 4 Step 1 `toggleSelected`) ✓, nearest-neighbor ordering (Task 1) ✓, floating action bar (Task 4 Step 2) ✓, RouteModal chrome/embed/external link matching `DirectionsModal` (Task 3) ✓, geolocation fallback (Task 3) ✓, out-of-scope items (drag reorder, cross-filter persistence, citizen map) correctly excluded ✓.
- No placeholders — every step has full code.
- Type consistency checked: `LatLng` defined in Task 1, imported identically in Task 3; `orderByNearestNeighbor<T extends LatLng>` used with `TrashReport[]` in Task 3 (`TrashReport` has `lat`/`lng` so it satisfies `LatLng`); `ReportCard` prop names (`selected`, `onToggleSelect`) from Task 2 match usage in Task 4.
