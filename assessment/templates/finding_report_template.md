# Finding: <short title>

- **Host:**
- **CVE(s):**
- **CVSS score:**
- **Matching Metasploit module:**

## Phase 5 — Explanation (fill in before Phase 6)

**What the vulnerability is, in plain language:**


**Why the scanner flagged it:**


**Which module would test it, and what it actually does:**


**What a successful exploit would mean** (e.g. remote code execution vs. information disclosure only):


**False-positive risk** (does the version banner guarantee the patch is missing, or just suggest it?):


---

## Phase 6 — Decision (you, manually, in msfconsole)

- [ ] Reviewed the explanation above
- [ ] Decided to test / decided NOT to test (circle one) — reason:
- [ ] If tested, command(s) run:

```
use <module>
set RHOSTS <host>
exploit
```

---

## Phase 7 — Result & remediation

- **Result:** confirmed exploitable / failed / false positive
- **Remediation recommendation:** (patch, config change, disable service, etc.)
- **Verified fixed on (date / re-scan):**
