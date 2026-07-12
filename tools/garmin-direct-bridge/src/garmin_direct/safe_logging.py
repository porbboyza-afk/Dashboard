import json
import logging
import re
from pathlib import Path
from typing import Any

SENSITIVE = re.compile(r"(?i)(password|token|cookie|authorization|session|oauth|email)(\s*[:=]\s*)([^\s,;}]+)")
BEARER = re.compile(r"(?i)Bearer\s+[A-Za-z0-9._~+/=-]+")
SENSITIVE_KEY = re.compile(r"(?i)(password|token|cookie|authorization|session|oauth|email)")


def redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: ("[REDACTED]" if SENSITIVE_KEY.search(str(k)) else redact(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [redact(v) for v in value]
    if isinstance(value, str):
        value = BEARER.sub("Bearer [REDACTED]", value)
        return SENSITIVE.sub(r"\1\2[REDACTED]", value)
    return value


class JsonLogger:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger(f"garmin-direct:{path}")
        self.logger.setLevel(logging.INFO)
        if not self.logger.handlers:
            self.logger.addHandler(logging.FileHandler(path, encoding="utf-8"))

    def event(self, name: str, **fields: Any) -> None:
        self.logger.info(json.dumps(redact({"event": name, **fields}), ensure_ascii=True, sort_keys=True))
