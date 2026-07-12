import argparse
import json
import time
from datetime import datetime, timezone

from .auth import DpapiSecretStore, GarminAuthAdapter
from .budget import RequestBudget
from .client import ReadOnlyGarminClient
from .config import BridgePaths
from .firebase_plan import build_wellness_plan, write_plan
from .sync_store import SyncStore
from .wellness_sync import WellnessSync


def append_event(path, event: str, **fields) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"at": datetime.now(timezone.utc).isoformat(), "event": event, **fields}, sort_keys=True) + "\n")


def wait_for_budget(budget: RequestBudget, needed: int, log) -> None:
    while True:
        state = budget.status()
        if state["remainingLastHour"] >= needed and state["remainingLastDay"] >= needed and not state["circuitReason"]:
            append_event(log, "budget_ready", remainingHour=state["remainingLastHour"])
            return
        next_at = datetime.fromisoformat(state["nextAvailableAt"])
        delay = max(30, min(300, (next_at - datetime.now(timezone.utc)).total_seconds() + 3))
        append_event(log, "waiting", nextAvailableAt=state["nextAvailableAt"], remainingHour=state["remainingLastHour"])
        time.sleep(delay)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--uid", required=True)
    args = parser.parse_args()
    paths = BridgePaths.default(); paths.ensure()
    log = paths.logs / "resume-wellness.jsonl"
    append_event(log, "started")
    budget = RequestBudget(paths.database)
    wait_for_budget(budget, 7, log)
    api = GarminAuthAdapter(DpapiSecretStore(paths.session)).restore()
    if api is None: raise RuntimeError("encrypted Garmin session is missing")
    sync = WellnessSync(ReadOnlyGarminClient(api, budget), SyncStore(paths.database))
    for domain in ("heart_rates", "stress", "body_battery"):
        result = sync.run_domain(domain, 3, True)
        append_event(log, "domain_complete", domain=domain, fetched=result["fetched"], totalStored=result["totalStored"])
    store = SyncStore(paths.database)
    plan = build_wellness_plan(store, args.uid)
    output = paths.reports / f"firebase-wellness-dry-run-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    write_plan(plan, output)
    append_event(log, "complete", operationCount=plan["operationCount"], report=str(output))
    return 0


if __name__ == "__main__": raise SystemExit(main())
