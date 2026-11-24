# Self-Audit Dashboard (web/)

Next.js 14 + Tailwind dashboard that displays self-audit results reported by the agent. Deploy to Vercel.

## Local dev

```bash
cd web
npm install
npm run dev      # http://localhost:3000
```

It renders with sample data until a real agent POSTs results. Without a KV store configured it uses an in-memory fallback (non-durable) so dev and a fresh deploy still work.

## Deploy to Vercel

1. Push this repo to GitHub (done).
2. On [vercel.com](https://vercel.com): **Add New → Project → Import** this repo.
3. Set **Root Directory** to `web/`.
4. Add env vars under **Settings → Environment Variables** (see below).
5. Deploy. Every push to the repo auto-deploys.

## Environment variables

| Var | What it is |
|---|---|
| `AGENT_TOKEN` | Your **owner key** — a secret you choose. Runs that send `Authorization: Bearer <AGENT_TOKEN>` are kept as durable history (your routine/scheduled audits). Leave unset in dev to treat non-session runs as yours. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Set automatically when you connect a **Vercel KV** store (below). Without them the app falls back to in-memory (non-durable). |

## Add durable storage (Vercel KV, free tier)

1. Vercel → your project → **Storage → Create Database → KV**.
2. Name it, create, and **Connect** it to this project. Vercel injects `KV_REST_API_URL` / `KV_REST_API_TOKEN` automatically.
3. Redeploy. Owner history now persists; guest sessions expire after 1 hour.

## Owner vs guest model

- **Owner (you):** send `Authorization: Bearer <AGENT_TOKEN>`. Results are kept as history for routine runs.
- **Guest (other people):** `POST /api/session` → `{ session }`, then POST results with header `X-Session-Id: <session>`. Guest data is isolated per session, **auto-expires after 1 hour**, and is **deleted on export**.

## Iterate in v0

Standard Next.js + Tailwind, so you can link the repo to [v0](https://v0.dev) and edit the UI there (**v0 → repo → Vercel**). Keep `app/api/**` and `lib/*` intact — that's the backend — and let v0 own `app/page.tsx` + components, pointing data fetches at `/api/audits`.

## API

- `GET /api/audits` → `{ audits, scope, sample }`. `?session=<id>` for a guest session; `Authorization: Bearer <AGENT_TOKEN>` for owner history; otherwise sample data.
- `POST /api/audits` → submit a result matching `../agent/schema.json`. Owner (Bearer token) or guest (`X-Session-Id`).
- `POST /api/session` → `{ session, expires_in }`. Mint a guest session.
- `GET /api/export?session=<id>` → returns the session's results **and deletes them**. `?format=md` for markdown. Owner export uses the Bearer token and keeps history.

## What the dashboard never does

It only receives and displays results. It never initiates a scan and cannot be pointed at a device — each agent audits its own host and reports in.
