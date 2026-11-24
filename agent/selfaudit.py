#!/usr/bin/env python3
"""Self-audit agent (skeleton).

Runs read-only scan engines against THIS host and writes a result JSON
file. You then load that file into the dashboard (drag-drop, file picker
or paste), which renders and exports it entirely in your browser. Nothing
is uploaded and no server stores your results.

The parsing TODOs are left for you to complete; the structure, CLI, engine
calls, and the file output are wired up.

Safety: audits the local host only. Baseline engines (nmap, lynis) are
read-only. The validate/both modes are opt-in and must stay gated behind
the dashboard checkpoint and run only in a lab.
"""
import argparse
import json
import platform
import socket
import subprocess
import sys
from datetime import datetime, timezone

AGENT_VERSION = "0.1.0"


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


def engine_nmap(target, events, findings):
    """Outside-in: open ports / services / version + vuln scripts."""
    events.append({"ts": now_iso(), "status": "run", "title": "nmap discovery started",
                   "detail": f"nmap -sV -sC --script vuln {target}"})
    rc, out, err = run(["nmap", "-sV", "-sC", "--script", "vuln", target])
    if rc != 0:
        events.append({"ts": now_iso(), "status": "error", "title": "nmap failed", "detail": err.strip()})
        return
    # TODO: parse `out` into findings (open ports, versions, vuln script hits).
    events.append({"ts": now_iso(), "status": "ok", "title": "nmap discovery complete",
                   "detail": "parse open ports/services here"})


def engine_lynis(events, findings):
    """Inside-out: host hardening audit."""
    events.append({"ts": now_iso(), "status": "run", "title": "Lynis hardening audit started",
                   "detail": "lynis audit system --quick"})
    rc, out, err = run(["lynis", "audit", "system", "--quick"])
    if rc not in (0, 78):  # lynis uses non-zero for warnings
        events.append({"ts": now_iso(), "status": "error", "title": "Lynis failed", "detail": err.strip()})
        return
    # TODO: parse /var/log/lynis-report.dat for warnings/suggestions into findings.
    events.append({"ts": now_iso(), "status": "ok", "title": "Lynis audit complete",
                   "detail": "parse /var/log/lynis-report.dat here"})


# TODO: engine_openvas(...), engine_nessus(...) via their local APIs (optional).


def build_result(mode, engines, target, events, findings, started):
    summary = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for f in findings:
        sev = f.get("severity")
        if sev in summary:
            summary[sev] += 1
    return {
        "agent_version": AGENT_VERSION,
        "device": {
            "id": socket.gethostname(),
            "hostname": socket.gethostname(),
            "os": platform.platform(),
            "address": target,
        },
        "mode": mode,
        "engines": engines,
        "started_at": started,
        "finished_at": now_iso(),
        "events": events,
        "findings": findings,
        "summary": summary,
    }


def main():
    ap = argparse.ArgumentParser(description="Self-audit this host and write a result JSON file to load into the dashboard.")
    ap.add_argument("--mode", choices=["audit", "validate", "both"], default="audit")
    ap.add_argument("--target", default="127.0.0.1", help="Host to audit (default: this host).")
    ap.add_argument("--engine", action="append", default=[], help="Optional extra engine: openvas|nessus")
    ap.add_argument("--out", default="selfaudit-report.json",
                    help="Write result JSON to this file (default: selfaudit-report.json). Use '-' for stdout.")
    args = ap.parse_args()

    started = now_iso()
    events, findings = [], []
    engines = ["nmap", "lynis"] + list(args.engine)

    engine_nmap(args.target, events, findings)
    engine_lynis(events, findings)
    # TODO: dispatch optional engines in args.engine; validation stays manual/gated.

    result = build_result(args.mode, engines, args.target, events, findings, started)

    if args.out == "-":
        json.dump(result, sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        with open(args.out, "w") as fh:
            json.dump(result, fh, indent=2)
        print(f"wrote {args.out} — load it into the dashboard to view and export")
    return 0


if __name__ == "__main__":
    sys.exit(main())
