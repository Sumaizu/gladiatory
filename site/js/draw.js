import { TEAMS, maxHp } from './balance.js';
import { ARENA, BAYS, BAY_W, COLUMNS, DUMMIES, FIELD_H, FIELD_W, bayX } from './places.js';
import { tierOf } from './gacha.js';
import { RAINBOW, RAINBOW_CYCLE, RAINBOW_W, SNOW_CYCLE, STAR_COLORS, starOf } from './stars.js';
import { LION, P, SPRITE, darker, drawDummyArt, lionSprite, sandTexel, gladiatorSprite, lookOf, lyingSprite, netHandSprite, netOverSprite, netSprite, paintLudusArt, sandSprite, shieldLookOf, shieldSprite, weaponSprite } from './art.js';

const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';
const SKIN = ['#f0c79e', '#e2b48a', '#c98f62', '#a86e46', '#7d4f32'];

function seeded(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashOf(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  return '#' + ((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0');
}

// таблички рисуются чётко поверх пиксельного мира: при закраске фона их только запоминаем
let signs = null;

function plaque(ctx, x, y, text, size = 15, tone = '#6b4426') {
  if (signs) {
    signs.push([x, y, text, size, tone]);
    return;
  }
  ctx.font = '800 ' + size + 'px ' + FONT;
  const w = ctx.measureText(text).width + 22, h = size + 12;
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  roundRect(ctx, x - w / 2 + 2, y - h / 2 + 3, w, h, 6);
  ctx.fill();
  const grad = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  grad.addColorStop(0, shade(tone, 0.18));
  grad.addColorStop(1, shade(tone, -0.18));
  ctx.fillStyle = grad;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = shade(tone, -0.45);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff3dc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
}

function column(ctx, x, y, h, tone = '#efe6d6') {
  ctx.fillStyle = shade(tone, -0.12);
  ctx.fillRect(x - 6, y, 12, 4);
  ctx.fillRect(x - 6, y + h - 4, 12, 4);
  const grad = ctx.createLinearGradient(x - 4, 0, x + 4, 0);
  grad.addColorStop(0, shade(tone, -0.1));
  grad.addColorStop(0.5, tone);
  grad.addColorStop(1, shade(tone, -0.25));
  ctx.fillStyle = grad;
  ctx.fillRect(x - 4, y + 4, 8, h - 8);
}

// --- лудус: вид сбоку, как в Domina; текстуры и спрайты — в art.js ---

export function paintLudus(ctx) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const signs = paintLudusArt(ctx);
  ctx.restore();
  return signs;
}

export function drawSigns(ctx, list) {
  for (const [x, y, text, size, tone] of list) plaque(ctx, x, y, text, size, tone);
}

export function drawLudusLife(ctx, t, dummyHits) {
  DUMMIES.forEach((d, i) => drawDummyArt(ctx, d.kind, d.x, d.y, dummyHits[i] || 0, t));
  // факелы на колоннах
  for (const cx of COLUMNS.slice(1, -1)) {
    const f = 0.7 + 0.3 * Math.sin(t * 11 + cx);
    ctx.fillStyle = '#3a2418';
    ctx.fillRect(cx + 12, 124, 4, 14);
    ctx.fillRect(cx + 10, 122, 8, 3);
    const tg = ctx.createRadialGradient(cx + 14, 116, 1, cx + 14, 116, 30);
    tg.addColorStop(0, 'rgba(255,200,90,' + (0.55 * f).toFixed(3) + ')');
    tg.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = tg;
    ctx.fillRect(cx - 16, 86, 60, 60);
    ctx.fillStyle = '#ff9a3c';
    ctx.fillRect(cx + 10, 112 - f * 4, 8, 10 + f * 4);
    ctx.fillStyle = '#ffe08a';
    ctx.fillRect(cx + 12, 116 - f * 2, 4, 6 + f * 2);
  }
}

export function drawSoon(ctx, t) {
  // табличка «скоро» у лудильни
  const tx = bayX(2) + BAY_W / 2, ty = 106;
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(-0.06);
  const pulse = 1 + 0.04 * Math.sin(t * 3);
  ctx.scale(pulse, pulse);
  ctx.font = '900 13px ' + FONT;
  ctx.fillStyle = '#e8b93c';
  roundRect(ctx, -58, -12, 116, 24, 12);
  ctx.fill();
  ctx.fillStyle = '#3a2804';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('гача · 30 монет', 0, 1);
  ctx.restore();
}

function crowd(ctx, random, cx, cy, rx, ry, rows, gap) {
  const people = [];
  for (let r = 0; r < rows; r++) {
    const ex = rx + r * gap, ey = ry + r * gap * 0.75;
    const n = Math.floor((ex + ey) * Math.PI / 9);
    for (let i = 0; i < n; i++) {
      const a = (i + random() * 0.6) / n * Math.PI * 2;
      const x = cx + Math.cos(a) * ex, y = cy + Math.sin(a) * ey;
      if (x < -6 || x > FIELD_W + 6 || y < -6 || y > FIELD_H + 6) continue;
      if (random() < 0.3) continue;
      people.push({ x, y, skin: SKIN[Math.floor(random() * SKIN.length)],
        cloth: ['#9a5a50', '#c9bfae', '#5c6f93', '#b39255', '#76648f', '#5f7d62', '#d3cabb'][Math.floor(random() * 7)],
        phase: random() * Math.PI * 2 });
    }
  }
  return people;
}

export function paintArena(ctx) {
  const random = seeded(11);
  const a = ARENA;
  ctx.fillStyle = '#5c4d40';
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  // трибуны
  for (let r = 14; r >= 0; r--) {
    ctx.fillStyle = r % 2 ? '#5e5045' : '#685a4d';
    ctx.beginPath();
    ctx.ellipse(a.cx, a.cy, a.rx + 22 + r * 18, a.ry + 22 + r * 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const people = crowd(ctx, random, a.cx, a.cy, a.rx + 34, a.ry + 32, 12, 17)
    .filter((p) => Math.abs(p.x - a.cx) > 92 || p.y > a.cy - a.ry - 12);
  // императорская ложа
  const boxTop = 8, boxBottom = a.cy - a.ry - 16;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(a.cx - 86, boxTop + 6, 176, boxBottom - boxTop);
  ctx.fillStyle = '#3a1c33';
  ctx.fillRect(a.cx - 84, boxTop, 168, boxBottom - boxTop);
  for (let i = 0; i < 4; i++) column(ctx, a.cx - 66 + i * 44, boxTop + 26, boxBottom - boxTop - 44, '#efe6d6');
  ctx.fillStyle = '#7a2a66';
  ctx.fillRect(a.cx - 90, boxTop, 180, 22);
  ctx.fillStyle = '#d9a441';
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.arc(a.cx - 80 + i * 20, boxTop + 22, 10, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = '#7a2a66';
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.arc(a.cx - 80 + i * 20, boxTop + 21, 8, 0, Math.PI);
    ctx.fill();
  }
  const rail = ctx.createLinearGradient(0, boxBottom - 20, 0, boxBottom);
  rail.addColorStop(0, '#e9dcc4');
  rail.addColorStop(1, '#b9a98b');
  ctx.fillStyle = rail;
  ctx.fillRect(a.cx - 90, boxBottom - 20, 180, 20);
  ctx.fillStyle = '#d9a441';
  ctx.fillRect(a.cx - 90, boxBottom - 20, 180, 3);
  ctx.fillStyle = '#7a2a66';
  ctx.fillRect(a.cx - 14, boxBottom - 17, 28, 14);
  // стена арены
  ctx.fillStyle = '#c9b79c';
  ctx.beginPath();
  ctx.ellipse(a.cx, a.cy, a.rx + 22, a.ry + 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9b3a2e';
  ctx.beginPath();
  ctx.ellipse(a.cx, a.cy, a.rx + 12, a.ry + 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // песок — как в лудусе: тёплый, в дымке, светлее к середине; у стены мягкая тень
  const sand = document.createElement('canvas');
  sand.width = FIELD_W;
  sand.height = FIELD_H;
  const sctx = sand.getContext('2d'), img = sctx.createImageData(FIELD_W, FIELD_H);
  for (let y = Math.floor(a.cy - a.ry); y <= a.cy + a.ry; y++) {
    for (let x = Math.floor(a.cx - a.rx); x <= a.cx + a.rx; x++) {
      const dx = (x + 0.5 - a.cx) / a.rx, dy = (y + 0.5 - a.cy) / a.ry, d = dx * dx + dy * dy;
      if (d > 1.02 || x < 0 || y < 0 || x >= FIELD_W || y >= FIELD_H) continue;
      const edge = Math.sqrt(d), [r, g, b] = sandTexel(x, y, 0.85 - 0.6 * edge * edge);
      const shade = 1 - 0.13 * Math.pow(Math.max(0, edge - 0.78) / 0.22, 1.6) - 0.04 * Math.max(0, -dy);
      img.data.set([r * shade, g * shade, b * shade, 255], (y * FIELD_W + x) * 4);
    }
  }
  sctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(a.cx, a.cy, a.rx, a.ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(sand, 0, 0);
  ctx.restore();
  // знамёна по стене
  for (let i = 0; i < 12; i++) {
    const ang = i / 12 * Math.PI * 2 + Math.PI / 12;
    const x = a.cx + Math.cos(ang) * (a.rx + 17), y = a.cy + Math.sin(ang) * (a.ry + 17);
    ctx.fillStyle = i % 2 ? '#d9a441' : '#7a2f24';
    ctx.fillRect(x - 5, y - 14, 10, 16);
    ctx.fillStyle = '#5b4a3a';
    ctx.fillRect(x - 1, y - 18, 2, 6);
  }
  return people;
}

export function drawCrowd(ctx, people, t, roar) {
  for (const p of people) {
    const jump = Math.max(0, Math.sin(t * (4 + roar * 6) + p.phase)) * (1 + roar * 3);
    ctx.fillStyle = p.cloth;
    ctx.fillRect(p.x - 3, p.y - 2 - jump, 6, 5);
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 4.5 - jump, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- гладиатор ---

// --- руки: рисуются поверх фигуры от плеча к кисти и двигаются вместе с оружием ---

const lerp = (a, b, k) => a + (b - a) * k;
const at = (p, q, k) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k)];
const SHOULDER = { far: [11, 13], near: [15, 13] };

// позы и замахи по ключевым кадрам: [доля анимации, правая кисть (в координатах спрайта: ступни на y = 39, центр
// x = 12, смотрит вправо), наклон оружия (0 — вверх, по часовой — вперёд)]. Первый кадр — поза в покое.
// two — на сколько пикселей вдоль рукояти ниже правой держит левая рука (у двуручного)
const HALF_PI = Math.PI / 2;
export const ANIMS = {
  // гладиус: правой рукой чуть перед собой; удар — с правого плеча наискось вперёд-вниз
  sword: { hit: [[0, [16, 21], 0.55], [0.14, [12, 13], -0.7], [0.3, [22, 20], 2.05], [0.55, [21, 21], 2.2], [1, [16, 21], 0.55]] },
  // двуручный меч: обеими руками у груди, клинок лежит на правом плече; удар — с плеча через верх наискось вниз перед собой
  greatsword: { two: 4, hit: [[0, [15, 22], -0.62], [0.15, [13, 15], -1.05], [0.3, [21, 23], 2.15], [0.6, [21, 24], 2.4],
    [1, [15, 22], -0.62]] },
  // секира: на правом плече; удар — поднять над головой и рубануть сверху вниз
  axe: { two: 4, hit: [[0, [15, 22], -0.78], [0.16, [14, 10], -0.12], [0.3, [21, 22], 1.95], [0.6, [21, 23], 2.1],
    [1, [15, 22], -0.78]] },
  // молот: обеими руками перед грудью, стоит вертикально (голова — перед лицом, не на нём); удар — завести за спину
  // и через верх обрушить вниз перед собой
  hammer: { two: 4, hit: [[0, [18, 24], 0.1], [0.12, [11, 16], -2.55], [0.21, [13, 8], -0.35], [0.3, [21, 23], 1.95],
    [0.62, [21, 24], 2.05], [1, [18, 24], 0.1]] },
  // копьё: правой рукой за середину древка, стоймя; удар — опустить и ткнуть вперёд, выбросив кисть;
  // бросок — рука над головой, отвести назад и метнуть с замахом (копьё вылетает на 0,54 анимации)
  spear: { hit: [[0, [15, 21], 0.12], [0.12, [11, 20], HALF_PI], [0.3, [23, 19], HALF_PI], [0.55, [20, 20], HALF_PI],
    [1, [15, 21], 0.12]],
    throw: [[0, [15, 21], 0.12], [0.22, [11, 7], 1.45], [0.48, [6, 7], 1.3], [0.56, [21, 8], 1.65], [0.8, [20, 16], 1.8],
      [1, [15, 21], 0.12]] },
  // трезубец: за середину древка; удар — снизу вперёд-вверх; выбивая оружие — ткнуть вперёд-вверх и резко рвануть
  // на себя и назад
  trident: { hit: [[0, [15, 21], 0.25], [0.13, [13, 25], 2.25], [0.3, [22, 17], 1.15], [0.55, [21, 18], 1.25],
    [1, [15, 21], 0.25]],
    disarm: [[0, [15, 21], 0.25], [0.18, [22, 15], 1.05], [0.36, [8, 14], -0.65], [0.7, [10, 17], -0.35],
      [1, [15, 21], 0.25]] },
};
// бросок сети или мешка — левой рукой: отвести и швырнуть вперёд
const TOSS = [[0, [17, 17]], [0.3, [12, 10]], [0.55, [23, 13]], [1, [17, 17]]];

const ease = (k) => k * k * (3 - 2 * k);
// где кисть и как повёрнуто оружие в долю phase анимации
export function pose(keys, phase) {
  let i = 0;
  while (i < keys.length - 2 && phase > keys[i + 1][0]) i++;
  const [t0, h0, r0] = keys[i], [t1, h1, r1] = keys[i + 1];
  const k = ease(Math.max(0, Math.min(1, (phase - t0) / Math.max(1e-6, t1 - t0))));
  return { hand: at(h0, h1, k), turn: r0 === undefined ? 0 : lerp(r0, r1, k) };
}

function limb(ctx, from, to, color, guard = null) {
  const n = Math.max(2, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) * 1.5));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    ctx.fillStyle = guard && k < 0.55 ? guard : color;
    ctx.fillRect(Math.round(lerp(from[0], to[0], k)) - 1, Math.round(lerp(from[1], to[1], k)) - 1, 2, 2);
  }
}

function fist(ctx, p, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(p[0]) - 1, Math.round(p[1]) - 1, 3, 3);
  ctx.fillStyle = darker(color, 0.75);
  ctx.fillRect(Math.round(p[0]) - 1, Math.round(p[1]) + 1, 3, 1);
}

function drawArms(ctx, g, look, bob) {
  const skin = look.skin, skinD = darker(skin, 0.8), guard = '#3f3833';
  const length = g.swingMax || 0.3, phase = g.swing > 0 ? 1 - g.swing / length : 0;
  ctx.save();
  ctx.translate(-SPRITE.x, -SPRITE.foot - bob);
  // что в руке: оружие; после броска копья (рука ещё доводит замах) — пустая рука по кадрам копья
  const type = g.weapon ? g.weapon.type : g.swing > 0 && g.anim === 'throw' ? 'spear' : 'fists';
  if (type === 'fists') {
    // кулаки: дальний чуть выше, ближний ниже; бьют по очереди
    const swing = g.swing > 0 && g.anim === 'hit' ? Math.sin(phase * Math.PI) : 0;
    const jab = (g.jab || 0) % 2;
    const far = jab === 0 ? at([16, 14], [23, 13], swing) : [16, 14];
    const near = jab === 1 ? at([18, 17], [24, 15], swing) : [18, 17];
    limb(ctx, SHOULDER.far, far, skinD);
    fist(ctx, far, skinD);
    limb(ctx, SHOULDER.near, near, skin);
    fist(ctx, near, skin);
    ctx.restore();
    return;
  }
  const anim = ANIMS[type] || ANIMS.sword;
  const keys = g.swing > 0 && anim[g.anim] && (g.animType || type) === type ? anim[g.anim] : anim.hit;
  const { hand, turn } = pose(keys, g.swing > 0 && keys !== anim.hit || g.anim === 'hit' ? phase : 0);
  const weaponAt = () => {
    if (!g.weapon) return;
    const art = weaponSprite(type, tierOf(g.weapon));
    ctx.save();
    ctx.translate(Math.round(hand[0]), Math.round(hand[1]));
    ctx.rotate(turn);
    ctx.scale(art.k, art.k);
    ctx.drawImage(art.canvas, -art.px, -art.py);
    ctx.restore();
  };
  if (anim.two) {
    // двуручное — обеими руками: правая у гарды, левая ниже по рукояти
    const low = [hand[0] - Math.sin(turn) * anim.two, hand[1] + Math.cos(turn) * anim.two];
    limb(ctx, SHOULDER.far, hand, skinD, guard);
    fist(ctx, hand, skinD);
    weaponAt();
    limb(ctx, SHOULDER.near, low, skin);
    fist(ctx, low, skin);
    ctx.restore();
    return;
  }
  limb(ctx, SHOULDER.far, hand, skinD, guard);
  weaponAt();
  fist(ctx, hand, skinD);
  // левая рука: щит, моток сети, мешок или пустая у груди; бросая сеть или мешок — замах вперёд
  const tossing = g.swing > 0 && g.anim === 'toss';
  const rest = tossing ? pose(TOSS, phase).hand : null;
  if (look.shield !== 'none') {
    const pos = [17 + (g.swing > 0 && g.anim === 'hit' ? Math.sin(phase * Math.PI) : 0), 17];
    limb(ctx, SHOULDER.near, pos, skin);
    const art = shieldSprite(look.shield, look.design, look.color);
    ctx.drawImage(art, Math.round(pos[0] - art.width / 2 + 1), Math.round(pos[1] - art.height / 2));
  } else if (look.net && !tossing) {
    const pos = [17, 16];
    limb(ctx, SHOULDER.near, pos, skin);
    ctx.drawImage(netHandSprite(), Math.round(pos[0]) - 4, Math.round(pos[1]) - 1);
    fist(ctx, pos, skin);
  } else if (look.sand && !tossing) {
    const pos = [17, 18];
    limb(ctx, SHOULDER.near, pos, skin);
    ctx.drawImage(sandSprite(), Math.round(pos[0]) - 4, Math.round(pos[1]) - 1);
    fist(ctx, pos, skin);
  } else {
    const pos = rest || [17, 17];
    limb(ctx, SHOULDER.near, pos, skin);
    fist(ctx, pos, skin);
  }
  ctx.restore();
}

function drawLion(ctx, g, t) {
  const dead = g.fate !== 'fight';
  const frame = dead ? 'dead' : g.swing > 0 ? 'pounce' : g.walking ? (Math.sin(t * 9 + g.x) > 0 ? 'walk1' : 'walk2') : 'stand';
  // лев в высоком разрешении: пиксель рисунка — пиксель поля
  const x = Math.round(g.x), y = Math.round(g.y);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(60,35,15,.22)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 40, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale((g.face < 0 ? -1 : 1) * LION.scale, LION.scale);
  ctx.drawImage(lionSprite(frame), -LION.x, -LION.foot);
  ctx.restore();
}

export function drawGladiator(ctx, g, t, scene) {
  if (g.lion) {
    drawLion(ctx, g, t);
    if (scene === 'arena') drawStatus(ctx, g, t);
    return;
  }
  const fate = scene === 'arena' ? g.fate : null;
  const pose = scene === 'ludus' && !g.walking ? g.pose : null;
  const lying = fate === 'down' || fate === 'dead' || pose === 'lie';
  const seed = hashOf(g.login);
  const look = lookOf(g, seed);
  let frame = 'stand';
  if (pose === 'sit') frame = 'sit';
  else if (g.walking && !lying) frame = Math.sin(t * 10 + seed) > 0 ? 'walk1' : 'walk2';
  const sprite = gladiatorSprite(look, frame, fate === 'dead', g.flash > 0.08 && !lying);
  const x = Math.round(g.x / P) * P, y = Math.round(g.y / P) * P;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(P, P);
  ctx.fillStyle = 'rgba(30,15,8,.3)';
  ctx.fillRect(lying ? -16 : -8, -1, lying ? 32 : 16, 3);
  if (fate === 'dead') {
    ctx.fillStyle = '#7a1414';
    ctx.fillRect(-12, -1, 22, 4);
    ctx.fillRect(-9, 3, 14, 1);
  }
  if (lying) {
    if (g.face < 0 && pose !== 'lie') ctx.scale(-1, 1);
    ctx.drawImage(lyingSprite(look, pose === 'lie', fate === 'dead'), -12, pose === 'lie' ? -8 : -8);
    ctx.restore();
    return;
  }
  ctx.scale(g.face < 0 ? -1 : 1, 1);
  const bob = g.walking ? (frame === 'walk1' ? 1 : 0) : 0;
  ctx.drawImage(sprite, -SPRITE.x, -SPRITE.foot - bob);
  if (frame === 'stand' || frame === 'walk1' || frame === 'walk2') drawArms(ctx, g, look, bob);
  ctx.restore();
  if (scene === 'arena' && g.stunT > 0 && g.fate === 'fight' && !g.dazed) {
    // накинутая сеть
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(P, P);
    ctx.drawImage(netOverSprite(), -13, -41);
    ctx.restore();
  }
  if (scene === 'arena') drawStatus(ctx, g, t);
}

// у головы: оглушённый молотом — звёздочки по кругу; ослеплённый песком — песчаная пелена на глазах
// и песчинки, вьющиеся вокруг головы (к концу слепоты тают)
const DUST = ['#f3e2b3', '#e2c690', '#c49a58'];
function drawStatus(ctx, g, t) {
  if (g.fate !== 'fight') return;
  const face = g.face < 0 ? -1 : 1;
  const x = Math.round(g.x / P) * P, y = Math.round(g.y / P) * P;
  if (g.stunT > 0 && g.dazed) {
    ctx.save();
    ctx.translate(x + (g.lion ? face * 30 : 0), y - (g.lion ? 50 : 70));
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + i * 2.09, sx = Math.round(Math.cos(a) * 9), sy = Math.round(Math.sin(a) * 3);
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(sx - 3, sy - 1, 6, 2);
      ctx.fillRect(sx - 1, sy - 3, 2, 6);
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
    }
    ctx.restore();
  }
  if (g.blindT > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, g.blindT * 1.5);
    // глаза: у человека — на голове, у льва — на морде впереди
    const hx = x + (g.lion ? face * 34 : face * 2), hy = y - (g.lion ? 40 : 58);
    // песчаная повязка на глазах с тёмным краем — видна и на светлом песке
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(hx - 9, hy - 3, 18, 7);
    ctx.fillStyle = '#f3e2b3';
    ctx.fillRect(hx - 8, hy - 2, 16, 2);
    ctx.fillStyle = '#d6b46e';
    ctx.fillRect(hx - 8, hy, 16, 3);
    // песчинки вьются вокруг головы
    for (let i = 0; i < 6; i++) {
      const a = t * 4.5 + i * 1.05, r = 12 + Math.sin(t * 3 + i) * 2, dark = i % 2 === 0;
      ctx.fillStyle = dark ? '#6b4a2a' : '#fff3cf';
      ctx.fillRect(Math.round(hx + Math.cos(a) * r) - 1, Math.round(hy - 2 + Math.sin(a) * r * 0.45) - 1, dark ? 3 : 2, dark ? 3 : 2);
    }
    ctx.restore();
  }
}

// что лежит на песке: оружие плашмя, щиты, сети и мешки; что летит: копья, сети, мешки, выбитое оружие
export function drawThrown(ctx, game) {
  for (const it of game.ground || []) {
    ctx.save();
    ctx.translate(Math.round(it.x / P) * P, Math.round(it.y / P) * P);
    ctx.scale(P, P);
    ctx.fillStyle = 'rgba(30,15,8,.25)';
    if (it.kind === 'weapon') {
      const art = weaponSprite(it.item.type, tierOf(it.item)), h = art.canvas.height * art.k;
      ctx.fillRect(-Math.round(h / 2), 0, Math.round(h), 2);
      ctx.rotate(Math.PI / 2);
      ctx.scale(art.k, art.k);
      ctx.drawImage(art.canvas, -art.canvas.width / 2, -art.canvas.height / 2 - 4);
    } else if (it.kind === 'shield') {
      const owner = game.members.get(it.owner) || { login: it.owner, color: '#8a7a66' };
      const look = shieldLookOf(owner, hashOf(owner.login)), art = shieldSprite(look.shape, look.design, look.color);
      ctx.fillRect(-Math.round(art.width / 2), 1, art.width, 2);
      ctx.scale(1, 0.6);
      ctx.drawImage(art, -Math.round(art.width / 2), -art.height + 2);
    } else if (it.kind === 'net') {
      ctx.scale(1, 0.55);
      ctx.drawImage(netSprite(), -10, -16);
    } else {
      ctx.fillRect(-4, 0, 8, 2);
      ctx.drawImage(sandSprite(), -4, -7);
    }
    ctx.restore();
  }
  for (const p of game.projectiles || []) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(P, P);
    if (p.kind === 'spear') {
      const art = weaponSprite(p.item ? p.item.type : 'spear', tierOf(p.item));
      ctx.rotate(p.angle + Math.PI / 2);
      ctx.scale(art.k, art.k);
      ctx.drawImage(art.canvas, -art.px, -art.canvas.height / 2);
    } else if (p.kind === 'fling') {
      // выбитое оружие кувыркается в полёте
      const art = weaponSprite(p.item.type, tierOf(p.item));
      ctx.rotate(p.x * 0.08);
      ctx.scale(art.k, art.k);
      ctx.drawImage(art.canvas, -art.px, -art.canvas.height / 2);
    } else if (p.kind === 'sand') {
      ctx.rotate(p.x * 0.06);
      ctx.drawImage(sandSprite(), -4, -4);
    } else {
      ctx.rotate(p.x * 0.05);
      ctx.drawImage(netSprite(), -8, -8);
    }
    ctx.restore();
  }
}

export function drawLabel(ctx, g, scene, highlight) {
  const fate = scene === 'arena' ? g.fate : null;
  const pose = scene === 'ludus' && !g.walking ? g.pose : null;
  // на арене у лежачих ни имени, ни здоровья — только у тех, кто ещё дерётся
  if (fate && fate !== 'fight') return;
  const lying = fate === 'down' || fate === 'dead' || pose === 'lie';
  // на скамьях и койках соседи рядом — подписи через одну выше, чтобы не налезали
  const stagger = pose && g.seat !== null && g.seat !== undefined && g.seat % 2 ? 15 : 0;
  const top = g.y - (g.lion ? (fate === 'fight' ? 70 : 40) : lying ? 26 : pose === 'sit' ? 64 : 86) - stagger;
  // на скамьях и койках имя не пишем — только полоску здоровья; имя видно у тех, кто ходит и тренируется
  if (pose && !highlight) {
    const part = Math.max(0, Math.min(1, g.hp / maxHp(g)));
    const bw = 24, bx = g.x - bw / 2, by = top + 4 + stagger;
    ctx.fillStyle = 'rgba(20,16,30,.8)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
    ctx.fillStyle = part > 0.5 ? '#4ade80' : part > 0.25 ? '#fbbf24' : '#f87171';
    ctx.fillRect(bx, by, bw * part, 3);
    return;
  }
  // уровень над головой не пишем — он есть в списке гладиаторов; ник цветом из твича
  ctx.font = '700 12px ' + FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const nameW = ctx.measureText(g.name).width, x0 = g.x - nameW / 2;
  ctx.fillStyle = highlight ? 'rgba(255,205,56,.92)' : 'rgba(20,16,30,.72)';
  roundRect(ctx, x0 - 5, top - 12, nameW + 10, 16, 6);
  ctx.fill();
  // в стенке на стенку ник — цвета команды
  const team = fate && g.team ? TEAMS.colors[g.team] : null;
  const star = fate === 'dead' || g.lion || team ? null : starOf(g.login);
  ctx.fillStyle = team || (star ? starPaint(ctx, star, x0, nameW) : fate === 'dead' ? '#c9c2b8' : g.color || '#fff');
  if (highlight && fate !== 'dead') {
    // на жёлтой подложке выбранного светлые ники теряются — даём им тёмный контур
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,16,30,.85)';
    ctx.strokeText(g.name, g.x, top + 1);
  }
  ctx.fillText(g.name, g.x, top + 1);
  if (fate === 'dead') return;
  const hpMax = maxHp(g), part = Math.max(0, Math.min(1, g.hp / hpMax));
  const bw = 34, bx = g.x - bw / 2, by = top + 6;
  ctx.fillStyle = 'rgba(20,16,30,.8)';
  ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
  ctx.fillStyle = part > 0.5 ? '#4ade80' : part > 0.25 ? '#fbbf24' : '#f87171';
  ctx.fillRect(bx, by, bw * part, 4);
}

// ники стримеров на холсте — та же радуга и тот же снежный блик, что в CSS
function starPaint(ctx, star, x, w) {
  const now = Date.now();
  if (star === 'rainbow') {
    const shift = (now % RAINBOW_CYCLE) / RAINBOW_CYCLE * RAINBOW_W;
    const from = x - RAINBOW_W + shift, bands = Math.ceil(w / RAINBOW_W) + 1, last = RAINBOW.length - 1;
    const grad = ctx.createLinearGradient(from, 0, from + RAINBOW_W * bands, 0);
    for (let b = 0; b < bands; b++) RAINBOW.forEach((color, i) => grad.addColorStop((b + i / last) / bands, color));
    return grad;
  }
  if (star === 'snow') {
    // блик пробегает по нику раз в 6 секунд, остальное время ник просто голубой
    const t = (now % SNOW_CYCLE) / SNOW_CYCLE;
    if (t < 0.7) return STAR_COLORS.snow;
    const at = x - 20 + (w + 40) * ((t - 0.7) / 0.3);
    const grad = ctx.createLinearGradient(at - 14, 0, at + 14, 0);
    grad.addColorStop(0, STAR_COLORS.snow);
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(1, STAR_COLORS.snow);
    return grad;
  }
  return STAR_COLORS[star] || '#fff';
}

export function drawMark(ctx, g, fate) {
  const x = g.x, y = g.y - 40;
  if (fate === 'dead') {
    ctx.font = '22px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('☠', x, y);
  }
}

export { roundRect, shade, FONT, hashOf };
