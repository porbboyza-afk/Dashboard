import unittest
from pathlib import Path
from garmin_direct.scheduler import task_xml


class SchedulerTests(unittest.TestCase):
    def test_xml_has_required_operational_guards(self):
        xml = task_xml("MyDash Garmin Direct 09", "09:00:00", "valid-user", Path("C:/repo/bridge")).decode("utf-16")
        self.assertIn("StartWhenAvailable", xml)
        self.assertIn("IgnoreNew", xml)
        self.assertIn("PT30M", xml)
        self.assertIn("auto-sync --uid valid-user", xml)


if __name__ == "__main__": unittest.main()
