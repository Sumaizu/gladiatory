import { FLAME, TEAMS, maxHp } from './balance.js';
import { COLUMNS, DUMMIES, FORGE } from './places.js';
import { drawCrowd, paintArenaArt } from './arena.js';
import { tierOf } from './gacha.js';
import { RAINBOW, RAINBOW_CYCLE, RAINBOW_W, SNOW_CYCLE, STAR_COLORS, starOf } from './stars.js';
import { LION, P, SPRITE, darker, lionSprite, gladiatorSprite, lookOf, lyingSprite, netHandSprite, netOverSprite, netSprite, sandSprite, shieldLookOf, shieldSprite, weaponSprite } from './art.js';
import { drawDummyArt, paintLudusArt } from './ludus.js';

const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';

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

// чучело i — рисуется вперемешку с гладиаторами по глубине (кто ниже на экране, тот ближе)
export function drawDummy(ctx, i, hit) {
  const d = DUMMIES[i];
  drawDummyArt(ctx, d.kind, d.x, d.y, hit || 0);
}

// work — что сейчас делают в кузне (game.forgeNow): пока идёт работа, у наковальни или точила летят искры
export function drawLudusLife(ctx, t, work = null) {
  drawForgeFire(ctx, t);
  if (work && !work.done) drawSparks(ctx, t, work.kind === 'sharpen' ? FORGE.wheel : FORGE.anvil, work.kind === 'sharpen');
  // факелы на колоннах
  for (const cx of COLUMNS.slice(1, -1)) {
    const f = 0.7 + 0.3 * Math.sin(t * 11 + cx);
    ctx.fillStyle = '#3a2418';
    ctx.fillRect(cx + 16, 124, 4, 14);
    ctx.fillRect(cx + 14, 122, 8, 3);
    const tg = ctx.createRadialGradient(cx + 18, 116, 1, cx + 18, 116, 30);
    tg.addColorStop(0, 'rgba(255,200,90,' + (0.55 * f).toFixed(3) + ')');
    tg.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = tg;
    ctx.fillRect(cx - 12, 86, 60, 60);
    ctx.fillStyle = '#ff9a3c';
    ctx.fillRect(cx + 14, 112 - f * 4, 8, 10 + f * 4);
    ctx.fillStyle = '#ffe08a';
    ctx.fillRect(cx + 16, 116 - f * 2, 4, 6 + f * 2);
  }
}

// живой огонь в устье горна: мерцающее зарево на стене и полу и пляшущие языки
function drawForgeFire(ctx, t) {
  const { x, y } = FORGE.fire, f = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.3 + 1);
  const glow = ctx.createRadialGradient(x, y + 6, 4, x, y + 6, 70);
  glow.addColorStop(0, 'rgba(255,170,70,' + (0.45 * f).toFixed(3) + ')');
  glow.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 70, y - 64, 140, 140);
  for (let i = 0; i < 6; i++) {
    const h = 6 + 8 * Math.abs(Math.sin(t * (7 + i) + i * 1.7)), fx = x - 10 + i * 4;
    ctx.fillStyle = i % 2 ? '#ffb43c' : '#ffe08a';
    ctx.fillRect(fx, y + 16 - h, 2, h);
  }
}

// искры: от наковальни — веером вверх при каждом ударе, от точила — струёй вбок
function drawSparks(ctx, t, at, grind) {
  for (let i = 0; i < 9; i++) {
    const k = (t * (grind ? 2.6 : 1.8) + i / 9) % 1, a = grind ? 0.2 + (i % 3) * 0.15 : -Math.PI / 2 + (i - 4) * 0.32;
    const r = 6 + k * (grind ? 46 : 30);
    const x = at.x + (grind ? -8 : 0) + Math.cos(grind ? Math.PI + a : a) * r;
    const y = at.y - (grind ? 2 : 6) + Math.sin(a) * r * (grind ? 0.6 : 1) + k * k * 18;
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = k < 0.4 ? '#fff2b0' : '#ffb43c';
    ctx.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, 2, 2);
  }
  ctx.globalAlpha = 1;
}

export function paintArena(ctx) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const people = paintArenaArt(ctx);
  ctx.restore();
  return people;
}

export { drawCrowd };

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
  // рапира: остриём вперёд-вверх перед собой; удар — отвести кисть и сделать выпад вперёд
  rapier: { hit: [[0, [17, 20], 1.05], [0.14, [12, 19], 1.35], [0.3, [24, 18], HALF_PI], [0.55, [22, 19], HALF_PI],
    [1, [17, 20], 1.05]] },
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

// drill — руки на разминке: [дальняя кисть, ближняя кисть], оружие отложено
function drawArms(ctx, g, look, bob, drill = null) {
  const skin = look.skin, skinD = darker(skin, 0.8), guard = '#3f3833';
  const length = g.swingMax || 0.3, phase = g.swing > 0 ? 1 - g.swing / length : 0;
  ctx.save();
  ctx.translate(-SPRITE.x, -SPRITE.foot - bob);
  if (drill) {
    limb(ctx, SHOULDER.far, drill[0], skinD);
    fist(ctx, drill[0], skinD);
    limb(ctx, SHOULDER.near, drill[1], skin);
    fist(ctx, drill[1], skin);
    ctx.restore();
    return;
  }
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
  const lying = fate === 'down' || fate === 'dead';
  const seed = hashOf(g.login);
  const look = lookOf(g, seed);
  let frame = 'stand';
  // отдыхает у стены (на трибуне не хватило места) — стоит смирно: ноги прямо, руки опущены вдоль тела
  const resting = scene === 'ludus' && !g.walking && g.place === 'rest' && pose !== 'sit';
  if (pose === 'sit') frame = 'sit';
  else if (resting) frame = 'idle';
  else if (g.walking && !lying) frame = Math.sin(t * 10 + seed) > 0 ? 'walk1' : 'walk2';
  // разминка на песке: бег на месте, прыжки, приседания, прыжки «звёздочкой»
  let lift = 0, hands = resting ? [[11, 25], [15, 25]] : null;
  // триумф парагона: вскидывает руки и подпрыгивает
  if (scene === 'arena' && g.triumph && g.fate === 'fight') {
    const s = Math.sin(t * 7);
    lift = s > 0 ? Math.round(s * 5) : 0;
    hands = [[7, 3], [19, 3]];
  }
  const drill = scene === 'ludus' && !g.walking && !lying && g.place === 'train' ? g.drill : null;
  if (drill) {
    const k = t + (seed % 97) / 13;
    if (drill === 'run') {
      const s = Math.sin(k * 15);
      frame = s > 0 ? 'walk1' : 'walk2';
      lift = s > 0 ? 1 : 0;
      hands = s > 0 ? [[15, 19], [10, 20]] : [[9, 20], [16, 19]];
    } else if (drill === 'jump') {
      const s = Math.sin(k * 5.5);
      lift = s > 0 ? Math.round(s * 7) : 0;
      hands = lift > 3 ? [[10, 3], [17, 3]] : [[13, 22], [17, 22]];
    } else if (drill === 'squat') {
      frame = Math.sin(k * 3.6) > 0 ? 'kneel' : 'stand';
      lift = frame === 'kneel' ? -7 : 0;
      hands = [[21, 15], [22, 17]];
    } else {
      const s = Math.sin(k * 6.5);
      lift = s > 0 ? 1 : 0;
      hands = s > 0 ? [[7, 4], [19, 4]] : [[11, 23], [16, 23]];
    }
  }
  const sprite = gladiatorSprite(look, frame, fate === 'dead', g.flash > 0.08 && !lying);
  const x = Math.round(g.x / P) * P, y = Math.round(g.y / P) * P;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(P, P);
  // тень на земле
  ctx.fillStyle = 'rgba(30,15,8,.3)';
  ctx.fillRect(lying ? -16 : -8, -1, lying ? 32 : 16, 3);
  if (fate === 'dead') {
    ctx.fillStyle = '#7a1414';
    ctx.fillRect(-12, -1, 22, 4);
    ctx.fillRect(-9, 3, 14, 1);
  }
  if (lying) {
    // павший на арене — как упал
    if (g.face < 0) ctx.scale(-1, 1);
    ctx.drawImage(lyingSprite(look, fate === 'dead'), -12, -8);
    ctx.restore();
    return;
  }
  ctx.scale(g.face < 0 ? -1 : 1, 1);
  const bob = g.walking ? (frame === 'walk1' ? 1 : 0) : Math.max(0, lift);
  ctx.drawImage(sprite, -SPRITE.x, -SPRITE.foot - bob);
  // у присевшего тело ниже на 7 пикселей — руки тоже
  if (frame === 'stand' || frame === 'walk1' || frame === 'walk2' || hands) drawArms(ctx, g, look, hands ? lift : bob, hands);
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
  if (g.amulet && !g.lion && !(scene === 'arena' && (g.doomed || g.fate && g.fate !== 'fight'))) drawAmuletSparks(ctx, x, y, t, hashOf(g.login));
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
    // глаза: у человека — на голове, у льва — на морде впереди
    const hx = x + (g.lion ? face * 34 : face * 2), hy = y - (g.lion ? 40 : 58);
    // глаза запорошены: голову окутывает облако бурой пыли, в нём клубится светлая дымка, вокруг вьётся песок
    const fade = Math.min(1, g.blindT * 1.5);
    const haze = ctx.createRadialGradient(hx, hy - 2, 2, hx, hy - 2, 22);
    haze.addColorStop(0, 'rgba(150,108,58,' + (0.6 * fade).toFixed(3) + ')');
    haze.addColorStop(0.6, 'rgba(160,118,66,' + (0.35 * fade).toFixed(3) + ')');
    haze.addColorStop(1, 'rgba(170,130,80,0)');
    ctx.fillStyle = haze;
    ctx.beginPath();
    ctx.ellipse(hx, hy - 2, 22, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      const a = t * 1.6 + i * 1.05, r = 6 + 4 * Math.sin(t * 2.3 + i);
      ctx.fillStyle = 'rgba(236,214,170,' + (0.4 * fade).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(hx + Math.cos(a) * r, hy - 2 + Math.sin(a) * r * 0.6, 2.5 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    // песчинки кружат вокруг головы
    ctx.globalAlpha = fade;
    for (let i = 0; i < 10; i++) {
      const a = t * 4 + i * 0.63, r = 16 + Math.sin(t * 3 + i) * 2, dark = i % 2 === 0;
      ctx.fillStyle = dark ? '#5a3a22' : '#fff3cf';
      ctx.fillRect(Math.round(hx + Math.cos(a) * r) - 1, Math.round(hy - 2 + Math.sin(a) * r * 0.45) - 1, 2, 2);
    }
    ctx.restore();
  }
}

// божественный амулет (второй шанс): возле гладиатора парит красный кристаллик — медленно облетает его на уровне
// плеч, покачивается, мерцает; за спиной бледнее
const CRYSTAL = ['..#..', '.#o#.', '#oO##', '#o###', '##*##', '.###.', '..#..'];
function drawAmuletSparks(ctx, x, y, t, seed) {
  const phase = t * 1.4 + (seed % 100) / 16, behind = Math.sin(phase) < 0;
  const cx = Math.round((x + Math.cos(phase) * 20) / 2) * 2;
  const cy = Math.round((y - 50 + Math.sin(phase) * 5 + Math.sin(t * 3.1 + seed) * 3) / 2) * 2;
  ctx.save();
  ctx.globalAlpha = behind ? 0.55 : 1;
  const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, 12);
  glow.addColorStop(0, 'rgba(255,70,80,.45)');
  glow.addColorStop(1, 'rgba(255,40,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 12, cy - 12, 24, 24);
  const twinkle = Math.sin(t * 5 + seed) > 0.6;
  CRYSTAL.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '.') continue;
      ctx.fillStyle = c === 'O' ? (twinkle ? '#ffffff' : '#ffd0d4') : c === 'o' ? '#ff6b74' : c === '*' ? '#8a0f1c' : j > 4 ? '#a8121f' : '#e0202f';
      ctx.fillRect(cx - 5 + i * 2, cy - 7 + j * 2, 2, 2);
    }
  });
  ctx.restore();
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
    } else if (p.kind === 'rock') {
      // камень с трибун: серый, с бликом и тенью, кувыркается
      ctx.rotate(p.x * 0.07);
      ctx.fillStyle = '#4a4540';
      ctx.fillRect(-3, -2, 6, 5);
      ctx.fillStyle = '#7a736a';
      ctx.fillRect(-3, -3, 5, 4);
      ctx.fillStyle = '#a8a094';
      ctx.fillRect(-2, -3, 2, 1);
    } else {
      ctx.rotate(p.x * 0.05);
      ctx.drawImage(netSprite(), -8, -8);
    }
    ctx.restore();
  }
}

// mark — номер бойца на дуэли ({ n, color }): цветной значок с цифрой слева на той же плашке, что и ник, — ничего не
// висит отдельно над головой и не закрывает соседей
export function drawLabel(ctx, g, scene, highlight, mark = null) {
  const fate = scene === 'arena' ? g.fate : null;
  const pose = scene === 'ludus' && !g.walking ? g.pose : null;
  // на арене у лежачих ни имени, ни здоровья — только у тех, кто ещё дерётся
  if (fate && fate !== 'fight') return;
  const lying = fate === 'down' || fate === 'dead';
  const top = g.y - (g.lion ? (fate === 'fight' ? 70 : 40) : lying ? 26 : pose === 'sit' ? 64 : 86);
  // у отдыхающих (на трибуне и у стены) подписей нет, кроме того, чью карточку открыли; имя видно у тех, кто ходит и
  // тренируется
  const resting = scene === 'ludus' && !g.walking && g.place === 'rest';
  if ((pose || resting) && !highlight) return;
  // уровень над головой не пишем — он есть в списке гладиаторов; ник цветом из твича
  ctx.font = '700 12px ' + FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const nameW = ctx.measureText(g.name).width, badge = mark ? 18 : 0;
  const left = g.x - (nameW + 10 + badge) / 2, x0 = left + badge + 5, cx = x0 + nameW / 2;
  ctx.fillStyle = highlight ? 'rgba(255,205,56,.92)' : 'rgba(20,16,30,.72)';
  roundRect(ctx, left, top - 12, nameW + 10 + badge, 16, 6);
  ctx.fill();
  if (mark) {
    ctx.fillStyle = mark.color;
    roundRect(ctx, left, top - 12, 16, 16, 6);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,243,220,.9)';
    ctx.stroke();
    ctx.font = '900 12px ' + FONT;
    ctx.fillStyle = '#fff';
    ctx.fillText(String(mark.n), left + 8, top + 1);
    ctx.font = '700 12px ' + FONT;
  }
  // в стенке на стенку ник — цвета команды
  const team = fate && g.team ? TEAMS.colors[g.team] : null;
  const star = fate === 'dead' || g.lion || team ? null : starOf(g.login);
  ctx.fillStyle = team || (star ? starPaint(ctx, star, x0, nameW) : fate === 'dead' ? '#c9c2b8' : g.color || '#fff');
  if (highlight && fate !== 'dead') {
    // на жёлтой подложке выбранного светлые ники теряются — даём им тёмный контур
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,16,30,.85)';
    ctx.strokeText(g.name, cx, top + 1);
  }
  ctx.fillText(g.name, cx, top + 1);
  // красный череп (убил насмерть) — слева от плашки, огонёк (серия без падений) — справа
  if (!g.lion && g.skull > 0) drawSkull(ctx, left - 14, top - 11);
  if (!g.lion && (g.streak || 0) >= FLAME.streak) drawFlame(ctx, left + nameW + 10 + badge + 4, top - 12, Date.now() / 1000);
  // здоровье — только в бою
  if (fate === 'dead' || scene !== 'arena') return;
  hpBar(ctx, g.x, top + 6, 28, g.hp / maxHp(g));
}

// красный череп 6×7 пикселей (по 2): лоб, глазницы, нос, зубы
function drawSkull(ctx, x, y) {
  const rows = ['.####.', '######', '#o##o#', '#o##o#', '###o##', '.####.', '.#.#.#'];
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '.') continue;
      ctx.fillStyle = row[i] === 'o' ? '#2a0a0a' : j < 2 ? '#ff6b5e' : '#e0352a';
      ctx.fillRect(x + i * 2, y + j * 2, 2, 2);
    }
  });
}

// огонёк: язычок пламени, мерцает
function drawFlame(ctx, x, y, t) {
  const f = Math.sin(t * 9 + x) > 0 ? 1 : 0;
  const rows = f ? ['..#...', '..##..', '.###..', '.####.', '##o##.', '#ooo##', '.###o.', '..##..']
    : ['...#..', '..##..', '..###.', '.####.', '.##o##', '##ooo#', '.o###.', '..##..'];
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '.') continue;
      ctx.fillStyle = row[i] === 'o' ? '#ffe08a' : j < 3 ? '#ff9a3c' : '#ff5a1f';
      ctx.fillRect(x + i * 2, y + j * 2, 2, 2);
    }
  });
}

// полоска здоровья: тонкая, с закруглёнными краями, на тёмной подложке
function hpBar(ctx, cx, y, w, part) {
  part = Math.max(0, Math.min(1, part));
  const x = cx - w / 2;
  ctx.fillStyle = 'rgba(20,16,30,.8)';
  roundRect(ctx, x - 1, y - 1, w + 2, 5, 2.5);
  ctx.fill();
  if (part <= 0) return;
  ctx.fillStyle = part > 0.5 ? '#4ade80' : part > 0.25 ? '#fbbf24' : '#f87171';
  roundRect(ctx, x, y, Math.max(3, w * part), 3, 1.5);
  ctx.fill();
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
