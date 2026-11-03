// пиксельная графика как в Чатобороне: один пиксель рисунка — два пикселя поля, текстуры и спрайты с обводкой
import { tierOf } from './gacha.js';
import { netUp, sandUp, shieldUp } from './balance.js';

export const P = 2;
const OUT = '#3a2416';

// --- шум и цвет ---

export function hash(x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function noise(x, y, scale, s) {
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

export function tone(c, k) {
  return [Math.max(0, Math.min(255, c[0] * k)), Math.max(0, Math.min(255, c[1] * k)), Math.max(0, Math.min(255, c[2] * k))];
}

export function hex(c) {
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
export function remember(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

// песок как в Domina: тёплый персиково-золотой, в лёгкой дымке, с крупными мягкими разводами и редкими крупинками
// (крупинки — по 2×2, как пиксели спрайтов). haze — насколько светлее «дымка» в этом месте (0…1)
export function sandTexel(x, y, haze = 0.5) {
  const base = rgb('#eccb94'), light = rgb('#f6e2b8');
  const t = Math.max(0, Math.min(1, haze * 0.75 + (noise(x, y, 230, 41) - 0.5) * 0.5));
  const c = base.map((v, i) => v + (light[i] - v) * t);
  let k = 0.965 + 0.05 * noise(x, y, 120, 42) + 0.025 * noise(x, y, 46, 43);
  const speck = hash(x >> 1, y >> 1, 44);
  if (speck < 0.014) k *= 0.9 + 0.04 * hash(x >> 1, y >> 1, 45);
  else if (speck > 0.993) k *= 1.04;
  return tone(c, k);
}


// --- гладиаторы: высокие стройные фигуры в профиль, как в Domina — без обводки, только тени ---

const SKINS = ['#e6cdad', '#d7b391', '#bf9472', '#9c7052', '#76523b'];
const HAIR = ['#2b1d14', '#4a2f1c', '#6e4424', '#a8823e', '#1c1410'];
const METALS = ['#4b4540', '#5c4d3f', '#7a6243', '#6c7176', '#868c92', '#a2a7ac', '#b8954a', '#c0282e'];
const BLADES = ['#8d9092', '#b08250', '#9aa1a8', '#d6dde3', '#bcd8ec', '#c4ecd6', '#e8c35a', '#ff3b3b'];
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
    sand: sandUp(g),
    amulet: Boolean(g.amulet),
  };
}

// щит, лежащий на песке, — того же вида, что у владельца
export function shieldLookOf(g, seed) {
  return { shape: SHIELD_SHAPES[(seed >>> 11) % SHIELD_SHAPES.length], design: (seed >>> 9) % 3, color: muted(g.color) };
}

const gearKey = (look) => [look.head, look.body, look.legs, look.feet].join('');
const BOOTS = ['#5a3a22', '#6b4329', '#4a3426', '#5c4d3f', '#6c7176', '#868c92', '#b8954a'];

// поза: stand, walk1, walk2, sit, kneel, idle (стоит смирно, ноги прямо). Ступни на y = 39, центр x = 12, смотрит вправо
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
    const idle = pose === 'idle';
    const back = idle ? 11 : pose === 'walk1' ? 6 : pose === 'walk2' ? 10 : 7;
    const front = idle ? 14 : pose === 'walk1' ? 18 : pose === 'walk2' ? 14 : 17;
    p.line(11, 24, back, 38, skinD, 3);
    foot(back, 39);
    const knee = idle ? [14, 31] : [Math.round((14 + front) / 2) + 1, 31];
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
  const live = pose === 'stand' || pose === 'walk1' || pose === 'walk2' || pose === 'idle';
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
  if (look.amulet) {
    // божественный амулет: золотой шнурок и красный камень на груди
    p.px(12, 11 + dy, '#d4af37');
    p.px(14, 11 + dy, '#d4af37');
    p.rect(13, 12 + dy, 1, 2, '#d8202e');
    p.px(13, 12 + dy, '#ff8a8a');
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

// павший на арене: лежит на спине, голова слева, лицо вверх; свет сверху. Те же цвета кожи, волос, ткани и
// снаряжения по редкости, что у стоящей фигурки. 24×9 пикселей
function lyingArt(look, dead) {
  const p = new Pix(24, 9);
  const skin = look.skin, skinD = darker(skin, 0.8), skinL = darker(skin, 1.08);
  const shade3 = (tier) => [METALS[tier], darker(METALS[tier], 0.68), darker(METALS[tier], 1.3)];
  // ноги: ближняя сверху светлее, дальняя ниже в тени; колени чуть согнуты
  p.rect(16, 4, 5, 2, skin);
  p.rect(16, 4, 5, 1, skinL);
  p.px(18, 3, skinL);
  p.rect(16, 6, 6, 2, skinD);
  if (look.legs) {
    const [m, mD, mL] = shade3(look.legs);
    p.rect(18, 3, 3, 3, m);
    p.rect(18, 3, 3, 1, mL);
    p.rect(18, 6, 3, 1, mD);
  }
  // ступни вверх: сандалии, ботинки или сапоги по редкости
  const boot = look.feet ? BOOTS[Math.min(BOOTS.length - 1, look.feet)] : null;
  p.rect(21, 2, 2, 4, boot || skin);
  p.px(21, 2, boot ? darker(boot, 1.3) : skinL);
  p.rect(22, 6, 2, 2, boot || skinD);
  // набедренная повязка с поясом цвета игрока
  p.rect(13, 3, 3, 5, CLOTH);
  p.rect(13, 7, 3, 1, CLOTH_D);
  p.rect(12, 3, 1, 5, BELT);
  p.rect(13, 4, 3, 1, look.color);
  // торс: грудь вверх; доспех по редкости
  for (let x = 6; x < 12; x++) for (let y = 3; y < 8; y++) p.px(x, y, y === 3 ? skinL : y === 7 ? skinD : skin);
  if (look.body) {
    const [m, mD, mL] = shade3(look.body);
    p.rect(6, 3, 6, 3, m);
    p.rect(6, 3, 6, 1, mL);
    p.rect(6, 5, 6, 1, mD);
  }
  // рука вдоль тела, наруч на ней
  p.rect(7, 6, 6, 1, skinD);
  p.rect(7, 6, 3, 1, GUARD);
  p.px(13, 6, skin);
  // шея и голова: затылок на подушке, лицо вверх
  p.rect(5, 4, 1, 3, skinD);
  if (look.helmet === 'bare') {
    p.ellipse(2.5, 5, 2.4, 2.6, skin, skinD, skinL);
    p.rect(0, 5, 2, 3, look.hair);
    p.px(3, 2, skin);
    p.px(2, 4, '#3a2a20');
  } else {
    const [m, mD, mL] = shade3(look.head);
    p.ellipse(2.5, 5, 2.6, 2.8, m, mD, mL);
    p.px(3, 3, '#2a2420');
    p.px(4, 4, '#2a2420');
    p.rect(0, 3, 1, 3, look.color);
  }
  if (!dead) return p.canvas();
  return p.canvas((c) => {
    const [r, g, b] = rgb(c), l = (r + g + b) / 3;
    return hex([l * 0.55 + r * 0.15, l * 0.5 + g * 0.1, l * 0.5 + b * 0.1]);
  });
}

export function lyingSprite(look, dead) {
  return remember(['lie5', look.color, gearKey(look), look.helmet, look.skin, look.hair, dead].join(':'),
    () => lyingArt(look, dead));
}

// оружие — в пикселях фигурки и в том же стиле: три тона (свет слева, основной, тень справа), без обводки.
// Смотрит клинком вверх; px, py — где его держит правая рука. Металл клинка — цвета редкости, древки и обмотки — свои
const WOODS = ['#5a3e26', '#7a5636', '#94693f'];
const WRAPS = ['#2e241f', '#4a3a30', '#665246'];
const IRONS = ['#4a4e54', '#6c7176', '#9aa0a6'];
const GOLDS = ['#8a6a2a', '#b8954a', '#e2c070'];

// вертикальная полоса в один-два пикселя: древко, рукоять, обмотка (через пиксель светлее)
function pole(p, x, y0, y1, pal, { wide = false, wrap = false } = {}) {
  for (let y = y0; y <= y1; y++) {
    const lit = wrap && y % 2 === 0;
    p.px(x, y, lit ? pal[2] : pal[1]);
    if (wide) p.px(x + 1, y, lit ? pal[1] : pal[0]);
  }
}

function weaponArt(type, tier) {
  const m = BLADES[Math.min(BLADES.length - 1, tier)], mL = darker(m, 1.25), mD = darker(m, 0.72), mDD = darker(m, 0.56);
  if (type === 'greatsword') {
    // огромный тяжёлый меч, как у Гатса: широкий длинный клинок-плита, грубая гарда, длинная рукоять на две руки
    const p = new Pix(6, 31);
    p.rect(2, 0, 2, 1, m);
    p.px(1, 1, mL);
    p.rect(2, 1, 2, 1, m);
    p.px(4, 1, mD);
    for (let y = 2; y <= 21; y++) {
      p.px(1, y, mL);
      p.px(2, y, m);
      p.px(3, y, y > 3 && y < 19 ? mD : m);
      p.px(4, y, mDD);
    }
    p.rect(0, 22, 6, 1, IRONS[2]);
    p.rect(0, 23, 6, 1, IRONS[0]);
    pole(p, 2, 24, 28, WRAPS, { wide: true, wrap: true });
    p.rect(1, 29, 4, 1, IRONS[1]);
    p.rect(2, 30, 2, 1, IRONS[0]);
    return { canvas: p.canvas(), px: 2.5, py: 24.5, k: 1 };
  }
  if (type === 'rapier') {
    // рапира: тонкий длинный прямой клинок, чашка гарды, прямая крестовина, рукоять с обмоткой и шарик на конце
    const p = new Pix(5, 30);
    p.px(2, 0, mL);
    for (let y = 1; y <= 20; y++) p.px(2, y, y < 14 ? mL : m);
    p.px(3, 20, mD);
    p.rect(0, 21, 5, 1, GOLDS[2]);
    p.rect(1, 22, 3, 1, GOLDS[1]);
    p.px(0, 22, GOLDS[0]);
    p.px(4, 22, GOLDS[0]);
    pole(p, 2, 23, 27, WRAPS, { wrap: true });
    p.rect(1, 28, 3, 1, GOLDS[2]);
    p.px(2, 29, GOLDS[0]);
    return { canvas: p.canvas(), px: 2, py: 25, k: 1 };
  }
  if (type === 'sword') {
    // гладиус средней длины: узкий клинок с острием, латунная гарда, рукоять с перехватом, шарик на конце
    const p = new Pix(4, 23);
    p.px(1, 0, mL);
    for (let y = 1; y <= 16; y++) {
      p.px(1, y, y < 12 ? mL : m);
      p.px(2, y, mD);
    }
    p.rect(0, 17, 4, 1, GOLDS[1]);
    p.px(0, 17, GOLDS[2]);
    pole(p, 1, 18, 20, WOODS, { wide: true, wrap: true });
    p.rect(1, 21, 2, 1, GOLDS[2]);
    p.rect(1, 22, 2, 1, GOLDS[0]);
    return { canvas: p.canvas(), px: 1.5, py: 18.5, k: 1 };
  }
  if (type === 'spear') {
    // копьё: листовидный наконечник, железная втулка, древко с обмоткой посередине
    const p = new Pix(3, 33);
    p.px(1, 0, mL);
    for (let y = 1; y <= 4; y++) {
      p.px(0, y, mL);
      p.px(1, y, m);
      p.px(2, y, mD);
    }
    p.px(1, 5, mD);
    p.px(1, 6, IRONS[2]);
    p.px(1, 7, IRONS[0]);
    pole(p, 1, 8, 31, WOODS);
    pole(p, 1, 16, 20, WRAPS, { wrap: true });
    p.px(1, 32, IRONS[1]);
    return { canvas: p.canvas(), px: 1, py: 18, k: 1 };
  }
  if (type === 'trident') {
    // трезубец: средний зуб длиннее боковых, у всех жала, перекладина, длинное древко
    const p = new Pix(7, 33);
    p.px(3, 0, mL);
    p.rect(2, 1, 3, 1, m);
    p.px(4, 1, mD);
    for (let y = 2; y <= 6; y++) p.px(3, y, y < 4 ? mL : m);
    for (const x of [0, 6]) {
      p.px(x, 2, mL);
      for (let y = 3; y <= 6; y++) p.px(x, y, x ? mD : m);
    }
    p.px(1, 3, mD);
    p.px(5, 3, mD);
    p.rect(1, 7, 5, 1, mD);
    p.px(0, 7, mDD);
    p.px(6, 7, mDD);
    p.px(3, 8, IRONS[2]);
    pole(p, 3, 9, 31, WOODS);
    pole(p, 3, 17, 21, WRAPS, { wrap: true });
    p.px(3, 32, IRONS[1]);
    return { canvas: p.canvas(), px: 3, py: 19, k: 1 };
  }
  if (type === 'hammer') {
    // боевой молот: брусок с широкими бойками на концах, железные полосы на древке, обмотка снизу
    const p = new Pix(9, 29);
    for (const x of [0, 7]) {
      p.rect(x, 0, 2, 5, m);
      p.rect(x, 0, 2, 1, mL);
      p.rect(x, 4, 2, 1, mDD);
      p.px(x + 1, 2, mD);
    }
    p.rect(2, 1, 5, 3, m);
    p.rect(2, 1, 5, 1, mL);
    p.rect(2, 3, 5, 1, mD);
    p.px(4, 2, mDD);
    pole(p, 4, 5, 8, IRONS);
    pole(p, 4, 9, 19, WOODS);
    p.rect(3, 20, 3, 1, IRONS[1]);
    pole(p, 4, 21, 26, WRAPS, { wrap: true });
    p.rect(3, 27, 3, 1, IRONS[1]);
    p.px(4, 28, IRONS[0]);
    return { canvas: p.canvas(), px: 4, py: 21.5, k: 1 };
  }
  if (type === 'axe') {
    // двусторонняя секира: две лопасти веером (у втулки узкие, к краю — высокая дуга), шип сверху, древко с перевязью
    const p = new Pix(13, 30);
    p.px(6, 0, mL);
    for (const side of [-1, 1]) {
      for (let u = 2; u <= 6; u++) {
        const h = Math.round(0.6 + (u - 1) * 0.95), x = 6 + side * u;
        for (let y = 6 - h; y <= 6 + h; y++) {
          const edge = u === 6, top = y < 6 - h + 1;
          p.px(x, y, edge ? mL : top ? m : y > 6 + h - 1 ? mDD : y > 6 ? mD : m);
        }
      }
      // гравировка — тёмная черта посередине лопасти
      p.px(6 + side * 4, 6, mDD);
    }
    p.rect(5, 1, 3, 10, IRONS[1]);
    p.rect(5, 1, 1, 10, IRONS[2]);
    p.rect(7, 1, 1, 10, IRONS[0]);
    pole(p, 6, 11, 27, WOODS);
    for (const y of [15, 18, 21, 24]) p.px(6, y, WRAPS[2]);
    p.rect(5, 12, 3, 1, IRONS[1]);
    p.rect(5, 19, 3, 1, IRONS[1]);
    p.rect(5, 28, 3, 1, IRONS[1]);
    p.px(6, 29, IRONS[0]);
    return { canvas: p.canvas(), px: 6, py: 22, k: 1 };
  }
  if (type === 'claws') return { canvas: new Pix(1, 1).canvas(), px: 0, py: 0, k: 1 };
  return weaponArt('sword', tier);
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

// мешок с песком: холщовый, перевязан у горла
function sandArt() {
  const p = new Pix(7, 8);
  p.rect(2, 0, 3, 1, '#c9a46a');
  p.rect(2, 1, 3, 1, '#6b4a2a');
  for (let y = 2; y < 8; y++) {
    const half = y < 4 ? 2 + (y - 2) : y > 6 ? 2 : 3;
    for (let x = 3 - half; x <= 3 + half; x++) {
      if (x < 0 || x > 6) continue;
      p.px(x, y, x < 3 && y < 5 ? '#e2c690' : x > 4 || y > 6 ? '#a07c45' : '#c9a46a');
    }
  }
  p.px(3, 4, '#a07c45');
  return p.outline().canvas();
}
export const sandSprite = () => remember('sand1', sandArt);

// лев в профиль, смотрит вправо: лапы на y = 23, центр x = 18. frame: stand, walk1, walk2, pounce, dead
// лев в высоком разрешении: один пиксель рисунка — один пиксель поля (у людей — два).
// Рыжевато-песочное поджарое тело, тёмная лохматая грива, тонкие лапы, длинный хвост с кисточкой; свет сверху слева
const LION_W = 112, LION_H = 64, LION_GROUND = 61;
const FUR = ['#7a5430', '#9c7243', '#bd925b', '#d4ac73', '#e6c792'];
const MANE = ['#1f140c', '#382214', '#57351d', '#86552c'];

function lionArt(frame) {
  const p = new Pix(LION_W, LION_H);
  const dead = frame === 'dead', pounce = frame === 'pounce';
  const lift = pounce ? 1 : 0, down = dead ? 9 : 0;
  // мех: по высоте внутри детали (-1 верх … 1 низ) — от светлого к тёмному, с мелким зерном по пикселям
  const furAt = (x, y, ny, bias = 0) => {
    const v = 2.6 - ny * 1.6 + bias + (hash(x, y, 71) - 0.5) * 0.7;
    return FUR[Math.max(0, Math.min(FUR.length - 1, Math.round(v)))];
  };
  const blob = (cx, cy, rx, ry, color) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) p.px(x, y, color(x, y, dy));
      }
    }
  };
  // конечность: от толстого начала к тонкому концу по ломаной
  const limb = (pts, w0, w1, far) => {
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    let run = 0;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], len = Math.hypot(x1 - x0, y1 - y0);
      for (let s = 0; s <= len; s += 0.5) {
        const t = (run + s) / total, r = (w0 + (w1 - w0) * t) / 2, x = x0 + (x1 - x0) * s / len, y = y0 + (y1 - y0) * s / len;
        blob(x, y, r, r, (px, py, dy) => furAt(px, py, dy * 0.6 + t * 0.6, far ? -1.1 : -0.2));
      }
      run += len;
    }
  };
  const legs = {
    stand: [[30, 22, 26], [38, 30, 34], [74, 74, 74], [82, 82, 82]],
    walk1: [[30, 16, 20], [38, 36, 40], [74, 66, 64], [82, 88, 92]],
    walk2: [[30, 26, 34], [38, 22, 24], [74, 80, 86], [82, 70, 70]],
    pounce: [[30, 18, 8], [38, 26, 16], [76, 92, 104], [84, 98, 108]],
  }[dead ? 'stand' : frame] || [[30, 22, 26], [38, 30, 34], [74, 74, 74], [82, 82, 82]];
  const ground = LION_GROUND;
  // дальние лапы — первыми и темнее
  const drawLeg = ([hip, knee, foot], i) => {
    const far = i % 2 === 0, front = i >= 2, hy = (front ? 38 : 36) - (front ? lift * 6 : 0) + down;
    let pts;
    if (dead) pts = [[hip, hy], [hip + 10, hy + 10], [hip + 22, hy + 13]];
    else if (front) pts = [[hip, hy], [knee, hy + 12 + (pounce ? -8 : 0)], [foot, pounce ? ground - 10 + (i - 2) * 4 : ground - 1]];
    else pts = [[hip, hy], [hip + 4, hy + 9], [knee, hy + 16], [foot, ground - 1]];
    limb(pts, front ? 6.5 : 7.5, 3.4, far);
    const [fx, fy] = pts[pts.length - 1];
    blob(fx + 1.5, fy, 3, 1.6, (x, y) => (far ? FUR[0] : FUR[1]));
  };
  [0, 2].forEach((i) => drawLeg(legs[i], i));
  // хвост: длинный, тонкий, чуть провисает; кисточка тёмная
  const tail = (t) => [22 - 19 * t, 27 + down + 10 * t * t - 4 * t * (1 - t)];
  for (let t = 0; t <= 1; t += 0.02) {
    const [x, y] = tail(t);
    blob(x, y, 1.3, 1.3, (px, py, dy) => furAt(px, py, dy, -0.4));
  }
  const [tx, ty] = tail(1);
  blob(tx - 1, ty + 2, 2.6, 3.6, (x, y) => MANE[hash(x, y, 72) < 0.5 ? 1 : 2]);
  // туловище: длинное, брюхо подобрано, грудь глубже
  const tilt = pounce ? -0.12 : 0;
  const curve = (pts, x) => {
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], t = (x - x0) / (x1 - x0), k = (1 - Math.cos(t * Math.PI)) / 2;
        return y0 + (y1 - y0) * k;
      }
    }
    return pts[pts.length - 1][1];
  };
  const TOP = [[18, 31], [24, 23], [34, 20], [50, 22], [66, 21], [80, 20], [90, 24]];
  const BOT = [[18, 33], [24, 40], [34, 43], [48, 39], [58, 39], [70, 44], [80, 46], [90, 40]];
  for (let x = 18; x <= 90; x++) {
    const shift = (x - 54) * tilt + down;
    const top = curve(TOP, x) + shift, bot = curve(BOT, x) + shift;
    for (let y = Math.floor(top); y <= bot; y++) {
      const ny = ((y + 0.5) - (top + bot) / 2) / ((bot - top) / 2 || 1);
      p.px(x, y, furAt(x, y, ny, x > 60 && ny > 0.3 ? -0.3 : 0));
    }
  }
  [1, 3].forEach((i) => drawLeg(legs[i], i));
  // грива: крупная тёмная масса вокруг головы и шеи, спускается на грудь; пряди расходятся от головы,
  // по краю — острые лохмы (кроме переда, где морда)
  const mx = 87, my = 24 + down + (pounce ? -5 : 0);
  const maneR = (a) => {
    const base = Math.hypot(Math.cos(a) * 14, Math.sin(a) * (Math.sin(a) > 0 ? 20 : 15)) / Math.hypot(Math.cos(a), Math.sin(a));
    return base * (1 + 0.06 * Math.sin(a * 5 + 0.7));
  };
  const front = (a) => Math.cos(a) > 0.55 && Math.sin(a) < 0.5;
  for (let y = my - 24; y <= my + 26; y++) {
    for (let x = mx - 22; x <= mx + 18; x++) {
      const dx = x + 0.5 - mx, dy = y + 0.5 - my, a = Math.atan2(dy, dx), d = Math.hypot(dx, dy), R = maneR(a);
      // лохмы: острые зубцы по краю
      const tuft = front(a) ? 0 : 3.2 * Math.max(0, Math.sin(a * 11 + 0.4)) ** 3 + 1.6 * Math.max(0, Math.sin(a * 23 + 2)) ** 4;
      if (d > R + tuft) continue;
      const strand = Math.sin(a * 22 + d * 0.55 + hash(Math.round(a * 22), 0, 75) * 3);
      const lightSide = (-dx * 0.6 - dy * 0.8) / (R || 1);
      let v = 1.2 + strand * 0.7 + lightSide * 1.1 + (hash(x, y, 76) - 0.5) * 0.5;
      if (d > R - 2) v -= 0.6;
      p.px(x, y, MANE[Math.max(0, Math.min(MANE.length - 1, Math.round(v)))]);
    }
  }
  // голова в профиль: округлый лоб, вытянутая морда, нижняя челюсть; морда теплее тела
  const FACE = ['#97703f', '#bd925b', '#d6b07a', '#ecd3a5'];
  const faceAt = (x, y, ny, bias = 0) => {
    const v = 2 - ny * 1.3 + bias + (hash(x, y, 77) - 0.5) * 0.5;
    return FACE[Math.max(0, Math.min(FACE.length - 1, Math.round(v)))];
  };
  const hx = 96, hy = 21 + down + (pounce ? -6 : 0);
  blob(hx - 0.5, hy - 0.5, 6.5, 6.8, (x, y, dy) => faceAt(x, y, dy));
  // морда: от лба вперёд и чуть вниз, с переносицей
  for (let x = hx; x <= hx + 12; x++) {
    const t = (x - hx) / 12, top = hy - 3 + t * 2.2, bot = hy + 6 - t * 1.2 - (t > 0.85 ? (t - 0.85) * 12 : 0);
    for (let y = Math.floor(top); y <= bot; y++) {
      const ny = ((y + 0.5) - (top + bot) / 2) / ((bot - top) / 2 || 1);
      p.px(x, y, y < top + 1.2 ? FACE[3] : faceAt(x, y, ny, 0.2));
    }
  }
  // нижняя челюсть и подбородок — в тени
  for (let x = hx - 1; x <= hx + 8; x++) {
    const t = (x - hx + 1) / 9, top = hy + 5, bot = hy + 8.5 - t * 2.5;
    for (let y = Math.floor(top); y <= bot; y++) p.px(x, y, faceAt(x, y, 0.8, -0.3));
  }
  // нос, пасть, глаз под тёмным надбровьем, ухо
  p.rect(hx + 11, hy - 1, 2, 2, '#2a1a12');
  p.px(hx + 12, hy + 1, '#2a1a12');
  p.px(hx + 11, hy - 1, '#5a4030');
  p.line(hx + 4, hy + 5, hx + 11, hy + 3, '#5a2a1e');
  p.px(hx + 4, hy + 5, '#3a1c14');
  for (const [x, y] of [[hx + 7, hy + 2], [hx + 9, hy + 2], [hx + 8, hy + 3]]) p.px(x, y, FACE[1]);
  // надбровье тёмное, глаз миндалевидный с бликом, под глазом и на щеке — тень
  p.line(hx + 1, hy - 4, hx + 6, hy - 3, FACE[0]);
  p.rect(hx + 3, hy - 2, 3, 2, '#1a120c');
  p.px(hx + 2, hy - 1, '#1a120c');
  p.px(hx + 4, hy - 2, '#e8d9c0');
  p.line(hx + 2, hy, hx + 5, hy + 1, FACE[1]);
  p.line(hx - 2, hy + 1, hx, hy + 4, FACE[1]);
  // кончик носа скруглён
  p.px(hx + 13, hy - 1, FACE[2]);
  blob(hx - 3, hy - 6, 2, 2.2, (x, y, dy) => (dy > 0.2 ? FACE[0] : FACE[2]));
  p.px(hx - 3, hy - 5, '#7a5a44');
  p.outline('#3a2c22');
  if (!dead) return p.canvas();
  // мёртвый лев: лежит, всё темнее и серее
  return p.canvas((c) => {
    const [r, g, b] = rgb(c), l = (r + g + b) / 3;
    return hex([l * 0.6 + r * 0.2, l * 0.55 + g * 0.15, l * 0.5 + b * 0.1]);
  });
}

export const lionSprite = (frame) => remember('lion5:' + frame, () => lionArt(frame));
// точка опоры спрайта льва: середина туловища на уровне лап; scale — во сколько пикселей поля один пиксель рисунка
export const LION = { x: 56, foot: LION_GROUND, scale: 1 };

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
  const key = ['g7', look.color, gearKey(look), look.helmet, look.shield, look.net, look.amulet, look.skin, look.hair, pose, dead,
    flash].join(':');
  return remember(key, () => {
    const art = remember(key.replace(/:(true|false)$/, ':false'), () => gladiatorArt(look, pose, dead));
    return flash ? silhouette(art) : art;
  });
}

export const weaponSprite = (type, tier) => remember('weapon4:' + type + ':' + tier, () => weaponArt(type, tier));
