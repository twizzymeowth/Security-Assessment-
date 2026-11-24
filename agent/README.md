# Self-Audit Agent

The agent runs on the device you want to audit. It runs the scan engines against **the host it runs on**, builds a result JSON (see [`schema.json`](schema.json)), and **writes it to a file**. You then load that file into the dashboard — nothing is uploaded and no server stores your results.

You are writing the Python agent; this folder gives you the contract to build against plus a skeleton to complete.

## Safety contract

- The agent audits **its own host only**. The default target is `127.0.0.1` / the machine's own addresses.
- Baseline engines are **read-only**: nmap (network exposure) + Lynis (host hardening).
- It is **read-only end to end**: it reports what it finds and never exploits anything. There is no attack or validation step. (The original manual playbook, including the optional Metasploit lab step, is kept separately under `Security Assessment/` as a template.)

## Engines

| Engine | Role | Required? |
|---|---|---|
| nmap | Outside-in: open ports, services, versions (`-sV -sC`, `--script vuln`) | baseline |
| Lynis | Inside-out: hardening — firewall, SSH, patches, permissions (`lynis audit system`) | baseline |
| OpenVAS / Greenbone CE | Optional free deep CVE scan | optional |
| Nessus | Optional deep CVE scan via local Nessus API (bring-your-own key) | optional |

## Install (on the device being audited)

```bash
sudo apt install -y nmap lynis        # baseline engines
# no third-party Python packages needed — the agent is standard library only
```

## Run

```bash
python3 selfaudit.py --mode audit                 # audit | validate | both
# writes ./selfaudit-report.json

python3 selfaudit.py --out ~/reports/laptop.json  # choose the output path
python3 selfaudit.py --out -                       # or print JSON to stdout
```

The script runs the baseline engines, assembles a result matching `schema.json`, and writes it to the file. Then open the dashboard and load that file (drag-and-drop, **Choose file…**, or **Paste JSON**). The dashboard validates, renders and exports it — all in your browser.

## Schedule (cron, on the device)

See [`crontab.example`](crontab.example). cron runs on the device and writes a dated report file each run; you load whichever one you want to review into the dashboard. Each machine audits itself on its own schedule.

## Result schema

`schema.json` is the source of truth for what the dashboard expects. Key shape:

```jsonc
{
  "agent_version": "0.1.0",
  "device": { "id": "my-laptop", "hostname": "...", "os": "..." },
  "mode": "audit",
  "engines": ["nmap", "lynis"],
  "started_at": "2026-11-12T02:00:04Z",
  "finished_at": "2026-11-12T02:00:52Z",
  "events": [ { "ts": "...", "status": "ok", "title": "...", "detail": "..." } ],
  "findings": [ { "id": "...", "severity": "high", "title": "...", "cve": "CVE-...", "source": "nmap", "remediation": "..." } ],
  "summary": { "critical": 0, "high": 0, "medium": 0, "low": 0 }
}
```
