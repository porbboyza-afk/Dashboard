import contextlib
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
PORT = 8133

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

def main():
    server = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 390, "height": 844})
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="domcontentloaded")
            page.wait_for_timeout(350)
            result = page.evaluate("""() => ({
              viewport: window.innerWidth,
              scrollWidth: document.documentElement.scrollWidth,
              menuBg: getComputedStyle(document.getElementById('mob-menu-btn')).backgroundColor,
              drawerBg: getComputedStyle(document.getElementById('mob-drawer')).backgroundColor,
              studioVisible: getComputedStyle(document.getElementById('studio-home')).display !== 'none'
            })""")
            assert result["viewport"] == 390, result
            assert result["scrollWidth"] <= 390, result
            assert result["menuBg"] != "rgb(255, 255, 255)", result
            assert result["drawerBg"] != "rgb(255, 255, 255)", result
            assert result["studioVisible"], result
            assert not errors, errors
            browser.close()
            print("Mobile layout OK", result)
    finally:
        with contextlib.suppress(Exception):
            server.shutdown()
        with contextlib.suppress(Exception):
            server.server_close()

if __name__ == "__main__":
    main()
