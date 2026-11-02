// арена в том же стиле, что и лудус (как в Domina): сзади каменная стена — под карнизом красный фриз, пилястры, внизу
// панели; посередине большие ворота с решёткой между мраморными колоннами, над ними — золотой орёл и пурпурная драпировка;
// по бокам ниши с мраморными статуями гладиаторов и бронзовые жаровни, знамёна и щиты. Слева, справа и спереди
// зрители стоят на узких ступенях за красным парапетом. Песок — как в лудусе, в середине разровнены круги
import { ARENA, ARENA_WALL, FIELD_H, FIELD_W } from './places.js';
import { P, Pix, darker, hash, noise, remember, rgb, tone } from './art.js';
import { SAND_DARK, mix, sandAt, smooth } from './ludus.js';

const W = ARENA_WALL;
const STONE = ['#76695b', '#968674', '#a99984', '#bcac95', '#d3c4ab'];
const RED = ['#5e231c', '#7d2f24', '#9b3a2e', '#b8503e', '#cf6a52'];
const GOLD = ['#7d5a1c', '#b8862e', '#e2b84a', '#f6dc8a'];
const PURPLE = ['#2e1628', '#5a2450', '#7a2a66', '#9a3c84'];
const MARBLE = ['#9f9382', '#c9bead', '#e6dfd2', '#f7f3ea'];
const BRONZE = ['#4a2e14', '#7a4e24', '#a8743a', '#d6a35a'];
const IRON = ['#25282d', '#3d4147', '#5d636b', '#8a9097'];
const WOOD = ['#4a2f1d', '#6e4a2e', '#946640'];
const LEAF = ['#24391a', '#36552a', '#4d7a33', '#6b9a44'];
// ступени зрителей по бокам: две полосы шириной STEP до парапета толщиной RAIL
const STEP = 26;
const RAIL = 10;
// на задней стене: ворота посередине, по бокам ниши со статуями, у ниш жаровни; пилястры и знамёна между ними
const GATE = { x: 460, w: 112, top: 30 };
const NICHES = [228, 692];
const PILASTERS = [116, 330, 590, 804];
const BANNERS = [168, 288, 632, 752];
// огонь: факелы на колоннах у ворот и жаровни у ниш (горят на каждом кадре, см. drawCrowd)
export const FIRES = [
  ...[GATE.x - 74, GATE.x + 74].map((x) => ({ x, y: 66, kind: 'torch' })),
  ...NICHES.flatMap((x) => [x - 50, x + 50]).map((x) => ({ x, y: W.base - 38, kind: 'brazier' })),
];

// --- фон по пикселям: стена, ступени зрителей, парапеты, песок ---

function wallTexel(x, y) {
  const grain = 1 + (hash(x, y, 301) - 0.5) * 0.04;
  if (y < 10) {
    // карниз с зубчиками
    const dent = y >= 6 && x % 10 < 5;
    return tone(rgb(y < 2 ? STONE[4] : dent ? STONE[1] : STONE[3]), grain);
  }
  if (y < 24) {
    // красный фриз с полукруглыми фестонами
    const local = x % 24, top = 12 + Math.round(((local - 12) / 12) ** 2 * 4);
    let c = '#5a2018';
    if (y >= top) c = y === top ? '#c06a4a' : '#8a3226';
    if (y >= 22) c = '#4a1a12';
    return tone(rgb(c), grain);
  }
  if (y >= W.base - 8) return tone(rgb(y < W.base - 6 ? STONE[4] : STONE[2]), grain * (y >= W.base - 2 ? 0.8 : 1));
  if (y >= W.base - 30) {
    // тёмная панель внизу стены с утопленными рамками
    const fx = (x - W.left) % 56, fy = y - (W.base - 30);
    const frame = fy > 3 && fy < 19 && fx > 4 && fx < 52 && (fy === 4 || fy === 18 || fx === 5 || fx === 51);
    const c = fy === 0 ? '#a07a5a' : frame ? '#8a6448' : '#6a4e3c';
    return tone(rgb(c), grain * (0.94 + 0.08 * noise(x, y, 26, 304)));
  }
  // кладка: ряды по 14, камни по 36 вразбежку, у каждого свой тон, кое-где трещины и потёки; под фризом тень
  const row = Math.floor((y - 24) / 14), off = row % 2 ? 18 : 0, bx = (x + off) % 36, by = (y - 24) % 14;
  let k = 0.9 + 0.14 * hash(Math.floor((x + off) / 36), row, 305) + 0.06 * noise(x, y, 18, 306);
  if (bx === 0 || by === 0) k *= 0.72;
  else if (bx === 1 || by === 1) k *= 1.08;
  if (Math.abs(noise(x, y, 30, 312) - 0.5) < 0.008 && noise(x, y, 80, 313) > 0.6) k *= 0.8;
  if (noise(x * 0.3, y * 0.05, 10, 314) > 0.8) k *= 0.93;
  k *= 0.76 + 0.24 * smooth(24, 50, y);
  return tone(rgb(STONE[2]), k * grain);
}

function standTexel(x, y, side) {
  // side — расстояние от края поля; ступени: светлая площадка и тёмный подступёнок со стороны арены
  const step = Math.floor(side / STEP), lx = side % STEP;
  let c = rgb(STONE[step % 2 ? 3 : 2]);
  let k = 0.82 + 0.08 * step + 0.06 * noise(x, y, 22, 307);
  if (lx >= STEP - 4) c = rgb(STONE[0]);
  else if (lx < 2) k *= 1.1;
  if ((y + step * 23) % 48 === 0) k *= 0.82;
  return tone(c, k * (1 + (hash(x, y, 308) - 0.5) * 0.05));
}

function frontTexel(x, y) {
  // ступени спереди — рядами поперёк
  const ly = (y - W.front - RAIL) % 28;
  let k = 0.86 + 0.06 * noise(x, y, 22, 309);
  const c = rgb(ly < 3 ? STONE[0] : ly < 5 ? STONE[4] : STONE[3]);
  if ((x + Math.floor((y - W.front) / 28) * 21) % 50 === 0) k *= 0.85;
  return tone(c, k * (1 + (hash(x, y, 310) - 0.5) * 0.05));
}

function railTexel(x, y, vertical) {
  // красный парапет: светлая кромка со стороны арены, золотая полоса, ниже — тёмная грань; золотые бляхи
  const d = vertical ? (x < FIELD_W / 2 ? W.left - 1 - x : x - W.right) : y - W.front;
  let c = d < 2 ? RED[4] : d < 4 ? GOLD[1] : d < 8 ? RED[2] : RED[0];
  const along = vertical ? y : x;
  if (d >= 4 && d < 8 && along % 40 >= 18 && along % 40 < 22) c = GOLD[2];
  return tone(rgb(c), 0.95 + 0.08 * noise(x, y, 12, 311));
}

function sandTexel(x, y) {
  const dx = (x - ARENA.cx) / ARENA.rx, dy = (y - ARENA.cy) / ARENA.ry;
  const edge = Math.pow(Math.pow(Math.abs(dx), 4) + Math.pow(Math.abs(dy), 4), 0.25);
  // свет: светлее к середине, у стен и парапетов тень, у задней стены — глубже
  let k = 0.92 + 0.1 * (1 - edge * edge);
  k *= 1 - 0.12 * Math.pow(Math.max(0, edge - 0.82) / 0.18, 1.6);
  k *= 0.76 + 0.24 * smooth(W.base, W.base + 30, y);
  k *= 1 - 0.1 * (1 - smooth(W.left, W.left + 14, x)) - 0.1 * smooth(W.right - 14, W.right, x);
  // разровненные круги: тёмная бороздка и светлый валик под ней; в самом центре — вытоптанный круг
  return sandAt(x, y, k, (c) => {
    const r = Math.hypot(x - ARENA.cx, (y - ARENA.cy) * 2);
    for (const ring of [104, 176, 250]) {
      const d = r - ring;
      if (d >= 0 && d < 3) c = mix(c, SAND_DARK, 0.35);
      else if (d >= 3 && d < 5) c = tone(c, 1.04);
    }
    if (r < 46) c = mix(c, SAND_DARK, 0.16 * (1 - r / 46) * (0.6 + 0.4 * noise(x, y, 6, 315)));
    return c;
  });
}

function texel(x, y) {
  if (x < W.left - RAIL) return standTexel(x, y, x);
  if (x >= W.right + RAIL) return standTexel(x, y, FIELD_W - 1 - x);
  if ((x < W.left || x >= W.right) && y < W.front + RAIL) return railTexel(x, y, true);
  if (y >= W.front + RAIL) return frontTexel(x, y);
  if (y >= W.front) return railTexel(x, y, false);
  if (y < W.base) return wallTexel(x, y);
  return sandTexel(x, y);
}

// --- постройки и вещи на стене (пиксели фигурок, P = 2) ---

function put(ctx, canvas, x, y) {
  ctx.drawImage(canvas, Math.round(x / P) * P, Math.round(y / P) * P, canvas.width * P, canvas.height * P);
}

// большие ворота: арка из клиньев с замковым камнем, глубокий тёмный проход со светом в конце, решётка приподнята —
// снизу острия
function gateArt() {
  const w = GATE.w / P, h = (W.base - GATE.top) / P, p = new Pix(w, h), cx = w / 2, r = 18, spring = 22;
  const inOpen = (x, y) => (y >= spring ? Math.abs(x + 0.5 - cx) < r : Math.hypot(x + 0.5 - cx, y + 0.5 - spring) < r);
  const ringR = (x, y) => (y >= spring ? Math.abs(x + 0.5 - cx) : Math.hypot(x + 0.5 - cx, y + 0.5 - spring));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rr = ringR(x, y);
      if (inOpen(x, y)) {
        // проход: темно, вдали у пола — свет
        const glow = Math.max(0, 1 - Math.hypot((x - cx) / 10, (y - h + 4) / 16));
        p.px(x, y, glow > 0.55 ? '#c99a5a' : darker('#2e1e14', 0.6 + 0.9 * glow + 0.15 * (y / h)));
        const lx = x - (cx - r), bar = lx % 5 < 2, cross = (y - 6) % 9 === 0, grate = y < h - 9;
        if (grate && bar) p.px(x, y, lx % 5 === 0 ? IRON[3] : IRON[2]);
        else if (grate && cross && y > 4) p.px(x, y, IRON[1]);
        if (y === h - 9 && bar) p.px(x, y, IRON[3]);
        if (y === h - 8 && lx % 5 === 0) p.px(x, y, IRON[2]);
      } else if (rr < r + 6) {
        const a = Math.atan2(y - spring, x - cx), block = Math.floor((a + Math.PI) / 0.26);
        const key = y < spring && Math.abs(x + 0.5 - cx) < 3;
        let c = key ? MARBLE[3] : y >= spring ? (Math.floor(y / 5) % 2 ? STONE[3] : STONE[4]) : block % 2 ? STONE[3] : STONE[4];
        if (rr > r + 4.6) c = STONE[1];
        p.px(x, y, c);
      }
    }
  }
  // золотой венок на замковом камне
  for (let a = 0; a < 18; a++) {
    const t = a / 18 * Math.PI * 2;
    p.px(Math.round(cx - 0.5 + Math.cos(t) * 3.5), Math.round(spring - r - 3 + Math.sin(t) * 3), a % 2 ? GOLD[1] : GOLD[2]);
  }
  return p.canvas();
}

// мраморная колонна у ворот: база, ствол с каннелюрами, капитель с завитками
function columnArt(height) {
  const h = height / P, p = new Pix(10, h);
  for (let y = 4; y < h - 4; y++) {
    for (let x = 1; x < 9; x++) p.px(x, y, x === 1 ? MARBLE[1] : x === 8 ? MARBLE[0] : x % 2 ? MARBLE[2] : MARBLE[3]);
  }
  p.rect(0, 0, 10, 2, MARBLE[3]);
  p.rect(0, 2, 10, 2, MARBLE[1]);
  p.px(0, 2, GOLD[2]);
  p.px(9, 2, GOLD[2]);
  p.rect(0, h - 4, 10, 2, MARBLE[1]);
  p.rect(0, h - 2, 10, 2, MARBLE[3]);
  return p.canvas();
}

// над воротами: пурпурная драпировка с золотой бахромой провисает между колоннами, посередине — золотой орёл
function swagArt() {
  const w = 84, p = new Pix(w, 18);
  for (let x = 0; x < w; x++) {
    const sag = Math.round(Math.sin(x / (w - 1) * Math.PI) * 6);
    for (let y = 0; y < 4 + sag; y++) p.px(x, y, x % 6 === 0 ? PURPLE[1] : y < 2 ? PURPLE[3] : PURPLE[2]);
    p.px(x, 4 + sag, GOLD[1]);
    if (x % 2) p.px(x, 5 + sag, GOLD[2]);
  }
  // орёл: тело, расправленные крылья, голова
  const cx = w / 2;
  for (let i = 0; i < 9; i++) {
    p.rect(cx - 2 - i, 2 + Math.floor(i / 2), 1, 4 - Math.floor(i / 3), GOLD[i % 2 ? 1 : 2]);
    p.rect(cx + 1 + i, 2 + Math.floor(i / 2), 1, 4 - Math.floor(i / 3), GOLD[i % 2 ? 1 : 2]);
  }
  p.rect(cx - 2, 2, 3, 7, GOLD[2]);
  p.rect(cx - 1, 0, 2, 2, GOLD[3]);
  p.px(cx + 1, 1, GOLD[0]);
  p.rect(cx - 2, 9, 3, 2, GOLD[1]);
  return p.canvas();
}

// ниша со статуей: полукруглая тёмная арка в мраморной раме, на постаменте — мраморный гладиатор со щитом и мечом
function nicheArt() {
  const w = 34, h = 54, p = new Pix(w, h), cx = 17, r = 13, spring = 15;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rr = y >= spring ? Math.abs(x + 0.5 - cx) : Math.hypot(x + 0.5 - cx, y + 0.5 - spring);
      if (rr < r) p.px(x, y, darker('#5a463a', 0.7 + 0.5 * (y / h) + 0.2 * (1 - rr / r)));
      else if (rr < r + 3) p.px(x, y, rr < r + 1 ? MARBLE[1] : MARBLE[2]);
    }
  }
  // постамент
  p.rect(cx - 9, h - 10, 18, 10, MARBLE[2]);
  p.rect(cx - 10, h - 11, 20, 2, MARBLE[3]);
  p.rect(cx - 9, h - 2, 18, 2, MARBLE[0]);
  p.rect(cx - 5, h - 7, 10, 3, GOLD[1]);
  // статуя: ноги, торс, шлем с гребнем, щит на левой руке, меч в поднятой правой
  const m = (x, y, ww, hh, k = 2) => p.rect(x, y, ww, hh, MARBLE[k]);
  m(cx - 3, 32, 2, 9, 1);
  m(cx + 1, 32, 2, 9, 2);
  m(cx - 4, 18, 8, 14, 2);
  m(cx - 4, 18, 2, 14, 3);
  m(cx + 3, 18, 1, 14, 1);
  m(cx - 3, 11, 6, 7, 3);
  m(cx - 3, 8, 6, 3, 1);
  m(cx - 1, 6, 2, 2, 3);
  p.ellipse(cx - 6, 25, 4, 6, MARBLE[2], MARBLE[0], MARBLE[3]);
  m(cx + 4, 14, 2, 6, 2);
  m(cx + 5, 3, 1, 11, 3);
  m(cx + 4, 13, 3, 1, 1);
  // плющ по раме
  for (let y = 4; y < 30; y += 2) {
    const x = cx + r + 1 + (hash(y, 3, 401) < 0.5 ? 0 : 1);
    p.px(x, y, LEAF[1 + (y % 3)]);
    if (hash(y, 4, 402) < 0.5) p.px(x + 1, y + 1, LEAF[2]);
  }
  return p.canvas();
}

// бронзовая жаровня на треноге (огонь — на каждом кадре)
function brazierArt() {
  const p = new Pix(16, 20);
  p.ellipse(8, 4, 7, 3, BRONZE[2], BRONZE[0], BRONZE[3]);
  p.rect(1, 3, 14, 1, BRONZE[3]);
  p.rect(3, 6, 10, 2, BRONZE[1]);
  for (const [x0, x1] of [[5, 2], [8, 8], [11, 14]]) p.line(x0, 7, x1, 19, BRONZE[x0 === 8 ? 2 : 1], 1);
  p.rect(5, 12, 7, 1, BRONZE[1]);
  p.rect(4, 1, 8, 2, '#3a2418');
  for (const x of [5, 7, 10]) p.px(x, 1, '#e0521a');
  return p.canvas();
}

// знамя: красное полотнище с золотым кругом-гербом, бахрома и перекладина
function bannerArt(width = 14, height = 36) {
  const p = new Pix(width, height);
  p.rect(0, 0, width, 2, WOOD[2]);
  p.rect(0, 0, width, 1, GOLD[2]);
  for (let y = 2; y < height - 3; y++) {
    for (let x = 1; x < width - 1; x++) p.px(x, y, x < 3 ? RED[3] : x > width - 4 ? RED[1] : RED[2]);
  }
  for (let x = 1; x < width - 1; x++) {
    p.px(x, height - 3, GOLD[1]);
    if (x % 2) p.px(x, height - 2, GOLD[2]);
  }
  const cx = (width - 1) / 2, cy = Math.round(height * 0.42), rr = width * 0.3;
  p.ellipse(cx, cy, rr, rr, GOLD[2], GOLD[0], GOLD[3]);
  p.ellipse(cx, cy, rr * 0.45, rr * 0.45, RED[2], RED[1], RED[3]);
  p.rect(1, 5, width - 2, 1, GOLD[1]);
  return p.canvas();
}

// плоская пилястра на стене: мраморный ствол, капитель и база
function pilasterArt() {
  const h = (W.base - 30 - 24) / P, p = new Pix(8, h);
  for (let y = 2; y < h - 2; y++) for (let x = 0; x < 8; x++) p.px(x, y, x === 0 ? MARBLE[3] : x === 7 ? MARBLE[0] : x % 3 === 1 ? MARBLE[1] : MARBLE[2]);
  p.rect(0, 0, 8, 2, MARBLE[3]);
  p.rect(0, h - 2, 8, 2, MARBLE[1]);
  return p.canvas();
}

// круглый щит на стене: дерево, бронзовый обод и умбон
function shieldArt(face) {
  const p = new Pix(12, 12);
  p.ellipse(6, 6, 5.6, 5.6, BRONZE[1], BRONZE[0], BRONZE[3]);
  p.ellipse(6, 6, 4.4, 4.4, face, darker(face, 0.7), darker(face, 1.25));
  p.ellipse(6, 6, 1.6, 1.6, BRONZE[2], BRONZE[0], BRONZE[3]);
  return p.canvas();
}

function sconceArt() {
  const p = new Pix(6, 10);
  p.rect(1, 3, 4, 2, IRON[2]);
  p.rect(2, 5, 2, 5, WOOD[1]);
  p.rect(2, 5, 1, 5, WOOD[2]);
  p.rect(0, 2, 6, 1, IRON[1]);
  return p.canvas();
}

// плющ свисает с фриза
function paintVine(ctx, x, y, length, seed) {
  let px = x;
  for (let i = 0; i < length; i += 2) {
    px += (noise(i, seed, 9, 403) - 0.5) * 2.4;
    const sx = Math.round(px / 2) * 2;
    ctx.fillStyle = LEAF[1];
    ctx.fillRect(sx, y + i, 2, 2);
    if (hash(i, seed, 404) < 0.55) {
      const side = hash(i, seed, 405) < 0.5 ? -1 : 1;
      ctx.fillStyle = LEAF[2 + Math.floor(hash(i, seed, 406) * 2)];
      ctx.fillRect(sx + side * 2, y + i, 2, 2);
      ctx.fillRect(sx + side * 4, y + i - 2, 2, 2);
    }
  }
}

// --- зрители ---

const SKINS = ['#f0c79e', '#e2b48a', '#c98f62', '#a86e46', '#7d4f32'];
const HAIRS = ['#2b1d14', '#4a2f1c', '#6e4424', '#a8823e', '#1c1410', '#8c8378'];
const CLOTHS = ['#e8e2d4', '#cfd9e6', '#a9c9b8', '#e0b2a8', '#dcc893', '#b3c0de', '#c2d9a8', '#ecc3d0', '#cbb79c', '#9fb3c9',
  '#d9d2c2', '#b9cfe0'];

// фигурка зрителя 11×22: голова с волосами, туника с перевязью тоги и поясом, ноги или длинный подол до пят,
// руки вниз или вскинуты; со спины — затылок вместо лица
function spectatorArt(look, up, back) {
  const p = new Pix(11, 22), { skin, hair, cloth, long } = look;
  const skinD = darker(skin, 0.82), clothL = darker(cloth, 1.08), clothD = darker(cloth, 0.8), shoe = '#4a3426';
  if (long) {
    for (let y = 15; y < 21; y++) {
      const spread = y > 18 ? 1 : 0;
      p.rect(3 - spread, y, 6 + 2 * spread, 1, cloth);
      p.px(3 - spread, y, clothL);
      p.px(8 + spread, y, clothD);
    }
    p.rect(3, 21, 2, 1, shoe);
    p.rect(6, 21, 2, 1, shoe);
  } else {
    p.rect(4, 15, 2, 6, skinD);
    p.rect(6, 15, 2, 6, skin);
    p.rect(4, 21, 2, 1, shoe);
    p.rect(6, 21, 2, 1, shoe);
  }
  for (let y = 6; y < 15; y++) for (let x = 3; x < 9; x++) p.px(x, y, x === 3 ? clothL : x === 8 ? clothD : cloth);
  for (let i = 0; i < 6; i++) p.px(3 + i, 6 + i, clothL);
  p.rect(3, 11, 6, 1, clothD);
  for (const x of [2, 9]) {
    const s = x === 2 ? skinD : skin;
    if (up) {
      p.rect(x, 1, 1, 5, s);
      p.px(x, 6, x === 2 ? clothL : clothD);
    } else {
      p.rect(x, 6, 1, 3, x === 2 ? clothL : clothD);
      p.rect(x, 9, 1, 4, s);
    }
  }
  p.rect(4, 1, 4, 4, back ? hair : skin);
  p.rect(4, 0, 4, 1, hair);
  p.px(4, 1, hair);
  p.px(7, 1, hair);
  if (back) p.rect(4, 4, 4, 1, darker(hair, 1.15));
  else {
    p.px(5, 2, '#2a1a12');
    p.px(7, 2, '#2a1a12');
    p.px(6, 4, skinD);
  }
  p.rect(5, 5, 2, 1, skinD);
  return p.canvas();
}

function spectatorSprite(look, up, back) {
  return remember(['spect', look.skin, look.hair, look.cloth, look.long, up, back].join(':'), () => spectatorArt(look, up, back));
}

function seeded(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// кто где стоит: слева и справа по двум ступеням, спереди — ряды спиной к нам
function makeCrowd() {
  const random = seeded(17), people = [];
  const pick = (list) => list[Math.floor(random() * list.length)];
  // face — куда смотрит: слева — вправо, на арену, справа — влево
  const person = (x, y, back, face = 1) => {
    if (random() < 0.08) return;
    people.push({ x: x + Math.round((random() - 0.5) * 4), y, back, face, phase: random() * Math.PI * 2, eager: random(),
      look: { skin: pick(SKINS), hair: pick(HAIRS), cloth: pick(CLOTHS), long: random() < 0.4 } });
  };
  for (let s = 0; s < 2; s++) {
    for (let y = 30 + (s % 2) * 14; y < FIELD_H + 30; y += 28) {
      person(s * STEP + 13, y, false);
      person(FIELD_W - 1 - (s * STEP + 13), y, false, -1);
    }
  }
  for (const [y, shift] of [[W.front + RAIL + 34, 0], [W.front + RAIL + 60, 12]]) {
    for (let x = W.left + 10 + shift; x < W.right - 8; x += 24) person(x, y, true);
  }
  return people.sort((a, b) => a.y - b.y);
}

export function paintArenaArt(ctx) {
  const img = ctx.createImageData(FIELD_W, FIELD_H);
  for (let y = 0; y < FIELD_H; y++) {
    for (let x = 0; x < FIELD_W; x++) img.data.set([...texel(x, y), 255], (y * FIELD_W + x) * 4);
  }
  ctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  // розетки на фризе
  for (let x = W.left + 12; x < W.right; x += 24) {
    ctx.fillStyle = '#efe0c6';
    ctx.fillRect(x - 3, 16, 6, 2);
    ctx.fillRect(x - 1, 14, 2, 6);
    ctx.fillStyle = GOLD[2];
    ctx.fillRect(x - 1, 16, 2, 2);
  }
  // пилястры, знамёна, щиты
  const pilaster = remember('arena:pilaster', pilasterArt);
  for (const x of PILASTERS) put(ctx, pilaster, x - 8, 24);
  const banner = remember('arena:banner', () => bannerArt());
  for (const x of BANNERS) put(ctx, banner, x - 14, 26);
  [[116, '#2f5f9a'], [804, '#3f7a3a']].forEach(([x, face]) => put(ctx, remember('arena:shield:' + face, () => shieldArt(face)), x - 12, 78));
  // по бокам: ниши со статуями, по обе стороны — жаровни
  const niche = remember('arena:niche', nicheArt), brazier = remember('arena:brazier', brazierArt);
  for (const x of NICHES) put(ctx, niche, x - 34, W.base - 8 - 108);
  for (const f of FIRES) if (f.kind === 'brazier') put(ctx, brazier, f.x - 16, f.y - 2);
  // посередине: ворота между колоннами, над ними драпировка с орлом, на колоннах факелы
  put(ctx, remember('arena:gate', gateArt), GATE.x - GATE.w / 2, GATE.top);
  const column = remember('arena:column', () => columnArt(W.base - 24));
  for (const x of [GATE.x - 74, GATE.x + 74]) put(ctx, column, x - 10, 24);
  put(ctx, remember('arena:swag', swagArt), GATE.x - 84, 24);
  const sconce = remember('arena:sconce', sconceArt);
  for (const f of FIRES) if (f.kind === 'torch') put(ctx, sconce, f.x - 6, f.y);
  [[W.left + 30, 60, 3], [WALL_X(0.36), 44, 5], [WALL_X(0.64), 50, 7], [W.right - 30, 64, 9]]
    .forEach(([x, len, seed]) => paintVine(ctx, x, 22, len, seed));
  // знамёна на боковых парапетах — свисают в сторону арены
  const side = remember('arena:sideBanner', () => bannerArt(10, 30));
  for (const y of [210, 360, 510]) {
    put(ctx, side, W.left - 6, y);
    put(ctx, side, W.right - 14, y);
  }
  return makeCrowd();
}

const WALL_X = (t) => Math.round(W.left + (W.right - W.left) * t);

// зрители на каждом кадре: подпрыгивают и вскидывают руки — тем чаще и выше, чем громче ревут трибуны;
// на стене горят факелы и жаровни
export function drawCrowd(ctx, people, t, roar) {
  for (const fire of FIRES) {
    const f = 0.7 + 0.3 * Math.sin(t * 11 + fire.x), big = fire.kind === 'brazier';
    const r = big ? 34 : 26, fy = fire.y - (big ? 2 : 4);
    const glow = ctx.createRadialGradient(fire.x, fy, 1, fire.x, fy, r);
    glow.addColorStop(0, 'rgba(255,200,90,' + (0.5 * f).toFixed(3) + ')');
    glow.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(fire.x - r, fy - r, r * 2, r * 2);
    if (big) {
      for (let i = 0; i < 5; i++) {
        const h = 6 + 8 * Math.abs(Math.sin(t * (7 + i) + i * 1.7 + fire.x));
        ctx.fillStyle = i % 2 ? '#ffb43c' : '#ffe08a';
        ctx.fillRect(fire.x - 9 + i * 4, fire.y + 2 - h, 2, h);
      }
    } else {
      ctx.fillStyle = '#ff9a3c';
      ctx.fillRect(fire.x - 3, fire.y - 8 - f * 4, 6, 8 + f * 4);
      ctx.fillStyle = '#ffe08a';
      ctx.fillRect(fire.x - 1, fire.y - 4 - f * 2, 2, 4 + f * 2);
    }
  }
  for (const p of people) {
    const s = Math.sin(t * (4 + roar * 6) + p.phase);
    const jump = Math.round(Math.max(0, s) * (1 + roar * 3) / P) * P;
    const up = p.eager < 0.15 + roar * 0.7 && s > -0.2;
    const sprite = spectatorSprite(p.look, up, p.back);
    if (p.face > 0) {
      ctx.drawImage(sprite, p.x - 11, p.y - 44 - jump, 22, 44);
      continue;
    }
    ctx.save();
    ctx.translate(p.x, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, -11, p.y - 44 - jump, 22, 44);
    ctx.restore();
  }
}
