# agents/security/db_security_agent.py
"""
DATABASE SECURITY AGENT — Self-learning agent that monitors database
security, detects SQL injection patterns, checks access controls,
and hardens configurations. Gets smarter with every scan cycle.
"""
import asyncio, json, os, re
from datetime import datetime
from collections import defaultdict
from agents.base_agent import BaseAgent


class DbSecurityAgent(BaseAgent):
    def __init__(self):
        super().__init__("db_security")
        self.scan_interval = 600  # 10 minutes
        self.db_url = os.getenv(
            "POSTGRES_URL",
            "postgresql://botuser:password@localhost:5432/cryptobot")

        # Self-learning state
        self.scan_count = 0
        self.learning_db_key = "security:db:learning_db"
        self.known_injection_patterns = [
            r"('|\"|;|--|\bOR\b|\bAND\b|\bUNION\b|\bSELECT\b|\bDROP\b|\bINSERT\b|\bDELETE\b|\bUPDATE\b).*(\b1\s*=\s*1\b|\bOR\b)",
            r"(\bEXEC\b|\bEXECUTE\b|\bxp_\b)",
            r"(\/\*.*\*\/)",
            r"(\bWAITFOR\b|\bBENCHMARK\b|\bSLEEP\b)",
        ]
        self.learned_patterns = []  # patterns discovered during operation
        self.query_log = []  # recent queries for analysis
        self.anomaly_baselines = {}  # {metric: baseline_value}
        self.blocked_ips = set()
        self.threat_history = defaultdict(list)  # {threat_type: [events]}

    async def load_learning_data(self):
        """Load learned security knowledge from Redis."""
        try:
            data = await self.redis.get(self.learning_db_key)
            if data:
                learned = json.loads(data)
                self.learned_patterns = learned.get("learned_patterns", [])
                self.anomaly_baselines = learned.get("anomaly_baselines", {})
                self.blocked_ips = set(learned.get("blocked_ips", []))
                self.scan_count = learned.get("scan_count", 0)
                self.threat_history = defaultdict(
                    list, learned.get("threat_history", {}))
                self.logger.info(
                    f"Loaded DB security knowledge: "
                    f"{len(self.learned_patterns)} learned patterns, "
                    f"{len(self.blocked_ips)} blocked IPs, "
                    f"{self.scan_count} previous scans")
        except Exception as e:
            self.logger.warning(f"Failed to load learning data: {e}")

    async def save_learning_data(self):
        """Persist learned knowledge."""
        learned = {
            "learned_patterns": self.learned_patterns,
            "anomaly_baselines": self.anomaly_baselines,
            "blocked_ips": list(self.blocked_ips),
            "scan_count": self.scan_count,
            "threat_history": dict(self.threat_history),
            "last_updated": datetime.utcnow().isoformat(),
        }
        await self.redis.set(self.learning_db_key, json.dumps(learned))

    async def check_db_connection_security(self) -> dict:
        """Check database connection and authentication security."""
        issues = []
        risk = 0

        # Check if using default credentials
        if "password@" in self.db_url or "postgres:postgres" in self.db_url:
            issues.append("Default/weak credentials detected")
            risk += 8

        # Check SSL
        if "sslmode=require" not in self.db_url and "sslmode=verify" not in self.db_url:
            issues.append("SSL not enforced in connection string")
            risk += 5

        # Check if connecting as superuser
        if "postgres@" in self.db_url or "root@" in self.db_url:
            issues.append("Connected as superuser — use least-privilege account")
            risk += 7

        return {"issues": issues, "risk": risk}

    async def scan_for_injection_attempts(self) -> dict:
        """Monitor Redis for query patterns that look like SQL injection."""
        injection_attempts = []

        # Check recent trade commands for injection patterns
        recent_commands = await self.redis.lrange("audit:trade_log", 0, 100)

        all_patterns = self.known_injection_patterns + self.learned_patterns

        for cmd in (recent_commands or []):
            try:
                cmd_str = cmd.decode() if isinstance(cmd, bytes) else cmd
                data = json.loads(cmd_str)

                # Check all string values in the data
                for key, value in self._flatten_dict(data).items():
                    if not isinstance(value, str):
                        continue
                    for pattern in all_patterns:
                        if re.search(pattern, value, re.IGNORECASE):
                            injection_attempts.append({
                                "field": key,
                                "value_preview": value[:50],
                                "pattern_matched": pattern[:30],
                                "timestamp": datetime.utcnow().isoformat(),
                            })
            except Exception:
                continue

        return {
            "attempts": injection_attempts,
            "count": len(injection_attempts),
        }

    async def check_query_anomalies(self) -> dict:
        """Detect anomalous database activity patterns — learns baselines over time."""
        try:
            import asyncpg
            conn = await asyncpg.connect(self.db_url)

            # Get current stats
            stats = {}

            # Active connections
            row = await conn.fetchrow(
                "SELECT count(*) as cnt FROM pg_stat_activity")
            stats["active_connections"] = row["cnt"] if row else 0

            # Database size
            row = await conn.fetchrow(
                "SELECT pg_database_size(current_database()) as size")
            stats["db_size_bytes"] = row["size"] if row else 0

            # Recent queries count (if pg_stat_statements available)
            try:
                row = await conn.fetchrow(
                    "SELECT count(*) as cnt FROM pg_stat_activity "
                    "WHERE state = 'active' AND query NOT LIKE '%pg_stat%'")
                stats["active_queries"] = row["cnt"] if row else 0
            except Exception:
                stats["active_queries"] = 0

            # Check for long-running queries (potential DoS)
            long_queries = await conn.fetch(
                "SELECT pid, now() - pg_stat_activity.query_start AS duration, "
                "query FROM pg_stat_activity "
                "WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes' "
                "AND state = 'active'")
            stats["long_running_queries"] = len(long_queries)

            await conn.close()

            # Compare against learned baselines
            anomalies = []
            for metric, value in stats.items():
                if metric in self.anomaly_baselines:
                    baseline = self.anomaly_baselines[metric]
                    if isinstance(value, (int, float)) and isinstance(baseline, (int, float)):
                        if baseline > 0 and value > baseline * 3:
                            anomalies.append({
                                "metric": metric,
                                "current": value,
                                "baseline": baseline,
                                "severity": "high",
                            })

                # Update baseline with exponential moving average (LEARNING)
                if isinstance(value, (int, float)):
                    if metric in self.anomaly_baselines:
                        alpha = 0.1  # learning rate
                        self.anomaly_baselines[metric] = (
                            alpha * value + (1 - alpha) * self.anomaly_baselines[metric])
                    else:
                        self.anomaly_baselines[metric] = value

            return {"stats": stats, "anomalies": anomalies}

        except ImportError:
            return {"stats": {}, "anomalies": [], "note": "asyncpg not installed"}
        except Exception as e:
            return {"stats": {}, "anomalies": [], "error": str(e)}

    async def check_table_permissions(self) -> dict:
        """Verify table-level security and access controls."""
        try:
            import asyncpg
            conn = await asyncpg.connect(self.db_url)

            # Check for public schema grants
            grants = await conn.fetch(
                "SELECT grantee, privilege_type, table_name "
                "FROM information_schema.table_privileges "
                "WHERE table_schema = 'public' AND grantee = 'PUBLIC'")

            issues = []
            for grant in grants:
                issues.append({
                    "table": grant["table_name"],
                    "privilege": grant["privilege_type"],
                    "grantee": "PUBLIC",
                    "risk": "medium",
                })

            # Check for tables without row-level security
            tables = await conn.fetch(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
            for table in tables:
                rls = await conn.fetchrow(
                    "SELECT relrowsecurity FROM pg_class WHERE relname = $1",
                    table["tablename"])
                if rls and not rls["relrowsecurity"]:
                    issues.append({
                        "table": table["tablename"],
                        "issue": "Row-level security not enabled",
                        "risk": "low",
                    })

            await conn.close()
            return {"issues": issues, "tables_checked": len(tables)}

        except ImportError:
            return {"issues": [], "note": "asyncpg not installed"}
        except Exception as e:
            return {"issues": [], "error": str(e)}

    async def scan_code_for_raw_queries(self) -> list:
        """Scan Python files for unsafe raw SQL query patterns."""
        issues = []
        dangerous_patterns = [
            (r'execute\s*\(\s*f["\']', "f-string in SQL execute — use parameterized queries"),
            (r'execute\s*\(\s*["\'].*\%s', "String formatting in SQL — verify parameterization"),
            (r'\.format\s*\(.*\).*execute', ".format() before execute — SQL injection risk"),
            (r'exec\s*\(', "exec() call — potential code injection"),
            (r'eval\s*\(', "eval() call — potential code injection"),
        ]

        # Add learned dangerous patterns
        for learned in self.learned_patterns:
            dangerous_patterns.append((learned, "Learned dangerous pattern"))

        project_root = os.getcwd()
        for root, dirs, files in os.walk(project_root):
            # Skip non-relevant directories
            if any(skip in root for skip in [
                "node_modules", ".git", "__pycache__", ".next", "venv"]):
                continue
            for fname in files:
                if not fname.endswith(".py"):
                    continue
                filepath = os.path.join(root, fname)
                try:
                    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                        for line_num, line in enumerate(f, 1):
                            for pattern, desc in dangerous_patterns:
                                if re.search(pattern, line, re.IGNORECASE):
                                    issues.append({
                                        "file": os.path.relpath(filepath, project_root),
                                        "line": line_num,
                                        "pattern": desc,
                                        "code_preview": line.strip()[:80],
                                    })
                except Exception:
                    continue

        return issues

    def _flatten_dict(self, d: dict, prefix: str = "") -> dict:
        """Flatten nested dict for scanning."""
        items = {}
        for k, v in d.items():
            key = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                items.update(self._flatten_dict(v, key))
            else:
                items[key] = v
        return items

    async def learn_from_scan(self, results: dict):
        """Update learning database — THIS IS HOW IT GETS SMARTER."""
        self.scan_count += 1

        # Learn from injection attempts — add new patterns
        injection_data = results.get("injection", {})
        for attempt in injection_data.get("attempts", []):
            value = attempt.get("value_preview", "")
            # Extract potential new patterns from real attacks
            if len(value) > 5:
                tokens = re.findall(r'[A-Z]{3,}', value)
                for token in tokens:
                    if token not in ["AND", "THE", "FOR"]:
                        new_pattern = rf'\b{token}\b'
                        if new_pattern not in self.learned_patterns:
                            self.learned_patterns.append(new_pattern)
                            self.logger.info(
                                f"LEARNED new injection pattern: {new_pattern}")

        # Track threat history for trend analysis
        risk = results.get("risk_score", 0)
        self.threat_history["risk_scores"].append({
            "score": risk,
            "scan": self.scan_count,
            "ts": datetime.utcnow().isoformat(),
        })
        # Keep last 500 entries
        self.threat_history["risk_scores"] = self.threat_history["risk_scores"][-500:]

        await self.save_learning_data()

        self.logger.info(
            f"DB SECURITY LEARNING: scan #{self.scan_count} | "
            f"patterns={len(self.learned_patterns)} | "
            f"baselines={len(self.anomaly_baselines)} | "
            f"blocked_ips={len(self.blocked_ips)}")

    async def execute(self):
        await self.load_learning_data()

        while self.running:
            try:
                self.logger.info(f"=== DB SECURITY SCAN #{self.scan_count + 1} ===")

                # Run all checks
                conn_security = await self.check_db_connection_security()
                injection_scan = await self.scan_for_injection_attempts()
                anomalies = await self.check_query_anomalies()
                permissions = await self.check_table_permissions()
                code_issues = await self.scan_code_for_raw_queries()

                # Compute risk score
                risk_score = conn_security.get("risk", 0)
                risk_score += injection_scan.get("count", 0) * 10
                risk_score += len(anomalies.get("anomalies", [])) * 5
                risk_score += len(permissions.get("issues", [])) * 2
                risk_score += len(code_issues) * 3

                results = {
                    "connection": conn_security,
                    "injection": injection_scan,
                    "anomalies": anomalies,
                    "permissions": permissions,
                    "code_issues": len(code_issues),
                    "risk_score": risk_score,
                }

                # Learn
                await self.learn_from_scan(results)

                # Signal
                if risk_score >= 20:
                    signal = "CRITICAL"
                elif risk_score >= 10:
                    signal = "WARNING"
                elif risk_score >= 3:
                    signal = "ADVISORY"
                else:
                    signal = "SECURE"

                self.logger.info(
                    f"Risk={risk_score} ConnIssues={len(conn_security['issues'])} "
                    f"Injections={injection_scan['count']} "
                    f"Anomalies={len(anomalies.get('anomalies', []))} "
                    f"CodeIssues={len(code_issues)} => {signal}")

                await self.report(signal=signal, metadata={
                    "risk_score": risk_score,
                    "conn_issues": len(conn_security["issues"]),
                    "injection_attempts": injection_scan["count"],
                    "anomalies": len(anomalies.get("anomalies", [])),
                    "permission_issues": len(permissions.get("issues", [])),
                    "code_issues": len(code_issues),
                    "scan_number": self.scan_count,
                    "learned_patterns": len(self.learned_patterns),
                    "baselines_tracked": len(self.anomaly_baselines),
                })

                if signal == "CRITICAL":
                    await self.redis.publish("alert:send", json.dumps({
                        "message": f"DB SECURITY CRITICAL: risk={risk_score}, "
                                   f"injections={injection_scan['count']}",
                        "level": "critical",
                    }))

            except Exception as e:
                self.logger.error(f"DB security scan failed: {e}")

            await asyncio.sleep(self.scan_interval)


if __name__ == "__main__":
    asyncio.run(DbSecurityAgent().run())
