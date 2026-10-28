import { maxHp } from './balance.js';
import { ARENA, DUMMIES, FIELD_H, FIELD_W, FOUNTAIN, GATE, PLACES, TEMPLE } from './places.js';

export const FIGURE = { ludus: 1.3, arena: 1.6 };
const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';
const SKIN = ['#f0c79e', '#e2b48a', '#c98f62', '#a86e46', '#7d4f32'];
const METAL = ['#8a6a4a', '#9b6b3c', '#c58a3e', '#a9b0b6', '#cfd6dc', '#d9dfe6', '#f2c94c'];
const BLADE = ['#a0743f', '#c98a45', '#9ba4ac', '#dfe6ec', '#bfe3ff', '#b7ffd8', '#ffd34d'];
const SAND = '#d8b98b';

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

function cypress(ctx, x, y, h) {
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  ctx.beginPath();
  ctx.ellipse(x + 4, y, h * 0.16, h * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  const grad = ctx.createLinearGradient(x - h * 0.14, 0, x + h * 0.14, 0);
  grad.addColorStop(0, '#2f5a2c');
  grad.addColorStop(1, '#1d3a1c');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.bezierCurveTo(x + h * 0.2, y - h * 0.6, x + h * 0.16, y - h * 0.1, x, y);
  ctx.bezierCurveTo(x - h * 0.16, y - h * 0.1, x - h * 0.2, y - h * 0.6, x, y - h);
  ctx.fill();
}

function sandFloor(ctx, random, x, y, w, h, base) {
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  for (let i = 0; i < w * h / 90; i++) {
    const px = x + random() * w, py = y + random() * h, r = 0.6 + random() * 1.6;
    ctx.fillStyle = random() < 0.5 ? 'rgba(120,80,40,.10)' : 'rgba(255,240,210,.14)';
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paving(ctx, random, x, y, w, h) {
  ctx.fillStyle = '#b9a58a';
  ctx.fillRect(x, y, w, h);
  const size = 22;
  for (let row = 0; row * size < h; row++) {
    for (let col = -1; col * size < w; col++) {
      const sx = x + col * size + (row % 2 ? size / 2 : 0), sy = y + row * size;
      ctx.fillStyle = shade('#c4b195', (random() - 0.5) * 0.16);
      ctx.fillRect(sx + 1, sy + 1, size - 2, size - 2);
    }
  }
}

function roof(ctx, x, y, w, h, tone) {
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, shade(tone, 0.12));
  grad.addColorStop(1, shade(tone, -0.2));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x - 8, y + h);
  ctx.lineTo(x + 10, y);
  ctx.lineTo(x + w - 10, y);
  ctx.lineTo(x + w + 8, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(tone, -0.4);
  ctx.lineWidth = 1;
  for (let i = 1; i < w / 12; i++) {
    const t = i / (w / 12);
    ctx.beginPath();
    ctx.moveTo(x + 10 + (w - 20) * t, y);
    ctx.lineTo(x - 8 + (w + 16) * t, y + h);
    ctx.stroke();
  }
  ctx.fillStyle = shade(tone, -0.35);
  ctx.fillRect(x - 8, y + h - 3, w + 16, 4);
}

function wall(ctx, x, y, w, h, tone) {
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, shade(tone, 0.08));
  grad.addColorStop(1, shade(tone, -0.12));
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  ctx.fillRect(x, y + h - 4, w, 4);
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

function drawTraining(ctx) {
  const { house, walk } = PLACES.train;
  ctx.fillStyle = 'rgba(110,78,44,.22)';
  roundRect(ctx, walk.x - 8, walk.y - 10, walk.w + 16, walk.h + 18, 14);
  ctx.fill();
  // навес с оружейной стойкой
  wall(ctx, house.x + 10, house.y + 34, house.w - 20, house.h - 34, '#a07a52');
  ctx.fillStyle = '#5e4128';
  for (let i = 0; i < 9; i++) {
    const x = house.x + 30 + i * 28;
    ctx.fillRect(x, house.y + 44, 3, 40);
    ctx.fillStyle = i % 3 === 0 ? '#c9ced3' : i % 3 === 1 ? '#8b5a2b' : '#b8bec4';
    ctx.fillRect(x - 1, house.y + 40, 5, 8);
    ctx.fillStyle = '#5e4128';
  }
  roof(ctx, house.x + 4, house.y + 4, house.w - 8, 32, '#b5532f');
  // ограда
  ctx.strokeStyle = '#7a5532';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(walk.x - 6, walk.y + walk.h + 6);
  ctx.lineTo(walk.x + walk.w + 6, walk.y + walk.h + 6);
  ctx.stroke();
  for (let x = walk.x - 6; x <= walk.x + walk.w + 6; x += 21) {
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(x - 2, walk.y + walk.h - 4, 4, 14);
  }
  plaque(ctx, house.x + house.w / 2, house.y + house.h + 2, 'Тренировочная');
}

function drawDummy(ctx, x, y, hit) {
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath();
  ctx.ellipse(x, y, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(hit * 30) * hit * 0.4);
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(-2, -34, 4, 34);
  ctx.fillStyle = '#d6b45e';
  roundRect(ctx, -9, -34, 18, 20, 6);
  ctx.fill();
  ctx.strokeStyle = '#8a6d2c';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-9, -26);
  ctx.lineTo(9, -26);
  ctx.moveTo(-9, -19);
  ctx.lineTo(9, -19);
  ctx.stroke();
  ctx.fillStyle = '#d6b45e';
  ctx.beginPath();
  ctx.arc(0, -40, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(-14, -30, 28, 3);
  ctx.restore();
}

function drawInfirmary(ctx) {
  const { house, walk } = PLACES.heal;
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  roundRect(ctx, walk.x - 8, walk.y - 10, walk.w + 16, walk.h + 18, 14);
  ctx.fill();
  wall(ctx, house.x + 10, house.y + 30, house.w - 20, house.h - 30, '#efe4d0');
  for (let i = 0; i < 4; i++) {
    const x = house.x + 34 + i * 64;
    if (i === 1 || i === 2) continue;
    ctx.fillStyle = '#5a4636';
    roundRect(ctx, x, house.y + 46, 22, 26, 10);
    ctx.fill();
  }
  ctx.fillStyle = '#4b3a2c';
  roundRect(ctx, house.x + house.w / 2 - 20, house.y + 42, 40, house.h - 42, 18);
  ctx.fill();
  roof(ctx, house.x + 4, house.y + 2, house.w - 8, 30, '#b5532f');
  // посох со змеёй
  const cx = house.x + house.w / 2, cy = house.y + 16;
  ctx.fillStyle = '#fbf6ec';
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d0343a';
  ctx.fillRect(cx - 3, cy - 9, 6, 18);
  ctx.fillRect(cx - 9, cy - 3, 18, 6);
  // койки
  for (let i = 0; i < 3; i++) {
    const x = walk.x + 26 + i * 80, y = walk.y + walk.h - 30;
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(x + 2, y + 4, 54, 18);
    ctx.fillStyle = '#8b6a48';
    ctx.fillRect(x, y, 54, 18);
    ctx.fillStyle = '#f6f1e6';
    ctx.fillRect(x + 2, y + 2, 50, 12);
    ctx.fillStyle = '#e6dccb';
    ctx.fillRect(x + 2, y + 2, 12, 12);
  }
  plaque(ctx, house.x + house.w / 2, house.y + house.h + 2, 'Лазарет');
}

function drawRest(ctx, random) {
  const { house, walk } = PLACES.rest;
  ctx.fillStyle = 'rgba(80,120,60,.28)';
  roundRect(ctx, walk.x - 8, walk.y - 10, walk.w + 16, walk.h + 18, 18);
  ctx.fill();
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = random() < 0.5 ? 'rgba(70,120,50,.35)' : 'rgba(120,160,70,.3)';
    ctx.fillRect(walk.x + random() * walk.w, walk.y + random() * walk.h, 2, 3);
  }
  // навес в полоску
  wall(ctx, house.x + 14, house.y + 30, house.w - 28, house.h - 30, '#d9c3a0');
  for (let i = 0; i < 4; i++) column(ctx, house.x + 26 + i * 75, house.y + 26, house.h - 26);
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? '#f3ead8' : '#8e3b46';
    ctx.beginPath();
    const x = house.x + 6 + i * ((house.w - 12) / 12);
    ctx.moveTo(x, house.y + 6);
    ctx.lineTo(x + (house.w - 12) / 12, house.y + 6);
    ctx.lineTo(x + (house.w - 12) / 12, house.y + 30);
    ctx.quadraticCurveTo(x + (house.w - 12) / 24, house.y + 38, x, house.y + 30);
    ctx.fill();
  }
  // скамьи
  for (const [x, y] of [[walk.x + 20, walk.y + 30], [walk.x + walk.w - 76, walk.y + 30],
    [walk.x + 20, walk.y + walk.h - 34], [walk.x + walk.w - 76, walk.y + walk.h - 34]]) {
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.fillRect(x + 2, y + 6, 56, 10);
    ctx.fillStyle = '#d9cdb8';
    ctx.fillRect(x, y, 56, 10);
    ctx.fillStyle = '#b3a68f';
    ctx.fillRect(x + 4, y + 10, 6, 6);
    ctx.fillRect(x + 46, y + 10, 6, 6);
  }
  // фонтан
  const f = FOUNTAIN;
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  ctx.beginPath();
  ctx.ellipse(f.x + 3, f.y + 6, f.r + 4, f.r * 0.55 + 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d9cfbf';
  ctx.beginPath();
  ctx.ellipse(f.x, f.y, f.r + 4, f.r * 0.55 + 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4f9fc4';
  ctx.beginPath();
  ctx.ellipse(f.x, f.y, f.r - 2, f.r * 0.55 - 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d9cfbf';
  ctx.fillRect(f.x - 4, f.y - 26, 8, 26);
  ctx.beginPath();
  ctx.ellipse(f.x, f.y - 26, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  plaque(ctx, house.x + house.w / 2, house.y + house.h + 2, 'Зона отдыха', 15, '#5d6e3a');
}

function drawForge(ctx) {
  const { house, walk } = PLACES.forge;
  ctx.fillStyle = 'rgba(60,50,45,.22)';
  roundRect(ctx, walk.x - 8, walk.y - 10, walk.w + 16, walk.h + 18, 14);
  ctx.fill();
  wall(ctx, house.x + 10, house.y + 22, house.w - 20, house.h - 22, '#7c726a');
  ctx.strokeStyle = 'rgba(0,0,0,.18)';
  ctx.lineWidth = 1;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 12; col++) {
      ctx.strokeRect(house.x + 10 + col * 22 + (row % 2) * 11, house.y + 24 + row * 12, 22, 12);
    }
  }
  ctx.fillStyle = '#5c534c';
  ctx.fillRect(house.x + house.w - 60, house.y - 10, 26, 40);
  roof(ctx, house.x + 4, house.y + 2, house.w - 8, 22, '#5a5048');
  ctx.fillStyle = '#2a201a';
  roundRect(ctx, house.x + 40, house.y + 34, 56, house.h - 34, 20);
  ctx.fill();
  // наковальня
  const ax = walk.x + walk.w / 2, ay = walk.y + 50;
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath();
  ctx.ellipse(ax, ay + 2, 26, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(ax - 10, ay - 14, 20, 16);
  ctx.fillStyle = '#3d4247';
  ctx.beginPath();
  ctx.moveTo(ax - 24, ay - 26);
  ctx.lineTo(ax + 18, ay - 26);
  ctx.quadraticCurveTo(ax + 30, ay - 26, ax + 32, ay - 20);
  ctx.lineTo(ax + 12, ay - 18);
  ctx.lineTo(ax + 8, ay - 12);
  ctx.lineTo(ax - 14, ay - 12);
  ctx.lineTo(ax - 18, ay - 18);
  ctx.lineTo(ax - 24, ay - 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5b6168';
  ctx.fillRect(ax - 24, ay - 27, 44, 3);
  // стойка с доспехами
  for (let i = 0; i < 2; i++) {
    const x = walk.x + 40 + i * (walk.w - 80), y = walk.y + walk.h - 40;
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(x - 2, y - 30, 4, 34);
    ctx.fillStyle = i ? '#c58a3e' : '#a9b0b6';
    roundRect(ctx, x - 11, y - 30, 22, 22, 6);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - 36, 8, Math.PI, 0);
    ctx.fill();
  }
  plaque(ctx, house.x + house.w / 2, house.y + house.h + 2, 'Кузница', 15, '#4e4640');
}

function drawTemple(ctx) {
  const t = TEMPLE;
  const top = t.y + 6;
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fillRect(t.x + 6, t.y + t.h - 16, t.w, 14);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = shade('#e6dccb', -0.06 * i);
    ctx.fillRect(t.x + 10 - i * 6, t.y + t.h - 30 + i * 8, t.w - 20 + i * 12, 8);
  }
  wall(ctx, t.x + 26, top + 48, t.w - 52, t.h - 84, '#d8ccb6');
  ctx.fillStyle = '#3c2f2a';
  roundRect(ctx, t.x + t.w / 2 - 22, top + 74, 44, t.h - 110, 4);
  ctx.fill();
  for (let i = 0; i < 6; i++) column(ctx, t.x + 22 + i * ((t.w - 44) / 5), top + 44, t.h - 82);
  ctx.fillStyle = '#efe6d6';
  ctx.fillRect(t.x + 10, top + 34, t.w - 20, 12);
  const grad = ctx.createLinearGradient(0, top, 0, top + 34);
  grad.addColorStop(0, '#f6efe2');
  grad.addColorStop(1, '#d9ccb4');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(t.x + 6, top + 34);
  ctx.lineTo(t.x + t.w / 2, top);
  ctx.lineTo(t.x + t.w - 6, top + 34);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#b9a98b';
  ctx.lineWidth = 2;
  ctx.stroke();
  // колесо Фортуны
  const cx = t.x + t.w / 2, cy = top + 22;
  ctx.strokeStyle = '#d4a23a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 9, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9);
    ctx.stroke();
  }
  plaque(ctx, cx, t.y + t.h - 6, 'Храм Фортуны', 14, '#7a5a2a');
}

function drawGate(ctx) {
  const g = GATE;
  ctx.fillStyle = '#8f8172';
  ctx.fillRect(g.x - 26, g.y - 6, g.w + 52, g.h + 6);
  ctx.fillStyle = '#a89a89';
  ctx.fillRect(g.x - 30, g.y - 12, g.w + 60, 10);
  ctx.fillStyle = '#2b2018';
  ctx.beginPath();
  ctx.moveTo(g.x, g.y + g.h);
  ctx.lineTo(g.x, g.y + 26);
  ctx.arc(g.x + g.w / 2, g.y + 26, g.w / 2, Math.PI, 0);
  ctx.lineTo(g.x + g.w, g.y + g.h);
  ctx.fill();
  ctx.strokeStyle = '#6b4a2b';
  ctx.lineWidth = 3;
  for (let x = g.x + 12; x < g.x + g.w; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, g.y + 14);
    ctx.lineTo(x, g.y + g.h);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(g.x, g.y + 40);
  ctx.lineTo(g.x + g.w, g.y + 40);
  ctx.stroke();
  plaque(ctx, g.x + g.w / 2, g.y - 8, 'На арену', 14, '#7a2f24');
}

export function drawSigns(ctx, list) {
  for (const [x, y, text, size, tone] of list) plaque(ctx, x, y, text, size, tone);
}

export function paintLudus(ctx) {
  signs = [];
  const random = seeded(7);
  sandFloor(ctx, random, 0, 0, FIELD_W, FIELD_H, SAND);
  paving(ctx, random, 0, 286, FIELD_W, 36);
  paving(ctx, random, 320, 0, 22, FIELD_H);
  paving(ctx, random, 578, 0, 22, FIELD_H);
  // двор с кругом для поединков
  const y = PLACES.yard.walk;
  sandFloor(ctx, random, y.x - 2, y.y - 24, y.w + 4, y.h + 30, '#dcc195');
  ctx.strokeStyle = 'rgba(140,100,60,.35)';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.ellipse(y.x + y.w / 2, y.y + y.h / 2, y.w / 2 - 16, y.h / 2 - 30, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  drawTraining(ctx);
  drawInfirmary(ctx);
  drawRest(ctx, random);
  drawForge(ctx);
  drawTemple(ctx);
  drawGate(ctx);
  for (const [x, yy, h] of [[316, 250, 70], [604, 250, 70], [316, 560, 64], [604, 560, 64], [16, 330, 56],
    [904, 330, 56]]) cypress(ctx, x, yy, h);
  const painted = signs;
  signs = null;
  return painted;
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

export function drawLudusLife(ctx, t, dummyHits) {
  DUMMIES.forEach((d, i) => drawDummy(ctx, d.x, d.y, dummyHits[i] || 0));
  // огонь кузницы
  const { house } = PLACES.forge;
  const flicker = 0.55 + 0.25 * Math.sin(t * 9) + 0.15 * Math.sin(t * 23);
  const fx = house.x + 68, fy = house.y + 58;
  const glow = ctx.createRadialGradient(fx, fy, 2, fx, fy, 42);
  glow.addColorStop(0, 'rgba(255,190,80,' + (0.9 * flicker).toFixed(3) + ')');
  glow.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(fx - 44, fy - 44, 88, 88);
  // дым из трубы
  for (let i = 0; i < 4; i++) {
    const k = (t * 0.35 + i / 4) % 1;
    ctx.fillStyle = 'rgba(90,90,95,' + (0.35 * (1 - k)).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(house.x + house.w - 47 + Math.sin(t + i) * 6 * k, house.y - 12 - k * 40, 6 + k * 10, 0, Math.PI * 2);
    ctx.fill();
  }
  // струи фонтана
  const f = FOUNTAIN;
  ctx.strokeStyle = 'rgba(190,230,255,.85)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? 1 : -1, spread = 10 + (i >> 1) * 7;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y - 28);
    ctx.quadraticCurveTo(f.x + side * spread, f.y - 44 - Math.sin(t * 5 + i) * 2, f.x + side * (spread + 8), f.y - 6);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 2; i++) {
    const k = (t * 0.6 + i / 2) % 1;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, 8 + k * (f.r - 10), (8 + k * (f.r - 10)) * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawSoon(ctx, t) {
  // табличка «скоро» на храме
  const tx = TEMPLE.x + TEMPLE.w / 2, ty = TEMPLE.y + 120;
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(-0.08);
  ctx.font = '900 13px ' + FONT;
  const pulse = 1 + 0.04 * Math.sin(t * 3);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#e8b93c';
  roundRect(ctx, -44, -12, 88, 24, 12);
  ctx.fill();
  ctx.fillStyle = '#3a2804';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('гача скоро', 0, 1);
  ctx.restore();
}

// --- гладиатор ---

export function drawGladiator(ctx, g, t, scene) {
  const fate = scene === 'arena' ? g.fate : null;
  const lying = fate === 'down' || fate === 'dead';
  const kneel = fate === 'yield';
  const seed = hashOf(g.login);
  const skin = SKIN[seed % SKIN.length];
  const metal = METAL[Math.min(METAL.length - 1, g.armor)];
  const size = FIGURE[scene];
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.scale(size, size);
  // тень
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath();
  ctx.ellipse(0, 0, lying ? 17 : 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (fate === 'dead') {
    ctx.fillStyle = 'rgba(140,20,20,.55)';
    ctx.beginPath();
    ctx.ellipse(4, 1, 15, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (lying) {
    ctx.translate(0, -3);
    ctx.rotate(g.face > 0 ? -Math.PI / 2 : Math.PI / 2);
    ctx.translate(0, 8);
  }
  ctx.scale(g.face < 0 ? -1 : 1, 1);
  if (fate === 'dead') ctx.globalAlpha = 0.75;
  const walk = g.walking && !lying && !kneel ? Math.sin(t * 12 + seed) : 0;
  const bob = Math.abs(walk) * 1.2;
  const low = kneel ? 6 : 0;
  ctx.translate(0, -bob + low);
  // щит за спиной
  ctx.fillStyle = shade(metal, -0.3);
  ctx.beginPath();
  ctx.ellipse(-7, -16, 6, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = g.color;
  ctx.beginPath();
  ctx.ellipse(-7, -16, 4.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.arc(-7, -16, 1.8, 0, Math.PI * 2);
  ctx.fill();
  // ноги
  ctx.fillStyle = skin;
  if (kneel) {
    ctx.fillRect(-4, -10, 4, 5);
    ctx.fillRect(1, -6, 7, 4);
  } else {
    ctx.fillRect(-4 + walk * 2, -10, 3.5, 10);
    ctx.fillRect(1 - walk * 2, -10, 3.5, 10);
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(-4.5 + walk * 2, -2.5, 4.5, 2.5);
    ctx.fillRect(0.5 - walk * 2, -2.5, 4.5, 2.5);
  }
  // туника
  ctx.fillStyle = g.color;
  roundRect(ctx, -6, -23, 12, 15, 3);
  ctx.fill();
  ctx.fillStyle = shade(g.color, -0.3);
  ctx.beginPath();
  ctx.moveTo(-6, -11);
  ctx.lineTo(6, -11);
  ctx.lineTo(7, -7);
  ctx.lineTo(-7, -7);
  ctx.closePath();
  ctx.fill();
  if (g.armor > 0) {
    ctx.fillStyle = metal;
    roundRect(ctx, -5.5, -22.5, 11, 9, 3);
    ctx.fill();
    ctx.fillStyle = shade(metal, -0.3);
    ctx.fillRect(-5.5, -15, 11, 1.5);
    if (g.armor >= 3) {
      ctx.fillStyle = shade(metal, 0.3);
      ctx.fillRect(-3, -21, 2, 5);
    }
  }
  ctx.fillStyle = '#4a2e1a';
  ctx.fillRect(-6, -12, 12, 2);
  if (g.armor >= 5) {
    ctx.fillStyle = '#b3262e';
    ctx.beginPath();
    ctx.moveTo(-5, -22);
    ctx.lineTo(-11, -6 + walk);
    ctx.lineTo(-4, -8);
    ctx.closePath();
    ctx.fill();
  }
  // голова и шлем
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0.5, -28, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.arc(0.5, -29, 6.2, Math.PI * 1.05, Math.PI * 1.95 + 0.2);
  ctx.lineTo(6.5, -27);
  ctx.lineTo(-5.5, -27);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(metal, -0.35);
  ctx.fillRect(1.5, -28.5, 5, 1.6);
  // гребень
  ctx.fillStyle = shade(g.color, 0.15);
  ctx.beginPath();
  ctx.moveTo(-5, -33);
  ctx.quadraticCurveTo(0, -41, 5, -34);
  ctx.quadraticCurveTo(0, -37, -5, -33);
  ctx.fill();
  // меч
  const blade = BLADE[Math.min(BLADE.length - 1, g.weapon)];
  if (!lying && !kneel) {
    const swing = g.swing > 0 ? Math.sin((1 - g.swing / 0.3) * Math.PI) : 0;
    ctx.save();
    ctx.translate(6, -16);
    ctx.rotate(-0.9 + swing * 2.1);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(-1, -4, 2, 4);
    ctx.fillStyle = shade(blade, -0.2);
    ctx.fillRect(-3, -5, 6, 1.6);
    ctx.fillStyle = blade;
    ctx.beginPath();
    ctx.moveTo(-1.3, -5);
    ctx.lineTo(1.3, -5);
    ctx.lineTo(1, -16);
    ctx.lineTo(0, -18);
    ctx.lineTo(-1, -16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (kneel) {
    // поднятая рука — сдаётся
    ctx.fillStyle = skin;
    ctx.fillRect(4, -30, 2.5, 12);
    ctx.fillStyle = '#f5f5f0';
    ctx.fillRect(5, -36, 7, 5);
  }
  ctx.restore();
  if (g.flash > 0 && !lying) {
    ctx.fillStyle = 'rgba(255,70,50,' + (g.flash * 2.5).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(g.x, g.y - 20 * size, 13 * size, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawLabel(ctx, g, scene, highlight) {
  const fate = scene === 'arena' ? g.fate : null;
  const lying = fate === 'down' || fate === 'dead';
  const top = g.y - (lying ? 20 : 43) * FIGURE[scene];
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
