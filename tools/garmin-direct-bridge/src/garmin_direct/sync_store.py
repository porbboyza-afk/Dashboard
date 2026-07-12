import hashlib
import json
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable


SCHEMA_VERSION = 2


class SyncStore:
    def __init__(self, database: Path):
        self.database = database
        database.parent.mkdir(parents=True, exist_ok=True)
        self.migrate()

    def _connect(self) -> sqlite3.Connection:
        db = sqlite3.connect(self.database, timeout=5)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA busy_timeout=5000")
        db.execute("PRAGMA foreign_keys=ON")
        return db

    def migrate(self) -> None:
        with self._connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS sync_runs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    domain TEXT NOT NULL, started_at TEXT NOT NULL,
                    finished_at TEXT, status TEXT NOT NULL,
                    window_start TEXT NOT NULL, window_end TEXT NOT NULL,
                    fetched_count INTEGER NOT NULL DEFAULT 0,
                    inserted_count INTEGER NOT NULL DEFAULT 0,
                    updated_count INTEGER NOT NULL DEFAULT 0,
                    error_kind TEXT
                );
                CREATE TABLE IF NOT EXISTS sync_cursors (
                    domain TEXT PRIMARY KEY, cursor_date TEXT NOT NULL,
                    updated_at TEXT NOT NULL, last_run_id INTEGER,
                    FOREIGN KEY(last_run_id) REFERENCES sync_runs(id)
                );
                CREATE TABLE IF NOT EXISTS source_activities (
                    source TEXT NOT NULL, source_id TEXT NOT NULL,
                    start_time TEXT, activity_type TEXT,
                    payload_hash TEXT NOT NULL, observed_at TEXT NOT NULL,
                    first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
                    PRIMARY KEY(source, source_id)
                );
                CREATE TABLE IF NOT EXISTS canonical_activities (
                    canonical_id TEXT PRIMARY KEY, source TEXT NOT NULL,
                    source_id TEXT NOT NULL, schema_version INTEGER NOT NULL,
                    start_time_utc TEXT NOT NULL, activity_date TEXT NOT NULL,
                    activity_type TEXT NOT NULL, distance_km REAL,
                    duration_min REAL, average_pace REAL, average_hr INTEGER,
                    cadence INTEGER, elevation_gain_m REAL, calories REAL,
                    provenance_json TEXT NOT NULL, fingerprint TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(source, source_id)
                );
                CREATE INDEX IF NOT EXISTS idx_canonical_activity_date ON canonical_activities(activity_date);
                CREATE INDEX IF NOT EXISTS idx_canonical_fingerprint ON canonical_activities(fingerprint);
                CREATE TABLE IF NOT EXISTS dedupe_decisions (
                    left_id TEXT NOT NULL, right_id TEXT NOT NULL,
                    score REAL NOT NULL, decision TEXT NOT NULL,
                    decided_at TEXT NOT NULL,
                    PRIMARY KEY(left_id, right_id)
                );
                CREATE TABLE IF NOT EXISTS wellness_records (
                    domain TEXT NOT NULL, record_date TEXT NOT NULL,
                    payload_hash TEXT NOT NULL, schema_json TEXT NOT NULL,
                    first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
                    PRIMARY KEY(domain, record_date)
                );
                CREATE TABLE IF NOT EXISTS canonical_wellness (
                    domain TEXT NOT NULL, record_date TEXT NOT NULL,
                    schema_version INTEGER NOT NULL, value_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY(domain, record_date)
                );
            """)
            db.execute("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)", (SCHEMA_VERSION, utc_now()))

    def cursor(self, domain: str) -> date | None:
        with self._connect() as db:
            row = db.execute("SELECT cursor_date FROM sync_cursors WHERE domain=?", (domain,)).fetchone()
        return date.fromisoformat(row[0]) if row else None

    def begin_run(self, domain: str, start: date, end: date) -> int:
        with self._connect() as db:
            cursor = db.execute(
                "INSERT INTO sync_runs(domain, started_at, status, window_start, window_end) VALUES(?, ?, 'running', ?, ?)",
                (domain, utc_now(), start.isoformat(), end.isoformat()),
            )
            return int(cursor.lastrowid)

    def fail_run(self, run_id: int, error_kind: str) -> None:
        with self._connect() as db:
            db.execute("UPDATE sync_runs SET status='failed', finished_at=?, error_kind=? WHERE id=?", (utc_now(), error_kind, run_id))

    def commit_activities(self, run_id: int, activities: Iterable[dict[str, Any]], cursor_date: date) -> dict[str, int]:
        rows = list(activities)
        inserted = updated = 0
        now = utc_now()
        with self._connect() as db:
            for activity in rows:
                source_id = str(activity.get("activityId") or "").strip()
                if not source_id:
                    raise ValueError("activity missing activityId")
                digest = payload_hash(activity)
                current = db.execute("SELECT payload_hash FROM source_activities WHERE source='garmin' AND source_id=?", (source_id,)).fetchone()
                if current is None:
                    inserted += 1
                    db.execute("INSERT INTO source_activities VALUES('garmin', ?, ?, ?, ?, ?, ?, ?)", (source_id, activity.get("startTimeGMT") or activity.get("startTimeLocal"), activity_type(activity), digest, now, now, now))
                else:
                    if current[0] != digest:
                        updated += 1
                    db.execute("UPDATE source_activities SET start_time=?, activity_type=?, payload_hash=?, observed_at=?, last_seen_at=? WHERE source='garmin' AND source_id=?", (activity.get("startTimeGMT") or activity.get("startTimeLocal"), activity_type(activity), digest, now, now, source_id))
            db.execute("UPDATE sync_runs SET status='success', finished_at=?, fetched_count=?, inserted_count=?, updated_count=? WHERE id=?", (now, len(rows), inserted, updated, run_id))
            db.execute("INSERT INTO sync_cursors(domain, cursor_date, updated_at, last_run_id) VALUES('activities', ?, ?, ?) ON CONFLICT(domain) DO UPDATE SET cursor_date=excluded.cursor_date, updated_at=excluded.updated_at, last_run_id=excluded.last_run_id", (cursor_date.isoformat(), now, run_id))
        return {"fetched": len(rows), "inserted": inserted, "updated": updated}

    def activity_count(self) -> int:
        with self._connect() as db:
            return int(db.execute("SELECT COUNT(*) FROM source_activities WHERE source='garmin'").fetchone()[0])

    def upsert_canonical_activity(self, activity: dict[str, Any], fingerprint: str) -> None:
        canonical_id = f"{activity['source']}:{activity['sourceId']}"
        with self._connect() as db:
            db.execute("""INSERT INTO canonical_activities VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(canonical_id) DO UPDATE SET schema_version=excluded.schema_version,
                start_time_utc=excluded.start_time_utc, activity_date=excluded.activity_date,
                activity_type=excluded.activity_type, distance_km=excluded.distance_km,
                duration_min=excluded.duration_min, average_pace=excluded.average_pace,
                average_hr=excluded.average_hr, cadence=excluded.cadence,
                elevation_gain_m=excluded.elevation_gain_m, calories=excluded.calories,
                provenance_json=excluded.provenance_json, fingerprint=excluded.fingerprint,
                updated_at=excluded.updated_at""", (
                canonical_id, activity["source"], activity["sourceId"], activity["schemaVersion"],
                activity["startTimeUtc"], activity["date"], activity["type"], activity.get("dist"),
                activity.get("time"), activity.get("avgPace"), activity.get("hr"), activity.get("cad"),
                activity.get("elevationGainM"), activity.get("calories"), json.dumps(activity["provenance"], sort_keys=True), fingerprint, utc_now(),
            ))

    def canonical_count(self) -> int:
        with self._connect() as db:
            return int(db.execute("SELECT COUNT(*) FROM canonical_activities").fetchone()[0])

    def commit_wellness(self, run_id: int, domain: str, records: list[tuple[date, Any]], cursor_date: date) -> dict[str, int]:
        from .wellness_normalize import normalize_wellness
        inserted = updated = 0
        now = utc_now()
        with self._connect() as db:
            for record_date, payload in records:
                digest = payload_hash({"payload": payload})
                shape = json.dumps(value_schema(payload), sort_keys=True, separators=(",", ":"))
                current = db.execute("SELECT payload_hash FROM wellness_records WHERE domain=? AND record_date=?", (domain, record_date.isoformat())).fetchone()
                if current is None:
                    inserted += 1
                    db.execute("INSERT INTO wellness_records VALUES(?, ?, ?, ?, ?, ?)", (domain, record_date.isoformat(), digest, shape, now, now))
                else:
                    if current[0] != digest: updated += 1
                    db.execute("UPDATE wellness_records SET payload_hash=?, schema_json=?, last_seen_at=? WHERE domain=? AND record_date=?", (digest, shape, now, domain, record_date.isoformat()))
                canonical = normalize_wellness(domain, record_date, payload)
                db.execute("INSERT INTO canonical_wellness VALUES(?, ?, ?, ?, ?) ON CONFLICT(domain, record_date) DO UPDATE SET schema_version=excluded.schema_version, value_json=excluded.value_json, updated_at=excluded.updated_at", (domain, record_date.isoformat(), canonical["schemaVersion"], json.dumps(canonical, sort_keys=True, separators=(",", ":")), now))
            db.execute("UPDATE sync_runs SET status='success', finished_at=?, fetched_count=?, inserted_count=?, updated_count=? WHERE id=?", (now, len(records), inserted, updated, run_id))
            db.execute("INSERT INTO sync_cursors(domain, cursor_date, updated_at, last_run_id) VALUES(?, ?, ?, ?) ON CONFLICT(domain) DO UPDATE SET cursor_date=excluded.cursor_date, updated_at=excluded.updated_at, last_run_id=excluded.last_run_id", (domain, cursor_date.isoformat(), now, run_id))
        return {"fetched": len(records), "inserted": inserted, "updated": updated}

    def wellness_count(self, domain: str) -> int:
        with self._connect() as db:
            return int(db.execute("SELECT COUNT(*) FROM wellness_records WHERE domain=?", (domain,)).fetchone()[0])


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def payload_hash(value: dict[str, Any]) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()
    return hashlib.sha256(encoded).hexdigest()


def activity_type(activity: dict[str, Any]) -> str | None:
    value = activity.get("activityType")
    if isinstance(value, dict):
        return value.get("typeKey") or value.get("typeId")
    return str(value) if value is not None else None


def activity_window(store: SyncStore, initial_days: int = 30, overlap_days: int = 2, today: date | None = None) -> tuple[date, date]:
    end = today or date.today()
    cursor = store.cursor("activities")
    start = cursor - timedelta(days=overlap_days) if cursor else end - timedelta(days=initial_days - 1)
    return min(start, end), end


def value_schema(value: Any) -> Any:
    if isinstance(value, dict): return {str(k): value_schema(v) for k, v in sorted(value.items())}
    if isinstance(value, list): return {"type": "array", "items": value_schema(value[0]) if value else None}
    return {"type": type(value).__name__, "nullable": value is None}
