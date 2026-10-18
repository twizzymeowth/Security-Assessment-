# Lab setup — Kali VM & how it reaches the target device

This covers the part that comes *before* [`WORKFLOW.md`](WORKFLOW.md): standing up the Kali Linux VM that runs the whole pipeline, and — the important part — **how that VM actually talks to the device you're assessing** over the network.

> ⚠️ **Authorized use only.** Build this to test devices you own or have explicit written authorization to test. Keep the assessment on a network you control. Never point it at anything else.

---

## 1. The assessment host: a Kali Linux VM

Everything in this pipeline (Nmap, Nessus, Metasploit, Faraday) runs on **one Kali Linux virtual machine**. Using a VM rather than your main OS keeps the tooling isolated, snapshot-able, and easy to tear down.

1. **Hypervisor** — install one on your host machine:
   - VirtualBox (free), VMware Workstation Player (free), or VMware Fusion / Hyper-V / Proxmox.
2. **Kali image** — download the official VM image or installer ISO from <https://www.kali.org/get-kali/>. The prebuilt VirtualBox/VMware images are the fastest start.
3. **Resources** — give it at least **2 vCPU / 4 GB RAM / 40 GB disk**. Nessus is the heavy one; 4 GB is a floor, 8 GB is comfortable.
4. **First boot** — update everything, then confirm the stack:
   ```bash
   sudo apt update && sudo apt full-upgrade -y
   nmap --version
   msfconsole -v
   ```
5. **Snapshot** — take a VM snapshot called `clean-baseline` now, before any scanning. You can roll back to it between engagements.

Tool installation (Nessus, Faraday, keeping Nmap/Metasploit current) is in [`INSTALLATION.md`](INSTALLATION.md).

---

## 2. How the Kali VM communicates with the target device

This is the question that decides whether anything works: **the Kali VM and the target device have to be able to address each other over IP.** How you wire the VM's virtual network adapter determines that.

### Pick a network mode

| VM network mode | What it does | Use it when |
|---|---|---|
| **Bridged** (recommended for a real device) | The VM gets its **own IP on your physical LAN**, as if it were another machine plugged into your router. It can reach — and be reached by — other devices on that LAN. | You're assessing a **separate physical device you own** (a NAS, an IoT device, a spare laptop) on your home network. |
| **Host-only / Internal network** | The VM sits on an **isolated virtual network** with no path to your real LAN or the internet. Pair it with a **target VM** on the same host-only network. | You want a **fully contained lab** — safest option, nothing can leak onto your real network. |
| **NAT** (default, *not* suitable here) | The VM shares the host's IP and hides behind it. It can reach the internet but **other LAN devices can't reach the VM**, and reverse connections back to the VM fail without manual port-forwarding. | General internet access only — *not* for assessing other devices. |

For testing a real device on your LAN, set the Kali VM's adapter to **Bridged**. For an all-virtual lab, put Kali and a victim VM on the same **Host-only/Internal** network. Both keep the traffic on a network you control; the difference is just whether the target is physical or virtual.

> Why bridged over NAT matters: several Metasploit payloads use a **reverse connection** — the target connects *back* to Kali. That only works if the target can route to Kali's IP, which NAT prevents but bridged allows.

### Confirm the two can see each other

Once the adapter is set, verify reachability **before** scanning:

```bash
# 1. What IP/subnet is Kali on?
ip addr show            # note Kali's address, e.g. 192.168.1.50/24

# 2. Find the target's IP (same subnet). Either check your router's DHCP
#    lease table, or sweep the subnet for live hosts:
sudo nmap -sn 192.168.1.0/24      # ping/ARP sweep, lists live hosts
#    (arp-scan -l also works on the local segment)

# 3. Confirm a path to the target, e.g. 192.168.1.20
ping -c 3 192.168.1.20
```

If `ip addr` shows Kali in `192.168.1.x` and the target answers at `192.168.1.20`, they're on the **same subnet** and can talk directly — you're ready for Phase 1.

### The traffic path, tool by tool

Everything rides standard TCP/IP across the LAN segment. Kali is the **assessment host**; the device under test is the **target**:

```
   ┌─────────────────────────┐          ┌──────────────────────┐          ┌───────────────────────┐
   │  Kali Linux VM          │          │  Router / LAN switch │          │  Target device        │
   │  (bridged adapter)      │  TCP/IP  │   192.168.1.1        │  TCP/IP  │  192.168.1.20         │
   │  192.168.1.50           │◄────────►│   same /24 subnet    │◄────────►│  (device you own)     │
   │  Nmap · Nessus ·        │          └──────────────────────┘          └───────────────────────┘
   │  Metasploit · Faraday   │
   └─────────────────────────┘
         ▲  outbound probes & exploit traffic  ──────────────────────────►  target service ports
         └──────────  reverse-connection callbacks (some MSF payloads)  ◄──
```

- **Nmap** sends crafted TCP/UDP/ICMP probes straight to the target's IP and reads the replies to map open ports and service versions. Outbound, Kali → target.
- **Nessus** runs on the Kali VM and opens TCP connections to the target's open ports to test them against its plugin/CVE checks. You drive it from a browser on Kali at `https://<kali-ip>:8834` (e.g. `https://192.168.1.50:8834`). The scan traffic is Kali → target; the web UI is local to Kali.
- **Metasploit** uses Kali as the attacker host. You set `RHOSTS` to the target's IP for outbound exploit traffic. For payloads that call home, `LHOST` is **Kali's own LAN IP** and `LPORT` is a listener on Kali — the target connects back to it (the ◄── arrow above), which is exactly why the VM needs a routable bridged IP.
- **Faraday** runs locally on Kali for reporting (`http://<kali-ip>:5985`). It ingests the `.nessus`/Metasploit export files — it doesn't send any traffic to the target.

### Firewall notes

- The **target's own firewall** may drop probes or closed-port responses — that shows up as filtered ports in Nmap, not a lab problem.
- For reverse-connection payloads, make sure **Kali's firewall** (and the host machine's firewall, since the adapter is bridged) allows inbound on your chosen `LPORT`.
- Keep the whole thing on your controlled LAN. Do not run any of this over public Wi-Fi or against anything beyond your authorized scope.

---

## 3. Ready check

Before moving to [`WORKFLOW.md`](WORKFLOW.md) Phase 1, you should have:

- [ ] Kali VM built, updated, `clean-baseline` snapshot taken
- [ ] Nessus and Faraday installed (per [`INSTALLATION.md`](INSTALLATION.md))
- [ ] VM adapter set to **Bridged** (real device) or **Host-only/Internal** (all-virtual lab)
- [ ] `ip addr` confirms Kali's subnet; target IP identified on the **same subnet**
- [ ] `ping` / `nmap -sn` confirms Kali and the target can reach each other
- [ ] You own or have written authorization to test the target
