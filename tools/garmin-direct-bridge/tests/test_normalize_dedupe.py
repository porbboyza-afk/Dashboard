import unittest
from garmin_direct.normalize import canonical_activity
from garmin_direct.dedupe import decision, fingerprint


RAW = {"activityId": 42, "startTimeGMT": "2026-07-10 01:00:00", "activityType": {"typeKey": "running"}, "distance": 10000, "movingDuration": 3000, "averageHR": 150}


class NormalizeDedupeTests(unittest.TestCase):
    def test_garmin_units_and_contract(self):
        item = canonical_activity(RAW)
        self.assertEqual((item["dist"], item["time"], item["avgPace"], item["type"]), (10.0, 50.0, 5.0, "run"))
        self.assertEqual(item["startTimeUtc"], "2026-07-10T01:00:00Z")
        self.assertNotIn("password", str(item).lower())

    def test_missing_values_stay_null_not_zero(self):
        item = canonical_activity({"activityId": 1, "startTimeGMT": "2026-07-10 01:00:00", "activityType": {"typeKey": "running"}})
        self.assertIsNone(item["dist"]); self.assertIsNone(item["time"]); self.assertIsNone(item["hr"])

    def test_cross_source_near_match_is_duplicate(self):
        left = canonical_activity(RAW)
        right = dict(left, source="strava", sourceId="99", startTimeUtc="2026-07-10T01:00:30Z", dist=10.02, time=50.2)
        self.assertEqual(decision(left, right), "duplicate")
        self.assertNotEqual(fingerprint(left), fingerprint(dict(left, sourceId="other", startTimeUtc="2026-07-10T02:00:00Z")))

    def test_close_but_different_workout_is_distinct(self):
        left = canonical_activity(RAW)
        right = dict(left, source="health_connect", sourceId="x", startTimeUtc="2026-07-10T01:03:00Z", dist=5.0, time=25.0)
        self.assertEqual(decision(left, right), "distinct")

    def test_identity_is_always_duplicate(self):
        item = canonical_activity(RAW)
        self.assertEqual(decision(item, dict(item)), "duplicate")


if __name__ == "__main__": unittest.main()
