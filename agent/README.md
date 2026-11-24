# Self-Audit CLI

A single-user, **read-only** self-assessment of **your own device**. One command runs the enabled scan engines against this host, builds a professional report, and writes it to a timestamped folder locally — in four formats (HTML → Save-as-PDF, Markdown, CSV, JSON). Designed to run weekly from cron. Nothing is uploaded anywhere.

> ⚠️ **Your own device only.** This audits the machine it runs on. It is a defensive, benign self-check — read-only, with no exploitation.

## What's here

```
selfaudit.py            # the CLI (standard library only — no pip installs)
selfaudit.conf.example  # copy to selfaudit.conf and edit
crontab.example         # weekly run line
schema.json             # the report JSON shape
```

## Install (on the device you're auditing)

```bash
sudo apt install -y nmap lynis            # the free baseline engines
cp selfaudit.conf.example selfaudit.conf  # then edit it (see below)
```

No Python packages are required — the agent uses the standard library only.

## Configure

Edit `selfaudit.conf`:

- `[general] target` — keep it `127.0.0.1` (your own host). `output_dir` — where reports are written (default `~/selfaudit-reports`).
- `[engines]` — toggle `nmap`, `lynis`, `openvas`, `nessus`. nmap + Lynis are the free, read-only baseline.
- `[nessus]` — your own local Nessus: `url`, `access_key`, `secret_key` (Nessus → Settings → My Account → API Keys → Generate), and the `scan_name` whose results to pull.
- `[validation]` — opt-in defense tests, off by default (see below).

## Run

```bash
python3 selfaudit.py --config selfaudit.conf
```

It runs the enabled engines, assembles the report, and writes a timestamped folder under `output_dir`, e.g.:

```
~/selfaudit-reports/2026-11-24_0200/
  report.html   # open in a browser and Save-as-PDF for the PDF
  report.md
  report.csv
  report.json
```

## Schedule weekly (cron, on this device)

See [`crontab.example`](crontab.example). Install with `crontab agent/crontab.example` (edit the path first). It runs Sundays at 02:00 and appends to `~/selfaudit-reports/cron.log`. The defense-validation tests are intentionally **not** in the cron line — keep them manual.

## Defense validation (opt-in, off by default)

`--validate` (or `[validation] enabled = true`) runs **benign, standard detection-test artifacts** and records whether your controls allowed or blocked each one. It rolls into the report as a **Defense validation** section.

**What it is:**
- The **EICAR anti-malware test string** — the industry-standard, harmless file every AV recognizes. The test writes it, checks whether a control removed/quarantined it, then deletes it.
- A **benign execution marker** — writes and detects a harmless timestamped marker (a logging/visibility check), then deletes it.

**What it is NOT:** it contains no real malware and no exploit payloads. Each test is clearly labeled, non-destructive, leaves nothing persistent, and cleans up after itself. It is kept **out of the weekly cron run** unless you turn it on.

Real exploit validation (actual Metasploit) is **not** automated here — it stays a manual, case-by-case step documented in the [`Security Assessment/`](../Security%20Assessment/) template playbook.

```bash
python3 selfaudit.py --config selfaudit.conf --validate
```

## Completing the engines

`selfaudit.py` is a working skeleton: report generation (and the validation tests) run out of the box, so every run produces a valid report. The per-engine **result → findings** parsing (nmap output, the Lynis report, OpenVAS/GVM results) and the **Nessus API field mapping** are marked with `TODO` — fill those in for your setup and each engine's findings get richer. See [`schema.json`](schema.json) for the finding shape.
