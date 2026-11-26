"""Autopilot play-test: fly the cover scene to its debrief and report the result."""
import os
import subprocess
import time

from playwright.sync_api import sync_playwright

REPO = "/home/hatch/workspace/make-fun/best-flight-game-20261126"
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
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto("http://localhost:8080/index.html?shot=cover")
        # Poll the canvas pixels for the debrief panel (bright panel centre)
        # by checking game state through a screenshot-free probe: wait, then
        # screenshot and report.
        for waited in (45, 45, 45):
            page.wait_for_timeout(waited * 1000)
            page.screenshot(path="/tmp/legtest.png")
            print(f"after {waited}s more, errors:", errors if errors else "none")
        browser.close()
finally:
    server.terminate()
print("done")
