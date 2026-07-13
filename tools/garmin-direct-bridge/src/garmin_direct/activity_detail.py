from __future__ import annotations

from typing import Any


DETAIL_SCHEMA_VERSION = 1


def number(value: Any) -> float | None:
    try:
        parsed = float(value)
        return parsed if parsed >= 0 else None
    except (TypeError, ValueError):
        return None


def first(payload: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if payload.get(key) is not None:
            return payload[key]
    return None


def pace(distance_m: float | None, duration_s: float | None) -> float | None:
    if not distance_m or not duration_s:
        return None
    return round((duration_s / 60) / (distance_m / 1000), 4)


def normalize_lap(raw: dict[str, Any], index: int) -> dict[str, Any] | None:
    distance_m = number(first(raw, "distance", "lapDistance", "distanceMeters"))
    duration_s = number(first(raw, "movingDuration", "duration", "elapsedDuration", "timerDuration"))
    if not distance_m or not duration_s:
        return None
    return {
        "index": index + 1,
        "distanceKm": round(distance_m / 1000, 4),
        "durationMin": round(duration_s / 60, 3),
        "pace": pace(distance_m, duration_s),
        "averageHr": number(first(raw, "averageHR", "averageHeartRate")),
        "maxHr": number(first(raw, "maxHR", "maxHeartRate")),
        "cadence": number(first(raw, "averageRunningCadenceInStepsPerMinute", "averageCadence")),
        "elevationGainM": number(first(raw, "elevationGain", "elevationGainMeters")),
        "lapType": str(first(raw, "lapType", "intensityType", "name") or "lap").lower(),
    }


def extract_laps(splits: Any) -> list[dict[str, Any]]:
    rows = splits.get("lapDTOs") if isinstance(splits, dict) else splits
    if not isinstance(rows, list):
        return []
    return [lap for index, row in enumerate(rows) if isinstance(row, dict) and (lap := normalize_lap(row, index))]


def extract_polyline(details: Any) -> str | None:
    if not isinstance(details, dict):
        return None
    candidates = (
        details.get("geoPolylineDTO"), details.get("map"), details.get("activityMap"), details,
    )
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        value = first(candidate, "polyline", "summaryPolyline", "encodedPolyline")
        if isinstance(value, str) and value:
            return value
    return None


def normalize_activity_detail(activity_id: str, details: Any, splits: Any) -> dict[str, Any]:
    laps = extract_laps(splits)
    return {
        "schemaVersion": DETAIL_SCHEMA_VERSION,
        "source": "garmin",
        "sourceId": str(activity_id),
        "laps": laps,
        "map": {"polyline": extract_polyline(details)} if extract_polyline(details) else None,
        "coverage": {"laps": bool(laps), "map": bool(extract_polyline(details)), "streams": False},
    }
