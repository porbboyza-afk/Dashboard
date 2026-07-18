import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from garmin_direct.auto_sync import AlreadyRunning, firebase_executable, is_cross_source_duplicate, plan_patch, process_lock, write_status_dashboard
from garmin_direct.firebase_plan import firebase_key
from garmin_direct.sync_store import SyncStore


class AutoSyncTests(unittest.TestCase):
    def test_lock_prevents_overlapping_runs(self):
        with tempfile.TemporaryDirectory() as directory:
            lock = Path(directory) / "bridge.lock"
            with process_lock(lock):
                with self.assertRaises(AlreadyRunning):
                    with process_lock(lock):
                        pass
            self.assertFalse(lock.exists())

    def test_firebase_key_is_deterministic(self):
        self.assertEqual(firebase_key("garmin", "123"), "garmin_123")

    def test_firebase_cli_falls_back_to_user_npm_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            executable = Path(directory) / "npm" / "firebase.cmd"
            executable.parent.mkdir()
            executable.touch()
            with patch("garmin_direct.auto_sync.shutil.which", return_value=None), patch.dict("os.environ", {"APPDATA": directory}):
                self.assertEqual(firebase_executable(), str(executable))

    def test_status_dashboard_contains_sync_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            paths = unittest.mock.Mock(root=Path(directory))
            with patch("garmin_direct.auto_sync.Path.home", return_value=Path(directory) / "no-desktop"):
                target = write_status_dashboard(paths, {"status": "success", "finishedAt": "2026-07-18T10:12:22+00:00", "activityFetched": 3, "firebaseOperations": 12})
            html = target.read_text(encoding="utf-8")
            self.assertIn("SYNCED", html)
            self.assertIn("Firebase updates", html)
            self.assertIn("17:12:22 ICT", html)
            self.assertNotIn("password", html.lower())

    def test_reported_rounded_pair_is_cross_source_duplicate(self):
        garmin = {"date": "2026-07-09", "type": "run", "source": "garmin", "dist": 1.32889, "time": 8.9667}
        health = {"date": "2026-07-09", "type": "run", "source": "health_connect", "dist": 1.33, "time": 9}
        self.assertTrue(is_cross_source_duplicate(garmin, health))

    def test_plan_patch_rejects_wrong_owner(self):
        store = unittest.mock.Mock(spec=SyncStore)
        bad = {"operations": [{"op": "set", "path": "users/other/workouts/x", "value": {}}]}
        with patch("garmin_direct.auto_sync.build_plan", return_value=bad), patch("garmin_direct.auto_sync.build_wellness_plan", return_value={"operations": []}):
            with self.assertRaises(ValueError):
                plan_patch(store, "expected-user")


if __name__ == "__main__": unittest.main()
