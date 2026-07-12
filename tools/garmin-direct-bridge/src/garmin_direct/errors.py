from enum import Enum


class ErrorKind(str, Enum):
    BUDGET_EXHAUSTED = "budget_exhausted"
    AUTH = "auth"
    CHALLENGED = "challenged"
    RATE_LIMITED = "rate_limited"
    TEMPORARY = "temporary"
    TIMEOUT = "timeout"
    CONTRACT_CHANGED = "contract_changed"
    UNKNOWN = "unknown"


def classify_error(exc: Exception) -> ErrorKind:
    from .budget import BudgetExceeded
    if isinstance(exc, BudgetExceeded): return ErrorKind.BUDGET_EXHAUSTED
    status = getattr(getattr(exc, "response", None), "status_code", None)
    if status == 401: return ErrorKind.AUTH
    if status == 403: return ErrorKind.CHALLENGED
    if status == 429: return ErrorKind.RATE_LIMITED
    if status and status >= 500: return ErrorKind.TEMPORARY
    name = type(exc).__name__.lower()
    if "timeout" in name: return ErrorKind.TIMEOUT
    if isinstance(exc, (KeyError, TypeError, ValueError)): return ErrorKind.CONTRACT_CHANGED
    return ErrorKind.UNKNOWN
