import unittest, uuid
from datetime import date, timedelta
from pathlib import Path
from garmin_direct.sync_store import SyncStore
from garmin_direct.wellness_sync import WellnessSync


class FakeClient:
    def __init__(self): self.calls = []
    def call(self, method, *args):
        self.calls.append((method, args))
        if method == "get_body_battery":
            current, end = date.fromisoformat(args[0]), date.fromisoformat(args[1]); result = []
            while current <= end:
                result.append({"date": current.isoformat(), "charged": 10}); current += timedelta(days=1)
            return result
        return {"secretHealthValue": 42, "samples": [{"value": 99}]}


class WellnessSyncTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).parent / ".wellness-runtime"; root.mkdir(exist_ok=True)
        self.store = SyncStore(root / f"{uuid.uuid4().hex}.sqlite")

    def test_daily_domain_is_idempotent(self):
        first = WellnessSync(FakeClient(), self.store).run_domain("sleep", 3)
        second = WellnessSync(FakeClient(), self.store).run_domain("sleep", 3)
        self.assertEqual((first["inserted"], second["inserted"], second["updated"]), (3, 0, 0))
        self.assertEqual(second["totalStored"], 3)

    def test_body_battery_uses_range_endpoint_once(self):
        client = FakeClient(); result = WellnessSync(client, self.store).run_domain("body_battery", 3)
        self.assertEqual(len(client.calls), 1); self.assertEqual(result["inserted"], 3)

    def test_body_battery_overlap_is_idempotent_per_date(self):
        first = WellnessSync(FakeClient(), self.store).run_domain("body_battery", 3)
        second = WellnessSync(FakeClient(), self.store).run_domain("body_battery", 3)
        self.assertEqual((first["inserted"], second["inserted"], second["updated"]), (3, 0, 0))

    def test_schema_storage_does_not_duplicate_health_values(self):
        WellnessSync(FakeClient(), self.store).run_domain("hrv", 1)
        with self.store._connect() as db:
            shape = db.execute("SELECT schema_json FROM wellness_records WHERE domain='hrv'").fetchone()[0]
        self.assertNotIn("42", shape); self.assertNotIn("99", shape)

    def test_failure_does_not_advance_cursor(self):
        class Broken:
            def call(self, *_): raise TimeoutError()
        with self.assertRaises(TimeoutError): WellnessSync(Broken(), self.store).run_domain("stress", 1)
        self.assertIsNone(self.store.cursor("stress"))


if __name__ == "__main__": unittest.main()
