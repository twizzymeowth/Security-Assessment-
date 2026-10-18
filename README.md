# Security-Assessment-

A documented, recon-to-report **security assessment pipeline** run from a **Kali Linux VM** against a device **you own or are authorized to test**. It ties Nmap, Nessus, Metasploit, and Faraday into one repeatable workflow, with a mandatory manual checkpoint before anything is actually exploited.

> ⚠️ **Authorized use only.** Only run this against devices you own or have explicit written authorization to test. Keep it on a LAN you control — run it from a separate device on the same network as the target, never from the target itself, and never over public Wi-Fi.

---

## What this is

This repo is **documentation and a playbook**, not a tool. You install and run the four tools yourself on a Kali VM; these docs are the process that connects them, from building the lab to writing up findings.

| Phase | What happens | Tool |
|---|---|---|
| 0. Lab setup | Build the Kali VM and put it on the same network as the target | Kali + hypervisor |
| 1. Discovery | Scan the target for open ports/services | Nmap |
| 2. Vulnerability scan | Check exposed services against known CVEs | Nessus |
| 3. Import | Pull scan results into Metasploit's database | Metasploit |
| 4. Correlate | Match each CVE to a module, rank by severity | Metasploit |
| 5. Explain | Plain-language write-up of each ranked finding | — |
| 6. Decide & exploit | *You* personally pick and run each module, one at a time | Metasploit (manual) |
| 7. Report | Log outcome + remediation per finding | Faraday |

Phase 6 is the only phase that touches a target offensively, and it is **always a manual `msfconsole` session** — nothing in this repo selects, configures, or launches an exploit for you.

---

## The Kali VM and how it reaches the target device

The whole pipeline runs on **one Kali Linux VM**. For it to assess a device, the VM and the target have to be able to address each other over IP — which comes down to how you wire the VM's virtual network adapter.

- **Bridged mode (for a real device you own):** the VM gets its own IP on your physical LAN, as if it were another machine on the router. It can reach, and be reached by, the target on the same subnet (e.g. Kali `192.168.1.50`, target `192.168.1.20`, both on `192.168.1.0/24`). This is the mode to use when the target is a separate physical device.
- **Host-only / Internal mode (for an all-virtual lab):** Kali and a victim VM share an isolated virtual network with no path to your real LAN — the safest, fully contained option.
- **NAT (the hypervisor default) is *not* suitable here:** the VM hides behind the host's IP, other LAN devices can't reach it, and reverse-connection payloads fail.

Once the adapter is set, confirm the two can see each other before scanning:

```bash
ip addr show                     # Kali's IP/subnet, e.g. 192.168.1.50/24
sudo nmap -sn 192.168.1.0/24     # find live hosts; identify the target IP
ping -c 3 192.168.1.20           # confirm a path to the target
```

**Traffic path.** Everything rides standard TCP/IP across the LAN. Kali is the assessment host:

```
 Kali Linux VM (bridged)          Router / switch           Target device (you own)
 192.168.1.50                     192.168.1.1               192.168.1.20
 Nmap · Nessus ·      ──TCP/IP──►   same /24 subnet  ──TCP/IP──►  service ports
 Metasploit · Faraday ◄───────── reverse-connection callbacks ◄──
```

- **Nmap** sends probes to the target IP and reads the replies (outbound).
- **Nessus** runs on Kali and connects to the target's open ports to test them; you drive it from a browser on Kali at `https://<kali-ip>:8834`.
- **Metasploit** runs on Kali: `RHOSTS` is the target; for payloads that call home, `LHOST` is **Kali's own IP** and the target connects *back* to it — which is why a routable bridged IP matters.
- **Faraday** runs locally on Kali for reporting (`http://<kali-ip>:5985`); it reads scan files and sends nothing to the target.

Full build + networking walkthrough, including the readiness checklist: [`docs/LAB-SETUP.md`](Security%20Assessment/docs/LAB-SETUP.md).

---

## Full documentation

Everything lives under [`Security Assessment/`](Security%20Assessment/):

- **[`docs/LAB-SETUP.md`](Security%20Assessment/docs/LAB-SETUP.md)** — build the Kali VM, network modes, and exactly how the VM communicates with the target device (Phase 0).
- **[`docs/INSTALLATION.md`](Security%20Assessment/docs/INSTALLATION.md)** — install Nmap, Nessus, Metasploit, and Faraday on Kali.
- **[`docs/WORKFLOW.md`](Security%20Assessment/docs/WORKFLOW.md)** — the 7 phases, ground rules, exact commands, and tool reference.
- **[`templates/finding_report_template.md`](Security%20Assessment/templates/finding_report_template.md)** — consistent per-finding write-up format.

---

## Connecting this repo to Claude

This repo includes a GitHub Actions workflow at [`.github/workflows/claude.yml`](.github/workflows/claude.yml) that runs the [Claude Code GitHub Action](https://code.claude.com/docs/en/github-actions). Once it's set up, you can mention **`@claude`** in any issue or pull request comment to have Claude read the repo, answer questions, make changes, and push commits. Steps below are verified against the current official docs (October 2026).

**Quick setup (if you run Claude Code locally):**
1. Install the GitHub CLI and run `gh auth login`.
2. In this repo, open `claude` and run `/install-github-app`. It installs the Claude GitHub App, saves your auth secret, and opens a ready-to-create PR with the workflow. Merge that PR.

**Manual setup (what the committed workflow expects):**
1. **Install the Claude GitHub App** on this repository: <https://github.com/apps/claude> (grants Contents, Issues, and Pull requests read/write, among others).
2. **Add an authentication secret** under *Settings → Secrets and variables → Actions*:
   - `ANTHROPIC_API_KEY` — a Claude API key from <https://platform.claude.com>, **or**
   - `CLAUDE_CODE_OAUTH_TOKEN` — a subscription token from `claude setup-token`. If you use this, change the `anthropic_api_key:` line in `claude.yml` to `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`.
3. **Merge `claude.yml` to the default branch.** (It's already in this branch — merging the PR does this.)
4. **Test it:** open an issue or PR comment with, e.g., `@claude summarize docs/WORKFLOW.md`.

You need admin access to the repo to install the app and add secrets. Never commit the key itself — only reference it as a secret.

---

## Repo layout

```
.
├── .github/
│   └── workflows/
│       └── claude.yml              # Claude Code GitHub Action (@claude integration)
├── README.md                       # this file
└── Security Assessment/
    ├── README.md                   # pipeline overview
    ├── docs/
    │   ├── LAB-SETUP.md            # Kali VM build + VM-to-device networking (Phase 0)
    │   ├── INSTALLATION.md         # install the four tools
    │   └── WORKFLOW.md             # the 7 phases, commands, ground rules
    ├── templates/
    │   └── finding_report_template.md
    └── LICENSE
```

## What this deliberately does not do

Phase 6 — the only phase that touches a target offensively — is a manual `msfconsole` session, by design. Nothing in this repo selects, configures, or launches an exploit for you.

## License

MIT — see [`Security Assessment/LICENSE`](Security%20Assessment/LICENSE).
