import unittest
from datetime import date
from garmin_direct.wellness_normalize import normalize_wellness


DAY = date(2026, 7, 12)


class WellnessNormalizeTests(unittest.TestCase):
    def test_sleep_seconds_convert_to_minutes(self):
        value = normalize_wellness("sleep", DAY, {"dailySleepDTO": {"sleepTimeSeconds": 27000, "deepSleepSeconds": 5400, "sleepScores": {"overall": {"value": 82}}}})
        self.assertEqual((value["sleepMinutes"], value["deepSleepMinutes"], value["sleepScore"]), (450.0, 90.0, 82.0))

    def test_hrv_and_resting_hr(self):
        hrv = normalize_wellness("hrv", DAY, {"hrvSummary": {"lastNightAvg": 55, "weeklyAvg": 51, "status": "BALANCED"}})
        heart = normalize_wellness("heart_rates", DAY, {"restingHeartRate": 48, "minHeartRate": 42, "maxHeartRate": 171})
        self.assertEqual((hrv["lastNightAvgMs"], hrv["weeklyAvgMs"]), (55.0, 51.0)); self.assertEqual(heart["restingHr"], 48)

    def test_stress_seconds_and_body_battery(self):
        stress = normalize_wellness("stress", DAY, {"overallStressLevel": 31, "restStressDuration": 3600})
        battery = normalize_wellness("body_battery", DAY, {"charged": 45, "drained": 38, "bodyBatteryValuesArray": [[1, 30], [2, 67]]})
        self.assertEqual(stress["restStressDurationMin"], 60.0); self.assertEqual((battery["startLevel"], battery["endLevel"]), (30, 67))

    def test_missing_payload_is_explicit(self):
        value = normalize_wellness("sleep", DAY, {})
        self.assertFalse(value["available"]); self.assertIsNone(value["sleepMinutes"])


if __name__ == "__main__": unittest.main()
