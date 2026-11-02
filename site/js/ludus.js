// лудус в стиле Domina и наших гладиаторов: текстуры (кровля, штукатурка, плиты пола, мрамор, песок) — по пикселям
// поля, постройки и вещи — пикселями фигурок (вдвое крупнее), без обводки, три тона: свет слева, основной, тень справа
import { COLUMNS, DUMMIES, FIELD_H, FIELD_W, FORGE, GATE, LUDUS_H, LUDUS_TOP, SIDE, STANDS, TIERS, WALL, bayX, sideBase }
  from './places.js';
import { P, Pix, darker, hash, noise, remember, rgb, tone } from './art.js';

const smooth = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// --- палитры ---
const WOOD = ['#4a2f1d', '#6e4a2e', '#946640', '#b88a5c', '#d3a473'];
const LINEN = ['#a99c82', '#cbbfa5', '#e3d9c4', '#f4eedf'];
const MARBLE = ['#8f8372', '#b8ab96', '#d8cebd', '#efe8dc', '#fbf8f1'];
const GOLD = ['#7d5a1c', '#b8862e', '#e2b84a', '#f6dc8a'];
const IRON = ['#3d4147', '#5d636b', '#8a9097', '#b9bec4'];
const TERRA = ['#7d4636', '#a8634c', '#c98a6e', '#e0a98c'];
const STONE = ['#9b8a72', '#c4b294', '#ddcdb0', '#efe3cb'];
const ROPE = ['#7a6238', '#a88c58', '#cdb27a'];

// --- мраморная лестница к статуе: площадка под постаментом и четыре ступени до песка ---
const SX = 460;
const STAIRS = [{ top: 222, bottom: 236, half: 56 }, ...[0, 1, 2, 3].map((i) => ({ top: 236 + i * 16, bottom: 252 + i * 16,
  half: 62 + i * 12 }))];

function marble(x, y) {
  let c = rgb(MARBLE[3]);
  const v = noise(x, y, 22, 91), w = noise(x + 300, y, 9, 92);
  if (Math.abs(v - 0.5) < 0.012) c = rgb(MARBLE[2]);
  else if (Math.abs(w - 0.5) < 0.008) c = mix(rgb(MARBLE[2]), rgb(MARBLE[3]), 0.5);
  return tone(c, 0.97 + 0.05 * noise(x, y, 40, 93));
}

function stairTexel(x, y) {
  for (let i = STAIRS.length - 1; i >= 0; i--) {
    const s = STAIRS[i], dx = Math.abs(x - SX);
    if (y < s.top || y >= s.bottom || dx > s.half) continue;
    let k = 1;
    const ty = y - s.top;
    if (ty === 0) k = 1.1;
    else if (ty < 5) k = 1.03;
    else k = 0.86 - 0.06 * (ty - 5) / 11;
    if (dx > s.half - 3) k *= 0.82;
    return tone(marble(x, y), k);
  }
  return null;
}

// --- песок: светлый кремовый, крупные мягкие пятна, вытоптанные проплешины и круги у столбов, редкие камешки ---
const SAND = { light: rgb('#efdcb4'), mid: rgb('#e2c795'), dark: rgb('#c7a36d'), pebble: rgb('#977751'),
  pebbleL: rgb('#c9b08a'), shine: rgb('#fbf1da') };

// песок без общего света: пятна, борозды граблями, крупинки и камешки 2×2. mark — свои следы поверх (у столбов — вытоптанные
// круги, на арене — разровненные круги); k — свет. Тот же песок на арене (arena.js)
export function sandAt(x, y, k = 1, mark = null) {
  const n = noise(x, y, 150, 61) * 0.5 + noise(x, y, 52, 62) * 0.32 + noise(x, y, 17, 63) * 0.18;
  let c = mix(SAND.mid, SAND.light, smooth(0.28, 0.74, n));
  const patch = noise(x, y, 70, 64);
  if (patch > 0.6) c = mix(c, SAND.dark, Math.min(0.35, (patch - 0.6) * 1.2));
  if (mark) c = mark(c);
  // лёгкие борозды, будто песок разровняли граблями
  const streak = noise(x * 0.1, y * 1.8, 8, 66);
  if (streak > 0.72) c = tone(c, 1 - (streak - 0.72) * 0.18);
  // крупинки 2×2, как пиксели фигурок: камешки с бликом, тёмные и светлые песчинки
  const gx = x >> 1, gy = y >> 1, g = hash(gx, gy, 67);
  if (g < 0.004) return tone((x & 1) === 0 && (y & 1) === 0 ? SAND.pebbleL : SAND.pebble, k);
  if (g < 0.016) return tone(mix(c, SAND.dark, 0.55), k);
  if (g > 0.993) return tone(SAND.shine, k);
  return tone(c, k * (1 + (hash(x, y, 68) - 0.5) * 0.02));
}
export const SAND_DARK = SAND.dark;
export { mix, smooth };

function sandTexel(x, y) {
  // свет: светлее к середине, тень под галереей, у нижнего края чуть темнее
  let k = 0.9 + 0.12 * (1 - Math.pow(Math.abs(x - FIELD_W / 2) / (FIELD_W / 2), 2));
  k *= 0.8 + 0.2 * smooth(WALL.sand, WALL.sand + 36, y);
  k *= 1 - 0.12 * smooth(WALL.rail - 46, WALL.rail, y);
  // вытоптанные круги вокруг столбов
  return sandAt(x, y, k, (c) => {
    for (const d of DUMMIES) {
      const r = Math.hypot((x - d.x) / 48, (y - d.y - 4) / 17);
      if (r < 1.4) c = mix(c, SAND.dark, 0.3 * Math.max(0, 1 - Math.abs(r - 0.7) / 0.6) * (0.6 + 0.4 * noise(x, y, 5, 65)));
    }
    return c;
  });
}

// --- кровля, штукатурка, плиты пола, бордюр, доски впереди ---
function texel(x, y) {
  const stair = y >= STAIRS[0].top && y < WALL.sand ? stairTexel(x, y) : null;
  if (stair) return stair;
  const grain = 1 + (hash(x, y, 3) - 0.5) * 0.03;
  if (y < WALL.top) {
    // тёмный деревянный потолок: стропила, внизу балка с зубчиками
    let c = rgb('#3a271b'), k = 0.8 + 0.25 * y / WALL.top;
    const rx = x % 46;
    if (rx < 10) c = rgb(rx < 2 ? '#6e4c35' : '#55392a');
    if (y >= 28) {
      c = rgb('#6a4630');
      if (y >= 35 && x % 16 < 9) c = rgb(y === 35 ? '#a8774f' : '#8a6040');
      if (y === 28) c = rgb('#8a6040');
    }
    return tone(c, k * grain);
  }
  if (y < WALL.floor) {
    // тёплая штукатурка: тень под кровлей, пятна, кое-где облупилась и треснула; внизу тёмная панель
    let c = rgb('#82593d');
    let k = 0.74 + 0.26 * smooth(WALL.top, WALL.top + 50, y);
    k *= 0.92 + 0.12 * noise(x, y, 64, 71) + 0.05 * noise(x, y, 11, 72);
    const flake = noise(x, y, 24, 73);
    if (flake > 0.78) k *= flake > 0.8 ? 1.1 : 0.86;
    if (Math.abs(noise(x, y, 34, 77) - 0.5) < 0.006 && noise(x, y, 90, 78) > 0.62) k *= 0.78;
    if (y >= WALL.floor - 36) {
      c = rgb('#6a3e2c');
      if (y < WALL.floor - 33) c = rgb(y === WALL.floor - 36 ? '#b88560' : '#9a6a48');
      k = 0.94 + 0.08 * noise(x, y, 30, 79);
    }
    return tone(c, k * (1 + (hash(x >> 1, y >> 1, 74) - 0.5) * 0.05));
  }
  if (y < WALL.step) {
    // каменные плиты галереи вразбежку: швы, светлые кромки, у каждой плиты свой тон; у стены — тень
    const ry = y - WALL.floor, row = Math.floor(ry / 16), off = row % 2 ? 23 : 0;
    const col = Math.floor((x + off) / 46), lx = (x + off) % 46, ly = ry % 16;
    let k = 0.86 + 0.18 * hash(col, row, 81) + 0.07 * noise(x, y, 12, 82);
    if (lx === 0 || ly === 0) k *= 0.7;
    else if (lx === 1 || ly === 1) k *= 1.1;
    else if (hash(x >> 1, y >> 1, 83) < 0.03) k *= 0.88;
    k *= 0.74 + 0.26 * smooth(WALL.floor, WALL.floor + 18, y);
    return tone(rgb('#a6876b'), k * grain);
  }
  if (y < WALL.sand) {
    // бордюр: светлая каменная кромка и тёмная грань
    const ty = y - WALL.step;
    return tone(rgb(ty < 2 ? '#d9c6a8' : '#8a6a4e'), (ty < 2 ? 1 : 0.95 - ty * 0.03) * grain);
  }
  return sandTexel(x, y);
}

// --- спрайты построек и вещей (пиксели фигурок) ---

// колонна: капитель и база светлые, верх ствола терракотовый, низ — кремовый, тонкие каннелюры
function columnArt() {
  const h = (WALL.step - WALL.top - 4) / P, p = new Pix(16, h);
  const shaft = (y0, y1, pal) => {
    for (let y = y0; y <= y1; y++) for (let x = 2; x < 14; x++) {
      const c = x < 4 ? pal[3] : x < 7 ? pal[2] : x < 11 ? pal[1] : pal[0];
      p.px(x, y, (x === 6 || x === 9) && y % 7 !== 0 ? darker(c, 0.9) : c);
    }
  };
  const ring = (y, x0, w, pal) => {
    for (let x = x0; x < x0 + w; x++) p.px(x, y, x < x0 + 2 ? pal[3] : x > x0 + w - 3 ? pal[0] : pal[2]);
  };
  for (let y = 0; y < 3; y++) ring(y, 0, 16, STONE);
  p.rect(0, 2, 16, 1, STONE[0]);
  for (let y = 3; y < 6; y++) ring(y, 1, 14, STONE);
  ring(6, 2, 12, STONE);
  const mid = Math.round(h * 0.48);
  shaft(7, mid - 2, TERRA);
  ring(mid - 1, 1, 14, STONE);
  ring(mid, 1, 14, STONE);
  shaft(mid + 1, h - 9, STONE);
  for (let y = h - 8; y < h - 5; y++) ring(y, 1, 14, STONE);
  for (let y = h - 5; y < h; y++) ring(y, 0, 16, STONE);
  p.rect(0, h - 1, 16, 1, STONE[0]);
  return p.canvas();
}

// двустворчатая дверь из досок в каменной раме, железные полосы с заклёпками, кольца
function doorArt() {
  const p = new Pix(28, 54);
  p.rect(0, 0, 28, 4, STONE[2]);
  p.rect(0, 0, 28, 1, STONE[3]);
  p.rect(0, 3, 28, 1, STONE[0]);
  p.rect(1, 4, 2, 50, STONE[2]);
  p.rect(25, 4, 2, 50, STONE[0]);
  for (let y = 4; y < 54; y++) for (let x = 3; x < 25; x++) {
    const plank = (x - 3) % 4, c = plank === 0 ? WOOD[0] : plank === 1 ? WOOD[2] : WOOD[1];
    p.px(x, y, hash(x, y, 101) < 0.05 ? WOOD[0] : c);
  }
  p.rect(13, 4, 2, 50, WOOD[0]);
  for (const y of [12, 40]) {
    p.rect(3, y, 22, 2, IRON[1]);
    p.rect(3, y, 22, 1, IRON[2]);
    for (let x = 5; x < 24; x += 4) p.px(x, y, IRON[3]);
  }
  for (const x of [10, 17]) {
    p.rect(x, 25, 2, 3, GOLD[1]);
    p.px(x, 25, GOLD[3]);
  }
  return p.canvas();
}

// красное знамя с золотой каймой и лавровым венком
function bannerArt() {
  const p = new Pix(14, 36);
  p.rect(0, 0, 14, 2, WOOD[2]);
  p.rect(0, 0, 14, 1, WOOD[3]);
  for (let y = 2; y < 33; y++) for (let x = 1; x < 13; x++) {
    const c = x < 3 ? '#b8382c' : x > 10 ? '#6e1a14' : '#9c2a22';
    p.px(x, y, (x + y) % 9 === 0 ? darker(c, 0.85) : c);
  }
  for (let y = 2; y < 33; y++) {
    p.px(1, y, GOLD[2]);
    p.px(12, y, GOLD[1]);
  }
  for (let x = 1; x < 13; x++) p.px(x, 31, GOLD[2]);
  for (const x of [1, 4, 7, 10]) {
    p.px(x + 1, 33, '#9c2a22');
    p.px(x + 1, 34, GOLD[2]);
  }
  for (let a = 0; a < 18; a++) {
    const t = a / 18 * Math.PI * 2;
    if (a === 4 || a === 5) continue;
    p.px(Math.round(6.5 + Math.cos(t) * 4), Math.round(14 + Math.sin(t) * 4.5), a % 2 ? GOLD[2] : GOLD[3]);
  }
  p.rect(6, 12, 2, 4, GOLD[1]);
  return p.canvas();
}

function plantArt() {
  const p = new Pix(14, 18);
  p.rect(4, 12, 6, 6, '#a8582f');
  p.rect(3, 12, 8, 2, '#c06a3a');
  p.rect(4, 17, 6, 1, '#7a3e20');
  for (let i = 0; i < 30; i++) {
    const a = hash(i, 1, 71) * Math.PI, r = 3 + hash(i, 2, 71) * 4;
    p.px(7 + Math.cos(a) * r * 1.1, 11 - Math.sin(a) * r, hash(i, 3, 71) > 0.5 ? '#4d7a2e' : '#3b5e22');
  }
  return p.canvas();
}

// статуя Фортуны: богиня с повязкой на глазах и короной, в струящемся хитоне, в руке — колесо удачи;
// белый мрамор и золото, на постаменте табличка и россыпь монет
function fortunaArt() {
  const p = new Pix(44, 76), M = MARBLE, G = GOLD, cx = 22;
  // постамент
  p.rect(4, 63, 36, 2, M[3]);
  p.rect(4, 63, 36, 1, M[4]);
  for (let y = 65; y < 74; y++) for (let x = 6; x < 38; x++) p.px(x, y, x < 9 ? M[3] : x > 34 ? M[1] : M[2]);
  p.rect(4, 74, 36, 2, M[1]);
  p.rect(13, 67, 18, 5, G[1]);
  p.rect(14, 68, 16, 3, G[2]);
  for (let x = 15; x < 29; x += 2) p.px(x, 69, G[0]);
  // монеты у ног
  for (const [x, y] of [[11, 62], [13, 61], [12, 62], [15, 62], [29, 62], [31, 61], [32, 62], [27, 62], [34, 62]]) {
    p.px(x, y, G[2]);
    p.px(x, y - 1, G[3]);
  }
  // хитон: расширяется книзу, складки наискось, свет слева
  for (let y = 30; y < 63; y++) {
    const half = 5 + (y - 30) * 0.24, c0 = cx + Math.sin((y - 30) / 11) * 0.8;
    for (let x = Math.round(c0 - half); x <= Math.round(c0 + half); x++) {
      const t = (x - (c0 - half)) / (2 * half);
      let c = t < 0.25 ? M[4] : t < 0.55 ? M[3] : t < 0.8 ? M[2] : M[1];
      if (((x - Math.round(y * 0.35)) % 5 + 5) % 5 === 0) c = t > 0.5 ? M[0] : M[1];
      p.px(x, y, c);
    }
  }
  p.rect(Math.round(cx - 11), 62, 23, 1, M[1]);
  // торс, пояс, ожерелье
  for (let y = 14; y < 31; y++) {
    const half = y < 18 ? 6 : 4.5;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const t = (x - (cx - half)) / (2 * half);
      p.px(x, y, t < 0.3 ? M[4] : t < 0.65 ? M[3] : M[2]);
    }
  }
  for (let y = 15; y < 42; y++) {
    const x = Math.round(cx - 4 + (y - 15) * 0.42);
    p.px(x, y, M[4]);
    p.px(x + 1, y, M[1]);
  }
  p.rect(cx - 5, 29, 11, 2, G[2]);
  p.rect(cx - 5, 29, 11, 1, G[3]);
  p.rect(cx - 2, 16, 5, 1, G[2]);
  p.px(cx, 17, '#c83a3a');
  // голова, волосы, повязка, корона
  p.rect(cx - 1, 11, 3, 3, M[3]);
  p.ellipse(cx, 7.5, 3.6, 4.2, M[3], M[2], M[4]);
  for (let y = 4; y < 21; y++) {
    p.px(cx - 4 - (y > 10 ? 1 : 0), y, y % 3 ? M[2] : M[3]);
    p.px(cx + 4 + (y > 10 ? 1 : 0), y, y % 3 ? M[1] : M[2]);
  }
  p.rect(cx - 3, 4, 7, 2, M[2]);
  p.rect(cx - 4, 7, 9, 2, G[2]);
  p.rect(cx - 4, 7, 9, 1, G[3]);
  p.rect(cx - 4, 3, 9, 1, G[1]);
  for (const x of [cx - 4, cx - 2, cx, cx + 2, cx + 4]) {
    p.px(x, 2, G[2]);
    p.px(x, 1, x === cx ? G[3] : G[2]);
  }
  p.px(cx, 0, G[3]);
  p.px(cx, 2, '#c83a3a');
  // левая рука (от нас справа) придерживает хитон
  p.line(cx + 6, 16, cx + 9, 23, M[2], 2);
  p.line(cx + 9, 23, cx + 5, 28, M[3], 2);
  // правая рука (от нас слева) держит колесо удачи
  p.line(cx - 6, 16, cx - 9, 23, M[3], 2);
  p.line(cx - 9, 23, cx - 12, 27, M[3], 2);
  const wx = 10, wy = 30;
  for (let a = 0; a < 56; a++) {
    const t = a / 56 * Math.PI * 2, lit = Math.cos(t + 0.8) > 0.3, dim = Math.cos(t + 0.8) < -0.3;
    for (const r of [7, 7.8]) p.px(Math.round(wx + Math.cos(t) * r), Math.round(wy + Math.sin(t) * r), lit ? G[3] : dim ? G[0] : G[2]);
  }
  for (let k = 0; k < 8; k++) {
    const t = k / 8 * Math.PI * 2;
    p.line(wx, wy, wx + Math.cos(t) * 6.5, wy + Math.sin(t) * 6.5, G[1]);
    p.px(Math.round(wx + Math.cos(t) * 9), Math.round(wy + Math.sin(t) * 9), G[2]);
  }
  p.ellipse(wx, wy, 1.6, 1.6, G[3], G[1]);
  p.px(wx, wy, '#c83a3a');
  p.rect(cx - 13, 26, 3, 2, M[3]);
  return p.canvas();
}

// --- рисование на холсте поля ---

function put(ctx, canvas, x, y) {
  ctx.drawImage(canvas, Math.round(x / P) * P, Math.round(y / P) * P, canvas.width * P, canvas.height * P);
}

// деревянная трибуна: ряды-ступени, задние выше; верх — светлая доска, спереди — вертикальные доски.
// Две части с проходом посередине, где стоит колонна
function paintStands(ctx) {
  for (const [x0, x1] of STANDS) paintStand(ctx, x0, x1);
}

function paintStand(ctx, x0, x1) {
  TIERS.forEach((seat, r) => {
    const top = seat - 8, bottom = r === TIERS.length - 1 ? WALL.step : TIERS[r + 1] - 8;
    for (let y = top + 4; y < bottom; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const board = Math.floor((x - x0) / 16) % 2, k = 0.92 + 0.12 * hash(x >> 4, r, 121);
        ctx.fillStyle = (x - x0) % 16 === 0 ? WOOD[0] : darker(board ? WOOD[1] : WOOD[2], k * (y < top + 6 ? 0.7 : 1));
        ctx.fillRect(x, y, 2, 2);
      }
    }
    for (let y = top; y < top + 4; y += 2) {
      for (let x = x0 - 4; x < x1 + 4; x += 2) {
        ctx.fillStyle = y === top ? WOOD[4] : (x - x0) % 60 === 0 ? WOOD[1] : WOOD[3];
        ctx.fillRect(x, y, 2, 2);
      }
    }
    for (const px of [x0 - 4, x1]) {
      ctx.fillStyle = WOOD[0];
      ctx.fillRect(px, top + 4, 4, bottom - top - 4);
    }
  });
}

// ниша-апсида за статуей: тёмный полукруглый свод с каменной рамой и тёплым светом
function paintNiche(ctx) {
  const cx = SX, top = 70, w = 56;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - w, WALL.floor);
  ctx.lineTo(cx - w, top + w);
  ctx.arc(cx, top + w, w, Math.PI, 0);
  ctx.lineTo(cx + w, WALL.floor);
  ctx.closePath();
  ctx.fillStyle = STONE[1];
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - w + 6, WALL.floor);
  ctx.lineTo(cx - w + 6, top + w);
  ctx.arc(cx, top + w, w - 6, Math.PI, 0);
  ctx.lineTo(cx + w - 6, WALL.floor);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, top, 0, WALL.floor);
  g.addColorStop(0, '#3a2418');
  g.addColorStop(1, '#5a3a26');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  const glow = ctx.createRadialGradient(cx, 140, 8, cx, 140, 90);
  glow.addColorStop(0, 'rgba(255,214,140,.45)');
  glow.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - w, top, w * 2, WALL.floor - top);
  ctx.restore();
}

// стрельчатое витражное окно: каменная рама, три стрельчатых проёма с переплётом, голубое стекло в свинцовой решётке,
// ромбики-вставки, вверху — круглая «роза»; подоконник
const GLASS = ['#1c3a5e', '#2f6fa8', '#5aa8d8', '#9ad4f0', '#d8f2fb'];
const LEAD = '#1a1f2a';
function windowArt() {
  const w = 20, h = 36, p = new Pix(w, h);
  // стрельчатая арка из двух дуг: пята на высоте spring, вершина — вверху
  const inside = (x, y, inset) => {
    const L = inset, R = w - 1 - inset, span = R - L, spring = 1 + inset + Math.round(span * 0.87);
    if (x < L || x > R || y > h - 1 - inset) return false;
    if (y >= spring) return true;
    const dy = spring - y;
    return (x - L) ** 2 + dy ** 2 <= span ** 2 && (x - R) ** 2 + dy ** 2 <= span ** 2;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside(x, y, 0)) continue;
    if (!inside(x, y, 2)) {
      p.px(x, y, x < w / 2 ? STONE[2] : STONE[1]);
      continue;
    }
    if (!inside(x, y, 3)) {
      p.px(x, y, '#2a1c14');
      continue;
    }
    // стекло: светлее к середине и кверху, с переливами
    const glow = 0.5 + 0.5 * Math.sin(x * 1.3 + y * 0.7) * Math.cos(y * 0.4);
    let c = GLASS[1 + Math.min(3, Math.floor(glow * 2.6 + (y < 14 ? 1 : 0)))];
    // переплёт: средники с острыми верхушками, горизонтальные полосы, ромбики
    const lancet = (x === 7 || x === 12) && y > 14;
    const tip = y <= 14 && y > 8 && (Math.abs(x - 7) === 14 - y - 2 || Math.abs(x - 12) === 14 - y - 2);
    if (lancet) c = STONE[1];
    else if (tip) c = LEAD;
    else if (y > 14 && (y - 15) % 4 === 0) c = LEAD;
    else if (y > 14 && (x === 5 || x === 10 || x === 15) && (y - 17) % 8 === 0) c = GLASS[4];
    else if (y <= 8 && Math.hypot(x - 9.5, y - 6) < 3.4 && Math.hypot(x - 9.5, y - 6) > 2.4) c = LEAD;
    else if (y <= 8 && Math.hypot(x - 9.5, y - 6) <= 1.2) c = GLASS[4];
    p.px(x, y, c);
  }
  p.rect(0, h - 2, w, 2, STONE[3]);
  p.rect(0, h - 1, w, 1, STONE[1]);
  return p.canvas();
}

// ящик с цветами под окном
function flowerBoxArt() {
  const p = new Pix(22, 7);
  p.rect(0, 3, 22, 4, WOOD[1]);
  p.rect(0, 3, 22, 1, WOOD[3]);
  for (let x = 1; x < 21; x++) {
    const h = 1 + Math.round(hash(x, 1, 151) * 2);
    for (let y = 3 - h; y < 3; y++) p.px(x, y, LEAF[1 + (x + y) % 3]);
    if (hash(x, 2, 151) < 0.35) p.px(x, 2 - h + 1, hash(x, 3, 151) < 0.5 ? '#d8423a' : '#f2c94c');
  }
  return p.canvas();
}

// круглый щит с эмблемой на стене
function wallShieldArt(face) {
  const p = new Pix(14, 14);
  p.ellipse(7, 7, 6.6, 6.6, darker(face, 0.8), darker(face, 0.55), darker(face, 1.15));
  p.ellipse(7, 7, 5, 5, face, darker(face, 0.75), darker(face, 1.25));
  for (let a = 0; a < 24; a++) {
    const t = a / 24 * Math.PI * 2;
    p.px(Math.round(7 + Math.cos(t) * 6), Math.round(7 + Math.sin(t) * 6), a % 3 ? GOLD[1] : GOLD[3]);
  }
  p.ellipse(7, 7, 1.6, 1.6, GOLD[2], GOLD[0], GOLD[3]);
  for (const [dx, dy] of [[0, -3], [0, 3], [-3, 0], [3, 0]]) p.px(7 + dx, 7 + dy, GOLD[2]);
  return p.canvas();
}

// фриз вдоль стены под балкой: тёмно-красная полоса с полукруглыми фестонами и светлыми розетками (как на фото окна)
function paintFrieze(ctx) {
  const y0 = WALL.top + 2, h = 14;
  for (let x = 0; x < FIELD_W; x += 2) {
    for (let y = y0; y < y0 + h; y += 2) {
      const local = x % 24, cx = 12, top = y0 + 2 + Math.round(((local - cx) / cx) ** 2 * 4);
      let c = '#5a2018';
      if (y >= top) c = y === top ? '#c06a4a' : '#8a3226';
      if (y >= y0 + h - 2) c = '#4a1a12';
      if (y === y0) c = '#a8775a';
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  for (let x = 12; x < FIELD_W; x += 24) {
    ctx.fillStyle = '#efe0c6';
    ctx.fillRect(x - 3, y0 + 7, 6, 2);
    ctx.fillRect(x - 1, y0 + 5, 2, 6);
    ctx.fillStyle = '#e2b84a';
    ctx.fillRect(x - 1, y0 + 7, 2, 2);
  }
}

// плющ и лианы: стебель по 2 пикселя, листья кучками; hang — свисает вниз, иначе взбирается вверх
const LEAF = ['#24391a', '#36552a', '#4d7a33', '#6b9a44', '#8cb85a'];
function paintVine(ctx, x, y, length, seed, hang = true) {
  let px = x;
  for (let i = 0; i < length; i += 2) {
    px += (noise(i, seed, 9, 161) - 0.5) * 2.4;
    const yy = hang ? y + i : y - i, sx = Math.round(px / 2) * 2;
    ctx.fillStyle = LEAF[1];
    ctx.fillRect(sx, yy, 2, 2);
    if (hash(i, seed, 162) < 0.55) {
      const side = hash(i, seed, 163) < 0.5 ? -1 : 1, leaf = LEAF[2 + Math.floor(hash(i, seed, 164) * 3)];
      ctx.fillStyle = leaf;
      ctx.fillRect(sx + side * 2, yy, 2, 2);
      ctx.fillRect(sx + side * 4, yy - 2, 2, 2);
      ctx.fillStyle = LEAF[0];
      ctx.fillRect(sx + side * 4, yy, 2, 2);
    }
  }
}

// пучки травы у бордюра и в углах
function paintGrass(ctx, x0, x1, y, density, seed) {
  for (let x = x0; x < x1; x += 2) {
    if (hash(x, seed, 171) > density) continue;
    const h = 2 + Math.round(hash(x, seed, 172) * 4) * 2;
    for (let k = 0; k < h; k += 2) {
      ctx.fillStyle = LEAF[k === 0 ? 1 : 2 + Math.min(2, k >> 1)];
      ctx.fillRect(x + (k > 2 && hash(x, k, 173) < 0.5 ? 2 : 0), y - k, 2, 2);
    }
  }
}

// боковые стены: справа — с воротами на арену, слева — такая же глухая (рисуется зеркально, со щитом вместо ворот).
// Стоят вдоль песка и уходят вглубь к колоннаде, повёрнуты лицом к гладиаторам:
// каждая точка экрана справа от угла пересчитывается в точку на стене — u (глубина: 0 у колоннады, DEPTH у края поля)
// и h (высота над песком, в пикселях у дальнего угла; ближе к нам стена крупнее). Так ряды камней, свод и решётка
// ложатся в ракурсе, а пиксели остаются чёткими
const DEPTH = 256;
function sideAt(x, y) {
  const t = (x - SIDE.x) / (FIELD_W - SIDE.x);
  return { u: t * DEPTH, h: (sideBase(x) - y) / (1 + SIDE.grow * t), t };
}

function paintSideWall(ctx, right) {
  const u0 = GATE.from * DEPTH, u1 = GATE.to * DEPTH, r = (u1 - u0) / 2, cu = u0 + r, spring = GATE.height;
  const jamb = 16;
  // эмблема над сводом (на глухой стене — посередине) — щит, сжатый ракурсом
  const shield = right ? remember('ludus:gateShield', () => wallShieldArt('#8a2a22'))
    : remember('ludus:shieldR', () => wallShieldArt('#2f5f9a'));
  const sd = shield.getContext('2d').getImageData(0, 0, shield.width, shield.height).data;
  const SU = 3.4, SH = 2.1, sTop = right ? spring + r + 40 : 150;
  const emblem = (u, h) => {
    const sx = Math.floor((u - cu) / SU + shield.width / 2), sy = Math.floor((sTop - h) / SH);
    if (sx < 0 || sy < 0 || sx >= shield.width || sy >= shield.height) return null;
    const k = (sy * shield.width + sx) * 4;
    return sd[k + 3] ? [sd[k], sd[k + 1], sd[k + 2]] : null;
  };
  const inOpen = (u, h) => right && u > u0 && u < u1 && (h < spring || Math.hypot((u - cu), (h - spring)) < r);
  const ring = (u, h) => right && u > u0 - 9 && u < u1 + 9 && h > spring - 2 && Math.hypot(u - cu, h - spring) < r + 11;
  const jambs = (u, h) => right && u > u0 - 9 && u < u1 + 9 && h < spring && (u < u0 || u > u1);
  // столбец экрана: слева — зеркально
  const sx = (x) => (right ? x : FIELD_W - 2 - x);
  for (let x = SIDE.x; x < FIELD_W; x += 2) {
    const base = sideBase(x + 1);
    for (let y = 0; y < Math.min(LUDUS_H, base + 10); y += 2) {
      const { u, h, t } = sideAt(x + 1, y + 1);
      let c;
      if (h < 0) {
        // тень от стены на песке у самого низа
        ctx.fillStyle = 'rgba(40,20,8,' + (0.28 * (1 + h / 8)).toFixed(3) + ')';
        if (h > -8) ctx.fillRect(sx(x), y, 2, 2);
        continue;
      }
      const light = 1.02 - 0.16 * t;
      if (h > 262) {
        // выше стены — тёмный потолок, как над колоннадой
        c = tone(rgb('#3a271b'), 0.85);
      } else if (h > 248) {
        // балка под потолком
        c = tone(rgb(h > 258 ? '#a8774f' : '#6a4630'), light);
      } else if (inOpen(u, h)) {
        if (u < u0 + jamb) {
          // дальний откос прохода — освещённый камень в толще стены
          const bh = Math.floor(h / 12);
          c = tone(rgb((Math.floor(h) % 12) < 1.5 ? '#7d6e58' : '#c4b294'), 0.82 + 0.06 * hash(bh, 1, 193));
        } else {
          // проход: темно, у пола — свет арены с той стороны
          const glow = Math.max(0, 1 - Math.hypot((u - (u1 - 10)) / 70, h / 34));
          c = glow > 0.62 ? rgb('#efd29a') : tone(rgb('#3a2618'), 0.5 + 1.1 * glow * glow);
        }
        // решётка поднята, видна её нижняя часть под сводом: прутья, поперечины, внизу острия
        const gateLow = spring - 6;
        if (h > gateLow && u > u0 + 2) {
          const col = Math.floor((x - (SIDE.x + Math.round(GATE.from * (FIELD_W - SIDE.x)))) / 2);
          const cross = (h - gateLow) % 13 < 2.6;
          if (col % 2 === 0) c = rgb(col % 4 === 0 ? '#5d636b' : '#3d4147');
          else if (cross) c = rgb('#4a4f56');
        } else if (h > gateLow - 5 && u > u0 + 2 && Math.floor((x - SIDE.x) / 2) % 2 === 0) {
          c = rgb('#8a9097');
        }
      } else {
        const e = emblem(u, h);
        if (e) {
          c = e;
        } else if (ring(u, h) && h >= spring - 2) {
          // свод из клиньев, наверху замковый камень
          const a = Math.atan2(h - spring, u - cu), block = Math.floor(a / 0.3);
          const key = Math.abs(a - Math.PI / 2) < 0.16;
          c = tone(rgb(key ? '#efe3cb' : block % 2 ? '#ddcdb0' : '#c4b294'), light * (Math.hypot(u - cu, h - spring) > r + 9 ? 0.78 : 1));
        } else if (jambs(u, h)) {
          // косяки ворот — светлые камни
          c = tone(rgb(Math.floor(h / 10) % 2 ? '#ddcdb0' : '#c4b294'), light * ((Math.floor(h) % 10) < 1.4 ? 0.8 : 1));
        } else {
          // кладка: ряды по 12, камни по 40 вразбежку, у каждого свой тон; у самой колоннады — светлый угол
          const row = Math.floor(h / 12), off = row % 2 ? 20 : 0, bu = Math.floor((u + off) / 40);
          const joint = (h % 12) < 1.6 || ((u + off) % 40) < 3.2;
          let k = light * (0.88 + 0.16 * hash(bu, row, 191) + 0.05 * noise(x, y, 14, 192));
          if (joint) k *= 0.72;
          k *= 0.7 + 0.3 * smooth(262, 200, h);
          c = tone(rgb(u < 7 ? '#d6c4a4' : '#b5a284'), k);
        }
      }
      ctx.fillStyle = 'rgb(' + c.map((v) => Math.round(v)).join(',') + ')';
      ctx.fillRect(sx(x), y, 2, 2);
    }
  }
  // угол стены у колоннады — тонкая тёмная грань
  ctx.fillStyle = 'rgba(40,22,10,.45)';
  ctx.fillRect(sx(SIDE.x), 0, 2, SIDE.y);
  // плющ свисает с балки и ползёт снизу; трава вдоль низа стены
  const seed = right ? 0 : 100;
  [[SIDE.x + 12, 80, 59], [SIDE.x + 64, 130, 61], [SIDE.x + 112, 70, 63]]
    .forEach(([x, len, s]) => paintVine(ctx, sx(x), 30, len, s + seed, true));
  paintVine(ctx, sx(SIDE.x + 16), sideBase(SIDE.x + 16) - 2, 90, 67 + seed, false);
  for (let x = SIDE.x; x < FIELD_W; x += 2) {
    if (hash(x, 3 + seed, 171) > 0.45) continue;
    const y = Math.round(sideBase(x) / 2) * 2, h = 2 + Math.floor(hash(x, 4 + seed, 172) * 3) * 2;
    for (let k = 0; k < h; k += 2) {
      ctx.fillStyle = LEAF[k === 0 ? 1 : 2 + Math.min(2, k >> 1)];
      ctx.fillRect(sx(x - 2), y - k, 2, 2);
    }
  }
}

// --- кузня: справа от лудильни, два пролёта по колонне — заточка (арсенал и точило) и перековка (горн и наковальня) ---

const SOOT = ['#2a2420', '#3d342d', '#564a40', '#6e6054'];
const FIRE = ['#5a1408', '#a8280e', '#e0521a', '#f59a2a', '#ffd25a', '#fff2b0'];

// горн: каменная печь с арочным устьем, над ней железный колпак и кирпичная труба до потолка; под устьем — зольник
function furnaceArt() {
  const p = new Pix(32, 96);
  // труба
  for (let y = 0; y < 32; y++) for (let x = 11; x < 21; x++) {
    const row = y >> 2, off = row % 2 ? 2 : 0, joint = (y & 3) === 3 || (x + off) % 5 === 0;
    p.px(x, y, joint ? TERRA[0] : x < 13 ? TERRA[3] : x > 18 ? TERRA[1] : TERRA[2]);
  }
  // колпак: от трубы расширяется книзу, по краю заклёпки
  for (let y = 32; y < 46; y++) {
    const half = 5 + Math.round((y - 32) * 0.82);
    for (let x = 16 - half; x < 16 + half; x++) {
      const t = (x - (16 - half)) / (2 * half);
      p.px(x, y, y === 45 ? IRON[0] : t < 0.18 ? IRON[3] : t < 0.5 ? IRON[2] : t < 0.85 ? IRON[1] : IRON[0]);
    }
    if (y % 4 === 0) {
      p.px(16 - half + 1, y, GOLD[2]);
      p.px(16 + half - 2, y, GOLD[0]);
    }
  }
  // кладка печи, закопчённая сверху
  for (let y = 46; y < 96; y++) for (let x = 1; x < 31; x++) {
    const row = Math.floor((y - 46) / 6), off = row % 2 ? 4 : 0, joint = (y - 46) % 6 === 5 || (x + off) % 8 === 0;
    const sooty = y < 60 && hash(x, y, 201) < (60 - y) / 18;
    const c = joint ? '#6e6054' : x < 4 ? STONE[2] : x > 27 ? STONE[0] : hash(Math.floor((x + off) / 8), row, 202) < 0.5 ? STONE[1] : '#b3a184';
    p.px(x, y, sooty ? SOOT[2] : c);
  }
  p.rect(0, 46, 32, 2, STONE[3]);
  p.rect(0, 47, 32, 1, STONE[1]);
  // устье: арка, внутри жар — тёмная глубина, языки пламени, угли внизу (живое пламя дорисовывается поверх в draw.js)
  const cx = 16, top = 62, r = 8, bottom = 84;
  for (let y = top - r - 2; y < bottom + 1; y++) for (let x = cx - r - 2; x < cx + r + 2; x++) {
    const inside = y >= top ? Math.abs(x + 0.5 - cx) < r : Math.hypot(x + 0.5 - cx, y + 0.5 - top) < r;
    const rim = !inside && (y >= top ? Math.abs(x + 0.5 - cx) < r + 2 : Math.hypot(x + 0.5 - cx, y + 0.5 - top) < r + 2);
    if (rim) p.px(x, y, (x + y) % 3 ? '#d9c8a8' : '#a8957a');
    if (!inside) continue;
    const depth = (y - (top - r)) / (bottom - top + r);
    let c = depth < 0.35 ? FIRE[0] : depth < 0.6 ? FIRE[1] : FIRE[2];
    const flame = Math.abs(x + 0.5 - cx + Math.sin(y * 0.9) * 2) < (bottom - y) * 0.35;
    if (flame && depth > 0.3) c = depth > 0.75 ? FIRE[4] : FIRE[3];
    if (y >= bottom - 3) c = hash(x, y, 203) < 0.5 ? FIRE[4] : FIRE[3];
    p.px(x, y, c);
  }
  // под устьем — каменный порог и зольник
  p.rect(cx - r - 2, bottom + 1, 2 * r + 4, 2, STONE[3]);
  p.rect(cx - 5, 89, 10, 5, SOOT[0]);
  p.rect(cx - 4, 92, 8, 2, '#7a3a1a');
  for (const x of [cx - 3, cx, cx + 2]) p.px(x, 92, FIRE[3]);
  return p.canvas();
}

// наковальня на дубовом пне: рог влево, плоская рабочая грань, перехват и основание
function anvilArt() {
  const p = new Pix(22, 18);
  // пень
  for (let y = 9; y < 18; y++) for (let x = 5; x < 17; x++) p.px(x, y, x < 7 ? WOOD[3] : x > 14 ? WOOD[0] : (x + y) % 5 ? WOOD[2] : WOOD[1]);
  p.rect(5, 9, 12, 1, WOOD[4]);
  // рабочая грань с рогом
  for (let x = 0; x < 20; x++) {
    const horn = x < 6, h = horn ? Math.max(1, Math.round((x + 1) / 2)) : 3;
    for (let y = 4 - (horn ? Math.min(h, 3) - 1 : 2); y <= 4; y++) p.px(x, y, y === 4 - (horn ? Math.min(h, 3) - 1 : 2) ? IRON[3] : IRON[2]);
    p.px(x, 5, IRON[1]);
  }
  p.rect(20, 2, 1, 4, IRON[1]);
  // перехват и основание
  p.rect(8, 6, 6, 2, IRON[1]);
  p.rect(9, 6, 1, 2, IRON[2]);
  p.rect(6, 8, 10, 2, IRON[1]);
  p.rect(6, 8, 10, 1, IRON[2]);
  p.rect(6, 9, 10, 1, IRON[0]);
  return p.canvas();
}

// точильный круг на деревянной раме: каменное колесо с осью и ручкой, под ним корыто с водой
function grindstoneArt() {
  const p = new Pix(28, 26), S = ['#7d7466', '#a39886', '#c4b9a5', '#ddd3c1'];
  // ножки-козлы
  for (let y = 10; y < 26; y++) {
    const d = Math.round((y - 10) * 0.35);
    for (const x of [5 - d, 22 + d]) {
      p.px(x, y, WOOD[2]);
      p.px(x + 1, y, WOOD[0]);
    }
  }
  p.rect(3, 22, 22, 2, WOOD[1]);
  p.rect(3, 22, 22, 1, WOOD[3]);
  // корыто с водой
  p.rect(7, 17, 14, 5, WOOD[1]);
  p.rect(8, 17, 12, 1, '#3d78a8');
  p.rect(9, 17, 4, 1, '#8cc4e8');
  // колесо
  const cx = 14, cy = 9, r = 8;
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d > r) continue;
    const light = (cx - x + cy - y) / (2 * r);
    p.px(x, y, d > r - 1 ? S[0] : light > 0.35 ? S[3] : light > -0.1 ? S[2] : S[1]);
  }
  for (let a = 0; a < 6; a++) {
    const t = a / 6 * Math.PI * 2;
    p.px(Math.round(cx + Math.cos(t) * 5), Math.round(cy + Math.sin(t) * 5), S[1]);
  }
  // ось и ручка
  p.rect(cx - 1, cy - 1, 3, 3, IRON[1]);
  p.px(cx, cy, IRON[3]);
  p.rect(cx + 1, cy, 9, 1, WOOD[2]);
  p.rect(cx + 9, cy - 3, 1, 4, WOOD[3]);
  return p.canvas();
}

// арсенал: доска на стене с колышками — мечи, копья, секира, молот, трезубец и щиты
function arsenalArt() {
  const p = new Pix(50, 42);
  // доска и рама
  for (let y = 2; y < 42; y++) for (let x = 1; x < 49; x++) p.px(x, y, (x - 1) % 8 === 0 ? WOOD[0] : y % 13 === 0 ? WOOD[1] : WOOD[2]);
  p.rect(0, 0, 50, 3, WOOD[3]);
  p.rect(0, 0, 50, 1, WOOD[4]);
  p.rect(0, 40, 50, 2, WOOD[0]);
  for (const x of [0, 48]) p.rect(x, 0, 2, 42, WOOD[1]);
  const blade = (x, y0, len, w) => {
    for (let y = y0; y < y0 + len; y++) {
      p.px(x, y, IRON[3]);
      if (w > 1) p.px(x + 1, y, IRON[1]);
    }
    p.px(x, y0 - 1, IRON[2]);
  };
  // два меча остриём вверх: клинок, гарда, рукоять
  for (const x of [5, 10]) {
    blade(x, 6, 18, 2);
    p.rect(x - 2, 24, 6, 1, GOLD[1]);
    p.rect(x, 25, 2, 5, '#5a3a24');
    p.rect(x, 30, 2, 1, GOLD[2]);
  }
  // копья и трезубец: длинные древки, наконечники наверху
  for (const x of [15, 19]) {
    p.rect(x, 7, 1, 33, WOOD[3]);
    p.rect(x - 1, 3, 3, 4, IRON[2]);
    p.px(x, 2, IRON[3]);
  }
  p.rect(23, 9, 1, 31, WOOD[3]);
  p.rect(21, 7, 5, 1, IRON[2]);
  for (const x of [21, 23, 25]) p.rect(x, 3, 1, 4, IRON[3]);
  // секира и молот на колышках
  p.rect(29, 6, 1, 26, WOOD[3]);
  for (let y = 6; y < 15; y++) p.rect(30, y, Math.min(5, 1 + Math.round(Math.sin((y - 6) / 8 * Math.PI) * 5)), 1, y % 3 ? IRON[2] : IRON[3]);
  p.rect(35, 10, 1, 24, WOOD[3]);
  p.rect(32, 6, 7, 5, IRON[1]);
  p.rect(32, 6, 7, 1, IRON[3]);
  // два круглых щита справа
  p.ellipse(43, 12, 4.6, 4.6, '#8a2a22', '#5e1a14', '#b0463a');
  p.ellipse(43, 12, 1.4, 1.4, GOLD[2], GOLD[0]);
  p.ellipse(43, 29, 4.6, 4.6, '#2f5f9a', '#1e3e66', '#4f86c4');
  p.ellipse(43, 29, 1.4, 1.4, GOLD[2], GOLD[0]);
  for (const [x, y] of [[5, 4], [10, 4], [15, 1], [19, 1], [23, 1], [29, 4], [35, 4]]) p.px(x, y, WOOD[0]);
  return p.canvas();
}

// верстак у точила: бруски-оселки, кувшин с водой, тряпица
function benchArt() {
  const p = new Pix(26, 14);
  p.rect(0, 4, 26, 2, WOOD[3]);
  p.rect(0, 5, 26, 1, WOOD[1]);
  for (const x of [1, 23]) p.rect(x, 6, 2, 8, WOOD[1]);
  p.rect(1, 10, 24, 1, WOOD[0]);
  for (const [x, w, c] of [[3, 5, '#8a8478'], [9, 4, '#6e685e'], [14, 5, '#a39d90']]) {
    p.rect(x, 2, w, 2, c);
    p.rect(x, 2, w, 1, darker(c, 1.25));
  }
  p.ellipse(22, 2, 2, 2.6, '#a8582f', '#7a3e20', '#c06a3a');
  p.rect(21, 0, 2, 1, '#7a3e20');
  return p.canvas();
}

// стойка с инструментом кузнеца: клещи, молоты, зубило
function toolsArt() {
  const p = new Pix(26, 24);
  p.rect(0, 0, 26, 3, WOOD[2]);
  p.rect(0, 0, 26, 1, WOOD[4]);
  // клещи
  for (let y = 3; y < 20; y++) {
    const spread = y > 15 ? y - 15 : 0;
    p.px(3 - (y > 15 ? spread : 0), y, IRON[2]);
    p.px(5 + spread, y, IRON[1]);
  }
  // молоты
  for (const [x, w] of [[10, 6], [18, 4]]) {
    p.rect(x + (w >> 1), 3, 1, 16, WOOD[3]);
    p.rect(x, 18, w + 1, 4, IRON[1]);
    p.rect(x, 18, w + 1, 1, IRON[3]);
  }
  // зубило
  p.rect(24, 3, 1, 12, IRON[2]);
  p.px(24, 15, IRON[3]);
  return p.canvas();
}

// бадья для закалки: деревянная, с обручами, вода сверху
function tubArt() {
  const p = new Pix(16, 13);
  for (let y = 1; y < 13; y++) for (let x = 1; x < 15; x++) p.px(x, y, x < 3 ? WOOD[3] : x > 12 ? WOOD[0] : x % 3 ? WOOD[2] : WOOD[1]);
  for (const y of [3, 10]) p.rect(0, y, 16, 1, IRON[1]);
  p.rect(1, 0, 14, 2, '#3d78a8');
  p.rect(3, 0, 5, 1, '#8cc4e8');
  return p.canvas();
}

// куча угля у печи
function coalArt() {
  const p = new Pix(18, 7);
  for (let y = 0; y < 7; y++) {
    const half = Math.round(2 + y * 1.3);
    for (let x = 9 - half; x < 9 + half; x++) {
      const s = hash(x, y, 211);
      p.px(x, y, s < 0.1 ? '#7a3a1a' : s < 0.45 ? SOOT[0] : s < 0.8 ? SOOT[1] : SOOT[2]);
    }
  }
  return p.canvas();
}

// возвращает таблички для чёткого слоя (их больше нет); фон рисуется в полном разрешении поля, без потолка —
// с LUDUS_TOP в координатах лудуса
export function paintLudusArt(ctx) {
  const img = ctx.createImageData(FIELD_W, FIELD_H);
  for (let y = 0; y < FIELD_H; y++) {
    for (let x = 0; x < FIELD_W; x++) img.data.set([...texel(x, y + LUDUS_TOP), 255], (y * FIELD_W + x) * 4);
  }
  ctx.putImageData(img, 0, 0);
  ctx.translate(0, -LUDUS_TOP);
  ctx.imageSmoothingEnabled = false;
  const at = (canvas, x, y) => put(ctx, canvas, x, y);
  const door = remember('ludus:door', doorArt), banner = remember('ludus:banner', bannerArt);
  const win = remember('ludus:window', windowArt), flowers = remember('ludus:flowers', flowerBoxArt);
  paintFrieze(ctx);
  // лианы с балки под потолком
  [[196, 30, 11], [300, 46, 13], [392, 26, 17], [540, 34, 19], [612, 50, 23], [700, 30, 29]]
    .forEach(([x, len, seed]) => paintVine(ctx, x, WALL.top + 14, len, seed, true));
  // зона отдыха: окна-витражи над дверями, щиты, знамя, цветы; перед стеной — трибуна
  at(door, bayX(0) + 10, WALL.floor - 108);
  at(win, bayX(0) + 18, 58);
  at(flowers, bayX(0) + 16, 126);
  at(remember('ludus:shieldY', () => wallShieldArt('#a8641e')), bayX(0) + 76, 74);
  at(remember('ludus:shieldG', () => wallShieldArt('#3f7a3a')), bayX(0) + 76, 140);
  at(banner, bayX(1) + 4, 62);
  at(door, bayX(1) + 42, WALL.floor - 108);
  at(win, bayX(1) + 50, 58);
  at(flowers, bayX(1) + 46, 126);
  paintStands(ctx);
  // лудильня: ниша, лестница, статуя Фортуны, по бокам цветы
  paintNiche(ctx);
  at(remember('ludus:fortuna', fortunaArt), SX - 44, STAIRS[0].top - 148);
  at(remember('ludus:plant', plantArt), SX - 82, STAIRS[0].bottom - 36);
  at(remember('ludus:plant', plantArt), SX + 54, STAIRS[0].bottom - 36);
  // кузня, заточка: на стене — арсенал, под ним верстак с оселками; на полу — точильный круг
  at(remember('ludus:arsenal', arsenalArt), bayX(3) + 4, 104);
  at(remember('ludus:bench', benchArt), bayX(3) + 4, WALL.floor - 26);
  at(remember('ludus:grind', grindstoneArt), FORGE.wheel.x - 28, FORGE.wheel.y - 18);
  // кузня, перековка: окно и инструмент на стене, у дальней стены — горн с колпаком и трубой, уголь;
  // впереди — наковальня на пне и бадья для закалки
  at(win, bayX(4) + 8, 58);
  at(remember('ludus:tools', toolsArt), bayX(4) + 4, 138);
  at(remember('ludus:furnace', furnaceArt), FORGE.fire.x - 32, FORGE.fire.y - 146);
  at(remember('ludus:coal', coalArt), FORGE.fire.x - 70, FORGE.fire.y + 32);
  at(remember('ludus:anvil', anvilArt), FORGE.anvil.x - 22, FORGE.anvil.y - 4);
  at(remember('ludus:tub', tubArt), FORGE.fire.x + 2, FORGE.anvil.y + 6);
  // колонны, на некоторых — плющ
  const column = remember('ludus:column', columnArt);
  for (const cx of COLUMNS) {
    ctx.fillStyle = 'rgba(40,20,10,.22)';
    ctx.fillRect(cx - 4, WALL.top + 8, 30, WALL.step - WALL.top - 8);
    at(column, cx - 16, WALL.top + 4);
  }
  [[COLUMNS[0], 110, 41], [COLUMNS[1] - 10, 70, 43], [COLUMNS[3] + 10, 90, 47], [COLUMNS[4] - 8, 120, 53]]
    .forEach(([x, len, seed]) => paintVine(ctx, x, WALL.step - 4, len, seed, false));
  // трава у бордюра и по краям песка
  paintGrass(ctx, 0, FIELD_W, WALL.sand + 6, 0.12, 1);
  // по бокам: справа стена с воротами на арену, слева такая же глухая
  paintSideWall(ctx, true);
  paintSideWall(ctx, false);
  // тёплый свет как в Domina: светлее посередине, по краям и в углах темнее
  const light = ctx.createRadialGradient(FIELD_W / 2, 360, 80, FIELD_W / 2, 360, 620);
  light.addColorStop(0, 'rgba(255,236,190,.06)');
  light.addColorStop(1, 'rgba(60,25,10,.28)');
  ctx.fillStyle = light;
  ctx.fillRect(0, LUDUS_TOP, FIELD_W, FIELD_H);
  return [];
}

// --- тренировочные столбы ---

// деревянный столб с рукоятями: красное облупившееся дерево, верёвочные обмотки, рукояти в обе стороны
function postArt() {
  const p = new Pix(30, 46), R = ['#5e231c', '#8a3528', '#a8463a', '#c46a5a'];
  const rope = (x0, y0, w, h) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) p.px(x, y, ROPE[(x + y) % 3 === 0 ? 0 : (x + y) % 3 === 1 ? 1 : 2]);
  };
  const arm = (x0, x1, y) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      p.px(x, y, R[3]);
      p.px(x, y + 1, R[2]);
      p.px(x, y + 2, R[0]);
    }
    const end = x0 < x1 ? x1 : x1;
    p.rect(end, y, 1, 3, '#d9a070');
  };
  arm(4, 11, 15);
  arm(18, 26, 13);
  arm(19, 24, 30);
  arm(6, 11, 26);
  for (let y = 2; y < 46; y++) for (let x = 12; x < 18; x++) {
    let c = x === 12 ? R[3] : x < 15 ? R[2] : x < 17 ? R[1] : R[0];
    if (hash(x, y, 141) < 0.08) c = '#d9a070';
    p.px(x, y, c);
  }
  p.rect(12, 1, 6, 1, R[3]);
  rope(11, 5, 8, 5);
  rope(11, 22, 8, 3);
  rope(11, 38, 8, 5);
  rope(10, 14, 3, 3);
  rope(17, 12, 3, 3);
  return p.canvas();
}

// мешок на шесте: мешковина, набитая соломой, круглая голова, руки-палки с пучками соломы, верёвки на шее и поясе
function sackArt() {
  const p = new Pix(30, 46), B = ['#7a5a3a', '#9c7a52', '#b8966a', '#d2b488'], STRAW = ['#b8923e', '#d9b75e', '#f0d68a'];
  for (let y = 30; y < 46; y++) for (let x = 14; x < 17; x++) p.px(x, y, x === 14 ? WOOD[3] : x === 16 ? WOOD[0] : WOOD[2]);
  p.rect(2, 15, 26, 2, WOOD[1]);
  p.rect(2, 15, 26, 1, WOOD[3]);
  for (let y = 12; y < 30; y++) {
    const half = y < 15 ? 6 + (y - 12) : 9 - (y - 15) * 0.32;
    for (let x = Math.round(15.5 - half); x <= Math.round(15.5 + half); x++) {
      const t = (x - (15.5 - half)) / (2 * half);
      const c = t < 0.25 ? B[3] : t < 0.6 ? B[2] : t < 0.85 ? B[1] : B[0];
      p.px(x, y, (x + y) % 2 === 0 && t > 0.1 ? darker(c, 0.94) : c);
    }
  }
  for (const [x0, x1] of [[3, 9], [21, 27]]) {
    for (let y = 13; y < 19; y++) for (let x = x0; x <= x1; x++) p.px(x, y, x < x0 + 2 ? B[3] : y > 16 ? B[1] : B[2]);
    p.rect(x0 < 10 ? x0 + 4 : x0 + 1, 13, 1, 6, ROPE[1]);
  }
  for (let y = 13; y < 19; y++) {
    p.px(0, y, STRAW[y % 3]);
    p.px(1, y + (y % 2), STRAW[(y + 1) % 3]);
    p.px(29, y, STRAW[y % 3]);
    p.px(28, y + (y % 2), STRAW[(y + 2) % 3]);
  }
  for (let x = 10; x < 21; x++) p.px(x, 30 + (x % 3 === 0 ? 2 : x % 2), STRAW[x % 3]);
  p.rect(10, 28, 11, 1, ROPE[1]);
  p.ellipse(15.5, 6.5, 5, 5.5, B[2], B[1], B[3]);
  p.rect(12, 11, 7, 1, ROPE[1]);
  p.rect(12, 6, 1, 1, B[0]);
  p.rect(18, 6, 1, 1, B[0]);
  return p.canvas();
}

// доспех на крестовине: подставка крестом, столб, перекладина в рукавах, кожаный панцирь с ремнями,
// юбка, бронзовый шлем с гребнем
function armorArt() {
  const p = new Pix(30, 46), L = ['#5a3018', '#7a4426', '#9c5a32', '#bb7a4c'], B = ['#7a5a1e', '#a8822e', '#d0aa4a', '#efd488'];
  p.rect(5, 43, 20, 3, WOOD[2]);
  p.rect(5, 43, 20, 1, WOOD[3]);
  p.line(9, 43, 14, 36, WOOD[1], 2);
  p.line(21, 43, 16, 36, WOOD[1], 2);
  for (let y = 10; y < 43; y++) for (let x = 14; x < 17; x++) p.px(x, y, x === 14 ? WOOD[3] : x === 16 ? WOOD[0] : WOOD[2]);
  p.rect(2, 15, 26, 2, WOOD[2]);
  p.rect(2, 15, 26, 1, WOOD[3]);
  for (const [x0, x1] of [[3, 9], [21, 27]]) {
    for (let y = 14; y < 18; y++) for (let x = x0; x <= x1; x++) p.px(x, y, y === 14 ? LINEN[3] : y === 17 ? LINEN[0] : LINEN[2]);
    p.rect(x0 < 10 ? x1 : x0, 14, 1, 4, L[1]);
  }
  for (let y = 15; y < 29; y++) {
    const half = y < 18 ? 6 : 5;
    for (let x = 15 - half; x <= 16 + half; x++) {
      const t = (x - (15 - half)) / (2 * half + 1);
      p.px(x, y, t < 0.2 ? L[3] : t < 0.55 ? L[2] : t < 0.85 ? L[1] : L[0]);
    }
  }
  p.line(12, 18, 15, 22, L[0]);
  p.line(19, 18, 16, 22, L[0]);
  for (const y of [21, 25]) {
    p.rect(10, y, 11, 1, L[0]);
    p.px(10, y, B[2]);
    p.px(20, y, B[2]);
  }
  p.rect(13, 14, 5, 1, LINEN[3]);
  for (let y = 29; y < 34; y++) for (let x = 10; x < 22; x++) p.px(x, y, x % 2 ? LINEN[2] : LINEN[1]);
  // шлем: купол, широкие поля, решётка забрала, гребень
  p.ellipse(15.5, 7.5, 5, 4.5, B[2], B[1], B[3]);
  p.rect(8, 9, 16, 2, B[1]);
  p.rect(8, 9, 16, 1, B[3]);
  for (let y = 11; y < 14; y++) for (let x = 12; x < 20; x++) p.px(x, y, (x + y) % 2 ? B[0] : B[2]);
  for (let x = 13; x < 19; x++) p.px(x, 2 - (x > 15 ? 1 : 0), x < 16 ? B[3] : B[2]);
  p.rect(13, 0, 5, 1, B[3]);
  return p.canvas();
}

export const DUMMY_KINDS = ['post', 'sack', 'armor'];
const DUMMY_ART = { post: postArt, sack: sackArt, armor: armorArt };

export function drawDummyArt(ctx, kind, x, y, hit) {
  const sprite = remember('dummy2:' + kind, DUMMY_ART[kind] || postArt);
  const wobble = Math.sin(hit * 30) * hit;
  ctx.save();
  ctx.translate(Math.round(x / P) * P, Math.round(y / P) * P);
  ctx.scale(P, P);
  ctx.fillStyle = 'rgba(40,20,10,.28)';
  ctx.fillRect(-11, -1, 22, 3);
  // от удара столб чуть качается у основания
  ctx.rotate(wobble * (kind === 'sack' ? 0.35 : 0.18));
  ctx.drawImage(sprite, -15, -45);
  ctx.restore();
}
