import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path


class BudgetExceeded(RuntimeError): pass


class RequestBudget:
    def __init__(self, database: Path, hourly: int = 30, daily: int = 200, spacing: float = 2.0):
        self.database, self.hourly, self.daily, self.spacing = database, hourly, daily, spacing
        database.parent.mkdir(parents=True, exist_ok=True)
        with self._db() as db:
            db.execute("CREATE TABLE IF NOT EXISTS request_events (at REAL NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS circuit_state (id INTEGER PRIMARY KEY CHECK(id=1), open_until REAL NOT NULL, reason TEXT NOT NULL)")

    def _db(self):
        db = sqlite3.connect(self.database, timeout=5)
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA busy_timeout=5000")
        return db

    def acquire(self) -> None:
        now = time.time()
        with self._db() as db:
            circuit = db.execute("SELECT open_until, reason FROM circuit_state WHERE id=1").fetchone()
            if circuit and circuit[0] > now: raise BudgetExceeded(f"circuit open: {circuit[1]}")
            db.execute("DELETE FROM request_events WHERE at < ?", (now - 86400,))
            hour = db.execute("SELECT COUNT(*) FROM request_events WHERE at >= ?", (now - 3600,)).fetchone()[0]
            day = db.execute("SELECT COUNT(*) FROM request_events").fetchone()[0]
            last = db.execute("SELECT MAX(at) FROM request_events").fetchone()[0]
            if hour >= self.hourly or day >= self.daily: raise BudgetExceeded("request budget exhausted")
            if last and now - last < self.spacing: time.sleep(self.spacing - (now - last))
            db.execute("INSERT INTO request_events(at) VALUES (?)", (time.time(),))

    def open_circuit(self, seconds: int, reason: str) -> None:
        with self._db() as db:
            db.execute("INSERT OR REPLACE INTO circuit_state(id, open_until, reason) VALUES(1, ?, ?)", (time.time() + seconds, reason))

    def status(self) -> dict:
        now = time.time()
        with self._db() as db:
            hour_times = [row[0] for row in db.execute("SELECT at FROM request_events WHERE at >= ? ORDER BY at", (now - 3600,))]
            day_count = db.execute("SELECT COUNT(*) FROM request_events WHERE at >= ?", (now - 86400,)).fetchone()[0]
            circuit = db.execute("SELECT open_until, reason FROM circuit_state WHERE id=1").fetchone()
        next_at = hour_times[0] + 3600 if len(hour_times) >= self.hourly else now
        if circuit and circuit[0] > next_at: next_at = circuit[0]
        return {"usedLastHour": len(hour_times), "remainingLastHour": max(0, self.hourly - len(hour_times)), "usedLastDay": day_count, "remainingLastDay": max(0, self.daily - day_count), "nextAvailableAt": datetime.fromtimestamp(next_at, timezone.utc).isoformat(), "circuitReason": circuit[1] if circuit and circuit[0] > now else None}
