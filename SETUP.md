# GreenLens — Local Setup

## Prerequisites
- Node.js (v20+ recommended)
- Docker Desktop (for Postgres)

## 1. Database (Postgres via Docker)
```bash
cd backend
docker compose up -d
```
Starts a `postgres:16-alpine` container (`green-lens-postgres`) on `localhost:5434`, db `green_lens`.

If `docker compose up -d` errors with a Docker Desktop / pipe connection error, Docker Desktop itself isn't running — start it first, wait for it to be ready, then retry.

## 2. Backend
```bash
cd backend
npm install
cp .env.example .env   # DATABASE_URL, PORT=4000, JWT_SECRET
npx prisma migrate deploy
npx prisma generate
npm run dev             # http://localhost:4000
```

Optional: seed sample data (reports use live GPS reverse-geocoding, so seeding hits the network):
```bash
npx prisma db seed
```

### Re-generating the client
After any `schema.prisma` change, run `npx prisma generate` explicitly — it's not automatic on `migrate deploy`, and a stale client causes route 500s that look unrelated to the actual change.

## 3. Severity scorer (Python sidecar)
Report severity is derived from the submitted photos by the YOLOv8-seg model in `trash_neg.pt`, run by a small Python service:
```bash
cd ml
pip install -r requirements.txt
uvicorn score:app --port 8100
```
The backend reads `SEVERITY_SCORER_URL` (default `http://localhost:8100`). Without it running, reports still submit — just with `severity: null`, and the "no trash in this photo" rejection is skipped.

Uploaded photos are written to `backend/uploads/` (override with `UPLOAD_DIR`) and served at `/uploads/...` using `PUBLIC_BASE_URL` (default `http://localhost:4000`) — set that if the phone/browser reaches the API on a different host.

Check the model and thresholds without starting the server:
```bash
python ml/score.py       # runs the built-in selfcheck
```

## 4. Frontend
```bash
cd frontend
npm install
cp .env.example .env   # match backend PORT
npm run dev              # http://localhost:5173
```
Frontend calls `VITE_API_BASE_URL`, falling back to `http://localhost:4000` if unset (see `frontend/src/utils/api.ts`). If backend `PORT` isn't 4000 (e.g. port 4000 taken by another project), set `frontend/.env` to match.

## Common issues
- **500 on any DB-backed route (e.g. `/api/auth/login`)** — usually Postgres isn't reachable. Check with:
  ```bash
  cd backend && npx prisma migrate status
  ```
  If it reports `Can't reach database server`, Docker Desktop or the container isn't running — `docker compose up -d` in `backend/`.
- **Two dev servers fighting over ports 5173/5174** — on Windows, `pkill` doesn't reliably kill npm-spawned `node.exe`. Enumerate and `taskkill //F //PID <pid>` instead.
