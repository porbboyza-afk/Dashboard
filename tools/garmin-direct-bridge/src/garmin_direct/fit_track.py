from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

import fitdecode


SEMICIRCLES = 11930464.7111
MAX_POINTS = 600


def _number(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_fit_track(path: Path) -> dict[str, Any]:
    points: list[dict[str, Any]] = []
    with fitdecode.FitReader(path) as reader:
        for frame in reader:
            if not isinstance(frame, fitdecode.FitDataMessage) or frame.name != "record":
                continue
            values = {field.name: field.value for field in frame.fields}
            lat, lon = _number(values.get("position_lat")), _number(values.get("position_long"))
            if lat is None or lon is None:
                continue
            timestamp = values.get("timestamp")
            point = {
                "lat": round(lat / SEMICIRCLES, 6), "lng": round(lon / SEMICIRCLES, 6),
                "t": timestamp.isoformat() if isinstance(timestamp, datetime) else None,
                "distanceM": _number(values.get("distance")), "speedMps": _number(values.get("enhanced_speed") or values.get("speed")),
                "hr": _number(values.get("heart_rate")), "cadence": _number(values.get("cadence")),
                "altitudeM": _number(values.get("enhanced_altitude") or values.get("altitude")),
            }
            points.append({key: value for key, value in point.items() if value is not None})
    if len(points) > MAX_POINTS:
        step = len(points) / MAX_POINTS
        points = [points[int(index * step)] for index in range(MAX_POINTS - 1)] + [points[-1]]
    return {"points": points, "sampleCount": len(points), "coverage": {"map": bool(points), "streams": bool(points)}}
