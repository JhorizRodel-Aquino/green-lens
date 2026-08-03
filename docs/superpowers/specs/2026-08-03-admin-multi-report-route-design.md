# Admin Reports — Multi-Report Route Design

## Problem

Admin Reports page (`ReportsPage.tsx`) already lets a single report's GPS coordinates open a Google Maps directions modal (`DirectionsModal.tsx`, driven from `ReportDetailPanel.tsx`). There's no way to plan a route across multiple reports at once — an admin dispatching a cleanup crew has to open directions one report at a time.

## Goal

Let an admin check multiple reports in the Reports grid and generate a single Google Maps route covering all of them, ordered sensibly from their current location.

## Scope

- Frontend only. No backend/API changes — routing is client-side, built from data already loaded into `ReportsContext`.
- Applies to the admin Reports grid (`ReportsPage.tsx` / `ReportCard.tsx`) only, not the map view.

## Design

### Selection

- `ReportCard` gains an optional checkbox, top-left corner of the card, only rendered when the report has valid `lat`/`lng`. Clicking the checkbox stops propagation so it doesn't trigger `onClick` (opening the detail panel).
- `ReportsPage` owns `selectedIds: Set<string>` state.
- Selection is scoped to the current filtered view: changing `activeTab`, `datePreset`, `customFrom/To`, or `selectedLgu` clears `selectedIds`. (Simplest mental model — "select from what you're looking at now.")
- Cap at 10 selected reports (Google's no-API-key directions URL reliably supports ~10 total stops including origin/destination). Once 10 are selected, remaining unchecked checkboxes are disabled with a title tooltip explaining the cap.

### Trigger — floating action bar

- When `selectedIds.size >= 1`, a bar slides up and pins to the bottom of the Reports page content area.
- Shows "N selected", a "Clear" button (empties the set), and a "Make Route" button.
- "Make Route" is disabled when `selectedIds.size < 2` (a route needs at least 2 stops).
- Clicking "Make Route" opens `RouteModal`.

### RouteModal (new component: `frontend/src/components/admin/RouteModal.tsx`)

Sibling to `DirectionsModal.tsx`, reusing its location-fetching logic (`getUserLocation` → `getRelaxedLocation` fallback) and modal chrome (header, "Open in Google Maps" external link, close button, loading/error states).

**Props:** `reports: TrashReport[]` (the selected reports, already resolved from IDs by the caller), `onClose: () => void`.

**Behavior:**
1. On mount, fetch user location the same way `DirectionsModal` does. If it fails, show the same inline error and fall back to routing from the first selected report instead of geolocation (there's no sane "destination-only" fallback for a multi-stop route — the ladder needs *some* origin to sort from).
2. Once origin is known, order the reports via greedy nearest-neighbor: starting from the origin, repeatedly pick the closest remaining report (straight-line/Haversine distance) as the next stop, until all are ordered.
3. Build two URLs from the ordered stops (`stops[0..n-2]` as waypoints, `stops[n-1]` as destination):
   - External: `https://www.google.com/maps/dir/?api=1&origin={lat},{lng}&destination={lastLat},{lastLng}&waypoints={lat1},{lng1}|{lat2},{lng2}|...`
   - Embed iframe `src`: `https://maps.google.com/maps?saddr={lat},{lng}&daddr={lat1},{lng1}+to+{lat2},{lng2}+to+...+to+{lastLat},{lastLng}&output=embed`
4. Render the same modal shell as `DirectionsModal`: header with title ("Route for N reports"), "Open in Google Maps" link (`target="_blank"`), close button, and the embed iframe (or loading spinner while origin is resolving).

### Haversine helper

Small pure function (`frontend/src/utils/geo.ts` or inline in `RouteModal.tsx` if only used there) computing great-circle distance between two `{lat, lng}` points, used only for the nearest-neighbor sort. No new dependency.

## Error handling

- No reports have valid coordinates → checkbox never renders for those, so they can't be selected; not a runtime error case.
- Geolocation fails → same inline warning pattern as `DirectionsModal`, route still built (from first selected report as origin instead of true user location).
- Fewer than 2 selected → "Make Route" stays disabled, no error state needed.

## Out of scope / explicitly not building

- Manual drag-to-reorder of stops (nearest-neighbor auto-order only, per decision).
- Selection persisting across tab/filter changes.
- Any backend route-optimization, real road-distance routing, or persistence of generated routes.
- Applying this to the citizen-facing map view.

## Testing

- Manual: select 2–10 reports across a filtered tab, click Make Route, verify modal opens with a plausible route order and both links work.
- Manual: verify checkbox absent on reports without coordinates.
- Manual: verify selection clears on tab switch.
- Unit test for the Haversine/nearest-neighbor ordering function (pure, easy to test with fixed coordinates) — the only non-trivial logic being added.
