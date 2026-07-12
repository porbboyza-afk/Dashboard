import unittest, uuid
from pathlib import Path
from garmin_direct.firebase_plan import build_plan, build_wellness_plan, firebase_key, validate_uid
from garmin_direct.normalize import canonical_activity
from garmin_direct.dedupe import fingerprint
from garmin_direct.sync_store import SyncStore
from garmin_direct.maintenance import export_config


class FirebasePlanTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).parent / ".firebase-runtime"; root.mkdir(exist_ok=True)
        self.store = SyncStore(root / f"{uuid.uuid4().hex}.sqlite")
        item = canonical_activity({"activityId": 42, "startTimeGMT": "2026-07-10 01:00:00", "activityType": {"typeKey": "running"}, "distance": 10000, "movingDuration": 3000})
        self.store.upsert_canonical_activity(item, fingerprint(item))

    def test_plan_is_deterministic_set_under_owner(self):
        first = build_plan(self.store, "user_12345"); second = build_plan(self.store, "user_12345")
        self.assertEqual(first, second); self.assertEqual(first["operationCount"], 1)
        self.assertEqual(first["operations"][0]["path"], "users/user_12345/workouts/garmin_42")

    def test_invalid_uid_is_rejected(self):
        for uid in ("", "a/b", "x"):
            with self.assertRaises(ValueError): validate_uid(uid)

    def test_wellness_plan_uses_separate_deterministic_path(self):
        with self.store._connect() as db:
            db.execute("INSERT INTO canonical_wellness VALUES(?, ?, ?, ?, ?)", ("sleep", "2026-07-12", 1, '{\"source\":\"garmin\",\"date\":\"2026-07-12\"}', "now"))
        plan = build_wellness_plan(self.store, "user_12345")
        self.assertEqual(plan["kind"], "wellness"); self.assertEqual(plan["operations"][0]["path"], "users/user_12345/wellness_sources/garmin/2026-07-12/sleep")

    def test_firebase_key_is_safe(self):
        self.assertEqual(firebase_key("garmin", "a/b.#[]$"), "garmin_a_b_____")

    def test_export_has_no_secrets(self):
        output = Path(__file__).parent / ".firebase-runtime" / "config.json"; export_config(output)
        text = output.read_text()
        for forbidden in ("password", "session", "cookie", "email", "token"): self.assertNotIn(forbidden, text.lower())


if __name__ == "__main__": unittest.main()
