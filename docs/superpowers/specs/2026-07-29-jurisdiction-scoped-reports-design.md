# Jurisdiction-Scoped Reports — Design

## Purpose

LGU accounts (Admin, LGU Agent) must only see trash reports that fall within
their assigned jurisdiction (region, region+province, or
region+province+municipality — set at account creation, see UsersPage).
Reports arrive from citizens as raw GPS lat/lng only, so jurisdiction has to
be resolved server-side via reverse geocoding before scoping can work.

## Data model changes

`User.role` enum gains `SUPER_ADMIN`. `User.regionCode` / `regionName`
become nullable — only `SUPER_ADMIN` has no jurisdiction at all.

```prisma
enum Role {
  SUPER_ADMIN
  ADMIN
  LGU_AGENT
}
```

New `Report` model (reports currently only exist as frontend mock data in
`frontend/src/data/reports.ts` — this is where they move server-side):

```prisma
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
  id                 String              @id @default(uuid())
  lat                Float
  lng                Float
  severity           Severity            // existing HIGH | LOW
  details            String
  locationLabel      String?
  imageUrls          String[]
  status             ReportStatus        @default(UNRESOLVED)
  createdAt          DateTime            @default(now())
  resolvedAt         DateTime?
  flagReason         FlagReason?
  flaggedAt          DateTime?
  lguActionLogged    Boolean             @default(false)
  resolutionProofUrls String[]

  regionCode         String?
  regionName         String?
  provinceCode       String?
  provinceName       String?
  municipalityCode   String?
  municipalityName   String?
  jurisdictionStatus JurisdictionStatus  @default(UNASSIGNED)
}
```

(`remarks` sub-table omitted here — out of scope for this spec, carries over
unchanged from the existing frontend shape when reports move server-side.)

## Report intake flow

Triggered on report creation (`POST /api/reports`), citizen sends lat/lng
(+ severity/details/photos as today):

1. Reverse-geocode via Nominatim, through a single in-process queue that
   enforces a 1 request/second gap across *all* concurrent submissions
   (Nominatim's usage policy caps at 1 req/sec):

   ```
   GET https://nominatim.openstreetmap.org/reverse
       ?lat={lat}&lon={lng}&format=jsonv2&addressdetails=1
   ```

2. Check `address.country_code === 'ph'`. If not → reject the submission
   with `422 { error: "This service only accepts reports within the Philippines." }`.

3. If PH: take Nominatim's city/town/municipality and state/county address
   fields, normalize them (strip "Municipality of" / "City of" prefixes,
   diacritics, casing), then resolve against the live PSGC API
   (`https://psgc.gitlab.io/api`) — no local caching, matches the existing
   `utils/psgc.ts` approach used by UsersPage:

   - `GET /regions/` → match region by normalized name
   - `GET /regions/{code}/provinces/` → match province (skip if the region
     has no provinces, e.g. NCR — go straight to its
     `cities-municipalities/`)
   - `GET /provinces/{code}/cities-municipalities/` → match municipality

4. Full match (region + province + municipality, or region + municipality
   for NCR-style regions) → store all resolved codes/names,
   `jurisdictionStatus: ASSIGNED`.

5. Partial or no match (still confirmed PH) → store whatever did match
   (possibly nothing), `jurisdictionStatus: UNASSIGNED`. Only visible to
   `SUPER_ADMIN` until resolved via `PATCH /api/reports/:id/jurisdiction`
   (SUPER_ADMIN-only endpoint, sets the three code/name pairs and flips
   status to `ASSIGNED`).

## Visibility / scoping rule

`GET /api/reports` filters server-side by the authenticated user's stored
jurisdiction — never a client-supplied param, so an agent can't widen their
own scope by editing a query string:

- Jurisdiction = municipality X → `report.municipalityCode === X`
- Jurisdiction = province Y only (no municipality set) →
  `report.provinceCode === Y` (any municipality within)
- Jurisdiction = region Z only (no province set) →
  `report.regionCode === Z` (any province within)
- `UNASSIGNED` reports never match any of the above — invisible to
  `ADMIN` / `LGU_AGENT`.
- `SUPER_ADMIN` → no filter, sees everything including `UNASSIGNED`.

## Roles & seeding

- First `SUPER_ADMIN` account is created by a one-off seed script
  (`prisma/seed.ts`), not through the UI.
- A logged-in `SUPER_ADMIN` can create additional `SUPER_ADMIN` accounts
  through the same UsersPage form — jurisdiction fields become
  optional/hidden when that role is selected.
- The role dropdown on UsersPage shows options based on the logged-in
  user's own role: `SUPER_ADMIN` sees all three roles; `ADMIN` sees
  `ADMIN` / `LGU_AGENT` only.

## Out of scope

- Auth/login (sessions, JWT issuance, route guards). Nothing currently
  enforces "who is logged in" — this spec assumes an authenticated user
  context exists and covers only what happens once it does. Follow-up spec.
- Moving existing mock reports (`frontend/src/data/reports.ts`) and the
  `ReportsContext` off frontend-only state onto these new backend
  endpoints — follow-up implementation work once this spec's backend
  pieces exist.
- Local PSGC dataset caching (deferred; live API calls only, per explicit
  decision during brainstorming).
