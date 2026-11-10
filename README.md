# BCC Backend (Node + Express + Prisma + Postgres)

Render-ready port of `bccc-website/server` (Mongo/Mongoose) to Postgres via Prisma,
restructured into `routes / controllers / services / validators / utils / middleware`.

## Local dev

1. Copy env: `cp .env.example .env` and set `DATABASE_URL` to a local Postgres.
2. Install: `npm ci`
3. Migrate: `npm run migrate:dev` (creates tables from `prisma/schema.prisma`)
4. Seed: `npm run seed` (`-- --force` to re-seed)
5. Run: `npm run dev`

## API (unchanged from old server)

- `GET /` — running banner
- `GET /healthz` — `{ ok: true }`, `GET /healthz/db` — DB check
- `GET /api/blog/posts[?limit=]`, `GET /api/blog/posts/:id`, `GET /api/blog/categories/:category`
- `POST /api/contact`, `GET /api/contact/messages`
- `POST /api/giving`, `GET /api/giving/records`, `GET /api/giving/records/:id/status`
- `POST /api/mpesa/callback`

## Render deploy

Option A — Blueprint (recommended, creates fresh DB):

1. Push this folder as its own repo (or Render monorepo with Root Directory = this folder).
2. Render → New → Blueprint → select repo. It provisions `bccc-db` + `bccc-backend` web service.
3. Fill secret env vars: `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`.
4. After first deploy, update `YOUR_APP_URL` / `MPESA_CALLBACK_URL` to the real
   `https://<service>.onrender.com` URL if different, then redeploy.
5. Seed once: Render Shell → `npm run seed`.

Option B — Manual: create Managed Postgres `bccc-db`, then Web Service (Node 20):

- Build: `npm ci && npm run build && npx prisma migrate deploy`
- Start: `npm start`
- Health check: `/healthz`
- Add all env vars from `.env.example` (paste `DATABASE_URL` from the database page).

## Frontend wiring

Set the website's `VITE_API_URL` to `https://<service>.onrender.com` so
`POST /api/giving`, `POST /api/contact`, `GET /api/blog/posts` hit this backend.

## Notes

- CORS is open (`ALLOWED_ORIGINS=*`) per request — restrict to real domains before production.
- M-Pesa stays on sandbox URLs until you switch `MPESA_API_URL/AUTH_URL` + prod credentials.
- Prisma `amount` is `Decimal(12,2)`; services serialize it to `Number` for JSON.
