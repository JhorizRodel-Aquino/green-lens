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

## 3. Frontend
```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```
Frontend expects the backend at `http://localhost:4000` (see `frontend/src/utils/api.ts`).

## Common issues
- **500 on any DB-backed route (e.g. `/api/auth/login`)** — usually Postgres isn't reachable. Check with:
  ```bash
  cd backend && npx prisma migrate status
  ```
  If it reports `Can't reach database server`, Docker Desktop or the container isn't running — `docker compose up -d` in `backend/`.
- **Two dev servers fighting over ports 5173/5174** — on Windows, `pkill` doesn't reliably kill npm-spawned `node.exe`. Enumerate and `taskkill //F //PID <pid>` instead.
