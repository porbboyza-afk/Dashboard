from datetime import date, timedelta
from hashlib import sha256
from pathlib import Path
from typing import Any


def schema(value: Any) -> Any:
    if isinstance(value, dict): return {k: schema(v) for k, v in sorted(value.items())}
    if isinstance(value, list): return {"type": "array", "count": len(value), "items": schema(value[0]) if value else None}
    return {"type": type(value).__name__, "nullable": value is None}


def run_probe(client, days: int, fit_path: Path | None = None, activities_only: bool = False) -> dict:
    if days not in (7, 30): raise ValueError("days must be 7 or 30")
    end, start = date.today(), date.today() - timedelta(days=days - 1)
    activities = client.call("get_activities_by_date", start.isoformat(), end.isoformat())
    report = {"windowDays": days, "capabilities": {"activities": schema(activities)}}
    if activities:
        activity_id = activities[0].get("activityId")
        report["capabilities"].update({
            "activitySummary": schema(client.call("get_activity", activity_id)),
            "activityDetails": schema(client.call("get_activity_details", activity_id)),
            "activitySplits": schema(client.call("get_activity_splits", activity_id)),
        })
        if fit_path:
            download_format = type(client.api).ActivityDownloadFormat.ORIGINAL
            payload = client.call("download_activity", activity_id, download_format)
            fit_path.parent.mkdir(parents=True, exist_ok=True)
            fit_path.write_bytes(payload)
            report["fit"] = {"bytes": len(payload), "sha256": sha256(payload).hexdigest(), "path": str(fit_path)}
    if activities_only:
        return report
    for offset in range(3):
        day = (end - timedelta(days=offset)).isoformat()
        for name, method in (("sleep", "get_sleep_data"), ("hrv", "get_hrv_data"), ("heartRates", "get_heart_rates"), ("stress", "get_stress_data")):
            report["capabilities"].setdefault(name, []).append(schema(client.call(method, day)))
    report["capabilities"]["bodyBattery"] = schema(client.call("get_body_battery", (end - timedelta(days=2)).isoformat(), end.isoformat()))
    return report
