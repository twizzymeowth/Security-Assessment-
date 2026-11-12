# Security-Assessment- · Self-Audit Tool

A self-assessment tool you run against **your own device**. A small **agent** runs on the device, audits *that same machine*, and reports results to a **dashboard** you can host on Vercel. It uses the same kind of tooling as a formal assessment — nmap, Lynis, optionally OpenVAS / Nessus / Metasploit — reframed so a person can safely check their own posture.

The original recon-to-report playbook is kept, unchanged, as the **template** this tool is built on (see [`Security Assessment/`](Security%20Assessment/)).

> ⚠️ **Your own device only.** The agent audits the machine it runs on. It is a defensive, benign self-check — read-only by default, with any exploit step kept manual and off by default.

---

## The safety model (why this is safe to host, even publicly)

**The server never scans anything.** That is the core rule.

- The **agent** runs on *your* machine and audits *that* machine (localhost / its own host).
- The **dashboard** only *receives and displays* the results the agent pushes to it.
- Because the hosted side can't be pointed at a device, opening it up to other people only lets each of them audit **their own** machine. Nobody can aim it at someone else.

```
  Your device                         Dashboard (Vercel)
  ┌──────────────────────┐           ┌──────────────────────┐
  │ agent (Python)        │  POST     │  /api/audits          │
  │  nmap · Lynis         │ ───────►  │  stores + displays    │
  │  (opt) OpenVAS/Nessus │  results  │  timeline · findings  │
  │  audits THIS host     │           │  schedule · export    │
  └──────────────────────┘           └──────────────────────┘
     scanning happens here               never scans anything
```

---

## What it does

| Stage | What happens | Engine | Runs |
|---|---|---|---|
| Discovery | What's exposed on this host — open ports, services, versions | nmap | automated |
| Hardening audit | Config/rules in place — firewall, SSH, patches, permissions | Lynis | automated |
| Deep CVE scan *(optional)* | Fuller vulnerability coverage | OpenVAS or Nessus | automated |
| Correlate | Rank findings, match to references | agent | automated |
| Checkpoint | You review the shortlist and approve | — | **manual** |
| Validation *(optional)* | Benign proof-of-execution in a lab | Metasploit | **manual** |
| Report | Export the posture report | agent / Faraday | on demand |

### Engines — free by default, nothing required

The scan engine is pluggable, layered in this order:

- **Baseline, always on (free):** **nmap** (outside-in: what the network sees) **+ Lynis** (inside-out: how the host is configured). These are complementary — exposure *and* hardening — and run every audit.
- **Optional deep CVE scan — pick one:** **OpenVAS / Greenbone CE** (free) **or** **Nessus** (bring-your-own key; even free Nessus Essentials works, capped at 16 IPs).

All engine results merge into one findings list, deduped by host + CVE, so adding an engine enriches the same report instead of splitting it. Someone with nothing extra still gets a real audit from the baseline.

### Modes

A per-run mode, chosen in the dashboard: **Audit only** (default) · **Validation (Metasploit)** · **Both**. The dashboard toggle only sets intent — the agent reads it, and the Metasploit path still stops at the manual checkpoint and runs locally. New users default to Audit only.

---

## Repo layout

```
.
├── README.md                  # this file
├── web/                       # the dashboard — Next.js + Tailwind, deploy to Vercel
│   ├── app/                   # pages + /api/audits ingest endpoint
│   └── README.md              # Vercel + v0 setup
├── agent/                     # the local self-audit agent (Python)
│   ├── README.md              # how it works, install, schedule
│   ├── schema.json            # the result JSON the dashboard expects
│   ├── selfaudit.py           # skeleton to complete
│   ├── crontab.example        # scheduled self-audits
│   └── requirements.txt
└── Security Assessment/       # the original playbook, kept as the TEMPLATE
    ├── docs/                  # LAB-SETUP, INSTALLATION, WORKFLOW
    └── templates/
```

The `Security Assessment/` playbook is the reference the tool automates — kept intact so you can always follow it by hand.

---

## Deploy the dashboard (Vercel) and iterate in v0

**Vercel:** on [vercel.com](https://vercel.com) → *Add New → Project → Import* this GitHub repo → set **Root Directory** to `web/` → Deploy. Every push to the repo then auto-deploys. Full steps and env vars are in [`web/README.md`](web/README.md).

**v0:** the dashboard is plain Next.js + Tailwind, so you can link this repo to [v0](https://v0.dev) and keep editing the UI there. The chain is **v0 → this repo → Vercel**, one source of truth.

---

## Run the agent on your device

The agent is a Python program you run on the machine you want to audit. It runs nmap + Lynis against the host, builds a result JSON, and POSTs it to your dashboard. Schedule it with cron for recurring self-audits. See [`agent/README.md`](agent/README.md) for install, the result schema, and crontab examples.

cron runs **on the device**, not on Vercel — each machine schedules its own self-audit and reports in. The dashboard just shows when each device last audited.

---

## Isn't this just Nessus?

Nessus is one scan *engine*. This tool is a thin layer around it (and around nmap/Lynis/OpenVAS/Metasploit): one dashboard across tools, scheduling you can see, a shareable self-service setup where each person audits their own device, and free baseline checks that don't need any paid plan. If all you want is to scan your own box once, Nessus alone is enough — this earns its place when you want the combined, scheduled, shareable view.

---

## Connecting this repo to Claude

This repo includes a GitHub Actions workflow at [`.github/workflows/claude.yml`](.github/workflows/claude.yml) that runs the [Claude Code GitHub Action](https://code.claude.com/docs/en/github-actions). Mention **`@claude`** in an issue or PR comment to have Claude read the repo and make changes.

- Install the Claude GitHub App: <https://github.com/apps/claude>
- Add a secret under *Settings → Secrets and variables → Actions*: `ANTHROPIC_API_KEY` (pay-as-you-go), **or** `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token` (covered by your Claude subscription — no extra charge). If you use the token, change the `anthropic_api_key:` line in `claude.yml` accordingly.

This is unrelated to the self-audit tool, which calls no paid API.

---

## What this deliberately does not do

It never auto-exploits. The Metasploit path is optional, manual, checkpoint-gated, and off by default. The hosted dashboard never initiates a scan — it only receives results an agent chose to send about its own host.

## License

MIT — see [`Security Assessment/LICENSE`](Security%20Assessment/LICENSE).
