# Self-Audit Agent

The agent runs on the device you want to audit. It runs the scan engines against **the host it runs on**, builds a result JSON (see [`schema.json`](schema.json)), and POSTs it to your dashboard's `/api/audits` endpoint.

You are writing the Python agent; this folder gives you the contract to build against plus a skeleton to complete.

## Safety contract

- The agent audits **its own host only**. The default target is `127.0.0.1` / the machine's own addresses.
- Baseline engines are **read-only**: nmap (network exposure) + Lynis (host hardening).
- The Metasploit/validation path is **opt-in**, requires the dashboard checkpoint to be approved, and should run only in a lab. Keep it off by default.

## Engines

| Engine | Role | Required? |
|---|---|---|
| nmap | Outside-in: open ports, services, versions (`-sV -sC`, `--script vuln`) | baseline |
| Lynis | Inside-out: hardening — firewall, SSH, patches, permissions (`lynis audit system`) | baseline |
| OpenVAS / Greenbone CE | Optional free deep CVE scan | optional |
| Nessus | Optional deep CVE scan via local Nessus API (bring-your-own key) | optional |
| Metasploit | Optional manual, checkpoint-gated validation | optional |

## Install (on the device being audited)

```bash
sudo apt install -y nmap lynis        # baseline engines
pip install -r requirements.txt        # python deps (requests)
```

## Run

```bash
python3 selfaudit.py \
  --dashboard https://your-app.vercel.app \
  --token "$SELFAUDIT_TOKEN" \
  --mode audit                         # audit | validate | both
```

The script runs the baseline engines, assembles a result matching `schema.json`, and POSTs it to `<dashboard>/api/audits` with an `Authorization: Bearer <token>` header.

## Schedule (cron, on the device)

See [`crontab.example`](crontab.example). cron runs on the device, not on Vercel — each machine audits itself on its own schedule and reports in.

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
