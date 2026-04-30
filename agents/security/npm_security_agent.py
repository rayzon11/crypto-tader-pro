# agents/security/npm_security_agent.py
"""
NPM SECURITY AGENT — Self-learning agent that scans npm dependencies
for vulnerabilities, supply chain attacks, and malicious packages.
Gets smarter after every scan by learning from past findings.
"""
import asyncio, json, os, subprocess, hashlib
from datetime import datetime
from collections import defaultdict
from agents.base_agent import BaseAgent


class NpmSecurityAgent(BaseAgent):
    def __init__(self):
        super().__init__("npm_security")
        self.scan_interval = 1800  # 30 minutes
        self.known_vulns = {}  # {pkg: [vulns]} — learned memory
        self.false_positives = set()  # learned false positives to skip
        self.severity_weights = {
            "critical": 10.0,
            "high": 7.0,
            "moderate": 4.0,
            "low": 1.0,
            "info": 0.5,
        }
        self.scan_count = 0
        self.total_vulns_found = 0
        self.total_vulns_fixed = 0
        self.learning_db_key = "security:npm:learning_db"
        self.threat_patterns = defaultdict(int)  # {pattern: count}

    async def load_learning_data(self):
        """Load learned knowledge from Redis — gets smarter over restarts."""
        try:
            data = await self.redis.get(self.learning_db_key)
            if data:
                learned = json.loads(data)
                self.known_vulns = learned.get("known_vulns", {})
                self.false_positives = set(learned.get("false_positives", []))
                self.threat_patterns = defaultdict(int, learned.get("threat_patterns", {}))
                self.total_vulns_found = learned.get("total_vulns_found", 0)
                self.total_vulns_fixed = learned.get("total_vulns_fixed", 0)
                self.scan_count = learned.get("scan_count", 0)
                self.logger.info(
                    f"Loaded learning data: {len(self.known_vulns)} known vulns, "
                    f"{len(self.false_positives)} false positives, "
                    f"{self.scan_count} previous scans")
        except Exception as e:
            self.logger.warning(f"Failed to load learning data: {e}")

    async def save_learning_data(self):
        """Persist learned knowledge to Redis."""
        learned = {
            "known_vulns": self.known_vulns,
            "false_positives": list(self.false_positives),
            "threat_patterns": dict(self.threat_patterns),
            "total_vulns_found": self.total_vulns_found,
            "total_vulns_fixed": self.total_vulns_fixed,
            "scan_count": self.scan_count,
            "last_updated": datetime.utcnow().isoformat(),
        }
        await self.redis.set(self.learning_db_key, json.dumps(learned))

    async def run_npm_audit(self, project_dir: str) -> dict:
        """Run npm audit and parse results."""
        try:
            result = subprocess.run(
                ["npm", "audit", "--json"],
                capture_output=True, text=True, timeout=60,
                cwd=project_dir,
            )
            return json.loads(result.stdout) if result.stdout else {}
        except subprocess.TimeoutExpired:
            self.logger.warning("npm audit timed out")
            return {"error": "timeout"}
        except Exception as e:
            self.logger.warning(f"npm audit failed: {e}")
            return {"error": str(e)}

    async def check_lockfile_integrity(self, project_dir: str) -> dict:
        """Verify package-lock.json hasn't been tampered with."""
        lockfile = os.path.join(project_dir, "package-lock.json")
        if not os.path.exists(lockfile):
            return {"status": "missing", "risk": "high"}

        with open(lockfile, "r") as f:
            content = f.read()
        current_hash = hashlib.sha256(content.encode()).hexdigest()

        stored_hash = await self.redis.get(f"security:npm:lockfile_hash:{project_dir}")
        if stored_hash:
            stored_hash = stored_hash.decode() if isinstance(stored_hash, bytes) else stored_hash
            if current_hash != stored_hash:
                return {
                    "status": "modified",
                    "risk": "critical",
                    "prev_hash": stored_hash[:16],
                    "curr_hash": current_hash[:16],
                }

        await self.redis.set(
            f"security:npm:lockfile_hash:{project_dir}", current_hash)
        return {"status": "ok", "hash": current_hash[:16]}

    async def detect_suspicious_packages(self, project_dir: str) -> list:
        """Detect potentially malicious packages using learned patterns."""
        suspicious = []
        pkg_json = os.path.join(project_dir, "package.json")
        if not os.path.exists(pkg_json):
            return suspicious

        with open(pkg_json, "r") as f:
            pkg = json.loads(f.read())

        all_deps = {}
        all_deps.update(pkg.get("dependencies", {}))
        all_deps.update(pkg.get("devDependencies", {}))

        for name, version in all_deps.items():
            risk_score = 0
            reasons = []

            # Check for typosquatting patterns (learned)
            for known_pkg in ["react", "express", "lodash", "axios", "next",
                              "webpack", "babel", "typescript", "eslint"]:
                if name != known_pkg and self._string_similarity(name, known_pkg) > 0.8:
                    risk_score += 5
                    reasons.append(f"similar to '{known_pkg}' (typosquat?)")

            # Check for suspicious install scripts
            if "file:" in version or "git+" in version:
                risk_score += 3
                reasons.append("non-registry source")

            # Check against learned threat patterns
            for pattern, count in self.threat_patterns.items():
                if pattern in name:
                    risk_score += min(count, 5)
                    reasons.append(f"matches threat pattern '{pattern}'")

            # Skip known false positives (learned)
            if name in self.false_positives:
                continue

            if risk_score >= 3:
                suspicious.append({
                    "package": name,
                    "version": version,
                    "risk_score": risk_score,
                    "reasons": reasons,
                })

        return suspicious

    def _string_similarity(self, a: str, b: str) -> float:
        """Simple Levenshtein-based similarity ratio."""
        if a == b:
            return 1.0
        len_a, len_b = len(a), len(b)
        if len_a == 0 or len_b == 0:
            return 0.0
        matrix = [[0] * (len_b + 1) for _ in range(len_a + 1)]
        for i in range(len_a + 1):
            matrix[i][0] = i
        for j in range(len_b + 1):
            matrix[0][j] = j
        for i in range(1, len_a + 1):
            for j in range(1, len_b + 1):
                cost = 0 if a[i-1] == b[j-1] else 1
                matrix[i][j] = min(
                    matrix[i-1][j] + 1,
                    matrix[i][j-1] + 1,
                    matrix[i-1][j-1] + cost,
                )
        distance = matrix[len_a][len_b]
        max_len = max(len_a, len_b)
        return 1.0 - (distance / max_len)

    def compute_risk_score(self, audit_result: dict, lockfile: dict,
                           suspicious: list) -> tuple:
        """Compute overall risk score — gets more accurate over time."""
        score = 0.0

        # Audit vulnerabilities
        vulns = audit_result.get("vulnerabilities", {})
        for pkg_name, vuln_data in vulns.items():
            severity = vuln_data.get("severity", "low")
            weight = self.severity_weights.get(severity, 1.0)

            # Apply learning: reduce weight for known recurring low-risk vulns
            if pkg_name in self.known_vulns:
                past_count = len(self.known_vulns[pkg_name])
                if past_count > 5 and severity in ["low", "info"]:
                    weight *= 0.5  # learned: recurring low-risk, deprioritize

            score += weight

        # Lockfile integrity
        if lockfile.get("status") == "modified":
            score += 20.0  # critical: possible supply chain attack
        elif lockfile.get("status") == "missing":
            score += 10.0

        # Suspicious packages
        for pkg in suspicious:
            score += pkg.get("risk_score", 0) * 2

        # Normalize by scan experience (more scans = more confident)
        confidence = min(1.0, self.scan_count / 50)

        return score, confidence

    async def learn_from_scan(self, audit_result: dict, suspicious: list):
        """Update learning database after each scan — THIS IS HOW IT GETS SMARTER."""
        self.scan_count += 1

        # Learn new vulnerability patterns
        vulns = audit_result.get("vulnerabilities", {})
        for pkg_name, vuln_data in vulns.items():
            if pkg_name not in self.known_vulns:
                self.known_vulns[pkg_name] = []
            self.known_vulns[pkg_name].append({
                "severity": vuln_data.get("severity"),
                "scan_number": self.scan_count,
                "timestamp": datetime.utcnow().isoformat(),
            })
            self.total_vulns_found += 1

            # Learn threat patterns from package names
            parts = pkg_name.split("-")
            for part in parts:
                if len(part) > 3:
                    self.threat_patterns[part] += 1

        # Track which vulns got fixed between scans (positive learning)
        current_vuln_pkgs = set(vulns.keys())
        previous_vuln_pkgs = set(self.known_vulns.keys())
        fixed = previous_vuln_pkgs - current_vuln_pkgs
        self.total_vulns_fixed += len(fixed)

        # Save updated learning data
        await self.save_learning_data()

        self.logger.info(
            f"LEARNING UPDATE: scan #{self.scan_count} | "
            f"new_vulns={len(vulns)} | fixed={len(fixed)} | "
            f"known_patterns={len(self.threat_patterns)} | "
            f"total_learned={len(self.known_vulns)}")

    async def execute(self):
        await self.load_learning_data()

        frontend_dir = os.path.join(os.getcwd(), "frontend")

        while self.running:
            try:
                self.logger.info(f"=== NPM SECURITY SCAN #{self.scan_count + 1} ===")

                # Run all checks
                audit_result = await self.run_npm_audit(frontend_dir)
                lockfile_status = await self.check_lockfile_integrity(frontend_dir)
                suspicious = await self.detect_suspicious_packages(frontend_dir)

                # Compute risk score
                risk_score, confidence = self.compute_risk_score(
                    audit_result, lockfile_status, suspicious)

                # Learn from this scan
                await self.learn_from_scan(audit_result, suspicious)

                # Determine signal
                if risk_score >= 20:
                    signal = "CRITICAL"
                elif risk_score >= 10:
                    signal = "WARNING"
                elif risk_score >= 3:
                    signal = "ADVISORY"
                else:
                    signal = "SECURE"

                vuln_count = len(audit_result.get("vulnerabilities", {}))
                self.logger.info(
                    f"Risk={risk_score:.1f} Confidence={confidence:.2f} "
                    f"Vulns={vuln_count} Suspicious={len(suspicious)} "
                    f"Lockfile={lockfile_status['status']} => {signal}")

                await self.report(signal=signal, metadata={
                    "risk_score": round(risk_score, 2),
                    "confidence": round(confidence, 2),
                    "vuln_count": vuln_count,
                    "suspicious_packages": len(suspicious),
                    "lockfile_status": lockfile_status["status"],
                    "scan_number": self.scan_count,
                    "total_learned_vulns": len(self.known_vulns),
                    "threat_patterns_known": len(self.threat_patterns),
                })

                # Alert on critical findings
                if signal == "CRITICAL":
                    await self.redis.publish("alert:send", json.dumps({
                        "message": f"NPM SECURITY CRITICAL: risk={risk_score:.1f}, "
                                   f"{vuln_count} vulns, lockfile={lockfile_status['status']}",
                        "level": "critical",
                    }))

            except Exception as e:
                self.logger.error(f"Scan failed: {e}")

            await asyncio.sleep(self.scan_interval)


if __name__ == "__main__":
    asyncio.run(NpmSecurityAgent().run())
