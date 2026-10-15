# Installation

This stack: **Nmap → Nessus Essentials → Metasploit → Faraday**, on Kali Linux. All free/community editions. Exact package versions change — if a link or filename below is stale, grab the current one from the vendor's download page.

## Official links

| Tool | Purpose | Homepage / download | Source |
|---|---|---|---|
| Nmap | Discovery (Phase 1) | https://nmap.org/download.html | https://github.com/nmap/nmap |
| Nessus Essentials | Vuln scanning (Phase 2) | https://www.tenable.com/products/nessus/nessus-essentials | closed source |
| Metasploit Framework | Import/correlate/exploit (Phases 3, 4, 6) | https://www.metasploit.com/ | https://github.com/rapid7/metasploit-framework |
| Faraday | Reporting (Phase 7) | https://faradaysec.com/ | https://github.com/infobyte/faraday |

## 1. Nmap

Already installed on Kali. Keep it current:

```bash
sudo apt update
sudo apt install nmap -y
nmap --version
```

## 2. Nessus Essentials (free, capped at 16 IPs)

1. Register for a free activation code: https://www.tenable.com/products/nessus/nessus-essentials
2. Download the `.deb` for your distro from the Tenable downloads page, then install it:
   ```bash
   sudo dpkg -i Nessus-<version>-ubuntu1404_amd64.deb
   sudo systemctl start nessusd
   ```
3. Browse to `https://localhost:8834`, accept the self-signed cert warning, choose **Nessus Essentials**, create an admin account, and paste in the activation code from your email.
4. Let it finish downloading its plugin feed before running your first scan.

Docker alternative:
```bash
docker pull tenable/nessus:latest-ubuntu
docker run --name nessus -d -p 8834:8834 tenable/nessus:latest-ubuntu
```

(No internet on the Nessus machine? See the offline activation steps using `nessuscli fetch --challenge` covered earlier in this conversation.)

## 3. Metasploit Framework

Already installed on Kali. Keep it current:

```bash
sudo apt update && sudo apt install metasploit-framework -y
msfconsole -v
```

## 4. Faraday (community edition)

Homepage: https://faradaysec.com/ · Source: https://github.com/infobyte/faraday

**Docker (recommended by the Faraday project — bundles Postgres/Redis automatically):**
```bash
wget https://raw.githubusercontent.com/infobyte/faraday/master/docker-compose.yaml
docker compose up -d
docker compose logs faraday-server | grep -i password
```
Browse to `http://localhost:5985`.

**Non-Docker (pip, in a venv):** the pip install only gets you the Python package — Faraday also needs PostgreSQL and Redis running separately, which Docker would otherwise set up for you:

```bash
# 1. Install and start the dependencies
sudo apt install postgresql redis-server -y
sudo systemctl start postgresql redis-server

# 2. Create a venv and install Faraday into it
python3 -m venv faraday-venv
source faraday-venv/bin/activate
pip install faradaysec

# 3. Initialize the database — this prints your admin username/password, save them
faraday-manage initdb

# 4. Run the server AND the worker (two terminals, venv activated in both)
faraday-server      # terminal 1
faraday-worker      # terminal 2
```

Browse to `http://localhost:5985` and log in with the credentials from step 3. Remember to `source faraday-venv/bin/activate` again in any new terminal before running `faraday-server`/`faraday-manage`/`faraday-worker`.

Faraday has built-in parsers for both Nessus (`.nessus` XML) and Metasploit report exports, so in Phase 7 you can drag either file straight into the web UI's Vulnerabilities view rather than retyping findings by hand.

That's the whole stack. See [`WORKFLOW.md`](WORKFLOW.md) for how the phases connect, and the repo's top-level `README.md` for how to push this documentation to your own GitHub repo.
