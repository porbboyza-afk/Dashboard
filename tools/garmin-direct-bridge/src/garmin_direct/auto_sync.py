import json
import os
import shutil
import subprocess
import time
from contextlib import contextmanager
from datetime import datetime, timezone
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
            append_audit(paths, {"status": "success", "startedAt": started, "finishedAt": result["finishedAt"], "activityFetched": activity_result["fetched"], "firebaseOperations": firebase_result["operationCount"]})
            return result
        except Exception as exc:
            kind = classify_error(exc)
            append_audit(paths, {"status": "failed", "startedAt": started, "finishedAt": datetime.now(timezone.utc).isoformat(), "errorKind": kind.value, "message": str(exc)})
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
