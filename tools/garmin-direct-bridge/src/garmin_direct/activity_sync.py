from .errors import classify_error
from datetime import date, timedelta
from .sync_store import SyncStore, activity_window
from .normalize import canonical_activity
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
            return {"runId": run_id, "windowStart": start.isoformat(), "windowEnd": end.isoformat(), "totalStored": self.store.activity_count(), "canonicalStored": self.store.canonical_count(), **counts}
        except Exception as exc:
            self.store.fail_run(run_id, classify_error(exc).value)
            raise
