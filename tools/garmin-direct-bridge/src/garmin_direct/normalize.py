from datetime import datetime, timezone
from typing import Any


SCHEMA_VERSION = 1
TYPE_MAP = {"running": "run", "trail_running": "run", "treadmill_running": "run", "cycling": "bike", "walking": "walk", "swimming": "swim", "lap_swimming": "swim"}


def canonical_activity(raw: dict[str, Any], source: str = "garmin") -> dict[str, Any]:
    source_id = required(raw, "activityId")
    start = parse_garmin_time(raw.get("startTimeGMT"), assume_utc=True) or parse_garmin_time(raw.get("startTimeLocal"), assume_utc=False)
    if start is None: raise ValueError("activity missing start time")
    distance_m = number(raw.get("distance"))
    duration_s = number(raw.get("movingDuration")) or number(raw.get("duration"))
    activity_key = type_key(raw.get("activityType"))
    dist_km = round(distance_m / 1000, 5) if distance_m is not None else None
    minutes = round(duration_s / 60, 4) if duration_s is not None else None
    pace = round(minutes / dist_km, 6) if minutes is not None and dist_km and dist_km > 0 else None
    return {
        "schemaVersion": SCHEMA_VERSION, "source": source, "sourceId": str(source_id),
        "startTimeUtc": start.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "date": start.date().isoformat(), "type": TYPE_MAP.get(activity_key, activity_key or "other"),
        "dist": dist_km, "time": minutes, "avgPace": pace,
        "hr": integer(raw.get("averageHR")), "cad": integer(raw.get("averageRunningCadenceInStepsPerMinute") or raw.get("averageBikingCadenceInRevPerMinute")),
        "elevationGainM": number(raw.get("elevationGain")), "calories": number(raw.get("calories")),
        "provenance": {"identity": f"{source}:activityId", "distance": f"{source}:distance_m", "duration": f"{source}:movingDuration_s", "heartRate": f"{source}:averageHR"},
    }


def required(raw: dict[str, Any], key: str) -> Any:
    value = raw.get(key)
    if value is None or str(value).strip() == "": raise ValueError(f"activity missing {key}")
    return value


def number(value: Any) -> float | None:
    if value is None or value == "": return None
    parsed = float(value)
    return parsed if parsed >= 0 else None


def integer(value: Any) -> int | None:
    parsed = number(value)
    return round(parsed) if parsed is not None else None


def type_key(value: Any) -> str | None:
    if isinstance(value, dict): return value.get("typeKey")
    return str(value) if value else None


def parse_garmin_time(value: Any, assume_utc: bool) -> datetime | None:
    if not value: return None
    text = str(value).replace("Z", "+00:00")
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc if assume_utc else datetime.now().astimezone().tzinfo)
    return parsed

