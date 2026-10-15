# Home Lab Security Assessment Pipeline

A recon-to-report pipeline for testing devices **you own**, tying Nmap, Nessus, Metasploit, and Faraday into one documented workflow — with a mandatory manual checkpoint before anything is actually exploited.

> ⚠️ **Authorized use only.** Only run this against devices you own or have explicit written authorization to test, from a separate device on the same LAN as the target — never from the target itself, and never over public Wi-Fi.

## How it works

| Phase | What happens |
|---|---|
| 1. Discovery | Nmap scans the target for open ports/services |
| 2. Vulnerability scan | Nessus checks exposed services against known CVEs |
| 3. Import | Pull scan results into Metasploit's database |
| 4. Correlate | Match each CVE to a Metasploit module, rank by severity |
| 5. Explain | Plain-language write-up of each ranked finding |
| 6. Decide & exploit | You personally pick and run each module, one at a time — never automated |
| 7. Report | Log outcome + remediation per finding |

Full phase-by-phase detail, including the exact commands for each stage: [`docs/WORKFLOW.md`](docs/WORKFLOW.md)
Tool setup instructions: [`docs/INSTALLATION.md`](docs/INSTALLATION.md)
Finding write-up format: [`templates/finding_report_template.md`](templates/finding_report_template.md)

## Repo layout

```
.
├── docs/
│   ├── WORKFLOW.md        # the 7 phases, ground rules, tool reference
│   └── INSTALLATION.md    # how to install every tool this pipeline uses
├── templates/
│   └── finding_report_template.md
├── .gitignore
└── LICENSE
```

This repo is documentation and setup guidance, not a tool itself — you install and run Nmap, Nessus, Metasploit, and Faraday yourself, and use these docs as the playbook that connects them.

## What this deliberately does not do

Phase 6 — the only phase that touches a target in an offensive way — is a manual `msfconsole` session, by design. Nothing here selects, configures, or launches an exploit for you.

## License

MIT — see [`LICENSE`](LICENSE).
