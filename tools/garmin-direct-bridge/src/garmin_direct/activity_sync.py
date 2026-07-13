from .errors import classify_error
from datetime import date, timedelta
from .sync_store import SyncStore, activity_window
from .normalize import canonical_activity
from .activity_detail import normalize_activity_detail
from .fit_track import parse_fit_track
from .dedupe import fingerprint


class ActivitySync:
    def __init__(self, client, store: SyncStore):
        self.client, self.store = client, store

    def run(self, full: bool = False) -> dict:
        end = date.today()
        start = end - timedelta(days=29) if full else activity_window(self.store)[0]
        run_id = self.store.begin_run("activities", start, end)
        try:
            activities = self.client.call("get_activities_by_date", start.isoformat(), end.isoformat())
            counts = self.store.commit_activities(run_id, activities, end)
            for raw in activities:
                normalized = canonical_activity(raw)
                self.store.upsert_canonical_activity(normalized, fingerprint(normalized))
                # Detail is fetched once per new activity; summaries remain available if detail is unavailable.
                source_id = normalized["sourceId"]
                detail = self.store.activity_detail(source_id)
                if detail is None:
                    details = self.client.call("get_activity_details", source_id)
                    splits = self.client.call("get_activity_splits", source_id)
                    detail = normalize_activity_detail(source_id, details, splits)
                if not detail.get("coverage", {}).get("map"):
                    if "track" not in detail:
                        download_format = type(self.client.api).ActivityDownloadFormat.ORIGINAL
                        fit_path = self.store.database.parent / "fit-archive" / f"{source_id}.fit"
                        try:
                            fit_path.parent.mkdir(parents=True, exist_ok=True)
                            fit_path.write_bytes(self.client.call("download_activity", source_id, download_format))
                            track = parse_fit_track(fit_path)
                            detail["track"] = track
                            detail["coverage"].update(track["coverage"])
                        finally:
                            fit_path.unlink(missing_ok=True)
                self.store.upsert_activity_detail(detail)
            return {"runId": run_id, "windowStart": start.isoformat(), "windowEnd": end.isoformat(), "totalStored": self.store.activity_count(), "canonicalStored": self.store.canonical_count(), **counts}
        except Exception as exc:
            self.store.fail_run(run_id, classify_error(exc).value)
            raise
