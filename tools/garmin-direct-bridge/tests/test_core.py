import shutil
import unittest
from pathlib import Path

from garmin_direct.budget import BudgetExceeded, RequestBudget
from garmin_direct.capability_probe import schema
from garmin_direct.auth import DpapiSecretStore
from garmin_direct.safe_logging import redact
from garmin_direct.errors import ErrorKind, classify_error
from garminconnect import Garmin
from unittest.mock import Mock
from garmin_direct.client import ReadOnlyGarminClient


class CoreTests(unittest.TestCase):
    def test_budget_error_is_actionable(self):
        self.assertEqual(classify_error(BudgetExceeded("request budget exhausted")), ErrorKind.BUDGET_EXHAUSTED)
    def test_pinned_library_exposes_original_download_format(self):
        self.assertIsInstance(Garmin.ActivityDownloadFormat.ORIGINAL, Garmin.ActivityDownloadFormat)

    def test_dpapi_round_trip(self):
        path = Path(__file__).parent / ".runtime-session.enc"
        store = DpapiSecretStore(path)
        try:
            store.save("session-test-value")
            self.assertNotIn(b"session-test-value", path.read_bytes())
            self.assertEqual(store.load(), "session-test-value")
        finally:
            store.clear()

    def test_redaction(self):
        text = str(redact({"email": "a@b.com", "header": "Authorization: Bearer abc"}))
        self.assertNotIn("a@b.com", text); self.assertNotIn("abc", text)

    def test_schema_has_no_values(self):
        result = schema({"pace": 321, "name": "private"})
        self.assertNotIn("321", str(result)); self.assertNotIn("private", str(result))

    def test_spo2_is_read_only_allowlisted(self):
        api, budget = Mock(), Mock(); api.get_spo2_data.return_value = {"averageSpO2": 96}
        self.assertEqual(ReadOnlyGarminClient(api, budget).call("get_spo2_data", "2026-07-12")["averageSpO2"], 96)
        budget.acquire.assert_called_once()

    def test_budget_persists(self):
        temp = Path(__file__).parent / ".runtime"
        shutil.rmtree(temp, ignore_errors=True); temp.mkdir(exist_ok=True)
        try:
            budget = RequestBudget(temp / "b.sqlite", hourly=1, daily=1, spacing=0)
            budget.acquire()
            with self.assertRaises(BudgetExceeded): RequestBudget(temp / "b.sqlite", hourly=1, daily=1, spacing=0).acquire()
            state = budget.status(); self.assertEqual(state["remainingLastHour"], 0); self.assertEqual(state["usedLastHour"], 1)
        finally:
            shutil.rmtree(temp, ignore_errors=True)


if __name__ == "__main__": unittest.main()
