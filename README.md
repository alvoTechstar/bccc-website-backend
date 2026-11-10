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
- `POST /api/newsletter/subscribe` (`{ email, name?, source? }`) — idempotent, sends welcome email
- `GET /api/newsletter/subscribers`
- Giving accepts optional `email`; on first transition to `completed` (callback or
  query-status sync) a thank-you email goes out. Contact form `newsletter: true`
  auto-subscribes the sender.

## Email (nodemailer SMTP)

Set `SMTP_HOST / SMTP_PORT / EMAIL_USER / SMTP_PASS / EMAIL_FROM` (see `.env.example`;
Render vars are pre-wired in `render.yaml` as secrets). Works with Gmail app passwords,
SendGrid, etc. Sending is always best-effort: subscribe/giving/callback succeed even if
email is unconfigured or fails — failures are only logged.
- `GET /api/mpesa/status/:id` — fallback: queries Daraja for the stored
  CheckoutRequestID and syncs the giving record (use when a callback is missed)

## M-Pesa callback (public URL)

Daraja must be able to reach your server, so the callback needs a public HTTPS URL:

- **Render (accessible):** after deploy, set
  `MPESA_CALLBACK_URL=https://<your-service>.onrender.com/api/mpesa/callback`
  in the Render dashboard (and `YOUR_APP_URL` to the same origin).
  The `render.yaml` default uses `https://bccc-backend.onrender.com/...` — update it
  to your real service URL if different.
- **Local dev:** Safaricom cannot reach `localhost`. Expose the server with a tunnel
  (e.g. `ngrok http 3001`) and set
  `MPESA_CALLBACK_URL=https://<your-tunnel>.ngrok.io/api/mpesa/callback` in `.env`.
  (Note: the old biztrack backend used `http://127.0.0.1:3000/...`, which Daraja can
  never reach — it relies solely on query/polling instead.)
- The callback handler always answers HTTP 200 so Daraja never retry-storms, looks
  the record up by `CheckoutRequestID` first (falling back to the account reference),
  and marks it `completed`/`failed`.
- Robustness fallback (same pattern as biztrack): if a callback is missed (e.g. the
  free-tier server was asleep), the frontend can poll `GET /api/giving/records/:id/status`
  or trigger a live Daraja check via `GET /api/mpesa/status/:id`.

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
