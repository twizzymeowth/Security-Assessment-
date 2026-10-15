# Workflow

## Purpose & scope

This documents a repeatable process for assessing the security posture of devices you own (or have explicit written authorization to test). It combines discovery, vulnerability scanning, correlation, and reporting into one pipeline, with a required manual checkpoint before any exploit attempt.

## Ground rules

- Only scan devices you own or have explicit written authorization to test.
- Scan from a separate device on the same local network/LAN as the target — not from the target itself, and not over public Wi-Fi.
- No step in this workflow fires automatically against a target. Every exploit attempt (Phase 6) is a specific, manual command you issue yourself, one at a time.

## Phase 1 — Discovery (Nmap)

**Goal:** Find what's alive on the network and what's exposed.
**Tool:** Nmap

```bash
nmap -sV -sC -p- 192.168.1.X -oA scan_results
```

**Output:** Open ports, running services, and version banners per host.
**Why it matters:** This defines your actual attack surface — the scope for everything downstream.

## Phase 2 — Vulnerability scanning (Nessus)

**Goal:** Check each exposed service against known CVEs, missing patches, and misconfigurations.
**Tool:** Nessus Essentials (free, up to 16 IPs).
**Input:** Target IP(s), optionally scoped to just the ports Nmap found open.
**Output:** A `.nessus` report listing vulnerabilities with CVE IDs and CVSS severity scores.

## Phase 3 — Import findings into Metasploit

**Goal:** Centralize scan data into one working database.

```
db_import nessus_report.nessus
hosts
vulns
```

**Output:** Metasploit's internal DB ties host, port, and vulnerability data together, queryable via `hosts`, `services`, and `vulns`.

## Phase 4 — Correlate findings to Metasploit modules

**Goal:** Turn a long CVE list into a short, ranked shortlist worth your attention.
**Approach:** For each CVE in the `vulns` table, check for a matching Metasploit module:

```
search cve:<CVE-ID>
```

Then rank the results yourself (or in a spreadsheet/table tool of your choice) by CVSS severity, the module's reliability rating (shown in the search output — excellent/great/good/normal/average/low/manual), and host criticality (you define which hosts matter most — e.g. a NAS holding personal files outranks a spare test VM).

**Output:** A ranked table — `Host | Vulnerability | CVE | Matching Module | Severity | Rank`.

## Phase 5 — Explain each finding

**Goal:** Make every ranked item understandable before any decision gets made. For each finding, write a short summary covering:

- What the vulnerability is, in plain language
- Why the scanner flagged it
- Which Metasploit module would test it
- What a successful exploit would actually mean (e.g. remote code execution vs. information disclosure only)
- False-positive risk (a version banner doesn't always mean a patch is actually missing)

Use [`templates/finding_report_template.md`](../templates/finding_report_template.md) for a consistent format.

## Phase 6 — Human decision point (required, no bypass)

**This is the only step where anything touches the target, and it is never scripted in this repo.**

- You read the explained findings from Phase 5.
- You personally select which module(s) to test, one at a time.
- You run each one manually and review the output before moving to the next:

```
use exploit/windows/smb/ms17_010_eternalblue
set RHOSTS 192.168.1.X
exploit
```

Nothing upstream selects or launches an exploit on your behalf — that decision stays with you at every step.

## Phase 7 — Report

**Goal:** Turn raw results into something actionable.
**Tool:** Faraday (community edition, free).

Faraday has built-in parsers for both Nessus (`.nessus` XML) and Metasploit report exports — drag either file straight into Faraday's Vulnerabilities view (`http://localhost:5985`) instead of retyping findings by hand. For each finding attempted, make sure Faraday (or your notes alongside it) captures:

- Vulnerability / CVE
- Module used
- Result: confirmed exploitable / failed / false positive
- Remediation recommendation (patch, config change, disable service, etc.)

**Output:** A clean report to prioritize fixes — then loop back to Phase 1 to verify they're closed.

## Appendix — tool reference

| Stage | Tool | License |
|---|---|---|
| Discovery | Nmap | Free / open source |
| Vulnerability scanning | Nessus Essentials | Free (capped at 16 IPs) |
| Exploitation validation | Metasploit Framework | Free / open source |
| Reporting | Faraday | Free / open source (community edition) |
