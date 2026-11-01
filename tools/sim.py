"""Симулятор баланса: python tools/sim.py [weapons,ffa,hands,stats,pit,paragon] — бои идут в скрытом браузере."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from browser import NO_NETWORK, ROOT, Browser, serve


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else ""
    server = serve(ROOT)
    try:
        with Browser() as browser:
            browser.run_in_every_page(NO_NETWORK)
            browser.navigate(f"http://127.0.0.1:{server.server_address[1]}/tools/sim.html")
            browser.wait_for("document.readyState === 'complete'", 20)
            report = browser.evaluate(f"import('./sim.js').then((m) => m.run({only!r}))", wait_promise=True)
            print(report)
            for error in browser.errors:
                print("ошибка на странице:", error)
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    main()
