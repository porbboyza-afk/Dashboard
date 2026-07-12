from dataclasses import dataclass
from enum import Enum
from getpass import getpass
from pathlib import Path
from typing import Callable, Protocol


class AuthStatus(str, Enum):
    VALID = "valid"
    AUTH_REQUIRED = "auth_required"
    MFA_REQUIRED = "mfa_required"
    AUTH_REJECTED = "auth_rejected"
    ACCOUNT_CHALLENGE = "account_challenge"
    SESSION_CORRUPT = "session_corrupt"


class SecretStore(Protocol):
    def save(self, value: str) -> None: ...
    def load(self) -> str | None: ...
    def clear(self) -> None: ...


@dataclass
class DpapiSecretStore:
    path: Path

    def save(self, value: str) -> None:
        import win32crypt
        self.path.parent.mkdir(parents=True, exist_ok=True)
        encrypted = win32crypt.CryptProtectData(value.encode(), "MyDash Garmin session", None, None, None, 0)
        self.path.write_bytes(encrypted)

    def load(self) -> str | None:
        if not self.path.exists():
            return None
        import win32crypt
        return win32crypt.CryptUnprotectData(self.path.read_bytes(), None, None, None, 0)[1].decode()

    def clear(self) -> None:
        self.path.unlink(missing_ok=True)


class GarminAuthAdapter:
    def __init__(self, store: SecretStore, mfa_prompt: Callable[[], str] | None = None):
        self.store = store
        self.mfa_prompt = mfa_prompt or (lambda: getpass("Garmin MFA code: "))

    def login_interactive(self):
        from garminconnect import Garmin
        email = input("Garmin email: ").strip()
        password = getpass("Garmin password: ")
        api = Garmin(email, password, prompt_mfa=self.mfa_prompt, retry_attempts=1)
        api.login()
        self.store.save(api.client.dumps())
        return api

    def restore(self):
        from garminconnect import Garmin
        session = self.store.load()
        if not session:
            return None
        api = Garmin(retry_attempts=1)
        try:
            api.login(session)
            self.store.save(api.client.dumps())
            return api
        except Exception:
            raise
