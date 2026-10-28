export const FIELD_W = 920;
export const FIELD_H = 644;

// места лудуса: walk — где гуляют гладиаторы, house — здание за ними
export const PLACES = {
  train: {
    name: 'Тренировочная', words: ['трен', 'тренировка', 'тренироваться', 'тренить'],
    house: { x: 28, y: 18, w: 276, h: 92 }, walk: { x: 40, y: 128, w: 252, h: 136 },
  },
  heal: {
    name: 'Лазарет', words: ['лазарет', 'лечение', 'лечиться', 'лечить', 'хил'],
    house: { x: 616, y: 18, w: 276, h: 92 }, walk: { x: 628, y: 128, w: 252, h: 136 },
  },
  rest: {
    name: 'Зона отдыха', words: ['отдых', 'отдыхать', 'отдохнуть'],
    house: { x: 28, y: 338, w: 276, h: 74 }, walk: { x: 40, y: 430, w: 252, h: 184 },
  },
  forge: {
    name: 'Кузница', words: ['кузница', 'кузня'],
    house: { x: 616, y: 338, w: 276, h: 74 }, walk: { x: 628, y: 430, w: 252, h: 184 },
  },
  yard: {
    name: 'Двор', words: ['двор'],
    house: null, walk: { x: 342, y: 246, w: 236, h: 300 },
  },
};

export const TEMPLE = { x: 352, y: 14, w: 216, h: 196 };
export const GATE = { x: 400, y: 584, w: 120, h: 60 };
export const DUMMIES = [{ x: 82, y: 168 }, { x: 166, y: 196 }, { x: 250, y: 168 }];
export const FOUNTAIN = { x: 166, y: 520, r: 34 };

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
