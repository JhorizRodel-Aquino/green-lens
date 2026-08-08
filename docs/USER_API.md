# Citizen Report Submission — API Reference

For the ordinary-user (non-admin) side. Base URL is `VITE_API_BASE_URL` in the frontend, defaults to `http://localhost:4000`.

## Auth

Citizens have their own accounts now — separate from the LGU/admin login, but the same mechanism: no JWT/session yet, just an `x-user-id` header carrying the logged-in user's id (see `backend/src/middleware/requireUser.ts`).

### Sign up

```
POST /api/auth/signup
Content-Type: application/json
```

```json
{ "name": "Juan Dela Cruz", "email": "juan@example.com", "password": "at-least-8-chars" }
```

`201 Created` with the public user object (`role: "CITIZEN"`, no password hash). `409` if the email's already taken.

### Log in

```
POST /api/auth/login
Content-Type: application/json
```

```json
{ "email": "juan@example.com", "password": "at-least-8-chars" }
```

`200 OK` with the public user object. `401` on bad credentials, `403` if blocked. Store `id` from the response and send it as `x-user-id` on subsequent requests.

### Who am I

```
GET /api/auth/me
x-user-id: <your user id>
```

Re-verifies the stored id is still a real, active account — use on app load instead of trusting cached data forever.

---

## Check for duplicates near you

```
GET /api/reports/nearby?lat=14.5995&lng=120.9842&radiusMeters=20
```

Public — no auth needed. Call this right after getting the device's GPS location, before showing the "Create Report" form, so the citizen can see if someone already reported the same thing.

| Query param | Type | Required | Notes |
|---|---|---|---|
| `lat` | number | yes | |
| `lng` | number | yes | |
| `radiusMeters` | number | no (default `20`, max `1000`) | |

Only `PENDING`/`REPORTED` reports are returned — resolved and flagged reports don't count as "still there." Response is an array, closest first:

```json
[
  {
    "id": "uuid",
    "lat": 14.59951,
    "lng": 120.98422,
    "details": "Garbage overflow at a Manila street corner.",
    "locationLabel": "...",
    "distanceMeters": 4,
    "images": [{ "url": "https://...", "kind": "USER_UPLOAD" }],
    "statusValue": "PENDING",
    "status": { "value": "PENDING", "validity": "VALID" },
    "_count": { "confirmations": 2 },
    "createdAt": "..."
  }
]
```

---

## Confirm a report ("I saw this too")

```
POST /api/reports/:id/confirm
x-user-id: <your user id>   (required)
```

Anyone logged in can confirm any report — not reporter-only, that's the point (independent corroboration that it's real/still there). One confirmation per (report, account); confirming twice is rejected.

`201 Created`, full report object with `_count.confirmations` updated. `409` if you already confirmed it. `404` if the report doesn't exist.

To undo:

```
DELETE /api/reports/:id/confirm
x-user-id: <your user id>   (required)
```

`200 OK`, full report object with `_count.confirmations` updated (a no-op, still `200`, if you hadn't confirmed it).

---

## Submit a report

```
POST /api/reports
Content-Type: multipart/form-data
x-user-id: <your user id>   (optional)
```

The photos are uploaded **with** the report, as file parts — this endpoint no longer takes pre-hosted `imageUrls`. The backend stores the files itself and serves them back under `/uploads/<name>`.

The `x-user-id` header is optional — an anonymous submission (no header) still works, but then nobody can reopen it later since there's no reporter on file. Logging in first is required to be able to reopen your own report.

### Form fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `lat` | number (as text) | yes | GPS latitude |
| `lng` | number (as text) | yes | GPS longitude |
| `details` | string | yes | Non-empty description |
| `images` | file × 1–5 | yes | Repeat the field once per photo. JPEG/PNG/WebP, max 8MB each |

There is **no `severity` field** — it is scored from the photos server-side (see below), so a reporter can't set their own dispatch priority.

`locationLabel` is not sent either — reverse-geocoded server-side.

```js
const form = new FormData();
form.set('lat', String(lat));
form.set('lng', String(lng));
form.set('details', 'Garbage overflow at a Manila street corner.');
for (const file of photos) form.append('images', file);

await fetch(`${API_BASE}/api/reports`, { method: 'POST', body: form, headers: { 'x-user-id': userId } });
```

Don't set `Content-Type` yourself — the browser adds it with the multipart boundary.

### What the server does with it

1. Runs the photos through the trash-segmentation model (`ml/score.py`) and derives `severity` from how much of the frame the trash covers: `HIGH` ≥ 25%, `MEDIUM` ≥ 5%, `LOW` below that. The worst photo of the batch decides.
2. **Rejects the submission if no trash is detected in any photo** (`422`) — nothing is geocoded and no file is written.
3. Reverse-geocodes `lat`/`lng` via Nominatim to get a human-readable address (`locationLabel`) and PSGC jurisdiction (region/province-or-district/municipality-or-city). NCR reports resolve as region → district → city.
4. Rejects the submission if the coordinates fall outside the Philippines.
5. Saves the photos and creates the report with `statusValue: "PENDING"`, `reporterId` set from `x-user-id` if present.

If the scorer is unreachable, the report is still filed — just with `severity: null`.

### Response

`201 Created`, full report object:

```json
{
  "id": "uuid",
  "lat": 14.5995,
  "lng": 120.9842,
  "severity": "HIGH",
  "details": "Garbage overflow at a Manila street corner.",
  "locationLabel": "... reverse-geocoded address ...",
  "images": [
    { "url": "http://localhost:4000/uploads/f6ead694-....jpg", "kind": "USER_UPLOAD" }
  ],
  "notes": [],
  "statusValue": "PENDING",
  "status": { "value": "PENDING", "validity": "VALID" },
  "createdAt": "2026-08-02T12:00:00.000Z",
  "resolvedAt": null,
  "flaggedAt": null,
  "lguActionLogged": false,
  "reporterId": "uuid or null",
  "regionCode": "...", "regionName": "...",
  "provinceCode": "...", "provinceName": "...",
  "municipalityCode": "...", "municipalityName": "...",
  "jurisdictionStatus": "ASSIGNED"
}
```

### Error cases

| Status | When |
|---|---|
| `422` | No trash detected in the photos, or coordinates are outside the Philippines (the `error` message says which) |
| `400` | Missing/wrong-typed field, no photo attached, more than 5 photos, a photo over 8MB, or a non-image file type |

---

## Reopen a resolved report

```
PATCH /api/reports/:id/citizen-reopen
Content-Type: application/json
x-user-id: <your user id>   (required)
```

Only the account that filed the report can reopen it, and only within **7 days** of it being marked resolved. Past that, or if you're not the reporter, or the report isn't currently `RESOLVED`, the request is rejected.

### Request body

```json
{
  "note": "The trash is still there, it wasn't actually collected.",
  "imageUrls": ["https://your-storage.example.com/uploads/proof.jpg"]
}
```

| Field | Type | Required |
|---|---|---|
| `note` | string | yes, non-empty |
| `imageUrls` | string[] | no (defaults to `[]`) — optional proof it's still not fixed |

### Response

`200 OK`, full report object, `statusValue` back to `"REPORTED"` and `resolvedAt: null`. Any old resolution-proof photos are cleared (they no longer apply).

### Error cases

| Status | When |
|---|---|
| `401` | Missing/invalid `x-user-id` |
| `403` | Caller isn't the reporter |
| `404` | Report id doesn't exist |
| `409` | Report isn't currently `RESOLVED`, or the 7-day window has passed |
| `400` | Missing/empty `note` |

---

## Add a follow-up remark

```
POST /api/reports/:id/remarks
Content-Type: application/json
x-user-id: <your user id>   (required)
```

Only the reporter can add a remark to their own report. Doesn't change status, just attaches a note (e.g. "still not collected as of this week").

### Request body

```json
{ "text": "Still uncollected as of today." }
```

| Field | Type | Required |
|---|---|---|
| `text` | string | yes, non-empty |

### Response

`201 Created`, full report object with the new note included under `notes`.

### Error cases

| Status | When |
|---|---|
| `401` | Missing/invalid `x-user-id` |
| `403` | Caller isn't the reporter |
| `404` | Report id doesn't exist |
| `400` | Missing/empty `text` |
