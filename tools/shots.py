import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from browser import NO_NETWORK, ROOT, Browser, serve

DOCS = ROOT / "docs"
WIDTH, HEIGHT = 1920, 1080
USUAL = ["overlay", "ludus", "duel", "pit", "results", "page"]

# общая подготовка: выдуманные гладиаторы с уровнями, характеристиками и вещами; кто-то сидит на скамье
TEAM = """
  const api = window.gladiatory, game = api.game;
  const { makeItem, RARITIES } = await import('./js/gacha.js');
  api.start();
  const names = ['Kitsune_Neko', 'Brutus', 'ЛысыйКабан', 'Spartak_88', 'MaximusTV', 'Ржавый_Гвоздь', 'Lupa', 'Crixus',
    'Феникс', 'Ironhide', 'Котлета', 'NightWolf', 'Варвар', 'Gannicus', 'Tiberius', 'Aurelia'];
  const colors = ['#ff6b5e', '#5fb4ff', '#7ee08a', '#ffc94d', '#c58cff', '#4fd6d6', '#ff8fc8', '#b8e05a', '#ff9d4d',
    '#8fa2ff', '#ffe08a', '#9ef0c8', '#f08a5d', '#a3c4ff', '#ff6b5e', '#c58cff'];
  const weapons = ['sword', 'greatsword', 'spear', 'sword', null, 'spear', 'sword', 'greatsword', 'sword', 'spear',
    null, 'sword', 'greatsword', 'spear', 'sword', 'sword'];
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  names.forEach((name, i) => {
    const login = name.toLowerCase();
    game.feed(name, 'трен', { login, color: colors[i] });
    const g = game.members.get(login);
    g.level = 1 + (i * 5) % 9;
    g.str = 1 + (i * 3) % 6;
    g.agi = 1 + (i * 2) % 5;
    g.vit = 1 + (i * 7) % 6;
    g.points = i % 4 === 0 ? 3 : 0;
    g.coins = 40 + (i * 137) % 600;
    g.fights = 5 + i * 3;
    const rarity = () => RARITIES[Math.min(RARITIES.length - 1, Math.floor(random() * random() * RARITIES.length * 1.4))];
    if (weapons[i]) g.weapon = makeItem(random, 'weapon', rarity(), weapons[i]);
    for (const slot of ['head', 'body', 'legs', 'feet']) g.gear[slot] = random() < 0.55 ? makeItem(random, 'armor', rarity(), slot) : null;
    if (i % 5 === 2 && weapons[i] !== 'greatsword') g.shield = true;
    if (i === 9) g.nets = 1;
    g.amulet = i === 3;
    g.hp = 1e6;
  });
  game.members.get('crixus').paragon = 2;
  game.members.get('ironhide').paragon = 1;
  for (const name of ['Котлета', 'Tiberius']) game.feed(name, 'отдых', { login: name.toLowerCase() });
  game.step(0.05);
  game.lines = [];
"""

PREPARE = {
    "overlay": TEAM + """
  game.forceMode = 'ffa';
  game.next();
  return game.state;
""",
    "ludus": TEAM + """
  game.forceMode = 'teams';
  game.next();
  for (let i = 0; i < 20 * 25 && game.state === 'battle'; i++) game.step(0.05);
  for (let i = 0; i < 20 * 60 && game.state !== 'ludus'; i++) game.step(0.05);
  game.forceMode = null;
  game.timer = 38;
  for (let i = 0; i < 20 * 6; i++) game.step(0.05);
  const shown = Array.from(game.members.values()).filter((g) => g.place !== 'rest').sort((a, b) => b.level - a.level)[0];
  game.feed(shown.name, 'проф', { login: shown.login });
  const lupa = game.members.get('lupa');
  if (lupa) {
    lupa.coins = 200;
    game.feed('Lupa', 'гача 2', { login: 'lupa' });
  }
  return game.state;
""",
    "duel": TEAM + """
  game.forceMode = 'duel';
  game.next();
  ['Lupa', 'Варвар', 'Феникс', 'NightWolf', 'Aurelia'].forEach((name, i) => game.feed(name, i % 2 ? '2' : '1',
    { login: name.toLowerCase() }));
  game.feed('Brutus', '2', { login: 'brutus' });
  game.timer = 4;
  return game.state;
""",
    "pit": TEAM + """
  game.forceMode = 'pit';
  game.next();
  return game.state;
""",
    "results": TEAM + """
  game.forceMode = 'ffa';
  game.next();
  for (let i = 0; i < 20 * 120 && game.state === 'battle'; i++) game.step(0.05);
  return game.state;
""",
}
WAIT = {"overlay": 20, "ludus": 4, "duel": 10, "pit": 9, "results": 1.5}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(DOCS))
    parser.add_argument("only", nargs="*")
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    server = serve(ROOT / "site")
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        with Browser(WIDTH, HEIGHT) as browser:
            browser.run_in_every_page(NO_NETWORK)
            wanted = args.only or USUAL
            for name in PREPARE:
                if name not in wanted:
                    continue
                browser.navigate(base + "/overlay.html?embed=1")
                browser.wait_for("Boolean(window.gladiatory)", 20)
                time.sleep(0.5)
                print(name + ":", browser.evaluate("(async () => {" + PREPARE[name] + "})()", wait_promise=True))
                time.sleep(WAIT[name])
                browser.screenshot(out / f"{name}.png")
                print("снято:", out / f"{name}.png")
            if "page" in wanted:
                browser.navigate(base + "/index.html")
                browser.wait_for("(() => { const f = document.getElementById('game'); "
                                 "return Boolean(f && f.contentWindow && f.contentWindow.gladiatory); })()", 20)
                time.sleep(4)
                browser.evaluate("document.getElementById('rules').open && document.getElementById('rules').close()")
                time.sleep(0.3)
                browser.screenshot(out / "page.png")
                print("снято:", out / "page.png")
            for error in browser.errors:
                print("ошибка на странице:", error)
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    main()
