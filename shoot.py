"""Take the 4 Nusa Airlift screenshots with Playwright Chromium (real browser captures)."""
import os
import subprocess
import time

from playwright.sync_api import sync_playwright

REPO = "/home/hatch/workspace/make-fun/best-flight-game-20261126"
OUT = os.path.join(REPO, "screenshots")
os.makedirs(OUT, exist_ok=True)

SHOTS = [
    ("1-cover.png", "http://localhost:8080/index.html?shot=cover", 6000),
    ("2-takeoff.png", "http://localhost:8080/index.html?shot=takeoff", 3500),
    ("3-storm.png", "http://localhost:8080/index.html?shot=storm", 6000),
    ("4-hangar.png", "http://localhost:8080/index.html?shot=hangar", 1500),
]

server = subprocess.Popen(
    ["node", "serve.ts"], cwd=REPO,
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)
time.sleep(1.5)
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        for name, url, wait in SHOTS:
            page.goto(url)
            page.wait_for_timeout(wait)
            path = os.path.join(OUT, name)
            page.screenshot(path=path)
            print(name, os.path.getsize(path), "bytes")
        print("console errors:", errors if errors else "none")
        browser.close()
finally:
    server.terminate()
print("done")
