export const FIELD_W = 920;
export const FIELD_H = 644;

// лудус сбоку, как в Domina: сзади колоннада с комнатами, в центре песок, спереди перила
export const WALL = { top: 40, floor: 228, step: 292, sand: 300, rail: 556, front: 590 };
export const COLUMNS = [30, 202, 374, 546, 718, 890];
export const BAYS = { rest: [0, 1], temple: [2], heal: [3, 4] };
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
    // команды нет: раненых уносят сюда сами после боя, а афк с ранами — когда снова напишет
    name: 'Лазарет', words: [],
    seats: [...row(262, 576, 870, 49), ...row(290, 600, 870, 49), ...row(324, 576, 870, 49)],
    walk: { x: 560, y: 250, w: 320, h: 86 },
  },
  temple: {
    name: 'Лудильня', words: [],
    walk: { x: 392, y: 252, w: 136, h: 34 },
  },
  train: {
    name: 'Тренировка', words: ['трен', 'тренировка', 'тренироваться', 'тренить'],
    walk: { x: 50, y: 350, w: 820, h: 190 },
  },
};

export const DUMMIES = [
  { x: 120, y: 392, kind: 'shield' }, { x: 290, y: 368, kind: 'straw' }, { x: 470, y: 400, kind: 'bag' },
  { x: 640, y: 366, kind: 'target' }, { x: 812, y: 396, kind: 'palus' }, { x: 200, y: 490, kind: 'palus' },
  { x: 382, y: 504, kind: 'shield' }, { x: 560, y: 488, kind: 'straw' }, { x: 736, y: 504, kind: 'bag' },
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
