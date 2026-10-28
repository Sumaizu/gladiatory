// пиксельная графика как в Чатобороне: один пиксель рисунка — два пикселя поля, текстуры и спрайты с обводкой
import { BAYS, BAY_W, COLUMNS, FIELD_H, FIELD_W, PLACES, WALL, bayX } from './places.js';

export const P = 2;
const W = FIELD_W / P;
const H = FIELD_H / P;
const OUT = '#1c120c';

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

const WY = { top: WALL.top / P, floor: WALL.floor / P, step: WALL.step / P, sand: WALL.sand / P, rail: WALL.rail / P,
  front: WALL.front / P };

function texel(x, y) {
  if (y < WY.top) {
    // балки крыши
    const row = Math.floor(y / 7), k = 0.8 + 0.3 * noise(x * 0.25, y * 3, 4, 3 + row);
    return tone(rgb('#3a2418'), (y % 7 === 6 ? 0.55 : k) * (0.75 + y / WY.top * 0.3));
  }
  if (y < WY.floor) {
    // каменная кладка
    const row = Math.floor((y - WY.top) / 10), off = row % 2 ? 11 : 0, bx = Math.floor((x + off) / 22);
    const mortar = (y - WY.top) % 10 === 0 || (x + off) % 22 === 0;
    const shadow = Math.min(1, 0.55 + (y - WY.top) / 40);
    if (mortar) return tone(rgb('#4a2f20'), shadow);
    const k = (0.84 + 0.28 * hash(bx, row, 5)) * (0.9 + 0.2 * fbm(x, y, 9)) * (hash(x, y, 7) > 0.97 ? 0.85 : 1);
    return tone(rgb('#7a5238'), k * shadow);
  }
  if (y < WY.step) {
    // терракотовая плитка галереи
    const row = Math.floor((y - WY.floor) / 8), off = row % 2 ? 8 : 0;
    const grout = (y - WY.floor) % 8 === 0 || (x + off) % 16 === 0;
    if (grout) return rgb('#5c3824');
    const k = (0.86 + 0.22 * hash(Math.floor((x + off) / 16), row, 9)) * (0.92 + 0.14 * fbm(x, y, 11));
    const dark = y - WY.floor < 3 ? 0.7 : 1;
    return tone(rgb('#99623f'), k * dark);
  }
  if (y < WY.sand) return y === WY.step ? rgb('#c79a6c') : tone(rgb('#5e3a24'), 0.9 + 0.2 * hash(x, y, 13));
  if (y < WY.front) {
    // песок: шум, лёгкая рябь, камешки, тень от галереи
    const n = fbm(x, y, 21);
    let k = 0.9 + 0.17 * n + 0.025 * Math.sin(x * 0.18 + y * 0.9 + n * 7);
    if (y < WY.sand + 8) k *= 0.78 + (y - WY.sand) / 8 * 0.22;
    if (hash(x, y, 23) > 0.993) k *= 0.8;
    if (hash(x, y, 29) > 0.996) k *= 1.12;
    return tone(rgb('#e2c497'), k);
  }
  // доски пола у перил
  const row = Math.floor((y - WY.front) / 6);
  if ((y - WY.front) % 6 === 0) return rgb('#22130b');
  const seam = Math.floor((x + row * 37) / 64);
  if ((x + row * 37) % 64 === 0) return rgb('#22130b');
  const grain = 0.85 + 0.25 * noise(x * 0.12, y * 2.5, 3, 31 + seam);
  return tone(rgb('#4a2c1a'), grain * (0.9 + 0.15 * hash(seam, row, 33)));
}

function column(h) {
  const w = 14, p = new Pix(w + 6, h);
  const top = rgb('#c98b6b'), low = rgb('#e6c9ad'), mid = Math.floor(h * 0.55);
  for (let y = 5; y < h - 5; y++) {
    for (let x = 3; x < w + 3; x++) {
      const u = (x - 3 + 0.5) / w;
      let k = 0.62 + 0.5 * Math.sin(Math.PI * u) - (u > 0.35 && u < 0.45 ? -0.12 : 0);
      if ((x - 3) % 3 === 2) k *= 0.88;
      k *= 0.95 + 0.08 * hash(x, y, 41);
      p.px(x, y, hex(tone(y < mid ? top : low, k)));
    }
  }
  for (const y0 of [0, h - 5]) {
    for (let y = y0; y < y0 + 5; y++) {
      for (let x = 0; x < w + 6; x++) {
        const k = (y === y0 ? 1.15 : y === y0 + 4 ? 0.7 : 0.95) * (0.92 + 0.1 * hash(x, y, 43));
        p.px(x, y, hex(tone(rgb('#d9b392'), k)));
      }
    }
  }
  return p.outline('#2a1a10').canvas();
}

function door(w, h) {
  const p = new Pix(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const plank = Math.floor(x / 5), seam = x % 5 === 0;
      const k = seam ? 0.6 : (0.8 + 0.25 * noise(x * 3, y * 0.3, 2, 51 + plank));
      const arch = y < 6 && Math.hypot(x - w / 2, (y - 6) * 1.6) > w / 2;
      if (arch) continue;
      p.px(x, y, hex(tone(rgb('#4a2c1c'), k)));
    }
  }
  for (const y of [8, Math.floor(h / 2), h - 6]) {
    p.rect(1, y, w - 2, 1, '#2a1a10');
    for (let x = 2; x < w - 1; x += 4) p.px(x, y, '#9a8a70');
  }
  p.px(Math.floor(w / 2) - 1, Math.floor(h / 2) + 3, '#c9a24a');
  p.px(Math.floor(w / 2) + 1, Math.floor(h / 2) + 3, '#c9a24a');
  return p.outline('#2a1a10').canvas();
}

function bench(w) {
  const p = new Pix(w, 8);
  for (let x = 0; x < w; x++) {
    const k = 0.85 + 0.25 * noise(x, 0, 6, 61);
    p.px(x, 0, hex(tone(rgb('#a8714a'), k * 1.15)));
    p.px(x, 1, hex(tone(rgb('#8a5a38'), k)));
    p.px(x, 2, hex(tone(rgb('#6b4329'), k)));
  }
  for (const x of [2, w - 5]) p.rect(x, 3, 3, 5, '#4e2f1c');
  return p.outline().canvas();
}

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
  return p.outline('#2a1a10').canvas();
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

function railing() {
  const h = WY.front - WY.rail + 2, p = new Pix(W, h);
  for (let x = 0; x < W; x++) {
    const k = 0.85 + 0.25 * noise(x, 0, 9, 81);
    p.px(x, 0, hex(tone(rgb('#a8714a'), k * 1.1)));
    for (let y = 1; y < 4; y++) p.px(x, y, hex(tone(rgb('#7a4a2a'), k * (1 - y * 0.06))));
    p.px(x, 10, hex(tone(rgb('#7a4a2a'), k)));
    p.px(x, 11, hex(tone(rgb('#5a361f'), k)));
    if (x % 11 >= 8) for (let y = 4; y < h - 1; y++) if (y < 10 || y > 11) p.px(x, y, hex(tone(rgb('#6b3f22'), k)));
  }
  for (let x = 4; x < W; x += 66) {
    p.rect(x, 0, 6, h, '#55321b');
    p.rect(x + 1, 0, 2, h, '#6e4428');
  }
  return p.outline('#22130b').canvas();
}

function ivy(seed) {
  const p = new Pix(16, 30);
  for (let i = 0; i < 60; i++) {
    const y = hash(i, seed, 91) * 30, spread = 2 + y * 0.18;
    p.px(8 + (hash(i, seed, 93) - 0.5) * spread * 2, y, hash(i, seed, 95) > 0.5 ? '#5a8a34' : '#3d6325');
  }
  return p.canvas();
}

// возвращает таблички для чёткого слоя
export function paintLudusArt(ctx) {
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) img.data.set([...texel(x, y), 255], (y * W + x) * 4);
  }
  ctx.putImageData(img, 0, 0);
  const put = (canvas, x, y) => ctx.drawImage(canvas, Math.round(x), Math.round(y));
  // зона отдыха
  for (const i of BAYS.rest) {
    const x = bayX(i) / P;
    put(door(30, 66), x + 25, WY.floor - 66);
    put(amphora('#a8582f'), x + 6, WY.floor - 14);
    put(amphora('#8f4a26'), x + 64, WY.floor - 14);
  }
  for (const y of [262, 286]) {
    for (const i of BAYS.rest) put(bench(BAY_W / P - (y === 286 ? 14 : 6)), bayX(i) / P + (y === 286 ? 9 : 3), y / P - 3);
  }
  // храм Фортуны
  const tx = bayX(BAYS.temple[0]) / P;
  ctx.fillStyle = '#2e1c13';
  ctx.fillRect(tx + 10, 42, BAY_W / P - 20, WY.floor - 42);
  ctx.fillStyle = 'rgba(255,200,90,.10)';
  ctx.fillRect(tx + 10, 42, BAY_W / P - 20, WY.floor - 42);
  put(statue(), tx + BAY_W / P / 2 - 15, WY.floor - 58);
  put(plant(), tx + 12, WY.floor - 18);
  put(plant(), tx + BAY_W / P - 26, WY.floor - 18);
  // лазарет: полки, двери, койки
  for (const i of BAYS.heal) {
    const x = bayX(i) / P;
    put(door(24, 60), x + 28, WY.floor - 60);
    put(shelf(), x + 2, 58);
    put(shelf(), x + 54, 58);
  }
  for (const s of PLACES.heal.seats) if (s.y < WALL.step) put(cot(), s.x / P - 11, s.y / P - 3);
  for (const cx of COLUMNS) put(column(WY.step - WY.top - 6), cx / P - 10, WY.top + 6);
  for (const [x, s] of [[60, 1], [235, 2], [415, 3]]) put(ivy(s), x, WY.top - 2);
  put(railing(), 0, WY.rail - 1);
  const signs = [];
  signs.push([(bayX(BAYS.rest[0]) + bayX(BAYS.rest[1]) + BAY_W) / 2, 72, 'Зона отдыха', 14, '#5d4426']);
  signs.push([bayX(BAYS.temple[0]) + BAY_W / 2, 72, 'Храм Фортуны', 14, '#7a5a2a']);
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

// --- гладиаторы ---

const SKINS = ['#f0c79e', '#e2b48a', '#c98f62', '#a86e46', '#7d4f32'];
const HAIR = ['#2b1d14', '#4a2f1c', '#7a4a22', '#c9a24a', '#1c1410'];
const METALS = ['#8a6a4a', '#a8743c', '#c58a3e', '#a9b0b6', '#cfd6dc', '#c9cfd6', '#f2c94c'];
const BLADES = ['#a0743f', '#c98a45', '#9ba4ac', '#dfe6ec', '#bfe3ff', '#b7ffd8', '#ffd34d'];
export const HELMETS = ['murmillo', 'thraex', 'secutor', 'hoplo', 'bare'];

export function lookOf(g, seed) {
  const helmet = HELMETS[seed % HELMETS.length];
  return {
    color: g.color, armor: Math.min(6, g.armor || 0), helmet,
    skin: SKINS[(seed >>> 3) % SKINS.length], hair: HAIR[(seed >>> 6) % HAIR.length],
    shield: helmet === 'murmillo' || helmet === 'secutor' ? 'scutum' : helmet === 'bare' ? 'none' : 'parma',
  };
}

function shaded(p, x, y, w, h, c) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) p.px(x + i, y + j, i === 0 ? darker(c, 1.18) : i === w - 1 ? darker(c, 0.72) : c);
  }
}

// поза: stand, walk1, walk2, sit, kneel. Спрайт 26×34, ступни на y = 33, центр x = 12, смотрит вправо
function gladiatorArt(look, pose, dead) {
  const p = new Pix(26, 34);
  const skin = look.skin, skinD = darker(skin, 0.78), metal = METALS[look.armor], metalD = darker(metal, 0.7);
  const color = look.color, colorD = darker(color, 0.7);
  const drop = pose === 'sit' ? 3 : pose === 'kneel' ? 5 : 0;
  // плащ у богатых доспехов
  if (look.armor >= 5) p.rect(7, 12 + drop, 3, 14, '#9e2a2a');
  // ноги
  const leg = (hx, fx, fy, front) => {
    p.line(hx, 22 + drop, fx, fy - 2, front ? skin : skinD, 2);
    p.rect(fx - 1, fy - 1, 3, 1, '#5a3a22');
    p.px(fx + 1, fy - 2, '#5a3a22');
    if (look.armor >= 2 && front) p.rect(fx - 1, fy - 6, 2, 4, metal);
  };
  if (pose === 'sit') {
    p.rect(10, 22 + drop, 7, 2, skinD);
    p.rect(11, 24 + drop, 7, 2, skin);
    p.rect(16, 26, 2, 6, skin);
    p.rect(15, 32, 4, 1, '#5a3a22');
    p.rect(13, 27, 2, 5, skinD);
    p.rect(12, 32, 4, 1, '#5a3a22');
  } else if (pose === 'kneel') {
    p.line(10, 27, 8, 33, skinD, 2);
    p.rect(7, 32, 4, 1, '#5a3a22');
    p.line(13, 27, 17, 29, skin, 2);
    p.line(17, 29, 17, 33, skin, 2);
    p.rect(16, 32, 4, 1, '#5a3a22');
  } else {
    const feet = pose === 'walk1' ? [[8, 33], [16, 33]] : pose === 'walk2' ? [[13, 33], [11, 33]] : [[10, 33], [14, 33]];
    leg(10, feet[0][0], feet[0][1], false);
    leg(13, feet[1][0], feet[1][1], true);
  }
  // набедренная повязка и пояс
  const y0 = drop;
  for (let x = 8; x < 17; x++) for (let y = 20; y < 24; y++) {
    if (y === 23 && (x === 8 || x === 16)) continue;
    p.px(x, y + y0, (x + y) % 4 === 0 ? '#cfc2a8' : '#ebe0c8');
  }
  p.rect(8, 19 + y0, 9, 2, look.armor >= 4 ? '#c9a24a' : '#5a3a22');
  p.rect(14, 20 + y0, 2, 4, color);
  // торс
  for (let y = 11; y < 19; y++) for (let x = 9; x < 16; x++) {
    p.px(x, y + y0, x === 9 ? skinD : x === 15 ? darker(skin, 1.1) : skin);
  }
  p.px(12, 13 + y0, skinD);
  p.px(13, 13 + y0, skinD);
  p.px(12, 16 + y0, skinD);
  p.px(13, 17 + y0, skinD);
  if (look.armor >= 1) p.line(9, 11 + y0, 15, 18 + y0, '#6b4329');
  if (look.armor >= 3) {
    shaded(p, 9, 11 + y0, 7, 7, metal);
    p.rect(10, 13 + y0, 5, 1, metalD);
  }
  // рука с оружием (дальняя) — меч рисуется отдельно
  if (pose === 'kneel') {
    p.line(14, 12 + y0, 17, 4 + y0, skin, 2);
    p.rect(16, 0 + y0, 5, 4, '#f5f2ea');
  } else {
    p.line(14, 12 + y0, 18, 16 + y0, skinD, 2);
    if (look.armor >= 1) p.rect(15, 13 + y0, 2, 2, metal);
  }
  // голова
  p.ellipse(12.5, 7 + y0, 3.4, 3.8, skin, skinD, darker(skin, 1.12));
  p.px(15, 7 + y0, '#2a1a10');
  const helm = (x, y, w, h) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      p.px(x + i, y + j + y0, i === 0 || j === h - 1 ? metalD : i === 1 && j < 2 ? darker(metal, 1.25) : metal);
    }
  };
  if (look.helmet === 'murmillo') {
    helm(9, 3, 8, 6);
    p.rect(7, 8 + y0, 12, 1, metalD);
    for (let j = 4; j < 8; j++) for (let i = 14; i < 17; i++) if ((i + j) % 2) p.px(i, j + y0, '#2a1a10');
    for (let i = 0; i < 9; i++) p.px(8 + i, 2 + y0 - Math.round(Math.sin(i / 8 * Math.PI) * 3), color);
    for (let i = 1; i < 8; i++) p.px(8 + i, 2 + y0 - Math.round(Math.sin(i / 8 * Math.PI) * 3) + 1, colorD);
  } else if (look.helmet === 'thraex') {
    helm(9, 3, 8, 7);
    p.rect(14, 5 + y0, 3, 1, '#2a1a10');
    p.line(10, 2 + y0, 16, 0 + y0, metal);
    p.px(17, 1 + y0, metal);
    p.px(17, 2 + y0, metalD);
    p.rect(7, 2 + y0, 3, 3, color);
    p.px(6, 3 + y0, colorD);
  } else if (look.helmet === 'secutor') {
    p.ellipse(12.5, 6.5 + y0, 4.2, 4.6, metal, metalD, darker(metal, 1.25));
    p.px(15, 6 + y0, '#2a1a10');
    p.px(13, 6 + y0, '#2a1a10');
    p.rect(11, 1 + y0, 4, 1, color);
  } else if (look.helmet === 'hoplo') {
    helm(9, 3, 8, 6);
    p.rect(8, 8 + y0, 10, 1, metalD);
    p.rect(14, 5 + y0, 3, 2, '#2a1a10');
    p.line(9, 3 + y0, 7, -1 + y0, color);
    p.line(16, 3 + y0, 18, -1 + y0, color);
    p.rect(11, 1 + y0, 4, 2, colorD);
  } else {
    p.rect(9, 3 + y0, 7, 3, look.hair);
    p.rect(9, 6 + y0, 2, 3, look.hair);
    p.rect(9, 5 + y0, 7, 1, color);
    p.rect(14, 9 + y0, 2, 2, look.hair);
  }
  // щит на ближней руке; сидя и на коленях щит отложен
  if (pose === 'sit' || pose === 'kneel') {
    // без щита
  } else if (look.shield === 'scutum') {
    for (let j = 0; j < 14; j++) for (let i = 0; i < 7; i++) {
      const rim = i === 0 || i === 6 || j === 0 || j === 13;
      p.px(14 + i, 12 + j + y0, rim ? metalD : i === 1 ? darker(color, 1.15) : i === 5 ? colorD : color);
    }
    p.rect(17, 14 + y0, 1, 10, darker(color, 1.3));
    p.ellipse(17.5, 19 + y0, 1.6, 1.6, metal);
  } else if (look.shield === 'parma') {
    p.ellipse(17, 17 + y0, 4.6, 4.6, metalD);
    p.ellipse(17, 17 + y0, 3.6, 3.6, color, colorD, darker(color, 1.2));
    p.ellipse(17, 17 + y0, 1.2, 1.2, metal);
  } else {
    p.rect(9, 10 + y0, 4, 3, metal);
    p.rect(9, 10 + y0, 1, 3, metalD);
  }
  p.outline();
  if (!dead) return p.canvas();
  return p.canvas((c) => {
    const [r, g, b] = rgb(c), l = (r + g + b) / 3;
    return hex([l * 0.55 + r * 0.15, l * 0.5 + g * 0.1, l * 0.5 + b * 0.1]);
  });
}

// лежит на спине, голова слева: в лазарете под одеялом, на арене — без
function lyingArt(look, blanket, dead) {
  const p = new Pix(36, 12);
  const skin = look.skin, skinD = darker(skin, 0.78), metal = METALS[look.armor], metalD = darker(metal, 0.7);
  p.rect(21, 7, 11, 2, skin);
  p.rect(21, 9, 11, 1, skinD);
  p.rect(32, 6, 2, 4, '#5a3a22');
  p.rect(16, 6, 6, 4, '#ebe0c8');
  p.rect(16, 6, 1, 4, look.armor >= 4 ? '#c9a24a' : '#5a3a22');
  for (let x = 7; x < 16; x++) for (let y = 5; y < 10; y++) p.px(x, y, y === 5 ? darker(skin, 1.1) : y === 9 ? skinD : skin);
  if (look.armor >= 3) p.rect(7, 5, 9, 4, metal);
  p.rect(9, 9, 10, 1, skinD);
  p.ellipse(4, 7, 3.6, 3.4, skin, skinD, darker(skin, 1.1));
  if (look.helmet === 'bare') {
    p.rect(1, 4, 3, 6, look.hair);
    p.rect(3, 4, 1, 6, look.color);
  } else {
    p.rect(0, 4, 4, 7, metal);
    p.rect(0, 4, 1, 7, metalD);
    p.rect(0, 6, 1, 3, look.color);
  }
  if (blanket) {
    for (let x = 12; x < 35; x++) for (let y = 4; y < 10; y++) {
      p.px(x, y, y === 4 ? '#fbf6ea' : (x + y) % 5 === 0 ? '#d2c3a8' : '#e9dfcc');
    }
  }
  p.outline();
  if (!dead) return p.canvas();
  return p.canvas((c) => {
    const [r, g, b] = rgb(c), l = (r + g + b) / 3;
    return hex([l * 0.55 + r * 0.15, l * 0.5 + g * 0.1, l * 0.5 + b * 0.1]);
  });
}

export function lyingSprite(look, blanket, dead) {
  return remember(['lie', look.color, look.armor, look.helmet, look.skin, look.hair, blanket, dead].join(':'),
    () => lyingArt(look, blanket, dead));
}

function swordArt(tier) {
  const p = new Pix(5, 16), blade = BLADES[Math.min(BLADES.length - 1, tier)];
  p.rect(2, 0, 1, 11, blade);
  p.rect(1, 1, 1, 10, darker(blade, 0.75));
  p.rect(3, 1, 1, 10, darker(blade, 1.2));
  p.rect(0, 11, 5, 1, '#8a6a3a');
  p.rect(2, 12, 1, 3, '#5a3a22');
  p.px(2, 15, '#c9a24a');
  return p.outline().canvas();
}

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
  const key = ['g', look.color, look.armor, look.helmet, look.skin, look.hair, pose, dead, flash].join(':');
  return remember(key, () => {
    const art = remember(key.replace(/:(true|false)$/, ':false'), () => gladiatorArt(look, pose, dead));
    return flash ? silhouette(art) : art;
  });
}

export const swordSprite = (tier) => remember('sword:' + tier, () => swordArt(tier));
