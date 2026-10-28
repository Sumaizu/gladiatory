import { maxHp } from './balance.js';
import { ARENA, BAYS, BAY_W, COLUMNS, DUMMIES, FIELD_H, FIELD_W, bayX } from './places.js';
import { P, SPRITE, drawDummyArt, gladiatorSprite, lookOf, lyingSprite, paintLudusArt, swordSprite } from './art.js';

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
  // табличка «скоро» у храма
  const tx = bayX(2) + BAY_W / 2, ty = 106;
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(-0.06);
  const pulse = 1 + 0.04 * Math.sin(t * 3);
  ctx.scale(pulse, pulse);
  ctx.font = '900 13px ' + FONT;
  ctx.fillStyle = '#e8b93c';
  roundRect(ctx, -46, -12, 92, 24, 12);
  ctx.fill();
  ctx.fillStyle = '#3a2804';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('гача скоро', 0, 1);
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
  // песок
  const grad = ctx.createRadialGradient(a.cx, a.cy - 40, 40, a.cx, a.cy, a.rx);
  grad.addColorStop(0, '#ecd3a6');
  grad.addColorStop(1, '#cfae7c');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(a.cx, a.cy, a.rx, a.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = random() < 0.5 ? 'rgba(120,80,40,.10)' : 'rgba(255,245,220,.16)';
    ctx.fillRect(a.cx - a.rx + random() * a.rx * 2, a.cy - a.ry + random() * a.ry * 2, 2, 2);
  }
  ctx.strokeStyle = 'rgba(150,110,60,.18)';
  ctx.lineWidth = 2;
  for (let r = 40; r < a.rx; r += 34) {
    ctx.beginPath();
    ctx.ellipse(a.cx, a.cy, r, r * a.ry / a.rx, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
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

export function drawGladiator(ctx, g, t, scene) {
  const fate = scene === 'arena' ? g.fate : null;
  const pose = scene === 'ludus' && !g.walking ? g.pose : null;
  const lying = fate === 'down' || fate === 'dead' || pose === 'lie';
  const seed = hashOf(g.login);
  const look = lookOf(g, seed);
  let frame = 'stand';
  if (fate === 'yield') frame = 'kneel';
  else if (pose === 'sit') frame = 'sit';
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
  // меч в дальней руке: в бою и на тренировке им машут
  if (frame === 'stand' || frame === 'walk1' || frame === 'walk2') {
    const swing = g.swing > 0 ? Math.sin((1 - g.swing / 0.3) * Math.PI) : 0;
    ctx.translate(SPRITE.hand[0] - SPRITE.x, SPRITE.hand[1] - SPRITE.foot - bob);
    ctx.rotate(0.5 + swing * 2);
    ctx.drawImage(swordSprite(g.weapon || 0), -1, -11);
  }
  ctx.restore();
}

export function drawLabel(ctx, g, scene, highlight) {
  const fate = scene === 'arena' ? g.fate : null;
  const pose = scene === 'ludus' && !g.walking ? g.pose : null;
  const lying = fate === 'down' || fate === 'dead' || pose === 'lie';
  // на скамьях и койках соседи рядом — подписи через одну выше, чтобы не налезали
  const stagger = pose && g.seat !== null && g.seat !== undefined && g.seat % 2 ? 15 : 0;
  const top = g.y - (lying ? 26 : pose === 'sit' ? 64 : 86) - stagger;
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
  ctx.font = '700 12px ' + FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const lvl = String(g.level);
  const nameW = ctx.measureText(g.name).width;
  ctx.font = '900 10px ' + FONT;
  const lvlW = ctx.measureText(lvl).width + 8;
  const w = nameW + lvlW + 4, x0 = g.x - w / 2;
  ctx.fillStyle = highlight ? 'rgba(255,205,56,.92)' : 'rgba(20,16,30,.72)';
  roundRect(ctx, x0 - 3, top - 12, w + 6, 16, 6);
  ctx.fill();
  ctx.fillStyle = g.color;
  roundRect(ctx, x0, top - 10, lvlW, 12, 4);
  ctx.fill();
  ctx.fillStyle = '#10131a';
  ctx.fillText(lvl, x0 + lvlW / 2, top);
  ctx.font = '700 12px ' + FONT;
  ctx.fillStyle = highlight ? '#2a1a02' : fate === 'dead' ? '#c9c2b8' : '#fff';
  ctx.fillText(g.name, x0 + lvlW + 2 + nameW / 2, top + 1);
  if (fate === 'dead') return;
  const hpMax = maxHp(g), part = Math.max(0, Math.min(1, g.hp / hpMax));
  const bw = 34, bx = g.x - bw / 2, by = top + 6;
  ctx.fillStyle = 'rgba(20,16,30,.8)';
  ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
  ctx.fillStyle = part > 0.5 ? '#4ade80' : part > 0.25 ? '#fbbf24' : '#f87171';
  ctx.fillRect(bx, by, bw * part, 4);
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
