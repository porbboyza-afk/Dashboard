from datetime import date, timedelta
from .errors import classify_error
from .sync_store import SyncStore


DAILY_DOMAINS = {"sleep": "get_sleep_data", "hrv": "get_hrv_data", "heart_rates": "get_heart_rates", "stress": "get_stress_data", "spo2": "get_spo2_data"}


class WellnessSync:
    def __init__(self, client, store: SyncStore):
        self.client, self.store = client, store

    def run_domain(self, domain: str, days: int = 3, full: bool = False) -> dict:
        if domain not in {*DAILY_DOMAINS, "body_battery"}: raise ValueError(f"unsupported wellness domain: {domain}")
        end = date.today(); cursor = self.store.cursor(domain)
        start = end - timedelta(days=days - 1) if full or not cursor else max(end - timedelta(days=days - 1), cursor - timedelta(days=1))
        run_id = self.store.begin_run(domain, start, end)
        try:
            if domain == "body_battery":
                payload = self.client.call("get_body_battery", start.isoformat(), end.isoformat())
                records = []
                for item in payload if isinstance(payload, list) else []:
                    item_date = date.fromisoformat(str(item.get("date"))) if isinstance(item, dict) and item.get("date") else None
                    if item_date and start <= item_date <= end: records.append((item_date, item))
            else:
                records = []
                current = start
                while current <= end:
                    records.append((current, self.client.call(DAILY_DOMAINS[domain], current.isoformat())))
                    current += timedelta(days=1)
            counts = self.store.commit_wellness(run_id, domain, records, end)
            return {"domain": domain, "runId": run_id, "windowStart": start.isoformat(), "windowEnd": end.isoformat(), "totalStored": self.store.wellness_count(domain), **counts}
        except Exception as exc:
            self.store.fail_run(run_id, classify_error(exc).value)
            raise

    def run_all(self, days: int = 3) -> list[dict]:
        return [self.run_domain(domain, days) for domain in (*DAILY_DOMAINS, "body_battery")]
