# Security-Assessment- · Self-Audit Tool

A self-assessment tool you run against **your own device**. A small **agent** runs on the device, audits *that same machine*, and writes a results file. You load that file into a **dashboard** (hostable on Vercel) that renders and exports it **entirely in your browser**. It uses the same kind of tooling as a formal assessment — nmap, Lynis, optionally OpenVAS or Nessus — reframed so a person can safely check their own posture. It is read-only: it reports, it does not exploit.

The original recon-to-report playbook is kept, unchanged, as the **template** this tool is built on (see [`Security Assessment/`](Security%20Assessment/)).

> ⚠️ **Your own device only.** The agent audits the machine it runs on. It is a defensive, benign self-check — read-only by default, with any exploit step kept manual and off by default.

---

## The safety model (why this is safe to host, even publicly)

**The server stores nothing and scans nothing.** The dashboard is a static front end with no backend and no database.

- The **agent** runs on *your* machine and audits *that* machine (localhost / its own host), writing a results file.
- The **dashboard** only *reads a file you hand it*, in your browser, and renders/exports it. It has no endpoints and nothing is uploaded.
- Because the hosted side can't be pointed at a device and never receives data, opening it up to other people only lets each of them view **their own** report on **their own** machine.

```
  Your device                              Dashboard (static, in-browser)
  ┌──────────────────────┐                ┌──────────────────────┐
  │ agent (Python)        │  writes        │  you load the file    │
  │  nmap · Lynis         │ ──────────►    │  validate · render    │
  │  (opt) OpenVAS/Nessus │  report.json   │  timeline · findings  │
  │  audits THIS host     │  (you load it) │  export md/json/pdf   │
  └──────────────────────┘                └──────────────────────┘
     scanning happens here                   nothing is uploaded or stored
```

---

## What it does

| Stage | What happens | Engine | Runs |
|---|---|---|---|
| Discovery | What's exposed on this host — open ports, services, versions | nmap | automated |
| Hardening audit | Config/rules in place — firewall, SSH, patches, permissions | Lynis | automated |
| Deep CVE scan *(optional)* | Fuller vulnerability coverage | OpenVAS or Nessus | automated |
| Correlate | Rank findings, match to references | agent | automated |
| Checkpoint | You review the options and approve before running | — | **manual** |
| Report | Load the results file and export the posture report | agent → dashboard | on demand |

### Engines — free by default, nothing required

The scan engine is pluggable, layered in this order:

- **Baseline, always on (free):** **nmap** (outside-in: what the network sees) **+ Lynis** (inside-out: how the host is configured). These are complementary — exposure *and* hardening — and run every audit.
- **Optional deep CVE scan — pick one:** **OpenVAS / Greenbone CE** (free) **or** **Nessus** (bring-your-own key; even free Nessus Essentials works, capped at 16 IPs).

All engine results merge into one findings list, deduped by host + CVE, so adding an engine enriches the same report instead of splitting it. Someone with nothing extra still gets a real audit from the baseline.

### Audit only

The tool is read-only: it runs the scan engines and reports what it finds. It never exploits anything, and there is no attack or validation step. The original manual playbook — which does include an optional Metasploit lab step — is kept intact under `Security Assessment/` as a template for anyone who wants to run that by hand.

---

## Repo layout

```
.
├── README.md                  # this file
├── web/                       # the dashboard — Next.js + Tailwind, static, deploy to Vercel
│   ├── app/                   # the in-browser viewer (loads + validates + exports a report file)
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

**Vercel:** on [vercel.com](https://vercel.com) → *Add New → Project → Import* this GitHub repo → set **Root Directory** to `web/` → Deploy. Every push to the repo then auto-deploys. No environment variables or storage to set up — it's a static front end. Full steps are in [`web/README.md`](web/README.md).

**v0:** the dashboard is plain Next.js + Tailwind, so you can link this repo to [v0](https://v0.dev) and keep editing the UI there. The chain is **v0 → this repo → Vercel**, one source of truth.

---

## Run the agent on your device

The agent is a Python program you run on the machine you want to audit. It runs nmap + Lynis against the host, builds a result JSON, and writes it to a file. Schedule it with cron for recurring self-audits. See [`agent/README.md`](agent/README.md) for install, the result schema, and crontab examples.

```bash
python3 selfaudit.py --mode audit     # writes selfaudit-report.json
```

Then open the dashboard and load that file — drag-and-drop, file picker, or paste. cron runs **on the device**; each machine schedules its own self-audit and writes its own report files, and you load whichever one you want to review.

---

## Isn't this just Nessus?

Nessus is one scan *engine*. This tool is a thin layer around it (and around nmap/Lynis/OpenVAS): one dashboard across tools, scheduling you can run on your device, a shareable self-service setup where each person audits their own device, and free baseline checks that don't need any paid plan. If all you want is to scan your own box once, Nessus alone is enough — this earns its place when you want the combined, scheduled, shareable view.

---

## Connecting this repo to Claude

This repo includes a GitHub Actions workflow at [`.github/workflows/claude.yml`](.github/workflows/claude.yml) that runs the [Claude Code GitHub Action](https://code.claude.com/docs/en/github-actions). Mention **`@claude`** in an issue or PR comment to have Claude read the repo and make changes.

- Install the Claude GitHub App: <https://github.com/apps/claude>
- Add a secret under *Settings → Secrets and variables → Actions*: `ANTHROPIC_API_KEY` (pay-as-you-go), **or** `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token` (covered by your Claude subscription — no extra charge). If you use the token, change the `anthropic_api_key:` line in `claude.yml` accordingly.

This is unrelated to the self-audit tool, which calls no paid API.

---

## What this deliberately does not do

It never exploits anything — it is a read-only audit with no attack or validation step. The hosted dashboard never initiates a scan and never receives data; it only reads a results file you choose to open, in your own browser. (The optional Metasploit lab step lives only in the `Security Assessment/` template playbook, for manual use.)

## License

MIT — see [`Security Assessment/LICENSE`](Security%20Assessment/LICENSE).
