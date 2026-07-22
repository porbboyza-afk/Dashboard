import contextlib
import http.server
import json
import socketserver
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent
PORT = 8123
URL = f"http://127.0.0.1:{PORT}/index.html"
CHROME_CANDIDATES = [
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def find_browser():
    for path in CHROME_CANDIDATES:
        if path.exists():
            return str(path)
    raise FileNotFoundError("No Chrome/Edge executable found")


def main():
    browser_path = find_browser()
    results = {
        "page_errors": [],
        "console_errors": [],
        "request_failures": [],
        "checks": {},
    }

    handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(ROOT), **kwargs)
    server = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                executable_path=browser_path,
                headless=True,
                args=["--disable-gpu", "--no-first-run", "--no-default-browser-check"],
            )
            page = browser.new_page()
            page.on("pageerror", lambda exc: results["page_errors"].append(str(exc)))
            page.on(
                "console",
                lambda msg: results["console_errors"].append(f"{msg.type}: {msg.text}")
                if msg.type == "error"
                else None,
            )
            page.on(
                "requestfailed",
                lambda req: results["request_failures"].append(
                    f"{req.method} {req.url} :: {req.failure}"
                ),
            )

            page.goto(URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            results["checks"]["document_title"] = page.title()
            results["checks"]["has_showPage"] = page.evaluate("typeof showPage === 'function'")
            results["checks"]["has_mdToHtml"] = page.evaluate("typeof mdToHtml === 'function'")
            results["checks"]["has_training_analyst"] = page.evaluate("typeof window.MyDashTrainingAnalyst?.analyzePeriod === 'function'")
            results["checks"]["has_stravaLocalDateStr"] = page.evaluate("typeof stravaLocalDateStr === 'function'")
            results["checks"]["strava_local_date"] = page.evaluate(
                "stravaLocalDateStr({start_date_local:'2026-06-21T18:00:00Z'})"
            )
            results["checks"]["md_render"] = page.evaluate("mdToHtml('## Test\\n**ok**')")

            page.evaluate("showPage('today')")
            page.wait_for_timeout(300)
            results["checks"]["today_active"] = page.evaluate(
                "document.getElementById('page-today')?.classList.contains('active')"
            )

            page.evaluate("showPage('strava')")
            page.wait_for_timeout(300)
            results["checks"]["strava_active"] = page.evaluate(
                "document.getElementById('page-strava')?.classList.contains('active')"
            )

            page.evaluate("showPage('wellness')")
            page.wait_for_timeout(300)
            results["checks"]["wellness_active"] = page.evaluate(
                "document.getElementById('page-wellness')?.classList.contains('active')"
            )

            page.evaluate("showPage('fitness-stats')")
            page.wait_for_timeout(300)
            results["checks"]["fitness_stats_active"] = page.evaluate(
                "document.getElementById('page-fitness-stats')?.classList.contains('active')"
            )

            page.evaluate("showPage('post-run-review')")
            page.wait_for_timeout(300)
            results["checks"]["post_run_review_active"] = page.evaluate(
                "document.getElementById('page-post-run-review')?.classList.contains('active')"
            )

            page.evaluate("showPage('coach')")
            page.wait_for_timeout(300)
            results["checks"]["coach_active"] = page.evaluate(
                "document.getElementById('page-coach')?.classList.contains('active')"
            )
            results["checks"]["has_manual_plan_builder"] = page.evaluate(
                "typeof window.MyDashManualPlan?.createPlan === 'function' && typeof addManualPlanSession === 'function'"
            )
            results["checks"]["manual_plan_draft"] = page.evaluate(
                """(() => {
                    toggleManualPlanBuilder();
                    document.getElementById('manual-session-date').value = '2026-08-25';
                    document.getElementById('manual-session-type').value = 'Easy';
                    document.getElementById('manual-session-distance').value = '6';
                    document.getElementById('manual-session-title').value = 'Smoke test easy run';
                    addManualPlanSession();
                    return {
                        visible: document.getElementById('manual-plan-builder').style.display === 'block',
                        save_enabled: !document.getElementById('btn-save-manual-plan').disabled,
                        text: document.getElementById('manual-plan-draft').textContent,
                    };
                })()"""
            )

            page.evaluate("showPage('settings')")
            page.wait_for_timeout(300)
            results["checks"]["settings_active"] = page.evaluate(
                "document.getElementById('page-settings')?.classList.contains('active')"
            )

            browser.close()
    finally:
        with contextlib.suppress(Exception):
            server.shutdown()
        with contextlib.suppress(Exception):
            server.server_close()

    print(json.dumps(results, ensure_ascii=False, indent=2))

    bad = bool(results["page_errors"])
    critical_console = [
        item for item in results["console_errors"]
        if "favicon" not in item.lower()
    ]
    if critical_console:
        bad = True

    expected_true = [
        "has_showPage",
        "has_mdToHtml",
        "has_training_analyst",
        "has_stravaLocalDateStr",
        "today_active",
        "strava_active",
        "wellness_active",
        "fitness_stats_active",
        "post_run_review_active",
        "coach_active",
        "has_manual_plan_builder",
        "settings_active",
    ]
    for key in expected_true:
        if results["checks"].get(key) is not True:
            bad = True

    if results["checks"].get("strava_local_date") != "2026-06-21":
        bad = True

    if "<strong>ok</strong>" not in results["checks"].get("md_render", ""):
        bad = True

    manual_draft = results["checks"].get("manual_plan_draft", {})
    if not manual_draft.get("visible") or not manual_draft.get("save_enabled"):
        bad = True
    if "Smoke test easy run" not in manual_draft.get("text", ""):
        bad = True

    raise SystemExit(1 if bad else 0)


if __name__ == "__main__":
    main()
