export const FIELD_W = 920;
export const FIELD_H = 644;

// лудус сбоку, как в Domina: сзади колоннада с комнатами, в центре песок, по бокам — стены в ракурсе.
// Крайние колонны стоят в углах у боковых стен. Пролёты: два — зона отдыха, в середине — лудильня (она шире),
// справа — кузня: заточка и перековка.
// Потолок и перила впереди не видны: поле начинается у фриза под балкой, а песок тянется до нижнего края — так
// тренировке больше места. Координаты лудуса — свои: на экране y лудуса минус LUDUS_TOP
export const LUDUS_TOP = 44;
export const LUDUS_H = FIELD_H + LUDUS_TOP;
export const WALL = { top: 40, floor: 228, step: 292, sand: 300, rail: LUDUS_H };
export const COLUMNS = [130, 252, 374, 546, 668, 790];
export const bayX = (i) => COLUMNS[i] + 6;
// ширина лудильни (средний пролёт)
export const BAY_W = 160;

function row(y, from, to, step) {
  const spots = [];
  for (let x = from; x <= to; x += step) spots.push({ x, y });
  return spots;
}

// зона отдыха — деревянная трибуна в четыре ряда (задние выше), сидят плотно, ряды со сдвигом. Посередине стоит колонна —
// трибуна там разделена проходом, и у колонны никто не садится
export const TIERS = [206, 230, 254, 278];
export const STANDS = [[130, 238], [266, 362]];

export const PLACES = {
  rest: {
    name: 'Зона отдыха', words: ['отдых', 'отдыхать', 'отдохнуть', 'сесть'],
    // сидящий (шириной ~24) не заходит на колонны: между ним и колонной (32 в ширину) остаётся зазор
    seats: TIERS.flatMap((y, r) => row(y, 160 + (r % 2) * 10, 344, 20)
      .filter((s) => COLUMNS.every((cx) => Math.abs(s.x - cx) >= 30) && STANDS.some(([a, b]) => s.x > a && s.x < b))),
    walk: { x: 150, y: 300, w: 210, h: 40 },
  },
  // кузня: у точильного камня — заточка, у наковальни — первое оружие и перековка; look — куда смотреть за работой.
  // Команд «пойти» нет: сюда приходят с «улучшить», «реролл» и первой гачей
  sharpen: {
    name: 'Заточка', words: [],
    walk: { x: 572, y: 272, w: 24, h: 14 }, look: 624,
  },
  forge: {
    name: 'Кузня', words: [],
    walk: { x: 672, y: 272, w: 14, h: 14 }, look: 730,
  },
  temple: {
    name: 'Лудильня', words: [],
    walk: { x: 410, y: 262, w: 100, h: 30 },
  },
  train: {
    name: 'Тренировка', words: ['трен', 'тренировка', 'тренироваться', 'тренить'],
    walk: { x: 150, y: 340, w: 620, h: 280 },
  },
};

// по бокам лудус замыкают стены (справа — с воротами на арену); они уходят вглубь, к колоннаде, и повёрнуты лицом
// к песку. Низ правой стены на песке — наклонная линия от угла у колоннады (x, y) вниз-вправо, левая — зеркально;
// чем ближе к нам, тем стена выше (grow)
export const SIDE = { x: 790, y: 300, slope: 1.97, grow: 0.6 };
export const sideBase = (x) => SIDE.y + (x - SIDE.x) * SIDE.slope;
// где на высоте y начинается правая стена (левее — песок); левая — на столько же от левого края
export const sideX = (y) => SIDE.x + Math.max(0, y - SIDE.y) / SIDE.slope;
export const sideLeftX = (y) => FIELD_W - sideX(y);
// ворота в ней: откуда и докуда по глубине стены (0 — у колоннады, 1 — у края поля), высота проёма до свода
export const GATE = { from: 0.2, to: 0.78, height: 50 };
// отсюда выходят новички и гладиаторы после боя — с песка перед воротами
export const ENTRANCE = { x: 850, y: 462 };

// тренировочные столбы трёх видов: деревянный с рукоятями, набитый соломой мешок на шесте, доспех на крестовине.
// Четыре ряда со сдвигом на всём песке между боковыми стенами (ближе к нам песок шире), у каждого столба два места —
// слева и справа
const POSTS = [[360, [180, 320, 460, 600, 740]], [440, [250, 390, 530, 670]], [520, [180, 320, 460, 600, 740]],
  [600, [110, 250, 390, 530, 670, 810]]];
const KINDS = ['post', 'sack', 'armor'];
export const DUMMIES = POSTS.flatMap(([y, xs], r) => xs.map((x, i) => ({ x, y, kind: KINDS[(i + r) % 3] })));
// место у столба: id, где встать и в какую сторону смотреть
export const POST_SPOTS = DUMMIES.flatMap((d, i) => [-1, 1].map((side) => ({ id: 'p' + i + (side < 0 ? 'l' : 'r'),
  x: d.x + side * 26, y: d.y + 3, post: i, face: -side })));
// не хватило места на трибуне — отдыхающие стоят вплотную к левой стене, спиной к ней, лицом к песку (не дальше
// края поля; столбы и места у них не заняты)
export const WALL_LINE = [];
for (let y = 326; y <= 620; y += 22) {
  const x = Math.round(sideLeftX(y) + 12);
  if (x < 14 || POST_SPOTS.some((s) => Math.hypot(s.x - x, s.y - y) < 30) || DUMMIES.some((d) => Math.hypot(d.x - x, d.y - y) < 30)) continue;
  WALL_LINE.push({ x, y });
}
PLACES.rest.line = WALL_LINE;

// места для разминки — на свободном песке между столбами
export const WARM_SPOTS = [];
for (let y = 326; y <= 624; y += 34) {
  for (let x = 36; x <= 836; x += 40) {
    const sx = x + (y % 68 ? 0 : 20);
    // гладиатор ростом ~80 — не должен заходить в стену и головой
    if (sx + 24 > sideX(y - 60) || sx - 24 < sideLeftX(y - 60) || DUMMIES.some((d) => Math.abs(d.x - sx) < 64 && Math.abs(d.y - y) < 28)) continue;
    WARM_SPOTS.push({ id: 'w' + WARM_SPOTS.length, x: sx, y });
  }
}

// кузня: устье горна (живой огонь), наковальня и точильный круг — тут же искры, пока идёт работа
export const FORGE = { fire: { x: 756, y: 206 }, anvil: { x: 722, y: 258 }, wheel: { x: 628, y: 258 } };

export const ARENA = { cx: 460, cy: 352, rx: 372, ry: 236 };

export function pointIn(rect, random) {
  return { x: rect.x + 10 + random() * (rect.w - 20), y: rect.y + 10 + random() * (rect.h - 20) };
}

export function inArena(x, y, pad = 0) {
  const dx = (x - ARENA.cx) / (ARENA.rx - pad), dy = (y - ARENA.cy) / (ARENA.ry - pad);
  return dx * dx + dy * dy <= 1;
}

export function clampToArena(p, pad = 0) {
  const rx = ARENA.rx - pad, ry = ARENA.ry - pad;
  const dx = (p.x - ARENA.cx) / rx, dy = (p.y - ARENA.cy) / ry;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= 1) return p;
  p.x = ARENA.cx + dx / d * rx;
  p.y = ARENA.cy + dy / d * ry;
  return p;
}
