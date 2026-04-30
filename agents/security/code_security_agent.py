# agents/security/code_security_agent.py
"""
CODE SECURITY AGENT — Self-learning agent that scans the entire codebase
for secrets, vulnerabilities, OWASP issues, and insecure patterns.
Gets smarter after every scan by learning from findings and false positives.
"""
import asyncio, json, os, re, hashlib
from datetime import datetime
from collections import defaultdict
from agents.base_agent import BaseAgent


class CodeSecurityAgent(BaseAgent):
    def __init__(self):
        super().__init__("code_security")
        self.scan_interval = 3600  # 1 hour
        self.project_root = os.getcwd()

        # Self-learning state
        self.scan_count = 0
        self.learning_db_key = "security:code:learning_db"
        self.file_hashes = {}  # {filepath: hash} — detect changes
        self.known_issues = defaultdict(int)  # {issue_type: count}
        self.false_positive_hashes = set()  # hashes of confirmed false positives
        self.severity_history = []  # track risk over time
        self.learned_secret_patterns = []  # new patterns discovered

        # Built-in secret detection patterns
        self.secret_patterns = [
            (r'(?i)(api[_-]?key|apikey)\s*[=:]\s*["\']([a-zA-Z0-9_\-]{20,})["\']',
             "API key", "critical"),
            (r'(?i)(secret|password|passwd|pwd)\s*[=:]\s*["\']([^"\']{8,})["\']',
             "Password/Secret", "critical"),
            (r'(?i)(token)\s*[=:]\s*["\']([a-zA-Z0-9_\-\.]{20,})["\']',
             "Token", "critical"),
            (r'(?i)(aws_access_key_id)\s*[=:]\s*["\']?(AKIA[A-Z0-9]{16})',
             "AWS Access Key", "critical"),
            (r'(?i)(aws_secret_access_key)\s*[=:]\s*["\']?([a-zA-Z0-9/+=]{40})',
             "AWS Secret Key", "critical"),
            (r'(?i)-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----',
             "Private Key", "critical"),
            (r'(?i)(ghp_[a-zA-Z0-9]{36})',
             "GitHub Personal Access Token", "critical"),
            (r'(?i)(xox[bpas]-[a-zA-Z0-9\-]+)',
             "Slack Token", "critical"),
            (r'(?i)(sk-[a-zA-Z0-9]{20,})',
             "OpenAI/Stripe Secret Key", "critical"),
            (r'(?i)(mongodb(\+srv)?://[^\s]+)',
             "MongoDB Connection String", "high"),
            (r'(?i)(postgresql://[^\s]+)',
             "PostgreSQL Connection String", "high"),
            (r'(?i)(redis://[^\s]+)',
             "Redis Connection String", "medium"),
        ]

        # Vulnerability patterns
        self.vuln_patterns = [
            (r'eval\s*\(', "eval() usage — code injection risk", "high"),
            (r'exec\s*\(', "exec() usage — code injection risk", "high"),
            (r'__import__\s*\(', "Dynamic import — potential injection", "medium"),
            (r'subprocess\.call\s*\(.*shell\s*=\s*True',
             "Shell=True in subprocess — command injection", "high"),
            (r'os\.system\s*\(', "os.system() — prefer subprocess", "medium"),
            (r'pickle\.loads?\s*\(', "Pickle deserialization — arbitrary code execution", "high"),
            (r'yaml\.load\s*\([^)]*\)(?!.*Loader)',
             "Unsafe YAML load — use safe_load", "medium"),
            (r'requests\.get\s*\(.*verify\s*=\s*False',
             "SSL verification disabled", "medium"),
            (r'hashlib\.md5\s*\(', "MD5 for hashing — use SHA-256+", "low"),
            (r'hashlib\.sha1\s*\(', "SHA-1 for hashing — use SHA-256+", "low"),
            (r'random\.\w+\s*\(', "Non-cryptographic random — use secrets module for security", "low"),
            (r'DEBUG\s*=\s*True', "Debug mode enabled", "medium"),
            (r'CORS.*allow.*\*', "Wildcard CORS — restrict origins", "medium"),
        ]

        # File patterns to skip
        self.skip_dirs = {
            "node_modules", ".git", "__pycache__", ".next", "venv",
            ".venv", "dist", "build", ".eggs", "logs",
        }
        self.scan_extensions = {".py", ".js", ".ts", ".tsx", ".jsx",
                                ".json", ".yml", ".yaml", ".env",
                                ".sh", ".ps1", ".cfg", ".ini", ".toml"}

    async def load_learning_data(self):
        """Load learned security knowledge from Redis."""
        try:
            data = await self.redis.get(self.learning_db_key)
            if data:
                learned = json.loads(data)
                self.file_hashes = learned.get("file_hashes", {})
                self.known_issues = defaultdict(int, learned.get("known_issues", {}))
                self.false_positive_hashes = set(
                    learned.get("false_positive_hashes", []))
                self.severity_history = learned.get("severity_history", [])
                self.learned_secret_patterns = learned.get(
                    "learned_secret_patterns", [])
                self.scan_count = learned.get("scan_count", 0)
                self.logger.info(
                    f"Loaded code security knowledge: "
                    f"{len(self.file_hashes)} file hashes, "
                    f"{len(self.known_issues)} issue types, "
                    f"{len(self.false_positive_hashes)} false positives, "
                    f"{self.scan_count} previous scans")
        except Exception as e:
            self.logger.warning(f"Failed to load learning data: {e}")

    async def save_learning_data(self):
        """Persist learned knowledge."""
        learned = {
            "file_hashes": self.file_hashes,
            "known_issues": dict(self.known_issues),
            "false_positive_hashes": list(self.false_positive_hashes),
            "severity_history": self.severity_history[-200:],
            "learned_secret_patterns": self.learned_secret_patterns,
            "scan_count": self.scan_count,
            "last_updated": datetime.utcnow().isoformat(),
        }
        await self.redis.set(self.learning_db_key, json.dumps(learned))

    def _hash_finding(self, filepath: str, line: int, pattern: str) -> str:
        """Create unique hash for a finding — used to track false positives."""
        return hashlib.md5(
            f"{filepath}:{line}:{pattern}".encode()).hexdigest()

    def _should_scan_file(self, filepath: str) -> bool:
        """Check if file should be scanned."""
        parts = filepath.replace("\\", "/").split("/")
        if any(skip in parts for skip in self.skip_dirs):
            return False
        _, ext = os.path.splitext(filepath)
        return ext in self.scan_extensions

    async def scan_secrets(self) -> list:
        """Scan all files for hardcoded secrets."""
        findings = []
        all_patterns = self.secret_patterns + [
            (p, "Learned pattern", "high") for p in self.learned_secret_patterns
        ]

        for root, dirs, files in os.walk(self.project_root):
            dirs[:] = [d for d in dirs if d not in self.skip_dirs]
            for fname in files:
                filepath = os.path.join(root, fname)
                if not self._should_scan_file(filepath):
                    continue
                # Skip example/template files
                if ".example" in fname or ".template" in fname:
                    continue

                try:
                    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                        for line_num, line in enumerate(f, 1):
                            for pattern, desc, severity in all_patterns:
                                match = re.search(pattern, line)
                                if match:
                                    finding_hash = self._hash_finding(
                                        filepath, line_num, desc)
                                    # Skip learned false positives
                                    if finding_hash in self.false_positive_hashes:
                                        continue
                                    findings.append({
                                        "file": os.path.relpath(
                                            filepath, self.project_root),
                                        "line": line_num,
                                        "type": desc,
                                        "severity": severity,
                                        "preview": line.strip()[:60] + "...",
                                        "hash": finding_hash,
                                    })
                except Exception:
                    continue

        return findings

    async def scan_vulnerabilities(self) -> list:
        """Scan for code vulnerability patterns."""
        findings = []

        for root, dirs, files in os.walk(self.project_root):
            dirs[:] = [d for d in dirs if d not in self.skip_dirs]
            for fname in files:
                filepath = os.path.join(root, fname)
                if not self._should_scan_file(filepath):
                    continue

                try:
                    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                        for line_num, line in enumerate(f, 1):
                            for pattern, desc, severity in self.vuln_patterns:
                                if re.search(pattern, line, re.IGNORECASE):
                                    finding_hash = self._hash_finding(
                                        filepath, line_num, desc)
                                    if finding_hash in self.false_positive_hashes:
                                        continue
                                    findings.append({
                                        "file": os.path.relpath(
                                            filepath, self.project_root),
                                        "line": line_num,
                                        "type": desc,
                                        "severity": severity,
                                        "preview": line.strip()[:60],
                                        "hash": finding_hash,
                                    })
                except Exception:
                    continue

        return findings

    async def check_env_security(self) -> dict:
        """Check .env and environment configuration security."""
        issues = []

        # Check if .env exists (should not be committed)
        env_file = os.path.join(self.project_root, ".env")
        if os.path.exists(env_file):
            issues.append({
                "type": ".env file exists in project root",
                "severity": "high",
                "recommendation": "Ensure .env is in .gitignore",
            })

        # Check .gitignore includes .env
        gitignore = os.path.join(self.project_root, ".gitignore")
        if os.path.exists(gitignore):
            with open(gitignore, "r") as f:
                content = f.read()
            if ".env" not in content:
                issues.append({
                    "type": ".env NOT in .gitignore",
                    "severity": "critical",
                    "recommendation": "Add .env to .gitignore immediately",
                })
            if ".env.local" not in content:
                issues.append({
                    "type": ".env.local NOT in .gitignore",
                    "severity": "high",
                    "recommendation": "Add .env.local to .gitignore",
                })
        else:
            issues.append({
                "type": "No .gitignore file found",
                "severity": "critical",
                "recommendation": "Create .gitignore with sensitive file exclusions",
            })

        return {"issues": issues}

    async def detect_file_changes(self) -> dict:
        """Detect unauthorized file changes since last scan."""
        changed_files = []
        new_files = []
        current_hashes = {}

        for root, dirs, files in os.walk(self.project_root):
            dirs[:] = [d for d in dirs if d not in self.skip_dirs]
            for fname in files:
                filepath = os.path.join(root, fname)
                if not self._should_scan_file(filepath):
                    continue
                try:
                    with open(filepath, "rb") as f:
                        content_hash = hashlib.sha256(f.read()).hexdigest()
                    rel_path = os.path.relpath(filepath, self.project_root)
                    current_hashes[rel_path] = content_hash

                    if rel_path in self.file_hashes:
                        if self.file_hashes[rel_path] != content_hash:
                            changed_files.append(rel_path)
                    else:
                        new_files.append(rel_path)
                except Exception:
                    continue

        # Update hashes for next scan
        self.file_hashes = current_hashes

        return {
            "changed": changed_files,
            "new": new_files,
            "total_tracked": len(current_hashes),
        }

    async def learn_from_scan(self, secrets: list, vulns: list,
                               env_issues: dict, file_changes: dict):
        """Update learning database — THIS IS HOW IT GETS SMARTER."""
        self.scan_count += 1

        # Track issue types and frequencies
        for finding in secrets + vulns:
            issue_type = finding.get("type", "unknown")
            self.known_issues[issue_type] += 1

        # Learn: if same issue appears 10+ times, it might be a pattern worth
        # watching more closely in future scans
        for issue_type, count in self.known_issues.items():
            if count >= 10:
                # Extract keywords for new patterns
                words = issue_type.lower().split()
                for word in words:
                    if len(word) > 4 and word not in ["usage", "using", "found"]:
                        pattern = rf'(?i){word}'
                        if pattern not in self.learned_secret_patterns:
                            self.learned_secret_patterns.append(pattern)

        # Track severity trend over time (for trend analysis)
        total_risk = (
            len([s for s in secrets if s["severity"] == "critical"]) * 10 +
            len([s for s in secrets if s["severity"] == "high"]) * 7 +
            len([v for v in vulns if v["severity"] == "high"]) * 7 +
            len([v for v in vulns if v["severity"] == "medium"]) * 4 +
            len(env_issues.get("issues", [])) * 5 +
            len(file_changes.get("changed", [])) * 2
        )

        self.severity_history.append({
            "scan": self.scan_count,
            "risk": total_risk,
            "secrets": len(secrets),
            "vulns": len(vulns),
            "ts": datetime.utcnow().isoformat(),
        })

        # Compute trend: is security getting better or worse?
        if len(self.severity_history) >= 3:
            recent = [h["risk"] for h in self.severity_history[-3:]]
            older = [h["risk"] for h in self.severity_history[-6:-3]] if len(
                self.severity_history) >= 6 else recent
            trend = sum(recent) / len(recent) - sum(older) / len(older)
            trend_direction = "improving" if trend < 0 else "degrading" if trend > 0 else "stable"
        else:
            trend_direction = "insufficient_data"

        await self.save_learning_data()

        self.logger.info(
            f"CODE SECURITY LEARNING: scan #{self.scan_count} | "
            f"known_issues={len(self.known_issues)} | "
            f"false_positives={len(self.false_positive_hashes)} | "
            f"files_tracked={len(self.file_hashes)} | "
            f"trend={trend_direction}")

        return trend_direction

    async def execute(self):
        await self.load_learning_data()

        while self.running:
            try:
                self.logger.info(f"=== CODE SECURITY SCAN #{self.scan_count + 1} ===")

                # Run all scans
                secrets = await self.scan_secrets()
                vulns = await self.scan_vulnerabilities()
                env_security = await self.check_env_security()
                file_changes = await self.detect_file_changes()

                # Learn from scan
                trend = await self.learn_from_scan(
                    secrets, vulns, env_security, file_changes)

                # Compute risk score
                risk_score = 0
                severity_weights = {"critical": 10, "high": 7, "medium": 4, "low": 1}
                for finding in secrets:
                    risk_score += severity_weights.get(finding["severity"], 1)
                for finding in vulns:
                    risk_score += severity_weights.get(finding["severity"], 1)
                risk_score += len(env_security.get("issues", [])) * 5
                risk_score += len(file_changes.get("changed", [])) * 1

                # Signal
                if risk_score >= 30:
                    signal = "CRITICAL"
                elif risk_score >= 15:
                    signal = "WARNING"
                elif risk_score >= 5:
                    signal = "ADVISORY"
                else:
                    signal = "SECURE"

                critical_secrets = [s for s in secrets if s["severity"] == "critical"]

                self.logger.info(
                    f"Risk={risk_score} Secrets={len(secrets)} "
                    f"(critical={len(critical_secrets)}) Vulns={len(vulns)} "
                    f"EnvIssues={len(env_security.get('issues', []))} "
                    f"ChangedFiles={len(file_changes.get('changed', []))} "
                    f"Trend={trend} => {signal}")

                await self.report(signal=signal, metadata={
                    "risk_score": risk_score,
                    "secrets_found": len(secrets),
                    "critical_secrets": len(critical_secrets),
                    "vulnerabilities": len(vulns),
                    "env_issues": len(env_security.get("issues", [])),
                    "files_changed": len(file_changes.get("changed", [])),
                    "new_files": len(file_changes.get("new", [])),
                    "total_files_tracked": file_changes.get("total_tracked", 0),
                    "scan_number": self.scan_count,
                    "security_trend": trend,
                    "learned_patterns": len(self.learned_secret_patterns),
                })

                if signal == "CRITICAL":
                    details = []
                    if critical_secrets:
                        details.append(
                            f"{len(critical_secrets)} critical secrets exposed")
                    if env_security.get("issues"):
                        details.append(
                            f"{len(env_security['issues'])} env config issues")
                    await self.redis.publish("alert:send", json.dumps({
                        "message": f"CODE SECURITY CRITICAL: {', '.join(details)}. "
                                   f"DO NOT PUSH TO PUBLIC REPO!",
                        "level": "critical",
                    }))

            except Exception as e:
                self.logger.error(f"Code security scan failed: {e}")

            await asyncio.sleep(self.scan_interval)


if __name__ == "__main__":
    asyncio.run(CodeSecurityAgent().run())
