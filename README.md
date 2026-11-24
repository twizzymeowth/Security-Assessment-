# Security-Assessment- · Self-Audit CLI

A single-user, **read-only** self-assessment tool you run against **your own device**. One command runs the scan engines against the host it runs on, builds a professional report, and writes it locally in four formats (HTML → Save-as-PDF, Markdown, CSV, JSON). It's built to run **weekly from cron**. It uses the same kind of tooling as a formal assessment — nmap, Lynis, and your own Nessus (optionally OpenVAS) — reframed so you can safely check your own posture. Nothing is hosted and nothing is uploaded.

The original recon-to-report playbook is kept, unchanged, as the **template** this tool is built on (see [`Security Assessment/`](Security%20Assessment/)).

> ⚠️ **Your own device only.** This audits the machine it runs on. It is a defensive, benign self-check — read-only, with any exploit step kept manual and out of automation.

---

## How it works

```
  Your device
  ┌───────────────────────────────────────────────┐
  │ selfaudit.py  (one command, from cron weekly)   │
  │   nmap · Lynis · (opt) OpenVAS · Nessus          │
  │   audits THIS host, read-only                    │
  │        │                                         │
  │        ▼                                         │
  │  ~/selfaudit-reports/2026-11-24_0200/            │
  │     report.html  report.md  report.csv  report.json
  └───────────────────────────────────────────────┘
      everything stays on your machine
```

- A single config file (`agent/selfaudit.conf`) sets the target, output folder, which engines run, and your Nessus keys.
- Each run writes a **timestamped report folder** with the same executive-summary / severity / findings layout in all four formats. Open `report.html` and Save-as-PDF for the PDF.
- Schedule it weekly with the provided crontab line.

Full setup, Nessus config, and the schedule are in [`agent/README.md`](agent/README.md).

## Engines

- **Baseline, free, always sensible:** **nmap** (what's exposed on the host) **+ Lynis** (how the host is hardened). Read-only.
- **Optional deep CVE scan:** **Nessus** via its local REST API (bring-your-own key — even free Nessus Essentials), or **OpenVAS / Greenbone CE** (free). All results merge into one findings list.

## Defense validation (opt-in, off by default)

An optional mode (`--validate`) runs **benign, standard detection-test artifacts** and reports whether your device's controls allowed or blocked each — the EICAR anti-malware test string and harmless "did it run" markers (the Atomic Red Team "did my control notice this?" approach). These contain **no real malware and no exploit payloads**: each test is labeled, non-destructive, cleans up after itself, and leaves nothing persistent. It's kept **out of the weekly cron run** unless you turn it on.

Real exploit validation (actual Metasploit) is **not** automated — it stays a manual, case-by-case step documented only in the [`Security Assessment/`](Security%20Assessment/) template playbook.

---

## Quick start

```bash
# on the device you're auditing
sudo apt install -y nmap lynis
cd agent
cp selfaudit.conf.example selfaudit.conf   # edit: output dir, engine toggles, Nessus keys
python3 selfaudit.py --config selfaudit.conf
# → writes ~/selfaudit-reports/<timestamp>/{report.html,md,csv,json}
```

Schedule it weekly: `crontab agent/crontab.example` (edit the path first).

---

## Repo layout

```
.
├── README.md                  # this file
├── agent/                     # the self-audit CLI (Python, standard library only)
│   ├── selfaudit.py           # the tool
│   ├── selfaudit.conf.example # copy to selfaudit.conf and edit
│   ├── crontab.example        # weekly schedule
│   ├── schema.json            # the report JSON shape
│   └── README.md              # setup, Nessus config, schedule, validation mode
└── Security Assessment/       # the original playbook, kept as the TEMPLATE
    ├── docs/                  # LAB-SETUP, INSTALLATION, WORKFLOW
    └── templates/
```

The `Security Assessment/` playbook is the reference the tool automates — kept intact so you can always follow it by hand, including the optional manual Metasploit step.

---

## What this deliberately does not do

It never exploits anything — it is a read-only audit. The defense-validation mode uses only benign test artifacts (no real malware, no exploit payloads) and is opt-in and off by default. It is not hosted and uploads nothing; every report stays on your machine.

## License

MIT — see [`Security Assessment/LICENSE`](Security%20Assessment/LICENSE).
