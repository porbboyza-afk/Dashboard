import json
import os
import shutil
import subprocess
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from typing import Any

from .activity_sync import ActivitySync
from .auth import DpapiSecretStore, GarminAuthAdapter
from .budget import RequestBudget
from .client import ReadOnlyGarminClient
from .config import BridgePaths
from .errors import ErrorKind, classify_error
from .firebase_plan import build_plan, build_wellness_plan, validate_uid
from .safe_logging import redact
from .sync_store import SyncStore
from .wellness_sync import WellnessSync


PROJECT = "dash-ca315"
INSTANCE = "dash-ca315-default-rtdb"
RETRYABLE = {ErrorKind.TEMPORARY, ErrorKind.TIMEOUT, ErrorKind.RATE_LIMITED}


class AlreadyRunning(RuntimeError):
    pass


@contextmanager
def process_lock(path: Path):
    try:
        handle = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError as exc:
        raise AlreadyRunning("Garmin Direct auto-sync is already running") from exc
    try:
        os.write(handle, str(os.getpid()).encode("ascii"))
        yield
    finally:
        os.close(handle)
        path.unlink(missing_ok=True)


def firebase_executable() -> str:
    executable = shutil.which("firebase.cmd") or shutil.which("firebase")
    if executable:
        return executable
    appdata = os.environ.get("APPDATA")
    if appdata:
        user_npm_executable = Path(appdata) / "npm" / "firebase.cmd"
        if user_npm_executable.is_file():
            return str(user_npm_executable)
    raise RuntimeError("Firebase CLI is not installed or not available on PATH")


def firebase_call(arguments: list[str], timeout: int = 120) -> str:
    result = subprocess.run(
        [firebase_executable(), *arguments, "--project", PROJECT, "--instance", INSTANCE],
        capture_output=True, text=True, timeout=timeout, check=False,
    )
    if result.returncode:
        message = (result.stderr or result.stdout or "Firebase CLI failed").strip()
        raise RuntimeError(redact(message))
    return result.stdout.strip()


def is_cross_source_duplicate(candidate: dict[str, Any], existing: dict[str, Any]) -> bool:
    if existing.get("source") == "garmin" or candidate.get("date") != existing.get("date"):
        return False
    if str(candidate.get("type") or "").lower() != str(existing.get("type") or "").lower():
        return False
    try:
        left_distance, right_distance = float(candidate.get("dist") or 0), float(existing.get("dist") or 0)
        left_time, right_time = float(candidate.get("time") or 0), float(existing.get("time") or 0)
    except (TypeError, ValueError):
        return False
    if min(left_distance, right_distance, left_time, right_time) <= 0:
        return False
    distance_difference = abs(left_distance - right_distance)
    duration_difference = abs(left_time - right_time)
    return (distance_difference <= 0.25 and distance_difference / max(left_distance, right_distance) <= 0.04
            and duration_difference <= 3 and duration_difference / max(left_time, right_time) <= 0.06)


def plan_patch(store: SyncStore, uid: str, existing_workouts: dict[str, Any] | None = None) -> tuple[dict[str, Any], list[str]]:
    plans = (build_plan(store, uid), build_wellness_plan(store, uid))
    patch: dict[str, Any] = {}
    written_paths: list[str] = []
    prefix = f"users/{uid}/"
    existing_rows = list((existing_workouts or {}).values())
    for plan in plans:
        for operation in plan["operations"]:
            path = operation["path"]
            if operation["op"] != "set" or not path.startswith(prefix):
                raise ValueError("unsafe Firebase operation")
            relative = path[len(prefix):]
            if relative.startswith("workouts/") and any(is_cross_source_duplicate(operation["value"], row) for row in existing_rows if isinstance(row, dict)):
                continue
            patch[relative] = operation["value"]
            written_paths.append(relative)
    return patch, written_paths


def write_and_verify(paths: BridgePaths, store: SyncStore, uid: str) -> dict[str, Any]:
    existing_raw = firebase_call(["database:get", f"/users/{uid}/workouts"])
    existing_workouts = json.loads(existing_raw) if existing_raw and existing_raw != "null" else {}
    patch, written_paths = plan_patch(store, uid, existing_workouts)
    now_ms = int(time.time() * 1000)
    patch["sync_sources/garmin_direct"] = {
        "status": "success", "last_sync": now_ms, "schema_version": 2,
        "automatic": True, "activity_count": store.canonical_count(),
        "wellness_count": sum(store.wellness_count(domain) for domain in ("sleep", "hrv", "heart_rates", "stress", "body_battery", "spo2")),
    }
    payload = paths.root / "firebase-auto-update.json"
    try:
        payload.write_text(json.dumps(patch, separators=(",", ":")), encoding="utf-8")
        firebase_call(["database:update", f"/users/{uid}", str(payload), "--force"])
    finally:
        payload.unlink(missing_ok=True)
    raw = firebase_call(["database:get", f"/users/{uid}/sync_sources/garmin_direct"])
    status = json.loads(raw)
    if status.get("last_sync") != now_ms or status.get("status") != "success":
        raise RuntimeError("Firebase read-back verification did not match the completed write")
    return {"operationCount": len(written_paths), "verifiedLastSync": now_ms}


def write_failure_status(paths: BridgePaths, uid: str, kind: ErrorKind) -> None:
    payload = paths.root / "firebase-auto-failure.json"
    value = {"status": "failed", "last_attempt": int(time.time() * 1000), "error_kind": kind.value, "automatic": True, "schema_version": 2}
    try:
        payload.write_text(json.dumps(value, separators=(",", ":")), encoding="utf-8")
        firebase_call(["database:update", f"/users/{uid}/sync_sources/garmin_direct", str(payload), "--force"])
    finally:
        payload.unlink(missing_ok=True)


def append_audit(paths: BridgePaths, event: dict[str, Any]) -> None:
    paths.logs.mkdir(parents=True, exist_ok=True)
    safe = redact(event)
    with (paths.logs / "auto-sync.jsonl").open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(safe, sort_keys=True) + "\n")


def write_status_dashboard(paths: BridgePaths, event: dict[str, Any]) -> Path:
    status = str(event.get("status") or "unknown").lower()
    succeeded = status == "success"
    title = "SYNCED" if succeeded else "SYNC FAILED" if status == "failed" else "SYNC STATUS"
    color = "#26a269" if succeeded else "#c01c28" if status == "failed" else "#b7791f"
    metrics = [
        ("Last finished", event.get("finishedAt") or "Not recorded"),
        ("Activities fetched", event.get("activityFetched") or 0),
        ("Local activities", event.get("activityTotal") or 0),
        ("Wellness domains", event.get("wellnessDomains") or 0),
        ("Firebase updates", event.get("firebaseOperations") or 0),
    ]
    if not succeeded:
        metrics.append(("Error kind", event.get("errorKind") or "unknown"))
    rows = "".join(
        f"<div class=\"metric\"><span>{escape(str(label))}</span><strong>{escape(str(value))}</strong></div>"
        for label, value in metrics
    )
    document = f"""<!doctype html>
<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">
<title>MyDash Garmin Sync Status</title><style>
:root{{color-scheme:dark;font-family:Georgia,serif}}*{{box-sizing:border-box}}body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#101513;color:#eff5ef;padding:24px}}main{{width:min(680px,100%);background:linear-gradient(145deg,#19211d,#111714);border:1px solid #314136;border-radius:20px;padding:32px;box-shadow:0 24px 70px #0008}}p{{color:#aebcaf;line-height:1.6}}.eyebrow{{font:700 11px/1 ui-monospace,monospace;letter-spacing:1.8px;color:#8fa093}}h1{{margin:10px 0 6px;font-size:42px;letter-spacing:.5px}}.state{{display:inline-flex;align-items:center;gap:8px;color:{color};font:800 13px/1 ui-monospace,monospace;letter-spacing:1.2px}}.dot{{width:10px;height:10px;border-radius:99px;background:currentColor;box-shadow:0 0 18px currentColor}}.grid{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:26px}}.metric{{padding:14px;border:1px solid #314136;border-radius:12px;background:#0d120f}}.metric span{{display:block;color:#aebcaf;font:700 10px/1.3 ui-monospace,monospace;letter-spacing:1px;text-transform:uppercase}}.metric strong{{display:block;margin-top:7px;font:700 16px/1.3 ui-monospace,monospace;word-break:break-word}}footer{{margin-top:24px;color:#839287;font:11px/1.5 ui-monospace,monospace}}@media(max-width:520px){{main{{padding:24px}}h1{{font-size:34px}}.grid{{grid-template-columns:1fr}}}}</style></head>
<body><main><div class=\"eyebrow\">MYDASH / GARMIN DIRECT / PORDELL</div><h1>Sync status</h1><div class=\"state\"><i class=\"dot\"></i>{title}</div><p>This report is updated by the Garmin bridge after each run. It contains sync metadata only.</p><section class=\"grid\">{rows}</section><footer>Open this file locally on PORDELL. Next scheduled runs: 09:00 and 21:00.</footer></main></body></html>"""
    target = paths.root / "sync-status.html"
    temporary = target.with_suffix(".tmp")
    temporary.write_text(document, encoding="utf-8")
    temporary.replace(target)
    desktop = Path.home() / "Desktop" / "MyDash Garmin Sync Status.html"
    try:
        desktop.write_text(document, encoding="utf-8")
    except OSError:
        pass
    return target


def refresh_status_dashboard(paths: BridgePaths) -> Path:
    audit = paths.logs / "auto-sync.jsonl"
    if audit.exists():
        for line in reversed(audit.read_text(encoding="utf-8").splitlines()):
            try:
                return write_status_dashboard(paths, json.loads(line))
            except json.JSONDecodeError:
                continue
    return write_status_dashboard(paths, {"status": "unknown"})


def run_auto_sync(uid: str, wellness_days: int = 1) -> dict[str, Any]:
    validate_uid(uid)
    paths = BridgePaths.default(); paths.ensure()
    started = datetime.now(timezone.utc).isoformat()
    with process_lock(paths.lock):
        try:
            api = GarminAuthAdapter(DpapiSecretStore(paths.session)).restore()
            if api is None:
                raise RuntimeError("Garmin session is missing; run mydash-garmin login")
            store = SyncStore(paths.database)
            client = ReadOnlyGarminClient(api, RequestBudget(paths.database))
            activity_result = ActivitySync(client, store).run(False)
            wellness_results = WellnessSync(client, store).run_all(wellness_days)
            firebase_result = write_and_verify(paths, store, uid)
            result = {"status": "success", "startedAt": started, "finishedAt": datetime.now(timezone.utc).isoformat(), "activities": activity_result, "wellness": wellness_results, "firebase": firebase_result}
            event = {"status": "success", "startedAt": started, "finishedAt": result["finishedAt"], "activityFetched": activity_result["fetched"], "activityTotal": activity_result["totalStored"], "wellnessDomains": len(wellness_results), "firebaseOperations": firebase_result["operationCount"]}
            append_audit(paths, event)
            write_status_dashboard(paths, event)
            return result
        except Exception as exc:
            kind = classify_error(exc)
            event = {"status": "failed", "startedAt": started, "finishedAt": datetime.now(timezone.utc).isoformat(), "errorKind": kind.value, "message": str(exc)}
            append_audit(paths, event)
            write_status_dashboard(paths, event)
            try:
                write_failure_status(paths, uid, kind)
            except Exception as status_error:
                append_audit(paths, {"status": "failure_status_write_failed", "errorKind": classify_error(status_error).value})
            raise


def run_with_retry(uid: str, wellness_days: int = 1, attempts: int = 3) -> dict[str, Any]:
    for attempt in range(1, attempts + 1):
        try:
            return run_auto_sync(uid, wellness_days)
        except AlreadyRunning:
            return {"status": "skipped", "reason": "already_running"}
        except Exception as exc:
            if classify_error(exc) not in RETRYABLE or attempt == attempts:
                raise
            time.sleep(15 * (2 ** (attempt - 1)))
    raise RuntimeError("auto-sync retry loop ended unexpectedly")
