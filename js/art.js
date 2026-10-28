// пиксельная графика как в Чатобороне: один пиксель рисунка — два пикселя поля, текстуры и спрайты с обводкой
import { BAYS, BAY_W, COLUMNS, FIELD_H, FIELD_W, PLACES, WALL, bayX } from './places.js';
import { tierOf } from './gacha.js';
import { netUp, shieldUp } from './balance.js';

export const P = 2;
const W = FIELD_W / P;
const H = FIELD_H / P;
const OUT = '#3a2416';

// --- шум и цвет ---

function hash(x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x, y, scale, s) {
  const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const fbm = (x, y, s) => noise(x, y, 18, s) * 0.5 + noise(x, y, 7, s + 1) * 0.3 + noise(x, y, 2.5, s + 2) * 0.2;

export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

function tone(c, k) {
  return [Math.max(0, Math.min(255, c[0] * k)), Math.max(0, Math.min(255, c[1] * k)), Math.max(0, Math.min(255, c[2] * k))];
}

function hex(c) {
  return '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

export const darker = (color, k = 0.7) => hex(tone(rgb(color), k));

// --- сетка пикселей для спрайтов ---

export class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Array(w * h).fill(null);
  }

  px(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (c && x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = c;
  }

  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.data[y * this.w + x] : null;
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }

  // заливка эллипса со светом сверху слева и тенью снизу справа
  ellipse(cx, cy, rx, ry, c, dark = null, light = null) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        let color = c;
        if (dark && dx + dy > 0.5) color = dark;
        else if (light && dx + dy < -0.6) color = light;
        this.px(x, y, color);
      }
    }
  }

  line(x0, y0, x1, y1, c, width = 1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (x1 - x0) * i / steps, y = y0 + (y1 - y0) * i / steps;
      if (width > 1) this.rect(Math.round(x - (width - 1) / 2), Math.round(y), width, 1, c);
      else this.px(x, y, c);
    }
  }

  outline(color = OUT) {
    const add = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
      }
    }
    for (const [x, y] of add) this.data[y * this.w + x] = color;
    return this;
  }

  canvas(map = null) {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const ctx = c.getContext('2d'), img = ctx.createImageData(this.w, this.h);
    this.data.forEach((color, i) => {
      if (!color) return;
      const [r, g, b] = rgb(map ? map(color) : color);
      img.data.set([r, g, b, 255], i * 4);
    });
    ctx.putImageData(img, 0, 0);
    return c;
  }
}

const cache = new Map();
function remember(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

// --- текстуры лудуса ---

function cot() {
  const p = new Pix(22, 8);
  p.rect(0, 3, 22, 2, '#6b4329');
  p.rect(1, 5, 2, 3, '#4e2f1c');
  p.rect(19, 5, 2, 3, '#4e2f1c');
  for (let x = 1; x < 21; x++) {
    p.px(x, 1, x % 4 === 0 ? '#d8ccb6' : '#efe6d4');
    p.px(x, 2, x % 3 === 0 ? '#d2c3a8' : '#e4d8c2');
  }
  p.rect(1, 0, 5, 2, '#f6efe0');
  return p.outline().canvas();
}

function amphora(color) {
  const p = new Pix(8, 14);
  p.ellipse(4, 8, 3.6, 5, color, darker(color, 0.7), darker(color, 1.25));
  p.rect(3, 1, 2, 3, darker(color, 0.85));
  p.rect(2, 1, 4, 1, darker(color, 0.7));
  p.px(1, 4, darker(color, 0.7));
  p.px(6, 4, darker(color, 0.7));
  p.rect(3, 13, 2, 1, darker(color, 0.6));
  for (let x = 2; x < 7; x++) p.px(x, 7, '#2a1a10');
  return p.outline().canvas();
}

function statue() {
  const p = new Pix(30, 58);
  const m = '#e8e0d0', md = '#c4b9a6', ml = '#fbf7ee';
  p.rect(5, 44, 20, 14, '#b9ab95');
  p.rect(3, 42, 24, 3, '#d4c8b2');
  p.rect(3, 55, 24, 3, '#a39680');
  // фигура в хитоне
  for (let y = 16; y < 42; y++) {
    const half = 4 + (y - 16) * 0.17;
    for (let x = Math.round(14 - half); x <= Math.round(14 + half); x++) {
      const fold = (x + Math.floor(y / 3)) % 4 === 0;
      p.px(x, y, fold ? md : x < 13 ? ml : m);
    }
  }
  p.ellipse(14, 11, 3.5, 4, m, md, ml);
  p.rect(12, 6, 5, 2, md);
  p.line(18, 20, 23, 26, m, 2);
  // колесо Фортуны
  for (let a = 0; a < 24; a++) {
    const t = a / 24 * Math.PI * 2;
    p.px(24 + Math.cos(t) * 5, 28 + Math.sin(t) * 5, '#d9a441');
  }
  for (let k = 0; k < 4; k++) p.line(24 - Math.cos(k * 0.785) * 5, 28 - Math.sin(k * 0.785) * 5,
    24 + Math.cos(k * 0.785) * 5, 28 + Math.sin(k * 0.785) * 5, '#b8862e');
  p.px(24, 28, '#f2c94c');
  return p.outline().canvas();
}

function shelf() {
  const p = new Pix(24, 22);
  const jars = ['#7fb069', '#c9a227', '#a3c4d9', '#c9584a', '#9b7bc4'];
  for (const y of [8, 20]) p.rect(0, y, 24, 2, '#5a3a22');
  for (let k = 0; k < 5; k++) {
    const c = jars[k];
    p.rect(1 + k * 5, 3, 3, 5, c);
    p.px(1 + k * 5, 3, darker(c, 1.3));
    p.rect(1 + k * 5, 2, 3, 1, '#d8ccb6');
    const c2 = jars[(k + 2) % 5];
    p.rect(1 + k * 5, 15, 3, 5, c2);
    p.px(1 + k * 5, 15, darker(c2, 1.3));
  }
  return p.outline().canvas();
}

function plant() {
  const p = new Pix(14, 18);
  p.rect(4, 12, 6, 6, '#a8582f');
  p.rect(3, 12, 8, 2, '#c06a3a');
  for (let i = 0; i < 26; i++) {
    const a = hash(i, 1, 71) * Math.PI, r = 3 + hash(i, 2, 71) * 4;
    p.px(7 + Math.cos(a) * r * 1.1, 11 - Math.sin(a) * r, hash(i, 3, 71) > 0.5 ? '#4d7a2e' : '#3b5e22');
  }
  return p.outline().canvas();
}


// мягкие текстуры в полном разрешении: плавные градиенты и едва заметный шум, без швов кладки
const BAY_RECTS = COLUMNS.slice(0, -1).map((x, i) => ({ x: x + 13, w: COLUMNS[i + 1] - x - 26 }));

function smoothstep(a, b, v) {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function texel(x, y) {
  const grain = 1 + (hash(x, y, 3) - 0.5) * 0.025;
  if (y < WALL.top) {
    const beam = (y % 14) < 2 ? 0.9 : 1;
    return tone(rgb('#3d291c'), (0.8 + y / WALL.top * 0.25) * beam * grain);
  }
  if (y < WALL.floor) {
    // стена: тёплая штукатурка, тень под крышей и в нишах
    let k = 0.82 + 0.18 * smoothstep(WALL.top, WALL.top + 70, y);
    k *= 0.96 + 0.08 * noise(x, y, 70, 5);
    if (y < WALL.top + 12) k *= y < WALL.top + 3 ? 1.12 : 1.04;
    const inBay = BAY_RECTS.some((b) => x > b.x && x < b.x + b.w) && y > WALL.top + 30;
    if (inBay) k *= 0.86 - 0.05 * smoothstep(WALL.floor - 40, WALL.floor, y);
    return tone(rgb('#76533b'), k * grain);
  }
  if (y < WALL.step) {
    // пол галереи: плавный, с еле заметными полосами
    let k = 0.86 + 0.14 * smoothstep(WALL.floor, WALL.step, y);
    if ((y - WALL.floor) % 16 === 0) k *= 0.95;
    if (y < WALL.floor + 6) k *= 0.8 + 0.2 * smoothstep(WALL.floor, WALL.floor + 6, y);
    k *= 0.97 + 0.06 * noise(x, y, 50, 9);
    return tone(rgb('#9a6f4e'), k * grain);
  }
  if (y < WALL.sand) {
    const k = y < WALL.step + 2 ? 1.18 : 0.78;
    return tone(rgb('#8a6447'), k * grain);
  }
  if (y < WALL.front) {
    // песок: светлый, с мягкой тенью от галереи и лёгкими разводами
    let k = 0.84 + 0.16 * smoothstep(WALL.sand, WALL.sand + 40, y);
    k *= 0.97 + 0.05 * noise(x, y, 90, 21) + 0.025 * noise(x, y, 24, 22);
    k *= 1 - 0.05 * Math.pow(Math.abs(x - FIELD_W / 2) / (FIELD_W / 2), 2);
    return tone(rgb('#ead8b2'), k * grain);
  }
  let k = 0.85 + 0.1 * noise(x * 0.15, y, 6, 31);
  if ((y - WALL.front) % 12 === 0) k *= 0.85;
  return tone(rgb('#4d3121'), k * grain);
}

function softColumn(ctx, cx) {
  const top = WALL.top + 12, bottom = WALL.step, w = 24, mid = top + (bottom - top) * 0.52;
  const body = (y0, y1, base) => {
    const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    g.addColorStop(0, darker(base, 0.78));
    g.addColorStop(0.38, darker(base, 1.08));
    g.addColorStop(0.62, base);
    g.addColorStop(1, darker(base, 0.7));
    ctx.fillStyle = g;
    ctx.fillRect(cx - w / 2, y0, w, y1 - y0);
  };
  ctx.fillStyle = 'rgba(40,20,10,.18)';
  ctx.fillRect(cx - w / 2 + 6, top, w, bottom - top);
  body(top + 8, mid, '#c99278');
  body(mid, bottom - 8, '#ddc6ae');
  for (const [y, h] of [[top, 9], [bottom - 9, 9]]) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#e2c4a6');
    g.addColorStop(1, '#a9876a');
    ctx.fillStyle = g;
    ctx.fillRect(cx - w / 2 - 5, y, w + 10, h);
  }
}

function softDoor(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#3a2519');
  g.addColorStop(1, '#4d3324');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  for (let i = 1; i < 4; i++) ctx.fillRect(x + i * w / 4, y + 2, 1, h - 2);
  ctx.fillStyle = '#5e4130';
  ctx.fillRect(x - 3, y - 4, w + 6, 4);
}

function softBench(ctx, x, y, w) {
  ctx.fillStyle = 'rgba(40,20,10,.2)';
  ctx.fillRect(x + 3, y + 5, w, 9);
  const g = ctx.createLinearGradient(0, y - 4, 0, y + 4);
  g.addColorStop(0, '#a77a56');
  g.addColorStop(1, '#6e4a31');
  ctx.fillStyle = g;
  ctx.fillRect(x, y - 4, w, 7);
  ctx.fillStyle = '#5a3b27';
  ctx.fillRect(x + 6, y + 3, 5, 10);
  ctx.fillRect(x + w - 11, y + 3, 5, 10);
}

function softRailing(ctx) {
  const top = WALL.rail, bottom = WALL.front;
  ctx.fillStyle = 'rgba(40,20,10,.16)';
  ctx.fillRect(0, top - 8, FIELD_W, 10);
  for (let x = 16; x < FIELD_W; x += 22) {
    const g = ctx.createLinearGradient(x, 0, x + 6, 0);
    g.addColorStop(0, '#7d5539');
    g.addColorStop(1, '#5a3a26');
    ctx.fillStyle = g;
    ctx.fillRect(x, top + 6, 6, bottom - top - 6);
  }
  const rail = (y, h) => {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#a3734f');
    g.addColorStop(1, '#6a4630');
    ctx.fillStyle = g;
    ctx.fillRect(0, y, FIELD_W, h);
  };
  rail(top, 9);
  rail(top + 22, 6);
  for (let x = 8; x < FIELD_W; x += 132) {
    const g = ctx.createLinearGradient(x, 0, x + 14, 0);
    g.addColorStop(0, '#8a603f');
    g.addColorStop(1, '#55382a');
    ctx.fillStyle = g;
    ctx.fillRect(x, top - 12, 14, bottom - top + 12);
    ctx.fillStyle = '#a3734f';
    ctx.fillRect(x - 2, top - 16, 18, 5);
  }
}

// возвращает таблички для чёткого слоя; фон рисуется в полном разрешении поля
export function paintLudusArt(ctx) {
  const img = ctx.createImageData(FIELD_W, FIELD_H);
  for (let y = 0; y < FIELD_H; y++) {
    for (let x = 0; x < FIELD_W; x++) img.data.set([...texel(x, y), 255], (y * FIELD_W + x) * 4);
  }
  ctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const put = (canvas, x, y) => ctx.drawImage(canvas, Math.round(x), Math.round(y), canvas.width * P, canvas.height * P);
  for (const i of BAYS.rest) {
    const x = bayX(i);
    softDoor(ctx, x + 50, WALL.floor - 128, 56, 128);
    put(amphora('#9a5a36'), x + 12, WALL.floor - 28);
    put(amphora('#86502f'), x + 128, WALL.floor - 28);
  }
  for (const i of BAYS.rest) {
    softBench(ctx, bayX(i) + 6, 262 - 2, BAY_W - 12);
    softBench(ctx, bayX(i) + 18, 286 - 2, BAY_W - 28);
  }
  const tx = bayX(BAYS.temple[0]);
  const glow = ctx.createRadialGradient(tx + BAY_W / 2, 150, 10, tx + BAY_W / 2, 150, 110);
  glow.addColorStop(0, 'rgba(255,210,140,.16)');
  glow.addColorStop(1, 'rgba(255,210,140,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(tx, WALL.top, BAY_W, WALL.floor - WALL.top);
  put(statue(), tx + BAY_W / 2 - 30, WALL.floor - 116);
  put(plant(), tx + 18, WALL.floor - 36);
  put(plant(), tx + BAY_W - 46, WALL.floor - 36);
  for (const i of BAYS.heal) {
    const x = bayX(i);
    softDoor(ctx, x + 56, WALL.floor - 118, 48, 118);
    put(shelf(), x + 4, 112);
    put(shelf(), x + 108, 112);
  }
  for (const s of PLACES.heal.seats) if (s.y < WALL.step) put(cot(), s.x - 22, s.y - 6);
  for (const cx of COLUMNS) softColumn(ctx, cx);
  softRailing(ctx);
  // тёплая дымка поверх всего, как на старой плёнке
  const haze = ctx.createLinearGradient(0, 0, 0, FIELD_H);
  haze.addColorStop(0, 'rgba(120,60,30,.10)');
  haze.addColorStop(0.5, 'rgba(255,220,170,.04)');
  haze.addColorStop(1, 'rgba(60,30,15,.12)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  const signs = [];
  signs.push([(bayX(BAYS.rest[0]) + bayX(BAYS.rest[1]) + BAY_W) / 2, 72, 'Зона отдыха', 14, '#5d4426']);
  signs.push([bayX(BAYS.temple[0]) + BAY_W / 2, 72, 'Лудильня', 14, '#7a5a2a']);
  signs.push([(bayX(BAYS.heal[0]) + bayX(BAYS.heal[1]) + BAY_W) / 2, 72, 'Лазарет', 14, '#6b2f28']);
  return signs;
}

// --- тренировочные мишени ---

function dummyArt(kind) {
  const p = new Pix(30, 40), wood = '#6b4329', woodL = '#8a5a38', woodD = '#4a2c1a';
  const post = (x, top, w = 3) => {
    p.rect(x, top, w, 40 - top, wood);
    p.rect(x, top, 1, 40 - top, woodL);
    p.rect(x + w - 1, top, 1, 40 - top, woodD);
  };
  if (kind === 'shield') {
    post(14, 10);
    p.rect(8, 22, 15, 2, woodD);
    p.ellipse(15.5, 18, 8, 8, '#6d5a3a', '#4f412a', '#8c7650');
    p.ellipse(15.5, 18, 5.5, 5.5, '#8a7348', '#6d5a3a', '#a68c5c');
    p.ellipse(15.5, 18, 2, 2, '#c9a24a', '#8a6a2a');
    p.rect(12, 6, 7, 4, '#3a3632');
  } else if (kind === 'straw') {
    post(14, 4);
    p.rect(4, 12, 23, 2, woodD);
    for (let y = 10; y < 28; y++) for (let x = 10; x < 21; x++) {
      if (Math.abs(x - 15.5) > 5 - (y < 13 ? 13 - y : 0)) continue;
      p.px(x, y, (x + y) % 3 ? '#d9b75e' : '#b8953f');
    }
    for (const y of [15, 21]) p.rect(10, y, 11, 1, '#7a5a2a');
    p.ellipse(15.5, 6, 4.5, 4.5, '#c9a87a', '#a8865a', '#e0c49a');
    p.rect(12, 9, 7, 1, '#7a5a2a');
    p.px(14, 6, '#5a3a22');
    p.px(17, 6, '#5a3a22');
  } else if (kind === 'palus') {
    for (let y = 6; y < 40; y++) for (let x = 12; x < 19; x++) {
      const k = x === 12 ? 1.25 : x === 18 ? 0.7 : 0.9 + 0.2 * noise(x * 4, y * 0.4, 2, 101);
      p.px(x, y, hex(tone(rgb(wood), k)));
    }
    p.ellipse(15.5, 6, 3.5, 2, woodL, wood);
    for (const y of [14, 26]) p.rect(11, y, 9, 2, '#a89060');
    for (const [x, y] of [[14, 18], [16, 20], [15, 31], [13, 34]]) p.px(x, y, woodD);
  } else if (kind === 'target') {
    p.line(15, 20, 8, 39, woodD, 2);
    p.line(15, 20, 22, 39, woodD, 2);
    post(14, 22, 2);
    const rings = ['#e8dfc4', '#c8302a', '#e8dfc4', '#c8302a', '#f2c94c'];
    rings.forEach((c, i) => p.ellipse(15.5, 14, 10 - i * 2, 10 - i * 2, c));
    for (let a = 0; a < 40; a++) {
      const t = a / 40 * Math.PI * 2;
      p.px(15.5 + Math.cos(t) * 9.5, 14 + Math.sin(t) * 9.5, '#b8953f');
    }
  } else {
    // рама с мешком: мешок рисуется отдельно и качается
    post(3, 2);
    post(25, 2);
    p.rect(3, 1, 25, 3, wood);
    p.rect(3, 1, 25, 1, woodL);
    p.rect(15, 4, 1, 5, '#a89060');
  }
  return p.outline().canvas();
}

function sackArt() {
  const p = new Pix(12, 18);
  for (let y = 0; y < 18; y++) {
    const half = y < 3 ? 2 + y : Math.min(5, 3 + y * 0.3);
    for (let x = Math.round(6 - half); x < Math.round(6 + half); x++) p.px(x, y, (x * 2 + y) % 5 ? '#a8865a' : '#8a6a42');
  }
  p.rect(3, 3, 6, 1, '#5a3a22');
  return p.outline().canvas();
}

export const DUMMY_KINDS = ['shield', 'straw', 'palus', 'target', 'bag'];

export function drawDummyArt(ctx, kind, x, y, hit, t) {
  const sprite = remember('dummy:' + kind, () => dummyArt(kind));
  const wobble = Math.sin(hit * 30) * hit;
  ctx.save();
  ctx.translate(Math.round(x / P) * P, Math.round(y / P) * P);
  ctx.scale(P, P);
  ctx.fillStyle = 'rgba(40,20,10,.28)';
  ctx.fillRect(-11, -1, 22, 3);
  if (kind === 'bag') {
    ctx.drawImage(sprite, -15, -40);
    const sack = remember('sack', sackArt);
    ctx.translate(0, -31);
    ctx.rotate(wobble * 0.9 + Math.sin(t * 1.3 + x) * 0.04);
    ctx.drawImage(sack, -6, 0);
  } else {
    ctx.rotate(wobble * 0.25);
    ctx.drawImage(sprite, -15, -40);
  }
  ctx.restore();
}

// --- гладиаторы: высокие стройные фигуры в профиль, как в Domina — без обводки, только тени ---

const SKINS = ['#e6cdad', '#d7b391', '#bf9472', '#9c7052', '#76523b'];
const HAIR = ['#2b1d14', '#4a2f1c', '#6e4424', '#a8823e', '#1c1410'];
const METALS = ['#4b4540', '#5c4d3f', '#7a6243', '#6c7176', '#868c92', '#a2a7ac', '#b8954a'];
const BLADES = ['#8a6a44', '#b08250', '#9aa1a8', '#d6dde3', '#bcd8ec', '#c4ecd6', '#e8c35a'];
const CLOTH = '#e9e0cf';
const CLOTH_D = '#bdb09a';
const BELT = '#4a3426';
const GUARD = '#3f3833';
export const HELMETS = ['murmillo', 'thraex', 'secutor', 'hoplo', 'bare'];
export const SPRITE = { w: 24, h: 40, x: 12, foot: 39, hand: [6, 19] };

// цвет игрока приглушаем, чтобы щит и гребень не кричали на фоне мягкого лудуса
function muted(color) {
  const [r, g, b] = rgb(color), l = (r + g + b) / 3;
  return hex([r * 0.72 + l * 0.18, g * 0.72 + l * 0.18, b * 0.72 + l * 0.18]);
}

// снаряжение по слотам видно на фигуре: шлем, броня, поножи, сапоги — каждое своей редкостью
export function lookOf(g, seed) {
  const style = HELMETS[seed % (HELMETS.length - 1)];
  const gear = g.gear || {};
  const head = tierOf(gear.head);
  return {
    color: muted(g.color), head, body: tierOf(gear.body), legs: tierOf(gear.legs), feet: tierOf(gear.feet),
    helmet: head ? style : 'bare',
    skin: SKINS[(seed >>> 3) % SKINS.length], hair: HAIR[(seed >>> 6) % HAIR.length],
    shield: !shieldUp(g) ? 'none' : SHIELD_SHAPES[(seed >>> 11) % SHIELD_SHAPES.length],
    design: (seed >>> 9) % 3,
    net: netUp(g) && !(g.netCool > 0),
  };
}

const gearKey = (look) => [look.head, look.body, look.legs, look.feet].join('');
const BOOTS = ['#5a3a22', '#6b4329', '#4a3426', '#5c4d3f', '#6c7176', '#868c92', '#b8954a'];

// поза: stand, walk1, walk2, sit, kneel. Ступни на y = 39, центр x = 12, смотрит вправо
function gladiatorArt(look, pose, dead) {
  const p = new Pix(SPRITE.w, SPRITE.h);
  const skin = look.skin, skinD = darker(skin, 0.8), skinL = darker(skin, 1.07);
  const shade3 = (tier) => [METALS[tier], darker(METALS[tier], 0.68), darker(METALS[tier], 1.3)];
  const [metal, metalD, metalL] = shade3(look.head);
  const [bodyM, bodyD, bodyL] = shade3(look.body);
  const [legM, legD, legL] = shade3(look.legs);
  const color = look.color, colorD = darker(color, 0.68), colorL = darker(color, 1.15);
  const dy = pose === 'sit' ? 11 : pose === 'kneel' ? 7 : 0;
  // обувь по редкости: сандалии с ремнями до голени, кожаные ботинки, высокие сапоги с пластиной, золото
  const boot = look.feet, bootM = METALS[Math.max(1, boot)];
  const foot = (x, y) => {
    if (boot === 1) {
      p.rect(x - 1, y, 4, 1, BELT);
      for (const [dx, dy2] of [[0, -1], [1, -2], [0, -3], [1, -4]]) p.px(x + dx, y + dy2, '#5c3b24');
      return;
    }
    if (boot === 2) {
      p.rect(x - 1, y - 3, 3, 3, '#6b4329');
      p.px(x - 1, y - 3, '#8a5a38');
      p.rect(x + 2, y - 1, 1, 1, '#6b4329');
      p.rect(x - 1, y, 4, 1, '#3a2418');
      return;
    }
    if (boot >= 3) {
      p.rect(x - 1, y - 6, 3, 6, '#55382a');
      p.rect(x - 1, y - 6, 1, 6, '#6e4a36');
      p.rect(x, y - 6, 2, 3, bootM);
      p.px(x, y - 6, darker(bootM, 1.3));
      p.rect(x + 2, y - 1, 1, 1, '#55382a');
      p.rect(x - 1, y, 4, 1, boot >= 6 ? '#b8954a' : '#2e1c12');
      if (boot >= 6) p.rect(x - 1, y - 6, 3, 1, '#e8c35a');
      return;
    }
    p.rect(x - 1, y, 4, 1, BELT);
    p.px(x - 1, y - 1, BELT);
  };
  // ноги: дальняя — темнее, на ближней поножи
  if (pose === 'sit') {
    p.rect(11, 34, 7, 2, skin);
    p.rect(11, 36, 7, 1, skinD);
    p.rect(16, 36, 2, 3, skin);
    foot(17, 39);
    p.rect(13, 36, 2, 3, skinD);
    foot(14, 39);
    if (look.legs) p.rect(16, 36, 2, 2, legM);
  } else if (pose === 'kneel') {
    p.line(11, 31, 8, 38, skinD, 3);
    foot(8, 39);
    p.line(14, 31, 18, 33, skin, 3);
    p.line(18, 33, 18, 38, skin, 3);
    foot(19, 39);
  } else {
    const back = pose === 'walk1' ? 6 : pose === 'walk2' ? 10 : 7;
    const front = pose === 'walk1' ? 18 : pose === 'walk2' ? 14 : 17;
    p.line(11, 24, back, 38, skinD, 3);
    foot(back, 39);
    const knee = [Math.round((14 + front) / 2) + 1, 31];
    p.line(14, 24, knee[0], knee[1], skin, 3);
    p.line(knee[0], knee[1], front, 38, skin, 3);
    foot(front + 1, 39);
    for (const y of [26, 28]) p.rect(13 + (knee[0] - 14) * (y - 24) / 7, y, 3, 1, '#d6cab5');
    // поножи по редкости: обмотки, бронзовая поножа спереди, поножи на обеих ногах с наколенником
    const shinX = (k, f, y) => Math.round(k + (f - k) * (y - 31) / 7);
    const backKnee = Math.round((11 + back) / 2);
    const plate = (k, f, light, top = 31, bottom = 36) => {
      for (let y = top; y <= bottom; y++) {
        const x = shinX(k, f, y);
        p.px(x - 1, y, light ? legL : legM);
        p.px(x, y, legM);
        p.px(x + 1, y, light ? legD : darker(legD, 0.85));
      }
      p.px(shinX(k, f, top), top, legL);
    };
    const wraps = (k, f, c) => {
      for (const y of [32, 34, 36]) {
        const x = shinX(k, f, y);
        p.rect(x - 1, y, 3, 1, c);
      }
    };
    if (look.legs === 1) {
      wraps(knee[0], front, '#d8ccb2');
      wraps(backKnee, back, '#a89c86');
    } else if (look.legs === 2) {
      plate(knee[0], front, true);
      wraps(backKnee, back, '#a89c86');
    } else if (look.legs >= 3) {
      plate(knee[0], front, true, 30);
      plate(backKnee, back, false, 31);
      p.rect(knee[0] - 1, 29, 3, 2, legM);
      p.px(knee[0] - 1, 29, legL);
      if (look.legs >= 4) for (const y of [25, 27]) p.rect(13 + (knee[0] - 14) * (y - 24) / 7, y, 3, 1, legD);
    }
  }
  // руки в стойке и на ходу рисуются отдельно (draw.js) и двигаются вместе с оружием
  const live = pose === 'stand' || pose === 'walk1' || pose === 'walk2';
  if (pose === 'kneel') {
    p.line(14, 13 + dy, 18, 5 + dy, skin, 2);
    p.rect(17, 0 + dy, 5, 4, '#f2eee4');
  } else if (!live) {
    p.line(11, 13 + dy, 7, 19 + dy, GUARD, 2);
    p.line(11, 13 + dy, 9, 16 + dy, darker(GUARD, 1.3));
    p.rect(5, 18 + dy, 2, 2, skinD);
  }
  // набедренная повязка и пояс
  for (let y = 21; y < 25; y++) for (let x = 10; x < 16; x++) {
    if (y === 24 && (x === 10 || x === 15)) continue;
    p.px(x, y + dy, x === 10 || (x * 2 + y) % 5 === 0 ? CLOTH_D : CLOTH);
  }
  if (look.body >= 3) {
    // птеруги — кожаные полосы поверх повязки
    for (let x = 10; x < 16; x++) {
      const strip = x % 2 === 0;
      p.rect(x, 21 + dy, 1, 3, strip ? '#6b4a33' : look.body >= 6 ? '#b8954a' : color);
      if (strip) p.px(x, 24 + dy, look.body >= 4 ? '#d8b46a' : '#8a6246');
    }
  } else {
    p.rect(14, 21 + dy, 1, 3, color);
  }
  p.rect(10, 20 + dy, 6, 1, look.body >= 4 ? '#b8954a' : BELT);
  if (look.body >= 1) p.px(13, 20 + dy, '#d8b46a');
  // торс, чуть подан вперёд
  for (let y = 11; y < 20; y++) {
    const lean = y < 14 ? 1 : 0;
    for (let x = 10 + lean; x < 16 + lean; x++) {
      p.px(x, y + dy, x === 10 + lean ? skinD : x === 15 + lean ? skinL : skin);
    }
  }
  p.rect(13, 14 + dy, 2, 1, skinD);
  p.px(13, 17 + dy, skinD);
  // броня по редкости: кожаная перевязь, + наплечник, бронзовая кираса, сегментата, золотая кираса с плащом
  const tier = look.body, leather = '#6b4a33', leatherL = '#8a6246', rivet = '#d8b46a';
  const torsoX = (y) => (y < 14 ? 11 : 10);
  if (tier === 1 || tier === 2) {
    p.line(11, 11 + dy, 15, 19 + dy, leather);
    p.line(15, 11 + dy, 11, 19 + dy, leather);
    p.px(12, 12 + dy, leatherL);
    p.px(13, 15 + dy, rivet);
  }
  if (tier === 2 || tier === 4) {
    // наплечник на ближнем плече — сегменты
    p.rect(14, 9 + dy, 3, 1, bodyL);
    p.rect(14, 10 + dy, 4, 1, bodyM);
    p.rect(15, 11 + dy, 3, 1, bodyD);
  }
  if (tier === 3 || tier >= 6) {
    // мускульная кираса
    for (let y = 11; y < 20; y++) {
      const x0 = torsoX(y) + 1;
      for (let x = x0; x < x0 + 5; x++) p.px(x, y + dy, x === x0 ? bodyD : x === x0 + 4 ? bodyL : bodyM);
    }
    p.rect(12, 11 + dy, 4, 1, bodyD);
    p.rect(13, 14 + dy, 3, 1, bodyD);
    p.px(14, 13 + dy, bodyL);
    p.px(14, 16 + dy, bodyD);
    p.px(14, 18 + dy, bodyD);
    p.px(12, 17 + dy, bodyL);
  }
  if (tier === 4) {
    // лорика сегментата — полосы
    for (let y = 11; y < 20; y++) {
      const x0 = torsoX(y) + 1;
      const band = (y - 11) % 2 === 0;
      for (let x = x0; x < x0 + 5; x++) p.px(x, y + dy, band ? (x === x0 ? bodyM : bodyL) : (x === x0 ? bodyD : bodyM));
    }
    for (let y = 12; y < 20; y += 2) p.px(15, y + dy, rivet);
  }
  if (tier >= 6) {
    p.rect(8, 11 + dy, 2, 12, '#8e2c28');
    p.rect(8, 11 + dy, 1, 12, '#6e1f1c');
    p.px(13, 15 + dy, '#fff2c0');
  }
  // шлем с гребнем, отброшенным назад
  const H = 4 + dy;
  p.rect(12, 10 + dy, 3, 1, skinD);
  if (look.helmet === 'bare') {
    p.rect(11, H + 1, 5, 5, skin);
    p.rect(11, H + 1, 1, 5, skinD);
    p.rect(11, H, 5, 2, look.hair);
    p.rect(11, H + 2, 2, 3, look.hair);
    p.px(15, H + 3, '#3a2a20');
    p.rect(11, H + 2, 5, 1, color);
    p.px(10, H + 3, color);
  } else {
    for (let y = 0; y < 6; y++) for (let x = 11; x < 16; x++) {
      if (y === 0 && (x === 11 || x === 15)) continue;
      p.px(x, H + y, x === 11 ? metalD : y === 0 || (x === 12 && y < 3) ? metalL : metal);
    }
    if (look.helmet === 'secutor') {
      p.px(15, H + 2, '#1e1915');
      p.rect(12, H - 1, 3, 1, metal);
      p.px(13, H - 2, color);
    } else {
      p.rect(14, H + 2, 2, 2, '#1e1915');
      p.px(15, H + 2, darker(metal, 0.5));
      p.rect(10, H + 5, 7, 1, metalD);
    }
    if (look.helmet === 'murmillo' || look.helmet === 'thraex') {
      const tall = look.helmet === 'murmillo' ? 3 : 2;
      for (let i = 0; i < 6; i++) p.rect(14 - i, H - tall + Math.floor(i / 2), 1, tall, i < 2 ? colorL : i < 4 ? color : colorD);
      p.px(8, H + 1, colorD);
      if (look.helmet === 'thraex') p.line(14, H - 1, 16, H - 2, metal);
    } else if (look.helmet === 'hoplo') {
      p.line(12, H, 10, H - 4, color);
      p.line(14, H, 15, H - 4, colorL);
    }
  }
  if (pose === 'sit') {
    // сидя ближняя рука лежит на колене
    p.line(14, 12 + dy, 16, 17 + dy, skin, 2);
    p.rect(16, 17 + dy, 2, 2, skinL);
  }
  if (!dead) return p.canvas();
  return p.canvas((c) => {
    const [r, g, b] = rgb(c), l = (r + g + b) / 3;
    return hex([l * 0.55 + r * 0.15, l * 0.5 + g * 0.1, l * 0.5 + b * 0.1]);
  });
}

// лежит на спине, голова слева: в лазарете под одеялом, на арене — без
function lyingArt(look, blanket, dead) {
  const p = new Pix(25, 9);
  const skin = look.skin, skinD = darker(skin, 0.8), metal = METALS[look.head], metalD = darker(metal, 0.7);
  p.rect(14, 5, 8, 2, skin);
  p.rect(14, 7, 8, 1, skinD);
  p.rect(22, 4, 2, 3, BELT);
  p.rect(11, 4, 3, 4, CLOTH);
  p.rect(11, 4, 1, 4, BELT);
  for (let x = 5; x < 11; x++) for (let y = 4; y < 8; y++) p.px(x, y, y === 7 ? skinD : skin);
  if (look.body >= 2) p.rect(5, 4, 5, 3, METALS[look.body]);
  p.rect(6, 7, 7, 1, GUARD);
  if (look.helmet === 'bare') {
    p.rect(1, 3, 4, 4, skin);
    p.rect(0, 3, 2, 4, look.hair);
  } else {
    p.rect(0, 3, 5, 5, metal);
    p.rect(0, 3, 5, 1, metalD);
    p.rect(0, 4, 1, 2, look.color);
  }
  if (blanket) {
    for (let x = 8; x < 24; x++) for (let y = 3; y < 8; y++) {
      p.px(x, y, y === 3 ? '#f7f1e4' : (x + y) % 5 === 0 ? '#d2c6b0' : '#e7ddca');
    }
  }
  if (!dead) return p.canvas();
  return p.canvas((c) => {
    const [r, g, b] = rgb(c), l = (r + g + b) / 3;
    return hex([l * 0.55 + r * 0.15, l * 0.5 + g * 0.1, l * 0.5 + b * 0.1]);
  });
}

export function lyingSprite(look, blanket, dead) {
  return remember(['lie4', look.color, gearKey(look), look.helmet, look.skin, look.hair, blanket, dead].join(':'),
    () => lyingArt(look, blanket, dead));
}

// оружие смотрит клинком вверх; pivot — где его держит рука
function weaponArt(type, tier) {
  const blade = BLADES[Math.min(BLADES.length - 1, tier)];
  if (type === 'greatsword') {
    const p = new Pix(4, 21);
    p.rect(1, 1, 2, 14, blade);
    p.px(1, 0, blade);
    p.rect(2, 1, 1, 14, darker(blade, 0.72));
    p.rect(0, 15, 4, 1, '#6b5236');
    p.rect(1, 16, 2, 4, '#4a3426');
    p.rect(1, 20, 2, 1, '#8a7044');
    return { canvas: p.canvas(), px: 1.5, py: 18 };
  }
  if (type === 'spear') {
    const p = new Pix(3, 30);
    p.px(1, 0, blade);
    p.rect(0, 1, 3, 3, blade);
    p.rect(2, 1, 1, 3, darker(blade, 0.72));
    p.px(1, 4, darker(blade, 0.8));
    p.rect(1, 5, 1, 25, '#7a5636');
    for (const y of [14, 22]) p.px(1, y, '#5a3e26');
    return { canvas: p.canvas(), px: 1, py: 20 };
  }
  const p = new Pix(3, 13);
  p.rect(1, 0, 1, 8, blade);
  p.rect(2, 1, 1, 7, darker(blade, 0.72));
  p.rect(0, 8, 3, 1, '#6b5236');
  p.rect(1, 9, 1, 3, '#4a3426');
  p.px(1, 12, '#8a7044');
  return { canvas: p.canvas(), px: 1, py: 11 };
}

// сеть: витая верёвка в два тона, узлы темнее, край — толстый шнур, по краю свинцовые грузила с бликом
function meshArt(w, h, shape, cell = 4) {
  const p = new Pix(w, h);
  const ropeL = '#eadcb4', rope = '#cdb98a', knot = '#8a7550', edge = '#9c8659', lead = '#4e5257', leadL = '#8a9096';
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && shape(x, y);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside(x, y)) continue;
    const a = (x + y) % cell === 0, b = (x - y + 400) % cell === 0;
    const border = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    if (border) p.px(x, y, edge);
    else if (a && b) p.px(x, y, knot);
    else if (a || b) p.px(x, y, ((x + y) >> 1) % 2 ? ropeL : rope);
  }
  // грузила по нижнему краю
  for (let x = 1; x < w - 1; x += 4) for (let y = h - 1; y >= 0; y--) {
    if (!inside(x, y)) continue;
    p.rect(x, y - 1, 2, 2, lead);
    p.px(x, y - 1, leadL);
    break;
  }
  return p;
}

function netArt() {
  const p = meshArt(20, 20, (x, y) => Math.hypot(x - 9.5, y - 9.5) < 9.4 + Math.sin(x * 1.7 + y) * 0.5, 3);
  // грузила по всему кругу у летящей сети
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    p.rect(Math.round(9 + Math.cos(a) * 8.6), Math.round(9 + Math.sin(a) * 8.6), 2, 2, '#4e5257');
  }
  return p.canvas();
}

// накинутая на гладиатора сеть: свисает с головы и расходится книзу
function netOverArt() {
  const p = meshArt(26, 40, (x, y) => y > 1 && Math.abs(x - 12.5) < 4.5 + y * 0.23 + Math.sin(y * 0.9) * 0.6, 3);
  p.rect(10, 1, 6, 2, '#9c8659');
  p.px(12, 0, '#9c8659');
  return p.canvas();
}

// сеть в руке: перекинутая через кисть, свисает мотком, внизу грузила
function netHandArt() {
  const p = meshArt(10, 15, (x, y) => y >= 2 && Math.abs(x - 4.5) <= 1.5 + Math.min(3, (y - 2) * 0.45), 2);
  p.rect(3, 0, 4, 1, '#9c8659');
  p.px(3, 1, '#9c8659');
  p.px(6, 1, '#9c8659');
  return p.canvas();
}

// щиты: пять форм, по три рисунка; лицо — цвет игрока с объёмом, обод металлический с заклёпками
const SHIELD_MASKS = {
  round: { w: 12, h: 12, inside: (x, y) => Math.hypot(x + 0.5 - 6, y + 0.5 - 6) <= 5.9 },
  oval: { w: 10, h: 16, inside: (x, y) => ((x + 0.5 - 5) / 4.9) ** 2 + ((y + 0.5 - 8) / 7.9) ** 2 <= 1 },
  scutum: { w: 10, h: 17, inside: (x, y) => !((x === 0 || x === 9) && (y === 0 || y === 16)) },
  square: { w: 11, h: 11, inside: (x, y) => !((x === 0 || x === 10) && (y === 0 || y === 10)) },
  hex: { w: 12, h: 13, inside: (x, y) => Math.abs(x + 0.5 - 6) + Math.abs(y + 0.5 - 6.5) * 0.75 <= 7.2
    && Math.abs(x + 0.5 - 6) <= 5.6 },
};
export const SHIELD_SHAPES = Object.keys(SHIELD_MASKS);

function shieldArt(shape, design, color) {
  const m = SHIELD_MASKS[shape] || SHIELD_MASKS.round, w = m.w, h = m.h, p = new Pix(w, h);
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m.inside(x, y);
  const rimL = '#d8a85a', rim = '#a8743c', rimD = '#6e4a22', boss = '#d8b46a', bossL = '#fff0c0', gold = '#f2c94c';
  const cx = (w - 1) / 2, cy = (h - 1) / 2, base = rgb(color);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    if (edge) {
      const lit = x + y < cx + cy;
      p.px(x, y, lit ? rimL : x + y > cx + cy + 3 ? rimD : rim);
      continue;
    }
    // выпуклое лицо: светлее слева сверху, темнее справа снизу
    const k = 1.18 - 0.42 * ((x - 1) / Math.max(1, w - 3)) - 0.12 * ((y - 1) / Math.max(1, h - 3));
    p.px(x, y, hex(tone(base, k)));
  }
  // заклёпки по ободу
  let i = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside(x, y) || inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1)) continue;
    if (i++ % 4 === 0) p.px(x, y, bossL);
  }
  const X = Math.round(cx), Y = Math.round(cy), tall = h > w + 3;
  if (design === 0) {
    // умбон с лучами
    for (let a = 0; a < 8; a++) {
      const t = a * Math.PI / 4;
      for (let r = 2; r < Math.min(w, h) / 2 - 1; r++) {
        const x = Math.round(cx + Math.cos(t) * r * (w / h > 0.8 ? 1 : 0.8)), y = Math.round(cy + Math.sin(t) * r * (tall ? 1.4 : 1));
        if (inside(x, y)) p.px(x, y, hex(tone(base, 1.35)));
      }
    }
  } else if (design === 1) {
    // золотой крест-перекладины
    for (let y = 1; y < h - 1; y++) if (inside(X, y)) p.px(X, y, gold);
    for (let x = 1; x < w - 1; x++) if (inside(x, Y)) p.px(x, Y, gold);
    if (tall) for (let x = 1; x < w - 1; x++) for (const yy of [3, h - 4]) if (inside(x, yy)) p.px(x, yy, boss);
  } else if (tall) {
    // крылья
    for (let k = 0; k < 4; k++) {
      p.px(X - 1 - k, Y - 1 - k, gold);
      p.px(X + 1 + k, Y - 1 - k, gold);
      p.px(X - 1 - k, Y + 1 + k, boss);
      p.px(X + 1 + k, Y + 1 + k, boss);
    }
  } else {
    // венок
    for (let a = 0; a < 24; a++) {
      const t = a / 24 * Math.PI * 2, x = Math.round(cx + Math.cos(t) * (w / 2 - 2.6)), y = Math.round(cy + Math.sin(t) * (h / 2 - 2.6));
      if (inside(x, y) && a % 6 !== 5) p.px(x, y, a % 2 ? '#7fb069' : '#5d8a4a');
    }
  }
  // умбон в центре
  p.rect(X - 1, Y - 1, 2, 2, boss);
  p.px(X - 1, Y - 1, bossL);
  p.px(X, Y, rimD);
  return p.canvas();
}

export const shieldSprite = (shape, design, color) => remember(['shield2', shape, design, color].join(':'),
  () => shieldArt(shape, design, color));
export const netOverSprite = () => remember('net-over2', netOverArt);
export const netHandSprite = () => remember('net-hand2', netHandArt);
export const netSprite = () => remember('net2', netArt);

// лев в профиль, смотрит вправо: лапы на y = 23, центр x = 18. frame: stand, walk1, walk2, pounce, dead
function lionArt(frame) {
  const p = new Pix(38, 25);
  const fur = '#c8964f', furD = '#a5763a', furL = '#e2bb7c', mane = '#6e3c1a', maneL = '#8f5426', maneD = '#4e2810';
  const dead = frame === 'dead';
  const lift = frame === 'pounce' ? -3 : 0;
  // хвост с кисточкой
  p.line(7, 11, 3, 6, furD, 2);
  p.line(3, 6, 1, 9, furD);
  p.rect(0, 9, 3, 3, maneD);
  // лапы: дальние темнее
  const legs = frame === 'walk1' ? [[9, 7], [12, 14], [25, 22], [28, 30]] : frame === 'walk2' ? [[9, 11], [12, 10], [25, 26],
    [28, 26]] : frame === 'pounce' ? [[9, 8], [12, 11], [26, 31], [29, 33]] : [[9, 9], [12, 12], [25, 25], [28, 28]];
  if (!dead) {
    legs.forEach(([hip, foot], i) => {
      const far = i % 2 === 0, c = far ? furD : fur, top = i >= 2 ? 15 + lift : 15;
      p.line(hip, top, foot, 22, c, 3);
      p.rect(foot - 1, 23, 4, 1, far ? maneD : furD);
    });
  }
  // туловище
  for (let y = 9; y < 18; y++) {
    for (let x = 6; x < 29; x++) {
      const dx = (x + 0.5 - 17) / 11.5, dy = (y + 0.5 - 13 - (x > 20 ? lift * 0.5 : 0)) / 4.6;
      if (dx * dx + dy * dy > 1) continue;
      p.px(x, y, y < 11 ? furD : y > 15 ? furL : fur);
    }
  }
  // грива и голова
  const hx = 29, hy = 9 + lift;
  p.ellipse(hx - 1, hy, 6.2, 6.6, mane, maneD, maneL);
  for (let i = 0; i < 10; i++) p.px(hx - 6 + (i % 5) * 2, hy - 5 + Math.floor(i / 5) * 9, maneL);
  p.ellipse(hx + 2, hy + 1, 3.6, 3.4, fur, furD, furL);
  p.rect(hx + 4, hy + 1, 3, 3, furL);
  p.px(hx + 6, hy + 1, '#2a1a10');
  p.px(hx + 3, hy - 1, '#2a1a10');
  p.rect(hx + 4, hy + 4, 2, 1, '#7a2a20');
  p.px(hx, hy - 4, furD);
  if (!dead) return p.canvas();
  // мёртвый лев лежит на боку: лапы вытянуты, всё темнее
  p.rect(10, 18, 18, 2, furD);
  return p.canvas((c) => {
    const [r, g, b] = rgb(c), l = (r + g + b) / 3;
    return hex([l * 0.6 + r * 0.2, l * 0.55 + g * 0.15, l * 0.5 + b * 0.1]);
  });
}

export const lionSprite = (frame) => remember('lion:' + frame, () => lionArt(frame));
export const LION = { x: 18, foot: 23 };

function silhouette(canvas) {
  const c = document.createElement('canvas');
  c.width = canvas.width;
  c.height = canvas.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

export function gladiatorSprite(look, pose, dead = false, flash = false) {
  const key = ['g7', look.color, gearKey(look), look.helmet, look.shield, look.net, look.skin, look.hair, pose, dead, flash].join(':');
  return remember(key, () => {
    const art = remember(key.replace(/:(true|false)$/, ':false'), () => gladiatorArt(look, pose, dead));
    return flash ? silhouette(art) : art;
  });
}

export const weaponSprite = (type, tier) => remember('weapon:' + type + ':' + tier, () => weaponArt(type, tier));
