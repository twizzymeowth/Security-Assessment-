# Self-Audit Dashboard (web/)

Next.js 14 + Tailwind dashboard that displays self-audit results. It runs **entirely in your browser** — you load the report JSON your agent produced, and it validates, renders and exports it. There is no backend, no database, and nothing is uploaded. Deploy to Vercel (or any static host).

## Local dev

```bash
cd web
npm install
npm run dev      # http://localhost:3000
```

It renders with sample data until you load a report.

## How to use it

1. On the device being audited, run the agent to produce a report file (see [`../agent/README.md`](../agent/README.md)):
   ```bash
   python3 selfaudit.py --mode audit   # writes selfaudit-report.json
   ```
2. Open the dashboard and load that file — **drag-and-drop**, **Choose file…**, or **Paste JSON**.
3. Review the findings, then **Export** as `.json`, `.md`, or `.pdf` (print → Save as PDF).

The report is validated client-side against [`../agent/schema.json`](../agent/schema.json). If it doesn't match, the page explains what's wrong.

## Deploy to Vercel

1. Push this repo to GitHub (done).
2. On [vercel.com](https://vercel.com): **Add New → Project → Import** this repo.
3. Set **Root Directory** to `web/`.
4. Deploy. Every push auto-deploys.

No environment variables and no storage to configure — it's a static front end.

## Iterate in v0

Standard Next.js + Tailwind, so you can link the repo to [v0](https://v0.dev) and edit the UI there (**v0 → repo → Vercel**). Keep `lib/types.ts` (the result shape) and the client-side validation in `app/page.tsx` aligned with `../agent/schema.json`.

## Privacy model

The dashboard never receives or stores anything. It can't be pointed at a device and has no endpoints — it only reads a file you hand it, in your own browser. So hosting it publicly only ever lets each person view **their own** report on **their own** machine.
