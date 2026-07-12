import argparse
import json
from datetime import datetime
from pathlib import Path

from .auth import DpapiSecretStore, GarminAuthAdapter
from .budget import RequestBudget
from .capability_probe import run_probe
from .client import ReadOnlyGarminClient
from .config import BridgePaths
from .activity_sync import ActivitySync
from .sync_store import SyncStore
from .wellness_sync import WellnessSync
from .maintenance import export_config, import_config, status, verify
from .firebase_plan import build_plan, build_wellness_plan, write_plan
from .auto_sync import run_with_retry
from .scheduler import install_tasks, task_status


def main() -> int:
    parser = argparse.ArgumentParser(description="MyDash read-only Garmin capability probe")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("login"); sub.add_parser("logout"); sub.add_parser("privacy-status"); sub.add_parser("status"); sub.add_parser("verify")
    export = sub.add_parser("export-config"); export.add_argument("output", type=Path)
    imported = sub.add_parser("import-config"); imported.add_argument("input", type=Path)
    dry = sub.add_parser("firebase-dry-run"); dry.add_argument("--uid", required=True)
    wellness_dry = sub.add_parser("firebase-wellness-dry-run"); wellness_dry.add_argument("--uid", required=True)
    sync_activities = sub.add_parser("sync-activities"); sync_activities.add_argument("--full", action="store_true", help="bounded 30-day refresh")
    sync_wellness = sub.add_parser("sync-wellness"); sync_wellness.add_argument("--days", type=int, choices=(1, 3, 7), default=3); sync_wellness.add_argument("--domain", choices=("sleep", "hrv", "heart_rates", "stress", "body_battery", "spo2")); sync_wellness.add_argument("--full", action="store_true")
    auto = sub.add_parser("auto-sync"); auto.add_argument("--uid", required=True); auto.add_argument("--wellness-days", type=int, choices=(1, 3, 7), default=3)
    scheduler_install = sub.add_parser("scheduler-install"); scheduler_install.add_argument("--uid", required=True); scheduler_install.add_argument("--project-root", type=Path, required=True)
    sub.add_parser("scheduler-status")
    probe = sub.add_parser("probe"); probe.add_argument("--days", type=int, choices=(7, 30), default=7); probe.add_argument("--include-fit", action="store_true"); probe.add_argument("--activities-only", action="store_true")
    args, paths = parser.parse_args(), BridgePaths.default(); paths.ensure()
    auth = GarminAuthAdapter(DpapiSecretStore(paths.session))
    if args.command == "login": auth.login_interactive(); print("Encrypted Garmin session saved with Windows DPAPI."); return 0
    if args.command == "logout": auth.store.clear(); print("Local Garmin session removed."); return 0
    if args.command == "privacy-status":
        print(json.dumps(status(paths), indent=2, sort_keys=True)); return 0
    if args.command == "status": print(json.dumps(status(paths), indent=2, sort_keys=True)); return 0
    if args.command == "verify": print(json.dumps(verify(paths), indent=2, sort_keys=True)); return 0
    if args.command == "export-config": export_config(args.output); print(f"Non-secret config: {args.output}"); return 0
    if args.command == "import-config": print(json.dumps(import_config(args.input), indent=2, sort_keys=True)); return 0
    if args.command == "firebase-dry-run":
        output = paths.reports / f"firebase-dry-run-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
        plan = build_plan(SyncStore(paths.database), args.uid); write_plan(plan, output); print(json.dumps({"mode": "dry-run", "operationCount": plan["operationCount"], "report": str(output)}, indent=2)); return 0
    if args.command == "firebase-wellness-dry-run":
        output = paths.reports / f"firebase-wellness-dry-run-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
        plan = build_wellness_plan(SyncStore(paths.database), args.uid); write_plan(plan, output); print(json.dumps({"mode": "dry-run", "operationCount": plan["operationCount"], "report": str(output)}, indent=2)); return 0
    if args.command == "auto-sync":
        print(json.dumps(run_with_retry(args.uid, args.wellness_days), indent=2, sort_keys=True)); return 0
    if args.command == "scheduler-install": print(json.dumps(install_tasks(args.uid, args.project_root), indent=2, sort_keys=True)); return 0
    if args.command == "scheduler-status": print(json.dumps(task_status(), indent=2, sort_keys=True)); return 0
    api = auth.restore()
    if api is None: parser.error("no session; run 'mydash-garmin login' first")
    client = ReadOnlyGarminClient(api, RequestBudget(paths.database))
    if args.command == "sync-activities":
        print(json.dumps(ActivitySync(client, SyncStore(paths.database)).run(args.full), indent=2, sort_keys=True)); return 0
    if args.command == "sync-wellness":
        sync = WellnessSync(client, SyncStore(paths.database)); result = sync.run_domain(args.domain, args.days, args.full) if args.domain else sync.run_all(args.days)
        print(json.dumps(result, indent=2, sort_keys=True)); return 0
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    fit = paths.fit_archive / f"probe-{stamp}.zip" if args.include_fit else None
    report = run_probe(client, args.days, fit, args.activities_only)
    output = paths.reports / f"capability-{stamp}.json"; output.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    print(f"Schema-only report: {output}"); return 0


if __name__ == "__main__": raise SystemExit(main())
