import json
import sqlite3
from pathlib import Path
from .config import BridgePaths
from .sync_store import SyncStore
from .budget import RequestBudget


def status(paths: BridgePaths) -> dict:
    result = {"root": str(paths.root), "encryptedSessionPresent": paths.session.exists(), "databasePresent": paths.database.exists(), "firebaseWrites": False, "schedulerEnabled": False}
    if not paths.database.exists(): return result
    store = SyncStore(paths.database)
    result["requestBudget"] = RequestBudget(paths.database).status()
    result["sourceActivities"] = store.activity_count(); result["canonicalActivities"] = store.canonical_count()
    with store._connect() as db:
        result["wellnessCounts"] = {row[0]: row[1] for row in db.execute("SELECT domain, COUNT(*) FROM wellness_records GROUP BY domain")}
        result["lastRuns"] = [{"domain": r[0], "status": r[1], "finishedAt": r[2], "errorKind": r[3]} for r in db.execute("SELECT domain,status,finished_at,error_kind FROM sync_runs ORDER BY id DESC LIMIT 8")]
    return result


def verify(paths: BridgePaths) -> dict:
    checks = {"runtimeExists": paths.root.exists(), "sessionEncryptedPresent": paths.session.exists(), "databaseIntegrity": False, "firebaseWritesDisabled": True, "schedulerDisabled": True}
    if paths.database.exists():
        with sqlite3.connect(paths.database) as db: checks["databaseIntegrity"] = db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    checks["ok"] = all(checks.values())
    return checks


def export_config(output: Path) -> None:
    value = {"version": 1, "requestBudget": {"hourly": 30, "daily": 200, "spacingSeconds": 2}, "activity": {"initialDays": 30, "overlapDays": 2}, "wellness": {"initialDays": 3}}
    output.write_text(json.dumps(value, indent=2, sort_keys=True), encoding="utf-8")


def import_config(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if value != {"version": 1, "requestBudget": {"hourly": 30, "daily": 200, "spacingSeconds": 2}, "activity": {"initialDays": 30, "overlapDays": 2}, "wellness": {"initialDays": 3}}: raise ValueError("unsupported or unsafe config")
    return value
