from dataclasses import dataclass
from pathlib import Path
import os


@dataclass(frozen=True)
class BridgePaths:
    root: Path
    secrets: Path
    logs: Path
    reports: Path
    fit_archive: Path
    database: Path
    lock: Path
    session: Path

    @classmethod
    def default(cls) -> "BridgePaths":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "MyDash" / "garmin-direct"
        return cls(base, base / "secrets", base / "logs", base / "reports", base / "fit-archive", base / "bridge.sqlite", base / "bridge.lock", base / "secrets" / "session.enc")

    def ensure(self) -> None:
        for path in (self.root, self.secrets, self.logs, self.reports, self.fit_archive):
            path.mkdir(parents=True, exist_ok=True)

