import json
import re
from pathlib import Path
from typing import Any
from .sync_store import SyncStore


UID_PATTERN = re.compile(r"^[A-Za-z0-9:_-]{6,128}$")


def validate_uid(uid: str) -> str:
    if not UID_PATTERN.fullmatch(uid or ""): raise ValueError("invalid or missing Firebase uid")
    return uid


def firebase_key(source: str, source_id: str) -> str:
    return f"{source}_{source_id}".replace(".", "_").replace("$", "_").replace("#", "_").replace("[", "_").replace("]", "_").replace("/", "_")


def workout_value(row: Any) -> dict[str, Any]:
    return {
        "schemaVersion": row["schema_version"], "source": row["source"], "sourceId": row["source_id"],
        "date": row["activity_date"], "startTimeUtc": row["start_time_utc"], "type": row["activity_type"],
        "dist": row["distance_km"], "time": row["duration_min"], "avgPace": row["average_pace"],
        "hr": row["average_hr"], "cad": row["cadence"], "elevationGainM": row["elevation_gain_m"],
        "calories": row["calories"], "provenance": json.loads(row["provenance_json"]),
    }


def build_plan(store: SyncStore, uid: str) -> dict[str, Any]:
    validate_uid(uid)
    with store._connect() as db:
        rows = db.execute("SELECT * FROM canonical_activities ORDER BY start_time_utc, canonical_id").fetchall()
    operations = [{"op": "set", "path": f"users/{uid}/workouts/{firebase_key(row['source'], row['source_id'])}", "value": workout_value(row)} for row in rows]
    return {"version": 1, "mode": "dry-run", "kind": "activities", "uid": uid, "operationCount": len(operations), "operations": operations}


def build_wellness_plan(store: SyncStore, uid: str) -> dict[str, Any]:
    validate_uid(uid)
    with store._connect() as db:
        rows = db.execute("SELECT domain, record_date, value_json FROM canonical_wellness ORDER BY record_date, domain").fetchall()
    operations = [{"op": "set", "path": f"users/{uid}/wellness_sources/garmin/{row['record_date']}/{row['domain']}", "value": json.loads(row["value_json"])} for row in rows]
    return {"version": 1, "mode": "dry-run", "kind": "wellness", "uid": uid, "operationCount": len(operations), "operations": operations}


def write_plan(plan: dict[str, Any], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(plan, indent=2, sort_keys=True), encoding="utf-8")
