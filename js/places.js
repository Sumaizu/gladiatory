export const FIELD_W = 920;
export const FIELD_H = 644;

// лудус сбоку, как в Domina: сзади колоннада с комнатами, в центре песок, спереди перила
export const WALL = { top: 40, floor: 228, step: 292, sand: 300, rail: 556, front: 590 };
export const COLUMNS = [30, 202, 374, 546, 718, 890];
export const BAYS = { rest: [0, 1], temple: [2], forge: [3], heal: [4] };
export const bayX = (i) => COLUMNS[i] + 6;
export const BAY_W = 160;

function row(y, from, to, step) {
  const spots = [];
  for (let x = from; x <= to; x += step) spots.push({ x, y });
  return spots;
}

export const PLACES = {
  rest: {
    name: 'Зона отдыха', words: ['отдых', 'отдыхать', 'отдохнуть', 'сесть'],
    seats: [...row(262, 52, 352, 42), ...row(286, 72, 352, 42), ...row(322, 52, 352, 42)],
    walk: { x: 40, y: 250, w: 320, h: 86 },
  },
  heal: {
    name: 'Лазарет', words: ['лазарет', 'лечение', 'лечиться', 'лечить', 'хил'],
    seats: [...row(262, 748, 868, 40), ...row(288, 742, 862, 40), ...row(322, 742, 862, 40)],
    walk: { x: 730, y: 250, w: 150, h: 86 },
  },
  forge: {
    name: 'Кузница', words: ['кузница', 'кузня'],
    walk: { x: 566, y: 256, w: 120, h: 30 },
  },
  train: {
    name: 'Тренировка', words: ['трен', 'тренировка', 'тренироваться', 'тренить'],
    walk: { x: 50, y: 350, w: 820, h: 190 },
  },
};

export const DUMMIES = [
  { x: 120, y: 392 }, { x: 290, y: 368 }, { x: 470, y: 400 }, { x: 640, y: 366 }, { x: 812, y: 396 },
  { x: 200, y: 486 }, { x: 382, y: 500 }, { x: 560, y: 484 }, { x: 736, y: 500 },
];
export const ENTRANCE = { x: 940, y: 440 };

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
