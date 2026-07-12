from .budget import RequestBudget
from .errors import ErrorKind, classify_error


class ReadOnlyGarminClient:
    def __init__(self, api, budget: RequestBudget):
        self.api, self.budget = api, budget

    def call(self, method: str, *args):
        allowed = {"get_activities_by_date", "get_activity", "get_activity_details", "get_activity_splits", "get_sleep_data", "get_hrv_data", "get_heart_rates", "get_stress_data", "get_body_battery", "get_spo2_data", "download_activity"}
        if method not in allowed: raise ValueError(f"method is not read-only allowlisted: {method}")
        self.budget.acquire()
        try:
            return getattr(self.api, method)(*args)
        except Exception as exc:
            kind = classify_error(exc)
            if kind in (ErrorKind.AUTH, ErrorKind.CHALLENGED): self.budget.open_circuit(86400, kind.value)
            elif kind == ErrorKind.RATE_LIMITED: self.budget.open_circuit(900, kind.value)
            raise
