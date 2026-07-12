from datetime import date
from typing import Any


def normalize_wellness(domain: str, record_date: date, raw: Any) -> dict[str, Any]:
    base = {"schemaVersion": 1, "source": "garmin", "date": record_date.isoformat(), "domain": domain}
    if not isinstance(raw, dict): return {**base, "available": False}
    if domain == "sleep":
        daily = raw.get("dailySleepDTO") if isinstance(raw.get("dailySleepDTO"), dict) else raw
        return {**base, "available": bool(daily), "sleepMinutes": seconds_to_minutes(first(daily, "sleepTimeSeconds", "sleepTimeInSeconds")), "deepSleepMinutes": seconds_to_minutes(first(daily, "deepSleepSeconds", "deepSleepDuration")), "lightSleepMinutes": seconds_to_minutes(first(daily, "lightSleepSeconds", "lightSleepDuration")), "remSleepMinutes": seconds_to_minutes(first(daily, "remSleepSeconds", "remSleepDuration")), "awakeMinutes": seconds_to_minutes(first(daily, "awakeSleepSeconds", "awakeDuration")), "sleepScore": number(first(daily, "sleepScores.overall.value", "sleepScore"))}
    if domain == "hrv":
        summary = raw.get("hrvSummary") if isinstance(raw.get("hrvSummary"), dict) else raw
        return {**base, "available": bool(summary), "lastNightAvgMs": number(first(summary, "lastNightAvg", "lastNightAverage")), "weeklyAvgMs": number(first(summary, "weeklyAvg", "weeklyAverage")), "status": first(summary, "status", "statusMessage")}
    if domain == "heart_rates":
        return {**base, "available": bool(raw), "restingHr": integer(first(raw, "restingHeartRate", "restingHR")), "minHr": integer(first(raw, "minHeartRate", "minHR")), "maxHr": integer(first(raw, "maxHeartRate", "maxHR"))}
    if domain == "stress":
        return {**base, "available": bool(raw), "averageStress": number(first(raw, "overallStressLevel", "averageStressLevel", "avgStressLevel")), "maxStress": number(first(raw, "maxStressLevel", "maxStress")), "restStressDurationMin": seconds_to_minutes(first(raw, "restStressDuration", "restStressDurationSeconds"))}
    if domain == "body_battery":
        return {**base, "available": bool(raw), "charged": number(raw.get("charged")), "drained": number(raw.get("drained")), "startLevel": body_battery_level(raw, first_item=True), "endLevel": body_battery_level(raw, first_item=False)}
    raise ValueError(f"unsupported wellness domain: {domain}")


def first(value: dict[str, Any], *paths: str) -> Any:
    for path in paths:
        current: Any = value
        for part in path.split("."):
            current = current.get(part) if isinstance(current, dict) else None
        if current is not None: return current
    return None


def number(value: Any) -> float | None:
    try: return float(value) if value is not None and value != "" else None
    except (TypeError, ValueError): return None


def integer(value: Any) -> int | None:
    parsed = number(value); return round(parsed) if parsed is not None else None


def seconds_to_minutes(value: Any) -> float | None:
    parsed = number(value); return round(parsed / 60, 2) if parsed is not None else None


def body_battery_level(raw: dict[str, Any], first_item: bool) -> int | None:
    values = raw.get("bodyBatteryValuesArray")
    if not isinstance(values, list) or not values: return None
    row = values[0] if first_item else values[-1]
    if not isinstance(row, list) or not row: return None
    candidates = [integer(value) for value in row[1:] if integer(value) is not None and 0 <= integer(value) <= 100]
    return candidates[-1] if candidates else None

