"""Кадры и GIF замахов оружия: python tools/anims.py [папка] — для проверки рисунков и анимаций на глаз."""
import base64
import io
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from browser import NO_NETWORK, ROOT, Browser, serve

TYPES = ["greatsword", "sword", "spear", "trident", "hammer", "axe"]
NAMES = {"greatsword": "Двуручный меч", "sword": "Меч", "spear": "Копьё", "trident": "Трезубец", "hammer": "Молот",
         "axe": "Секира"}
SLOW = 3
STEPS = 16
# место на поле (920×644): ряд по центру арены
X0, GAP, Y = 160, 120, 400
SETUP = """(async () => {
  const api = window.gladiatory, game = api.game;
  const { makeItem, RARITIES } = await import('./js/gacha.js');
  api.start();
  const types = %s, names = %s;
  types.forEach((type, i) => {
    game.feed('G' + i, 'трен', { login: 'g' + i, color: ['#ff6b5e', '#5fb4ff', '#7ee08a', '#ffc94d', '#c58cff', '#4fd6d6'][i] });
    const g = game.members.get('g' + i);
    g.weapon = makeItem(() => 0.5, 'weapon', RARITIES[2], type);
    g.name = names[type];
    g.hp = 1e6;
  });
  game.step(0.05);
  game.forceMode = 'ffa';
  game.next();
  game.setPaused(true);
  const css = document.createElement('style');
  css.textContent = '#pause, #banner { display: none !important; }';
  document.head.append(css);
  types.forEach((type, i) => Object.assign(game.members.get('g' + i), { x: %d + i * %d, y: %d, face: 1, walking: false,
    target: null, swing: 0, stunT: 0, blindT: 0 }));
  window.__anim = (type, anim, phase, length) => {
    types.forEach((t, i) => {
      const g = game.members.get('g' + i);
      if (!g.home) g.home = { weapon: g.weapon };
      g.weapon = g.home.weapon;
      if (anim && (type === null || t === type)) {
        Object.assign(g, { anim, animType: t, swingMax: length[t], swing: Math.max(1e-4, length[t] * (1 - phase)) });
        // копьё вылетает из руки на 0,54 броска
        if (anim === 'throw' && phase >= 0.54) g.weapon = null;
      } else g.swing = 0;
    });
  };
  return 1;
})()"""


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "anims"
    out.mkdir(parents=True, exist_ok=True)
    from PIL import Image, ImageDraw
    server = serve(ROOT / "site")
    frames = {}
    try:
        with Browser(1280, 720) as b:
            b.call("Emulation.setDeviceMetricsOverride", width=1280, height=720, deviceScaleFactor=2, mobile=False)
            b.run_in_every_page(NO_NETWORK)
            b.navigate(f"http://127.0.0.1:{server.server_address[1]}/overlay.html?embed=1")
            b.wait_for("Boolean(window.gladiatory)", 20)
            time.sleep(0.5)
            import json
            b.evaluate(SETUP % (json.dumps(TYPES), json.dumps(NAMES, ensure_ascii=False), X0, GAP, Y), wait_promise=True)
            length = b.evaluate("(async () => { const { WEAPON_TYPES, SPEAR } = await import('./js/balance.js');"
                                " return Object.fromEntries(%s.map((t) => [t, WEAPON_TYPES[t].anim])); })()" % json.dumps(TYPES),
                                wait_promise=True)
            row = {"x": 330 + X0 - 70, "y": 62 + Y - 112, "width": GAP * 5 + 140, "height": 152, "scale": 1}

            def shot():
                time.sleep(0.07)
                data = b.call("Page.captureScreenshot", format="png", clip=row)["data"]
                return Image.open(io.BytesIO(base64.b64decode(data))).convert("RGB")

            b.evaluate("window.__anim(null, null, 0, {})")
            idle = shot()
            idle.save(out / "idle.png")
            frames["hit"] = []
            for i in range(STEPS + 1):
                b.evaluate("window.__anim(null, 'hit', %f, %s)" % (i / STEPS, json.dumps(length)))
                frames["hit"].append(shot())
            spear_len = {t: 0.65 for t in TYPES}
            frames["throw"] = []
            for i in range(STEPS + 1):
                b.evaluate("window.__anim('spear', 'throw', %f, %s)" % (i / STEPS, json.dumps(spear_len)))
                frames["throw"].append(shot())
            frames["disarm"] = []
            for i in range(STEPS + 1):
                b.evaluate("window.__anim('trident', 'disarm', %f, %s)" % (i / STEPS, json.dumps(length)))
                frames["disarm"].append(shot())
            for e in b.errors:
                print("ошибка на странице:", e)
    finally:
        server.shutdown()
        server.server_close()

    # каждый боец — своя клетка шириной GAP (в пикселях снимка — вдвое)
    def cell(im, i):
        x = (70 + i * GAP - GAP // 2) * 2
        return im.crop((max(0, x), 0, x + GAP * 2, im.height))

    def gif(name, images, ms):
        hold = [images[0]] * 6 + images + [images[-1]] * 4
        hold[0].save(out / name, save_all=True, append_images=hold[1:], duration=ms, loop=0, disposal=2)

    for i, t in enumerate(TYPES):
        ms = max(20, round(length[t] * 1000 / STEPS * SLOW))
        gif(f"{t}.gif", [cell(f, i) for f in frames["hit"]], ms)
    gif("spear-throw.gif", [cell(f, TYPES.index("spear")) for f in frames["throw"]], round(650 / STEPS * SLOW))
    gif("trident-disarm.gif", [cell(f, TYPES.index("trident")) for f in frames["disarm"]],
        round(length["trident"] * 1000 / STEPS * SLOW))
    # лист: все шестеро, удар по кадрам сверху вниз (каждый четвёртый кадр)
    picks = frames["hit"][::4]
    sheet = Image.new("RGB", (idle.width, idle.height * len(picks)))
    for k, f in enumerate(picks):
        sheet.paste(f, (0, k * idle.height))
    ImageDraw.Draw(sheet)
    sheet.save(out / "hit-sheet.png")
    print("готово:", out)


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    main()
