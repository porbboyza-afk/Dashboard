from datetime import datetime
from hashlib import sha256
from typing import Any


def fingerprint(activity: dict[str, Any]) -> str:
    start = datetime.fromisoformat(activity["startTimeUtc"].replace("Z", "+00:00"))
    bucket = int(start.timestamp() // 120)
    duration = round((activity.get("time") or 0) * 60 / 60)
    distance = round((activity.get("dist") or 0) * 1000 / 100)
    value = f"{activity.get('type')}|{bucket}|{duration}|{distance}"
    return sha256(value.encode()).hexdigest()


def match_score(left: dict[str, Any], right: dict[str, Any]) -> float:
    if left.get("source") == right.get("source") and left.get("sourceId") == right.get("sourceId"): return 1.0
    if left.get("type") != right.get("type"): return 0.0
    lt = datetime.fromisoformat(left["startTimeUtc"].replace("Z", "+00:00")); rt = datetime.fromisoformat(right["startTimeUtc"].replace("Z", "+00:00"))
    time_score = max(0.0, 1 - abs((lt - rt).total_seconds()) / 300)
    duration_score = relative_score((left.get("time") or 0) * 60, (right.get("time") or 0) * 60, 0.08)
    distance_score = relative_score(left.get("dist") or 0, right.get("dist") or 0, 0.05)
    return round(0.5 * time_score + 0.25 * duration_score + 0.25 * distance_score, 4)


def decision(left: dict[str, Any], right: dict[str, Any]) -> str:
    score = match_score(left, right)
    return "duplicate" if score >= 0.82 else "review" if score >= 0.65 else "distinct"


def relative_score(left: float, right: float, tolerance: float) -> float:
    scale = max(abs(left), abs(right))
    if scale == 0: return 1.0
    return max(0.0, 1 - abs(left - right) / (scale * tolerance))

