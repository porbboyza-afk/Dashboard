import unittest
from pathlib import Path
from garmin_direct.resume_worker import append_event


class ResumeWorkerTests(unittest.TestCase):
    def test_log_contains_metadata_not_credentials(self):
        path = Path(__file__).parent / ".resume-worker.jsonl"
        try:
            append_event(path, "waiting", remainingHour=0)
            text = path.read_text()
            self.assertIn('"event": "waiting"', text)
            for forbidden in ("password", "cookie", "authorization", "session.enc"): self.assertNotIn(forbidden, text.lower())
        finally:
            path.unlink(missing_ok=True)


if __name__ == "__main__": unittest.main()
