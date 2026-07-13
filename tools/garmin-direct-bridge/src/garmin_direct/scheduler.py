import subprocess
import sys
import tempfile
from pathlib import Path
from xml.etree import ElementTree as ET

from .firebase_plan import validate_uid


TASKS = (("MyDash Garmin Direct 09", "09:00:00"), ("MyDash Garmin Direct 21", "21:00:00"))
NS = "http://schemas.microsoft.com/windows/2004/02/mit/task"


def task_status() -> dict:
    states = {}
    for name, _ in TASKS:
        result = subprocess.run(["schtasks.exe", "/Query", "/TN", name, "/FO", "LIST"], capture_output=True, text=True, check=False)
        states[name] = result.returncode == 0
    return {"enabled": all(states.values()), "tasks": states}


def install_tasks(uid: str, project_root: Path) -> dict:
    validate_uid(uid)
    bridge_root = project_root / "tools" / "garmin-direct-bridge"
    if not bridge_root.exists():
        raise FileNotFoundError(f"bridge directory not found: {bridge_root}")
    for name, start_time in TASKS:
        xml = task_xml(name, start_time, uid, bridge_root)
        with tempfile.NamedTemporaryFile("wb", suffix=".xml", delete=False) as handle:
            handle.write(xml); xml_path = Path(handle.name)
        try:
            result = subprocess.run(["schtasks.exe", "/Create", "/TN", name, "/XML", str(xml_path), "/F"], capture_output=True, text=True, encoding="utf-8", errors="replace", check=False)
            if result.returncode:
                raise RuntimeError((result.stderr or result.stdout or f"Failed to create {name}").strip())
        finally:
            xml_path.unlink(missing_ok=True)
    return task_status()


def windows_identity() -> str:
    return subprocess.check_output(["whoami.exe"], text=True, encoding="utf-8", errors="replace").strip()


def task_xml(name: str, start_time: str, uid: str, bridge_root: Path) -> bytes:
    ET.register_namespace("", NS)
    task = ET.Element(f"{{{NS}}}Task", {"version": "1.4"})
    registration = ET.SubElement(task, f"{{{NS}}}RegistrationInfo")
    ET.SubElement(registration, f"{{{NS}}}Description").text = f"MyDash Garmin Direct automatic sync ({name[-2:]}:00)"
    triggers = ET.SubElement(task, f"{{{NS}}}Triggers")
    daily = ET.SubElement(triggers, f"{{{NS}}}CalendarTrigger")
    ET.SubElement(daily, f"{{{NS}}}StartBoundary").text = f"2026-01-01T{start_time}"
    ET.SubElement(daily, f"{{{NS}}}Enabled").text = "true"
    schedule = ET.SubElement(daily, f"{{{NS}}}ScheduleByDay")
    ET.SubElement(schedule, f"{{{NS}}}DaysInterval").text = "1"
    # A logon trigger catches up the missed morning run when the PC starts after 09:00.
    logon = ET.SubElement(triggers, f"{{{NS}}}LogonTrigger")
    ET.SubElement(logon, f"{{{NS}}}Enabled").text = "true"
    ET.SubElement(logon, f"{{{NS}}}UserId").text = windows_identity()
    principals = ET.SubElement(task, f"{{{NS}}}Principals")
    principal = ET.SubElement(principals, f"{{{NS}}}Principal", {"id": "Author"})
    ET.SubElement(principal, f"{{{NS}}}UserId").text = windows_identity()
    ET.SubElement(principal, f"{{{NS}}}LogonType").text = "InteractiveToken"
    ET.SubElement(principal, f"{{{NS}}}RunLevel").text = "LeastPrivilege"
    settings = ET.SubElement(task, f"{{{NS}}}Settings")
    ET.SubElement(settings, f"{{{NS}}}MultipleInstancesPolicy").text = "IgnoreNew"
    ET.SubElement(settings, f"{{{NS}}}StartWhenAvailable").text = "true"
    ET.SubElement(settings, f"{{{NS}}}ExecutionTimeLimit").text = "PT30M"
    ET.SubElement(settings, f"{{{NS}}}Enabled").text = "true"
    actions = ET.SubElement(task, f"{{{NS}}}Actions", {"Context": "Author"})
    execute = ET.SubElement(actions, f"{{{NS}}}Exec")
    ET.SubElement(execute, f"{{{NS}}}Command").text = sys.executable
    ET.SubElement(execute, f"{{{NS}}}Arguments").text = f"-m garmin_direct.cli auto-sync --uid {uid} --wellness-days 1"
    ET.SubElement(execute, f"{{{NS}}}WorkingDirectory").text = str(bridge_root)
    return ET.tostring(task, encoding="utf-16", xml_declaration=True)
