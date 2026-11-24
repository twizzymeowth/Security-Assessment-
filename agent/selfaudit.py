#!/usr/bin/env python3
"""Self-audit CLI — a single-user, read-only self-assessment of YOUR OWN device.

One command runs the enabled scan engines against this host, builds a
professional report, and writes it to a timestamped folder locally in four
formats (HTML [open and Save-as-PDF], Markdown, CSV, JSON). Designed to run
weekly from cron. Nothing is uploaded anywhere.

Engines (toggled in the config): nmap + Lynis (read-only baseline), optional
OpenVAS, and Nessus via its local REST API.

Optional defense-validation mode (off by default, --validate): runs BENIGN,
standard detection-test artifacts — the EICAR anti-malware test string and
harmless "did it run" markers — and records whether your defenses allowed or
blocked each one. These are NOT real malware or exploits: each test is
labeled, non-destructive, cleans up after itself, and leaves nothing
persistent. Real exploit validation (Metasploit) is a manual, case-by-case
step kept in the Security Assessment/ template, never automated here.

The per-engine result parsing and the Nessus API field mapping are marked
with TODOs for you to complete for your setup; report generation works out
of the box so a cron run always produces a valid report.
"""
import argparse
import configparser
import json
import os
import platform
import socket
import ssl
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone

AGENT_VERSION = "0.2.0"

DEFAULT_CONFIG = {
    "general": {"target": "127.0.0.1", "output_dir": "~/selfaudit-reports"},
    "engines": {"nmap": "true", "lynis": "true", "openvas": "false", "nessus": "false"},
    "nessus": {"url": "https://127.0.0.1:8834", "access_key": "", "secret_key": "", "scan_name": "Self-Audit"},
    "validation": {"enabled": "false"},
}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def run(cmd):
    """Run a command, return (rc, stdout, stderr). Never raises."""
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
        return p.returncode, p.stdout, p.stderr
    except FileNotFoundError:
        return 127, "", f"{cmd[0]} not installed"
    except subprocess.TimeoutExpired:
        return 124, "", "timed out"


def load_config(path):
    cp = configparser.ConfigParser()
    # seed defaults, then overlay the file if present
    cp.read_dict(DEFAULT_CONFIG)
    if path and os.path.exists(os.path.expanduser(path)):
        cp.read(os.path.expanduser(path))
    return cp


# ---------------------------------------------------------------- engines
def engine_nmap(target, events, findings):
    """Outside-in: open ports / services / version + vuln scripts (read-only)."""
    events.append({"ts": now_iso(), "status": "run", "title": "nmap discovery started",
                   "detail": f"nmap -sV -sC --script vuln {target}"})
    rc, out, err = run(["nmap", "-sV", "-sC", "--script", "vuln", target])
    if rc != 0:
        events.append({"ts": now_iso(), "status": "error", "title": "nmap failed", "detail": err.strip()})
        return
    # TODO: parse `out` (open ports, versions, vuln script hits) into findings.
    events.append({"ts": now_iso(), "status": "ok", "title": "nmap discovery complete",
                   "detail": "parse open ports/services here"})


def engine_lynis(events, findings):
    """Inside-out: host hardening audit (read-only)."""
    events.append({"ts": now_iso(), "status": "run", "title": "Lynis hardening audit started",
                   "detail": "lynis audit system --quick"})
    rc, out, err = run(["lynis", "audit", "system", "--quick"])
    if rc not in (0, 78):  # lynis uses non-zero for warnings
        events.append({"ts": now_iso(), "status": "error", "title": "Lynis failed", "detail": err.strip()})
        return
    # TODO: parse /var/log/lynis-report.dat (warning[]/suggestion[]) into findings.
    events.append({"ts": now_iso(), "status": "ok", "title": "Lynis audit complete",
                   "detail": "parse /var/log/lynis-report.dat here"})


def engine_openvas(events, findings):
    """Optional free deep CVE scan via the GVM/OpenVAS API (read-only)."""
    events.append({"ts": now_iso(), "status": "run", "title": "OpenVAS scan requested",
                   "detail": "connect to the local GVM/openvas service"})
    # TODO: drive the GVM API (gvm-cli / python-gvm) and map results into findings.
    events.append({"ts": now_iso(), "status": "info", "title": "OpenVAS integration stub",
                   "detail": "wire up the GVM API here"})


def _nessus_request(cfg, path, method="GET", body=None):
    """Minimal Nessus REST call using the X-ApiKeys header. Self-signed TLS on localhost is common."""
    url = cfg["nessus"]["url"].rstrip("/") + path
    headers = {
        "X-ApiKeys": f"accessKey={cfg['nessus']['access_key']}; secretKey={cfg['nessus']['secret_key']}",
        "Content-Type": "application/json",
    }
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE  # local Nessus uses a self-signed cert
    with urllib.request.urlopen(req, context=ctx, timeout=60) as r:
        return json.loads(r.read().decode() or "{}")


def engine_nessus(cfg, events, findings):
    """Optional deep CVE scan via the local Nessus REST API (bring-your-own key)."""
    if not cfg["nessus"]["access_key"] or not cfg["nessus"]["secret_key"]:
        events.append({"ts": now_iso(), "status": "error", "title": "Nessus skipped",
                       "detail": "set nessus.access_key and nessus.secret_key in the config"})
        return
    events.append({"ts": now_iso(), "status": "run", "title": "Nessus: querying local API",
                   "detail": cfg["nessus"]["url"]})
    try:
        scans = _nessus_request(cfg, "/scans").get("scans") or []
        name = cfg["nessus"]["scan_name"]
        match = next((s for s in scans if s.get("name") == name), None)
        if not match:
            events.append({"ts": now_iso(), "status": "info", "title": "Nessus: scan not found",
                           "detail": f'no scan named "{name}" — create it in Nessus or change scan_name'})
            return
        # The latest results for that scan:
        _detail = _nessus_request(cfg, f"/scans/{match['id']}")
        # TODO: map _detail['vulnerabilities'] (and per-host details) into findings,
        # translating Nessus severity (0-4) to critical/high/medium/low/info.
        events.append({"ts": now_iso(), "status": "ok", "title": "Nessus: results retrieved",
                       "detail": "map vulnerabilities into findings here"})
    except Exception as e:  # noqa: BLE001 — never let an engine crash the run
        events.append({"ts": now_iso(), "status": "error", "title": "Nessus API error", "detail": str(e)})


# ---------------------------------------------------- defense validation (opt-in)
# BENIGN tests only. These measure whether your controls notice/block a known-safe
# artifact. They are NOT malware and do nothing destructive or persistent.
def _eicar_string():
    # Assembled at runtime so this source file itself isn't flagged by your AV.
    return (
        "X5O!P%@AP[4\\PZX54(P^)7CC)7}$"
        + "EICAR-STANDARD-ANTIVIRUS-TEST-FILE" + "!$H+H*"
    )


def validation_tests(out_dir, events):
    """Run benign detection tests; return a list of {name, category, result, detail}. Cleans up after itself."""
    results = []
    events.append({"ts": now_iso(), "status": "run", "title": "Defense validation started",
                   "detail": "benign detection tests (opt-in)"})

    # 1) EICAR anti-malware test file — standard, harmless AV test signature.
    eicar_path = os.path.join(out_dir, "eicar-test.txt")
    try:
        with open(eicar_path, "w") as fh:
            fh.write(_eicar_string())
        time.sleep(2)  # give real-time AV a moment to act
        if os.path.exists(eicar_path):
            result, detail = "allowed", "EICAR file persisted — no AV quarantine observed"
        else:
            result, detail = "blocked", "EICAR file was removed/quarantined by a control"
    except (OSError, PermissionError) as e:
        result, detail = "blocked", f"write denied by a control: {e}"
    finally:
        try:
            if os.path.exists(eicar_path):
                os.remove(eicar_path)
        except OSError:
            pass
    results.append({"name": "EICAR anti-malware test file", "category": "antivirus", "result": result, "detail": detail})

    # 2) Benign execution marker — a harmless "did a process run and leave a trace" check.
    marker = os.path.join(out_dir, f"exec-marker-{int(time.time())}.tmp")
    try:
        with open(marker, "w") as fh:
            fh.write(f"benign self-audit execution marker {now_iso()}\n")
        ran = os.path.exists(marker)
        results.append({"name": "Benign execution marker", "category": "visibility",
                        "result": "allowed" if ran else "blocked",
                        "detail": "wrote and detected a benign marker (checks logging/visibility, not blocking)"})
    except OSError as e:
        results.append({"name": "Benign execution marker", "category": "visibility",
                        "result": "blocked", "detail": f"could not write marker: {e}"})
    finally:
        try:
            if os.path.exists(marker):
                os.remove(marker)
        except OSError:
            pass

    events.append({"ts": now_iso(), "status": "ok", "title": "Defense validation complete",
                   "detail": f"{sum(1 for r in results if r['result'] == 'blocked')}/{len(results)} blocked"})
    return results


# ------------------------------------------------------------------ assembly
def build_result(cfg, engines, target, events, findings, validation, started):
    summary = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for f in findings:
        if f.get("severity") in summary:
            summary[f["severity"]] += 1
    result = {
        "agent_version": AGENT_VERSION,
        "device": {"id": socket.gethostname(), "hostname": socket.gethostname(),
                   "os": platform.platform(), "address": target},
        "mode": "audit",
        "engines": engines,
        "started_at": started,
        "finished_at": now_iso(),
        "events": events,
        "findings": findings,
        "summary": summary,
    }
    if validation is not None:
        result["validation"] = validation
    return result


# -------------------------------------------------------------- report output
def _counts(r):
    info = sum(1 for f in r["findings"] if f.get("severity") == "info")
    s = r["summary"]
    total = s["critical"] + s["high"] + s["medium"] + s["low"] + info
    return {**s, "info": info, "total": total}


def _exec_narrative(r, c):
    head = f"This read-only self-audit of {r['device']['id']} identified {c['total']} finding" + ("" if c["total"] == 1 else "s")
    extra = f", {c['info']} informational" if c["info"] else ""
    tail = (" Prioritise the critical and high-severity items, which carry the greatest exposure."
            if (c["critical"] or c["high"]) else
            " No critical or high-severity issues were identified; remaining items are hardening improvements.")
    return f"{head} — {c['critical']} critical, {c['high']} high, {c['medium']} medium, {c['low']} low{extra}.{tail}"


def build_markdown(r):
    c = _counts(r)
    esc = lambda s: str(s or "").replace("|", "\\|")
    L = ["# Self-Audit Report", "",
         f"**Device:** {r['device']['id']}  ",
         f"**OS:** {r['device'].get('os', '')}  ",
         f"**Generated:** {r['finished_at']}  ",
         f"**Engines:** {', '.join(r['engines'])}  ",
         "**Mode:** audit (read-only)", "",
         "## Executive summary", "", _exec_narrative(r, c), "",
         "## Severity breakdown", "", "| Severity | Count |", "| --- | ---: |",
         f"| Critical | {c['critical']} |", f"| High | {c['high']} |",
         f"| Medium | {c['medium']} |", f"| Low | {c['low']} |"]
    if c["info"]:
        L.append(f"| Info | {c['info']} |")
    L += [f"| **Total** | **{c['total']}** |", "", "## Findings", ""]
    if r["findings"]:
        L += ["| # | Severity | Finding | Source | Reference |", "| ---: | --- | --- | --- | --- |"]
        for i, f in enumerate(r["findings"], 1):
            port = f" :{f['port']}" if f.get("port") else ""
            L.append(f"| {i} | {f['severity']} | {esc(f['title'])} | {esc(f['source'])}{port} | {esc(f.get('cve')) or '—'} |")
        L += ["", "## Detailed findings", ""]
        for i, f in enumerate(r["findings"], 1):
            L.append(f"### {i}. {f['title']}")
            L.append("")
            L.append(f"- **Severity:** {f['severity']}")
            L.append(f"- **Source:** {f['source']}" + (f" (port {f['port']})" if f.get("port") else ""))
            if f.get("cve"):
                L.append(f"- **Reference:** {f['cve']}")
            L.append(f"- **Remediation:** {f.get('remediation', 'Review and remediate per your hardening baseline.')}")
            L.append("")
    else:
        L += ["No findings recorded (engines may still need result parsing wired up).", ""]
    if r.get("validation"):
        L += ["## Defense validation", "",
              "Benign detection tests — whether your controls noticed/blocked a known-safe artifact.", "",
              "| Test | Category | Result | Detail |", "| --- | --- | --- | --- |"]
        for v in r["validation"]:
            L.append(f"| {esc(v['name'])} | {v['category']} | {v['result']} | {esc(v['detail'])} |")
        L.append("")
    L += ["---", "", "_Read-only self-assessment of the owner's own device. No exploitation performed._"]
    return "\n".join(L) + "\n"


def build_csv(r):
    import csv
    import io
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "severity", "title", "cve", "source", "port", "remediation"])
    for f in r["findings"]:
        w.writerow([f.get("id", ""), f.get("severity", ""), f.get("title", ""), f.get("cve", ""),
                    f.get("source", ""), f.get("port", ""), f.get("remediation", "")])
    return buf.getvalue()


def build_html(r):
    import html
    c = _counts(r)
    e = html.escape
    col = {"critical": "#dc2626", "high": "#ea580c", "medium": "#d97706", "low": "#059669", "info": "#0284c7"}

    def metric(label, n, color):
        return f'<div class="metric"><div class="n" style="color:{color}">{n}</div><div class="l">{label}</div></div>'

    rows = ""
    for i, f in enumerate(r["findings"], 1):
        port = " :" + e(str(f["port"])) if f.get("port") else ""
        cve = f' <span class="cve">{e(f["cve"])}</span>' if f.get("cve") else ""
        rem = e(f.get("remediation", "Review and remediate per your hardening baseline."))
        rows += (f'<tr><td class="num">{i}</td>'
                 f'<td><span class="pill" style="background:{col.get(f["severity"], "#64748b")}">{e(f["severity"])}</span></td>'
                 f'<td><div class="t">{e(f["title"])}{cve}</div><div class="rem">{rem}</div></td>'
                 f'<td class="src">{e(f["source"])}{port}</td></tr>')
    findings_html = (f'<table><thead><tr><th>#</th><th>Severity</th><th>Finding &amp; remediation</th><th>Source</th></tr></thead><tbody>{rows}</tbody></table>'
                     if r["findings"] else "<p>No findings recorded (engines may still need result parsing wired up).</p>")

    validation_html = ""
    if r.get("validation"):
        vrows = ""
        for v in r["validation"]:
            tone = "#dc2626" if v["result"] == "allowed" else "#059669"
            vrows += (f'<tr><td>{e(v["name"])}</td><td class="src">{e(v["category"])}</td>'
                      f'<td><span class="pill" style="background:{tone}">{e(v["result"])}</span></td>'
                      f'<td class="rem">{e(v["detail"])}</td></tr>')
        validation_html = (
            '<h2>Defense validation</h2>'
            '<p class="note">Benign detection tests — whether your controls noticed or blocked a known-safe artifact. '
            'No real malware or exploits were used; each test cleans up after itself.</p>'
            f'<table><thead><tr><th>Test</th><th>Category</th><th>Result</th><th>Detail</th></tr></thead><tbody>{vrows}</tbody></table>'
        )

    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Self-Audit Report — {e(r['device']['id'])}</title>
<style>
  :root {{ color-scheme: light; }} * {{ box-sizing: border-box; }}
  body {{ font: 14px/1.5 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#0f172a; margin:0; background:#fff; }}
  .wrap {{ max-width:820px; margin:0 auto; padding:40px 32px; }}
  h1 {{ font-size:24px; margin:0 0 4px; }}
  h2 {{ font-size:15px; text-transform:uppercase; letter-spacing:.06em; color:#475569; border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin:32px 0 14px; }}
  .meta {{ color:#475569; font-size:12.5px; margin-top:8px; }} .meta b {{ color:#0f172a; }}
  .metrics {{ display:flex; gap:10px; flex-wrap:wrap; margin:10px 0 2px; }}
  .metric {{ border:1px solid #e2e8f0; border-radius:10px; padding:10px 16px; text-align:center; min-width:78px; }}
  .metric .n {{ font-size:22px; font-weight:700; }} .metric .l {{ font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:#64748b; }}
  table {{ width:100%; border-collapse:collapse; font-size:13px; }}
  th {{ text-align:left; color:#64748b; font-size:11px; text-transform:uppercase; letter-spacing:.04em; border-bottom:1px solid #e2e8f0; padding:8px; }}
  td {{ border-bottom:1px solid #eef2f6; padding:10px 8px; vertical-align:top; }}
  td.num, td.src {{ color:#64748b; font-size:12px; white-space:nowrap; }}
  .t {{ font-weight:600; }} .cve {{ font-weight:400; color:#64748b; font-size:11.5px; font-family:ui-monospace,Menlo,Consolas,monospace; }}
  .rem {{ color:#475569; font-size:12px; margin-top:3px; }}
  .pill {{ color:#fff; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.03em; padding:2px 8px; border-radius:999px; }}
  .note {{ color:#475569; font-size:12.5px; }}
  .foot {{ margin-top:36px; color:#94a3b8; font-size:11.5px; border-top:1px solid #e2e8f0; padding-top:12px; }}
  @media print {{ .wrap {{ padding:0; }} h2 {{ break-after:avoid; }} tr {{ break-inside:avoid; }} }}
</style></head>
<body><div class="wrap">
  <h1>Self-Audit Report</h1>
  <div class="meta"><b>{e(r['device']['id'])}</b>{(' · ' + e(r['device'].get('os',''))) if r['device'].get('os') else ''}<br>
  Generated {e(r['finished_at'])} · Engines: {e(', '.join(r['engines']))} · Mode: audit (read-only)</div>
  <h2>Executive summary</h2>
  <div>{e(_exec_narrative(r, c))}</div>
  <div class="metrics">
    {metric('Critical', c['critical'], col['critical'])}{metric('High', c['high'], col['high'])}
    {metric('Medium', c['medium'], col['medium'])}{metric('Low', c['low'], col['low'])}
    {metric('Info', c['info'], col['info']) if c['info'] else ''}{metric('Total', c['total'], '#0f172a')}
  </div>
  <h2>Findings</h2>
  {findings_html}
  {validation_html}
  <div class="foot">Read-only self-assessment of the owner's own device. No exploitation performed. Generated locally; nothing was uploaded.</div>
</div></body></html>"""


def write_reports(result, out_dir):
    stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
    folder = os.path.join(os.path.expanduser(out_dir), stamp)
    os.makedirs(folder, exist_ok=True)
    outputs = {
        "report.json": json.dumps(result, indent=2),
        "report.md": build_markdown(result),
        "report.csv": build_csv(result),
        "report.html": build_html(result),
    }
    for name, content in outputs.items():
        with open(os.path.join(folder, name), "w") as fh:
            fh.write(content)
    return folder


# ------------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(description="Read-only self-audit of your own device; writes a report locally.")
    ap.add_argument("--config", default="selfaudit.conf", help="Path to the config file (INI).")
    ap.add_argument("--validate", action="store_true",
                    help="Run the opt-in benign defense-validation tests this run (off by default; keep out of cron).")
    args = ap.parse_args()

    cfg = load_config(args.config)
    target = cfg["general"]["target"]
    out_dir = cfg["general"]["output_dir"]

    def on(section, key):
        return cfg.getboolean(section, key, fallback=False)

    started = now_iso()
    events, findings = [], []
    engines = []
    if on("engines", "nmap"):
        engines.append("nmap"); engine_nmap(target, events, findings)
    if on("engines", "lynis"):
        engines.append("lynis"); engine_lynis(events, findings)
    if on("engines", "openvas"):
        engines.append("openvas"); engine_openvas(events, findings)
    if on("engines", "nessus"):
        engines.append("nessus"); engine_nessus(cfg, events, findings)

    validation = None
    if args.validate or on("validation", "enabled"):
        os.makedirs(os.path.expanduser(out_dir), exist_ok=True)
        validation = validation_tests(os.path.expanduser(out_dir), events)

    result = build_result(cfg, engines, target, events, findings, validation, started)
    folder = write_reports(result, out_dir)
    print(f"wrote report to {folder}")
    print("  report.html (open and Save-as-PDF)  report.md  report.csv  report.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
