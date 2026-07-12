import shutil
import unittest
import uuid
from datetime import date, timedelta
from pathlib import Path

from garmin_direct.activity_sync import ActivitySync
from garmin_direct.sync_store import SyncStore, activity_window


ACTIVITIES = [
    {"activityId": 101, "startTimeGMT": "2026-07-10 01:00:00", "activityType": {"typeKey": "running"}, "distance": 10000},
    {"activityId": 102, "startTimeGMT": "2026-07-11 01:00:00", "activityType": {"typeKey": "running"}, "distance": 5000},
]


class FakeClient:
    def __init__(self, payload=None, error=None):
        self.payload, self.error, self.calls = payload or [], error, []

    def call(self, method, *args):
        self.calls.append((method, args))
        if self.error: raise self.error
        return self.payload


class ActivitySyncTests(unittest.TestCase):
    def setUp(self):
        self.runtime = Path(__file__).parent / ".activity-runtime"
        self.runtime.mkdir(exist_ok=True)
        self.store = SyncStore(self.runtime / f"sync-{uuid.uuid4().hex}.sqlite")

    def tearDown(self):
        shutil.rmtree(self.runtime, ignore_errors=True)

    def test_initial_window_is_bounded(self):
        self.assertEqual(activity_window(self.store, today=date(2026, 7, 12)), (date(2026, 6, 13), date(2026, 7, 12)))

    def test_repeat_run_is_idempotent_and_uses_overlap(self):
        first = ActivitySync(FakeClient(ACTIVITIES), self.store).run()
        second_client = FakeClient(ACTIVITIES)
        second = ActivitySync(second_client, self.store).run()
        self.assertEqual((first["inserted"], second["inserted"], second["updated"]), (2, 0, 0))
        self.assertEqual(second["totalStored"], 2)
        self.assertEqual(second["canonicalStored"], 2)
        self.assertEqual(second_client.calls[0][1][0], (date.today() - timedelta(days=2)).isoformat())

    def test_changed_payload_updates_without_duplicate(self):
        ActivitySync(FakeClient(ACTIVITIES), self.store).run()
        changed = [dict(ACTIVITIES[0], distance=11000), ACTIVITIES[1]]
        result = ActivitySync(FakeClient(changed), self.store).run()
        self.assertEqual((result["inserted"], result["updated"], result["totalStored"]), (0, 1, 2))

    def test_failed_fetch_does_not_advance_cursor(self):
        with self.assertRaises(TimeoutError): ActivitySync(FakeClient(error=TimeoutError()), self.store).run()
        self.assertIsNone(self.store.cursor("activities"))


if __name__ == "__main__": unittest.main()
