# Self-Audit Dashboard (web/)

Next.js 14 + Tailwind dashboard that displays self-audit results reported by the agent. Deploy to Vercel.

## Local dev

```bash
cd web
npm install
npm run dev      # http://localhost:3000
```

It renders with sample data until a real agent POSTs results.

## Deploy to Vercel

1. Push this repo to GitHub (done).
2. On [vercel.com](https://vercel.com): **Add New → Project → Import** this repo.
3. Set **Root Directory** to `web/`.
4. (Optional) add env var `AGENT_TOKEN` — a shared secret the agent must send. Leave unset to accept any agent (local/testing).
5. Deploy. Every push to the repo auto-deploys.

## Iterate in v0

This is standard Next.js + Tailwind, so you can link the repo to [v0](https://v0.dev) and edit the UI there. Changes flow **v0 → repo → Vercel**.

## API

- `GET /api/audits` → `{ audits: AuditResult[], sample: boolean }`
- `POST /api/audits` → the agent sends a result matching `../agent/schema.json`; send `Authorization: Bearer <AGENT_TOKEN>` if the env var is set.

> The in-memory store resets on serverless cold starts. For durable history, swap it for Vercel KV or Postgres — noted in `app/api/audits/route.ts`.

## What the dashboard never does

It only receives and displays results. It never initiates a scan and cannot be pointed at a device — each agent audits its own host and reports in.
