import { ARMOR_SLOTS, SLOT_IDS, STATS, armorOf, critOf, damageOf, maxHp, twoHanded, xpNeed } from './balance.js';
import { RARITIES, itemText, outcomeOf, rarityOf, spin } from './gacha.js';
import { FIELD_H, FIELD_W, DUMMIES, PLACES } from './places.js';
import { FONT, drawCrowd, drawGladiator, drawThrown, drawLabel, drawLudusLife, drawSigns, drawSoon, paintArena, paintLudus } from './draw.js';
import { plural } from './engine.js';
import { ambience, play, setSound } from './sound.js';
import { P } from './art.js';
import { RAINBOW_CYCLE, SNOW_CYCLE, starOf } from './stars.js';

const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 720;
const DOM_EVERY = 0.2;
const FADE = 0.7;
const FLOAT_TIME = 1.1;
// мир рисуется в низком разрешении и растягивается крупными пикселями — как в Domina
const PIXEL = 1;
const BLOOD = ['#8f1414', '#a8191b', '#6e0d0f', '#c22a22'];
const WHERE = {
  train: 'трен', heal: 'лазарет', rest: 'отдых',
  fight: 'в бою', down: 'пал', yield: 'сдался', dead: 'погиб',
};

const COMMANDS = {
  ludus: [['трен', 'тренироваться: опыт'], ['лазарет', 'лечиться бесплатно'], ['отдых', 'сесть на скамью и не идти в бой'],
    ['гача', '30 монет: оружие, доспех, щит, сеть'], ['сила · ловкость · выносливость', 'вложить очко'],
    ['проф', 'твоя карточка']],
  battle: [['сдаюсь', 'сдаться и точно выжить, но награда меньше'], ['проф', 'твоя карточка'],
    ['трен', 'встать со скамьи: в бой пойдёшь следующим']],
};
COMMANDS.results = COMMANDS.ludus;

// ник стримера получает свой класс: радуга, белый, тимьян, сердце или снег
function nick(className, name, login, tag = 'span') {
  const star = starOf(login);
  return el(tag, [className, star && 'star ' + star].filter(Boolean).join(' '), name);
}

// узлы списка пересоздаются — без этого радуга каждый раз начиналась бы заново и ники мигали бы вразнобой
const CYCLES = new Map([['rainbow', RAINBOW_CYCLE], ['snow-glint', SNOW_CYCLE]]);
function keepInStep(event) {
  const cycle = CYCLES.get(event.animationName);
  if (cycle) event.target.style.setProperty('--phase', -(Date.now() % cycle) + 'ms');
}

const ICONS = {
  weapon: '<svg viewBox="0 0 16 16"><path d="M13 1h2v2L7.5 10.5 5.5 8.5z" fill="currentColor"/><path d="M3.5 9l3.5 3.5-1.2 1.2-1.2-1.2-1.6 1.6-1.2-1.2 1.6-1.6-1.2-1.2z" fill="currentColor"/></svg>',
  armor: '<svg viewBox="0 0 16 16"><path d="M5 1.5 8 3l3-1.5 3.5 2-1 4-1.5-.5V14H4V7l-1.5.5-1-4z" fill="currentColor"/></svg>',
  coins: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="currentColor"/><circle cx="8" cy="8" r="3.5" fill="none" stroke="#1e140e" stroke-width="1.5"/></svg>',
  greatsword: '<svg viewBox="0 0 16 16"><path d="M14 0.5h1.5V2L6.5 11 5 9.5z" fill="currentColor"/><path d="M2.5 8.5l5 5-1.2 1.2-1.4-1.4-2 2-1.2-1.2 2-2-1.4-1.4z" fill="currentColor"/></svg>',
  spear: '<svg viewBox="0 0 16 16"><path d="M15.5 0.5l-1 4.2-1.6-1.6z" fill="currentColor"/><path d="M13.2 3.6l.9.9L1.7 16.9.8 16z" fill="currentColor"/></svg>',
  fists: '<svg viewBox="0 0 16 16"><path d="M4 6h8a2 2 0 0 1 2 2v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7zM4 3.5a1.5 1.5 0 0 1 3 0V6H4zM7.2 3a1.5 1.5 0 0 1 3 0V6h-3zM10.4 3.6a1.4 1.4 0 0 1 2.8 0V6h-2.8z" fill="currentColor"/></svg>',
  head: '<svg viewBox="0 0 16 16"><path d="M3 9a5 5 0 0 1 10 0v4h-3v-3H6v3H3z" fill="currentColor"/><path d="M7 1h2v3H7z" fill="currentColor"/></svg>',
  legs: '<svg viewBox="0 0 16 16"><path d="M4 1h8v4l-1 10H9L8 7l-1 8H5L4 5z" fill="currentColor"/></svg>',
  feet: '<svg viewBox="0 0 16 16"><path d="M3 2h5v8l6 2v3H3z" fill="currentColor"/></svg>',
  shield: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="currentColor"/><circle cx="8" cy="8" r="2" fill="#1e140e"/></svg>',
  net: '<svg viewBox="0 0 16 16"><path d="M2 2 14 14M2 14 14 2M2 8h12M8 2v12M2 5l9 9M5 2l9 9M2 11l9-9M5 14l9-9" stroke="currentColor" stroke-width="1.1" fill="none"/></svg>',
  void: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2"/></svg>',
};
// ширина окна барабана = ширина .fortune (312) минус отступы (20)
const ROLL = { speed: 18, wait: 2.5 };
const MODE_NAMES = { ffa: 'Все против всех', pit: 'Яма со львами', duel: 'Дуэль' };
const MODE_HINTS = { ffa: '— каждый сам за себя', pit: '— все вместе против львов', duel: '— двое случайных, остальные ставят' };
const REEL = { cells: 30, stop: 25, size: 44, width: 292 };

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function clock(seconds) {
  seconds = Math.max(0, Math.ceil(seconds));
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}

export class View {
  constructor() {
    this.canvas = $('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.world = $('world');
    this.wctx = this.world.getContext('2d');
    this.world.width = Math.round(FIELD_W / PIXEL);
    this.world.height = Math.round(FIELD_H / PIXEL);
    this.drops = [];
    this.stains = null;
    this.scale = 1;
    this.backs = {};
    this.people = [];
    this.scene = null;
    this.fade = 0;
    this.game = null;
    this.seen = 0;
    this.floats = [];
    this.dummyHits = DUMMIES.map(() => 0);
    this.domIn = 0;
    this.keys = {};
    this.roar = 0;
    this.time = 0;
    this.settings = null;
    this.quiet = false;
    document.addEventListener('animationstart', keepInStep);
    window.addEventListener('resize', () => {
      this._fit();
      this.rosterFit = null;
    });
    this._fit();
    $('stage').hidden = false;
  }

  use(settings) {
    this.settings = settings;
    document.body.classList.toggle('nocam', !settings.webcam);
    document.body.classList.toggle('nobg', !settings.bg);
    setSound(settings.sound, settings.volume);
    this.rosterFit = null;
  }

  _fit() {
    this.scale = Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT) || 1;
    $('stage').style.setProperty('--k', this.scale);
    const ratio = Math.max(1, Math.min(3, this.scale * (window.devicePixelRatio || 1)));
    if (ratio === this.ratio) return;
    this.ratio = ratio;
    this.canvas.width = Math.round(FIELD_W * ratio);
    this.canvas.height = Math.round(FIELD_H * ratio);
    this.backs = {};
  }

  _back(name) {
    if (this.backs[name]) return this.backs[name];
    const back = document.createElement('canvas');
    back.width = this.world.width;
    back.height = this.world.height;
    const ctx = back.getContext('2d');
    ctx.scale(1 / PIXEL, 1 / PIXEL);
    if (name === 'arena') this.people = paintArena(ctx);
    else this.signs = paintLudus(ctx);
    this.backs[name] = back;
    return back;
  }

  // demo — пример на странице: без звука
  frame(game, dt, demo) {
    this.time += dt;
    this.quiet = demo;
    if (game !== this.game) {
      this.game = game;
      this.seen = game ? game.eventId : 0;
      this.floats = [];
      this.keys = {};
      this.scene = null;
      if (this.cardNodes) for (const box of this.cardNodes.values()) box.remove();
      this.cardNodes = new Map();
    }
    if (!game) return;
    const scene = game.state === 'battle' ? 'arena' : 'ludus';
    if (scene !== this.scene) {
      if (this.scene !== null) this.fade = FADE;
      this.scene = scene;
      this.stains = null;
      this.drops = [];
    }
    this._events(game);
    this._noise(game, scene, demo);
    this.fade = Math.max(0, this.fade - dt);
    this.roar = Math.max(0, this.roar - dt * 0.8);
    for (let i = 0; i < this.dummyHits.length; i++) this.dummyHits[i] = Math.max(0, this.dummyHits[i] - dt);
    this._draw(game, scene, dt);
    this._scrollRoster(dt);
    this.domIn -= dt;
    if (this.domIn <= 0) {
      this.domIn = DOM_EVERY;
      this._dom(game);
    }
  }

  // фон: гул трибун на арене, тихий лудус; последние секунды лудуса — отсчёт
  _noise(game, scene, demo) {
    const live = !demo && game.state !== 'stopped' && !game.paused;
    ambience(live ? scene : null, live ? this.roar : 0);
    const left = Math.ceil(game.timer);
    if (live && game.state === 'ludus' && left <= 5 && left > 0 && left !== this.tick) play(left === 1 ? 'tickLast' : 'tick');
    this.tick = left;
  }

  _events(game) {
    for (const event of game.events) {
      if (event.id <= this.seen) continue;
      this.seen = event.id;
      this._event(game, event);
    }
  }

  _event(game, e) {
    const sound = (name) => {
      if (!this.quiet) play(name);
    };
    if (e.type === 'hit' && e.from && e.from.startsWith('lion') && Math.random() < 0.35) sound('growl');
    if (e.type === 'hit') {
      this._bleed(e.x, e.y - 22, e.crit ? 9 : 4);
      this.floats.push({ x: e.x + (Math.random() - 0.5) * 14, y: e.y - 46, text: String(e.amount), crit: e.crit,
        life: FLOAT_TIME, kind: 'hit' });
      this.roar = Math.min(1, this.roar + (e.crit ? 0.25 : 0.05));
      sound(e.crit ? 'crit' : 'hit');
    } else if (e.type === 'miss') {
      this.floats.push({ x: e.x, y: e.y - 46, text: 'мимо', life: FLOAT_TIME * 0.8, kind: 'miss' });
      sound('miss');
    } else if (e.type === 'down') {
      if (e.fate !== 'yield') this._bleed(e.x, e.y - 12, e.fate === 'dead' ? 22 : 8);
      if (e.fate === 'dead') this._stain(e.x + 4, e.y + 2, 13);
      const text = e.fate === 'dead' ? 'погиб' : e.fate === 'yield' ? 'сдался' : 'пал';
      this.floats.push({ x: e.x, y: e.y - 60, text, life: 2.2, kind: e.fate });
      this.roar = 1;
      sound(e.fate === 'dead' ? 'death' : 'down');
    } else if (e.type === 'level') {
      const g = game.members.get(e.login);
      if (g) this.floats.push({ x: g.x, y: g.y - 70, text: 'уровень ' + e.level, life: 2, kind: 'level', follow: g });
      sound('level');
    } else if (e.type === 'bet') {
      sound('coin');
    } else if (e.type === 'buy') {
      sound('coin');
    } else if (e.type === 'join') {
      sound('join');
    } else if (e.type === 'block') {
      this.floats.push({ x: e.x, y: e.y - 60, text: 'блок!', life: 1.1, kind: 'block' });
      sound('block');
    } else if (e.type === 'shieldbreak') {
      this.floats.push({ x: e.x, y: e.y - 78, text: 'щит сломан', life: 1.8, kind: 'flee' });
      sound('crack');
    } else if (e.type === 'nettear') {
      this.floats.push({ x: e.x, y: e.y - 84, text: 'сеть порвалась', life: 1.8, kind: 'flee' });
      sound('crack');
    } else if (e.type === 'stun') {
      this.floats.push({ x: e.x, y: e.y - 70, text: 'в сети!', life: 1.8, kind: 'flee' });
      this.roar = Math.min(1, this.roar + 0.4);
      sound('net');
    } else if (e.type === 'throw') {
      sound('whoosh');
    } else if (e.type === 'flee') {
      this.floats.push({ x: e.x, y: e.y - 70, text: 'бежит!', life: 1.6, kind: 'flee' });
      this.roar = Math.min(1, this.roar + 0.3);
      sound('boo');
    } else if (e.type === 'spin') {
      this._reel(game);
      sound('reel');
    } else if (e.type === 'prize') {
      const r = e.result, rank = r.item ? RARITIES.findIndex((x) => x.id === r.item.rarity) : -1;
      sound(rank >= 3 ? 'jackpot' : rank >= 0 || r.coins ? 'coin' : 'miss');
    } else if (e.type === 'go') {
      sound(e.place === 'heal' ? 'heal' : e.place === 'train' ? 'train' : 'step');
    } else if (e.type === 'phase') {
      this._banner(game, e.state);
      if (e.state === 'battle') sound(e.mode === 'pit' ? 'roar' : 'horn');
      if (e.state === 'results') sound(game.results && game.results.champion ? 'champion' : 'cheer');
    }
  }

  _banner(game, state) {
    const box = $('banner');
    if (state === 'results') {
      box.hidden = true;
      return;
    }
    box.className = 'banner ' + state;
    const pit = state === 'battle' && game.mode === 'pit', duel = state === 'battle' && game.duel;
    const people = game.fighters.filter((g) => !g.lion).length, lions = game.fighters.length - people;
    $('banner-title').textContent = duel ? (duel.betting ? 'ДУЭЛЬ' : 'В БОЙ!') : pit ? 'ЯМА СО ЛЬВАМИ'
      : state === 'battle' ? 'В БОЙ!' : 'ЛУДУС';
    $('banner-text').textContent = duel ? duel.left.name + ' против ' + duel.right.name
      + (duel.betting ? ' · ставки ' + Math.ceil(game.timer) + ' с' : '')
      : pit ? lions + ' ' + plural(lions, 'лев', 'льва', 'львов') + ' против ' + people + ' '
      + plural(people, 'гладиатора', 'гладиаторов', 'гладиаторов')
      : state === 'battle' ? 'Все против всех · ' + people + ' ' + plural(people, 'гладиатор', 'гладиатора', 'гладиаторов')
        : 'Готовьтесь к бою: ' + clock(game.timer);
    box.hidden = true;
    void box.offsetWidth;
    box.hidden = false;
    clearTimeout(this._bannerOff);
    this._bannerOff = setTimeout(() => {
      box.hidden = true;
    }, 2400);
  }

  _bleed(x, y, n) {
    if (this.scene !== 'arena') return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 110;
      this.drops.push({ x, y, z: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5, vz: 60 + Math.random() * 90,
        r: 1.5 + Math.random() * 2.5, color: BLOOD[Math.floor(Math.random() * BLOOD.length)] });
    }
  }

  _stain(x, y, r, color = BLOOD[2]) {
    if (!this.stains) return;
    const ctx = this.stains.getContext('2d');
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x / PIXEL, y / PIXEL, r / PIXEL, r * 0.45 / PIXEL, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _blood(ctx, dt) {
    for (const d of this.drops) {
      d.vz -= 420 * dt;
      d.z += d.vz * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.z <= 0) {
        d.dead = true;
        this._stain(d.x, d.y, d.r * 1.6, d.color);
        continue;
      }
      ctx.fillStyle = d.color;
      ctx.fillRect(d.x - d.r / 2, d.y - d.z - d.r / 2, d.r, d.r);
    }
    this.drops = this.drops.filter((d) => !d.dead);
  }

  _draw(game, scene, dt) {
    const w = this.wctx;
    w.setTransform(1, 0, 0, 1, 0, 0);
    w.imageSmoothingEnabled = false;
    w.drawImage(this._back(scene), 0, 0);
    if (scene === 'arena') {
      if (!this.stains) {
        this.stains = document.createElement('canvas');
        this.stains.width = this.world.width;
        this.stains.height = this.world.height;
      }
      w.drawImage(this.stains, 0, 0);
    }
    w.setTransform(1 / PIXEL, 0, 0, 1 / PIXEL, 0, 0);
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    const t = this.time;
    let figures;
    if (scene === 'arena') {
      drawCrowd(w, this.people, t, Math.min(1, this.roar + 0.15));
      figures = game.fighters.slice();
    } else {
      figures = Array.from(game.members.values()).filter((g) => !g.fate);
      for (const g of figures) {
        if (g.place !== 'train' || g.walking || g.swing <= 0) continue;
        DUMMIES.forEach((d, i) => {
          if (Math.hypot(d.x - g.x, d.y - g.y) >= 46) return;
          if (this.dummyHits[i] < 0.2 && !this.quiet) play('thwack');
          this.dummyHits[i] = 0.4;
        });
      }
      drawLudusLife(w, t, this.dummyHits);
      drawSigns(ctx, this.signs || []);
      drawSoon(ctx, t);
    }
    const lying = (g) => scene === 'arena' && (g.fate === 'down' || g.fate === 'dead');
    figures.sort((a, b) => (lying(b) - lying(a)) || a.y - b.y);
    for (const g of figures) drawGladiator(w, g, t, scene);
    if (scene === 'arena') {
      drawThrown(w, game);
      this._blood(w, dt);
    }
    const cards = new Set(game.cards.map((c) => c.login));
    for (const g of figures) drawLabel(ctx, g, scene, cards.has(g.login));
    if (scene === 'arena' && game.duel) this._duelMarks(ctx, game);
    this._floats(ctx, dt);
    if (this.fade > 0) {
      const k = this.fade / FADE;
      ctx.fillStyle = 'rgba(10,8,14,' + Math.min(1, k * 1.4).toFixed(3) + ')';
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    }
  }

  // над дуэлянтами — номер для ставки и сколько уже поставили
  _duelMarks(ctx, game) {
    const d = game.duel;
    [[d.left, 1], [d.right, 2]].forEach(([g, side]) => {
      const x = g.x, y = g.y - 122;
      ctx.fillStyle = side === 1 ? '#5fa8ff' : '#ff7a6e';
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff3dc';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '20px "Press Start 2P", ' + FONT;
      ctx.fillText(String(side), x + 1, y + 2);
      ctx.font = '800 13px ' + FONT;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20,12,10,.85)';
      const text = 'ставок: ' + game.betsOn(side);
      ctx.strokeText(text, x, y - 32);
      ctx.fillStyle = '#ffd98f';
      ctx.fillText(text, x, y - 32);
    });
  }

  _floats(ctx, dt) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floats) {
      f.life -= dt;
      const total = f.kind === 'hit' || f.kind === 'miss' ? FLOAT_TIME : 2;
      const k = 1 - Math.max(0, f.life) / total;
      const x = f.follow ? f.follow.x : f.x, y = (f.follow ? f.follow.y - 70 : f.y) - k * 26;
      const alpha = Math.min(1, f.life * 3);
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      let size = 15, color = '#fff';
      if (f.kind === 'hit') {
        size = f.crit ? 22 : 15;
        color = f.crit ? '#ffd34d' : '#ffffff';
      } else if (f.kind === 'miss') {
        size = 13;
        color = '#c9d3dc';
      } else if (f.kind === 'dead') {
        size = 22;
        color = '#ff6b5e';
      } else if (f.kind === 'down' || f.kind === 'yield') {
        size = 18;
        color = '#f1e7d4';
      } else if (f.kind === 'block') {
        size = 14;
        color = '#cfe3ff';
      } else if (f.kind === 'flee') {
        size = 15;
        color = '#ffd98f';
      } else if (f.kind === 'level') {
        size = 17;
        color = '#ffd34d';
      }
      ctx.font = Math.round(size * 0.8) + 'px "Press Start 2P", ' + FONT;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20,12,10,.85)';
      ctx.strokeText(f.text, x, y);
      ctx.fillStyle = color;
      ctx.fillText(f.text, x, y);
      ctx.globalAlpha = 1;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
  }

  // --- DOM ---

  _set(id, key, build) {
    if (this.keys[id] === key) return;
    this.keys[id] = key;
    build($(id));
  }

  _dom(game) {
    const state = game.state;
    const fightName = game.duel ? (game.duel.betting ? 'Арена · Дуэль: ставки' : 'Арена · Дуэль')
      : game.mode === 'pit' ? 'Арена · Яма со львами' : 'Арена · все против всех';
    const phase = { ludus: 'Лудус · подготовка', battle: fightName, results: 'Итоги боя' }[state] || '';
    this._set('phase', state + phase, (node) => {
      node.textContent = phase;
      node.className = 'phase ' + state;
    });
    const left = state === 'stopped' ? '' : clock(game.timer);
    this._set('clock', left + (state === 'battle' && game.timer < 15), (node) => {
      node.textContent = left;
      node.classList.toggle('hot', state === 'battle' && game.timer < 15);
    });
    this._status(game);
    this._roster(game);
    this._feed(game);
    this._cards(game);
    this._results(game);
    this._fortune(game);
    this._set('pause', String(game.paused), (node) => {
      node.hidden = !game.paused;
      $('pause-text').textContent = 'Стример поставил игру на паузу';
    });
  }

  _status(game) {
    const duel = game.duel;
    const key = game.state + '|' + game.mode + '|' + game.nextMode + '|' + game.notice + '|' + (game.state === 'battle' ? game.waiting + ':' + game.watching : '')
      + '|' + (duel ? duel.betting : '');
    this._set('status', key, (node) => {
      node.replaceChildren();
      if (game.notice) {
        node.append(el('span', 'warn', game.notice));
      } else if (duel && duel.betting) {
        node.append(el('code', '', '1'), el('small', '', '— за ' + duel.left.name), el('code', '', '2'),
          el('small', '', '— за ' + duel.right.name + ' · угадавшим по 100 монет'));
      } else if (duel) {
        node.append(el('small', '', 'Дуэль: ' + duel.left.name + ' против ' + duel.right.name + ' — никто не погибнет'));
      } else if (game.state === 'battle') {
        const what = game.mode === 'pit' ? 'Все вместе против львов — выжившим щедрая награда' : 'Бой до последнего на ногах';
        const off = [game.waiting && 'ждут следующего боя: ' + game.waiting,
          game.watching && 'смотрят со скамьи: ' + game.watching].filter(Boolean).join(' · ');
        node.append(el('small', '', off ? off[0].toUpperCase() + off.slice(1) : what));
      } else if (game.state === 'results') {
        node.append(el('small', '', 'Награды розданы — скоро снова в лудус'));
      } else if (game.state === 'ludus' && game.nextMode) {
        node.append(el('small', '', 'Дальше:'), el('b', 'next-mode ' + game.nextMode, MODE_NAMES[game.nextMode]),
          el('small', '', MODE_HINTS[game.nextMode]));
      } else {
        node.append(el('small', '', 'Напиши в чат что угодно — и ты гладиатор'));
      }
    });
    const betting = duel && duel.betting;
    this._set('commands', game.state + (betting ? duel.left.login + duel.right.login : ''), (node) => {
      const list = betting ? [['1', 'ставка на ' + duel.left.name], ['2', 'ставка на ' + duel.right.name],
        ['что угодно', 'вступить и тоже поставить']] : COMMANDS[game.state] || COMMANDS.ludus;
      node.replaceChildren(...list.map(([word, text]) => {
        const item = el('span', 'command');
        item.append(el('code', '', word), el('small', '', text));
        return item;
      }));
    });
  }

  _roster(game) {
    const battle = game.state === 'battle';
    const list = Array.from(game.members.values());
    const fateOrder = { fight: 0, yield: 1, down: 1, dead: 2 };
    list.sort((a, b) => (battle ? (fateOrder[a.fate] ?? 3) - (fateOrder[b.fate] ?? 3) : 0)
      || b.level - a.level || b.xp - a.xp || a.name.localeCompare(b.name));
    const bets = game.duel ? game.duel.bets : null;
    const key = (bets ? Array.from(bets).join(',') : '') + list.map((g) => [g.login, g.level, g.points, g.coins, Math.round(g.hp / maxHp(g) * 20), battle ? g.fate : g.place,
      g.walking && !battle].join(':')).join('|') + '#' + game.roster.fallen.length;
    this._set('roster', key, (node) => {
      node.replaceChildren(...list.map((g) => {
        const li = el('li', g.fate === 'dead' && battle ? 'gone' : '');
        const lvl = el('span', 'lvl', String(g.level));
        const where = battle && g.fate ? g.fate : g.place;
        const part = Math.max(0, Math.min(1, g.hp / maxHp(g)));
        const bar = el('span', 'hp'), fill = el('i', part > 0.5 ? '' : part > 0.25 ? 'mid' : 'low');
        fill.style.width = (part * 100).toFixed(0) + '%';
        bar.append(fill);
        const gold = el('span', 'gold');
        // свободные очки характеристик — перед монетой, только если есть
        if (g.points > 0) gold.append(el('em', 'points', '+' + g.points));
        gold.append(el('i'), String(g.coins));
        const name = nick('name', g.name, g.login);
        if (!starOf(g.login)) name.style.color = g.color;
        li.append(lvl, name, gold,
          el('span', 'where ' + where, battle && !g.fate ? (bets && bets.has(g.login) ? 'ставка ' + bets.get(g.login)
            : g.place === 'rest' ? 'смотрит' : 'ждёт')
            : WHERE[where] || ''), bar);
        return li;
      }));
      $('count').textContent = list.length ? String(list.length) : '';
      $('empty').hidden = list.length > 0;
      const fallen = game.roster.fallen.length;
      $('fallen').textContent = fallen ? 'павших: ' + fallen : '';
      this.rosterFit = null;
    });
  }

  // не влезли — список плавно едет вниз, стоит, едет обратно вверх
  _scrollRoster(dt) {
    const box = $('roster-box'), list = $('roster');
    if (!this.rosterFit) this.rosterFit = { over: Math.max(0, list.scrollHeight - box.clientHeight) };
    const over = this.rosterFit.over, s = this.rollState || (this.rollState = { y: 0, dir: 1, wait: ROLL.wait });
    if (over <= 0) {
      s.y = 0;
      s.dir = 1;
      s.wait = ROLL.wait;
    } else if (s.wait > 0) {
      s.wait -= dt;
    } else {
      s.y += s.dir * ROLL.speed * dt;
      if (s.y >= over || s.y <= 0) {
        s.y = Math.max(0, Math.min(over, s.y));
        s.dir = -s.dir;
        s.wait = ROLL.wait;
      }
    }
    const y = Math.round(Math.min(s.y, over));
    if (y !== this.rollShown) {
      this.rollShown = y;
      list.style.transform = 'translateY(' + -y + 'px)';
    }
  }

  _feed(game) {
    const lines = game.lines.slice(-7);
    const key = lines.map((l) => l.id).join(',');
    this._set('feed', key, (node) => {
      node.replaceChildren(...lines.slice().reverse().map((line) => {
        const li = el('li', line.kind, line.text);
        li.title = line.text;
        return li;
      }));
    });
  }

  // карточку не пересоздаём, а обновляем изнутри: иначе анимация появления мигает
  _cards(game) {
    const cards = game.cards.map((c) => game.members.get(c.login)).filter(Boolean);
    const node = $('cards');
    this.cardNodes = this.cardNodes || new Map();
    for (const [login, box] of this.cardNodes) {
      if (cards.some((g) => g.login === login)) continue;
      box.remove();
      this.cardNodes.delete(login);
    }
    for (const g of cards) {
      let box = this.cardNodes.get(g.login);
      const key = [g.level, Math.floor(g.xp), Math.round(g.hp), g.coins, g.str, g.agi, g.vit, g.points,
        JSON.stringify(g.weapon), JSON.stringify(g.gear), g.shield, g.nets, g.fights].join(':');
      if (!box) {
        box = el('div', 'profile');
        box.dataset.key = '';
        this.cardNodes.set(g.login, box);
      }
      if (box.parentNode !== node) node.append(box);
      if (box.dataset.key === key) continue;
      box.dataset.key = key;
      box.style.setProperty('--c', g.color);
      box.replaceChildren(...this._profile(g));
    }
  }

  _profile(g) {
    const box = { parts: [], append(...items) { this.parts.push(...items); } };
    const top = el('div', 'top');
    top.append(nick('who', g.name, g.login), el('span', 'lv', g.level + ' ур.'));
    const bar = (kind, part, text) => {
      const node = el('div', 'bar ' + kind), fill = el('i');
      fill.style.width = (Math.max(0, Math.min(1, part)) * 100).toFixed(1) + '%';
      node.append(fill, el('span', '', text));
      return node;
    };
    const hpMax = maxHp(g), need = xpNeed(g.level);
    const stats = el('div', 'stats');
    for (const stat of STATS) {
      const cell = el('div');
      cell.append(el('b', '', String(g[stat.id])), el('small', '', stat.name.toLowerCase()));
      stats.append(cell);
    }
    const gear = el('div', 'gear');
    const line = (label, value) => {
      const p = el('div');
      p.append(label + ': ', el('b', '', value));
      return p;
    };
    // инвентарь: шесть квадратных иконок, рамка — цвет редкости; ниже только общие цифры
    const inv = el('div', 'inv');
    const icon = (label, name, color) => {
      const cell = el('span', 'icon' + (color ? '' : ' empty'));
      cell.title = label;
      cell.style.setProperty('--c', color || '#5b5468');
      cell.innerHTML = ICONS[name];
      inv.append(cell);
    };
    const w = g.weapon;
    icon('Правая рука', w ? (w.type === 'sword' ? 'weapon' : w.type) : 'fists', w && rarityOf(w.rarity).color);
    icon('Левая рука', g.shield ? 'shield' : 'net', (g.shield || g.nets > 0) && !twoHanded(g) ? '#d9a441' : '');
    for (const id of SLOT_IDS) {
      const item = g.gear && g.gear[id];
      icon(ARMOR_SLOTS[id].label, id === 'body' ? 'armor' : id, item && rarityOf(item.rarity).color);
    }
    const totals = el('div', 'stats totals');
    for (const [value, label] of [[Math.round(damageOf(g)), 'урон'], [Math.round(armorOf(g) * 100) + '%', 'броня'],
      [Math.round(critOf(g) * 100) + '%', 'крит']]) {
      const cell = el('div');
      cell.append(el('b', '', String(value)), el('small', '', label));
      totals.append(cell);
    }
    gear.append(line('Монеты', String(g.coins)),
      line('Бои', g.fights + ' · побед ' + g.wins + ' · нокаутов ' + g.kos + ' · убийств ' + g.kills));
    box.append(top, bar('hp', g.hp / hpMax, Math.round(g.hp) + ' / ' + hpMax + ' здоровья'),
      bar('xp', g.xp / need, Math.floor(g.xp) + ' / ' + need + ' опыта'), stats);
    if (g.points > 0) {
      box.append(el('div', 'gear points', 'Свободных очков: ' + g.points + ' — пиши «сила», «ловкость» или «выносливость»'));
    }
    box.append(inv, totals, gear);
    return box.parts;
  }

  // --- гача ---

  _cell(result) {
    const cell = el('span', 'cell');
    let color, icon;
    if (result.item) {
      color = rarityOf(result.item.rarity).color;
      icon = result.item.kind === 'weapon' ? (result.item.type === 'sword' ? 'weapon' : result.item.type)
        : result.item.slot === 'body' ? 'armor' : result.item.slot;
    } else if (result.kind === 'shield' || result.kind === 'net') {
      color = outcomeOf(result.kind).color;
      icon = result.kind;
    } else {
      color = outcomeOf(result.kind).color;
      icon = result.coins ? 'coins' : 'void';
    }
    cell.style.setProperty('--c', color);
    cell.innerHTML = ICONS[icon];
    return cell;
  }

  _reel(game) {
    const now = game.spinNow;
    if (!now) return;
    // окно должно быть видно до запуска: у скрытого элемента CSS-анимация не идёт
    $('fortune').hidden = false;
    const strip = $('fortune-strip');
    const cells = [];
    for (let i = 0; i < REEL.cells; i++) cells.push(this._cell(i === REEL.stop ? now.result : spin(Math.random)));
    strip.replaceChildren(...cells);
    strip.style.transition = 'none';
    strip.style.transform = 'translateX(0)';
    void strip.offsetWidth;
    const target = REEL.width / 2 - (REEL.stop * REEL.size + 20);
    strip.style.transition = 'transform ' + now.spin.toFixed(2) + 's cubic-bezier(.12,.75,.2,1)';
    strip.style.transform = 'translateX(' + target.toFixed(1) + 'px)';
    this.reelId = now.id;
  }

  _fortune(game) {
    const now = game.spinNow, box = $('fortune');
    box.hidden = !now;
    if (!now) return;
    if (this.reelId !== now.id) this._reel(game);
    const g = game.members.get(now.login);
    const who = nick('', g ? g.name : now.login, now.login);
    if (g && !starOf(g.login)) who.style.color = g.color;
    $('fortune-who').replaceChildren(who, now.done ? '' : ' крутит гачу…');
    const prize = $('fortune-prize');
    const key = now.id + ':' + now.done;
    if (prize.dataset.key !== key) {
      prize.dataset.key = key;
      prize.replaceChildren();
      prize.style.color = '';
      const r = now.result;
      if (now.done && r.item) {
        prize.style.color = rarityOf(r.item.rarity).color;
        prize.append(itemText(r.item), el('small', '', r.equipped ? 'надевает' : 'не лучше своего — выброшено'));
      } else if (now.done && (r.kind === 'shield' || r.kind === 'net')) {
        prize.style.color = outcomeOf(r.kind).color;
        prize.append(outcomeOf(r.kind).name, el('small', '', r.equipped ? 'берёт' : 'лишний — выброшен'));
      } else if (now.done && r.coins) {
        prize.style.color = outcomeOf(r.kind).color;
        prize.append('+' + r.coins + ' монет', el('small', '', outcomeOf(r.kind).name));
      } else if (now.done) {
        prize.append('Пустота');
      }
    }
    const waiting = game.spins.length;
    $('fortune-queue').textContent = waiting ? 'в очереди ещё ' + waiting : '';
  }

  _results(game) {
    const r = game.state === 'results' ? game.results : null;
    this._set('results', r ? 'on' + game.eventId : 'off', (node) => {
      node.hidden = !r;
      if (!r) return;
      const champ = r.rows.find((row) => row.login === r.champion);
      $('champion').replaceChildren();
      const duelView = r.mode === 'duel';
      $('res-alive-title').textContent = duelView ? 'Победитель' : 'Выстояли';
      $('res-beaten-title').textContent = duelView ? 'Проигравший' : 'Пали, но живы';
      $('res-dead-title').textContent = duelView ? 'Угадали ставку' : 'Погибли';
      if (duelView) {
        $('champion').append('Дуэль выиграл ', champ ? nick('', champ.name, champ.login, 'b') : '', ' · ставки ' + r.bets[0] + ' : '
          + r.bets[1]);
      } else if (r.mode === 'pit') {
        $('champion').textContent = r.lionsDown === r.lions ? 'Львы повержены! Выжившие получают щедрую награду'
          : r.rows.some((row) => row.fate === 'fight') ? 'Время вышло — львы уходят в клетки' : 'Львы победили';
      } else if (champ) {
        $('champion').append('Чемпион арены — ', nick('', champ.name, champ.login, 'b'));
      } else {
        $('champion').textContent = 'Время вышло — чемпиона нет';
      }
      const fill = (id, rows, describe) => {
        const items = rows.slice(0, 11).map((row) => {
          const li = el('li');
          const name = nick('', row.name, row.login, 'b');
          if (!starOf(row.login)) name.style.color = row.color;
          li.append(name, describe(row));
          return li;
        });
        if (rows.length > 11) items.push(el('li', 'none', '…и ещё ' + (rows.length - 11)));
        if (!rows.length) items.push(el('li', 'none', 'никого'));
        $(id).replaceChildren(...items);
      };
      const reward = (row) => {
        const span = el('span', '', '+' + row.xp + ' опыта · +' + row.coins + ' монет'
          + (row.kos ? ' · нокаутов ' + row.kos : ''));
        if (row.ups) span.append(' · ', el('span', 'up', row.level + ' ур.!'));
        return span;
      };
      fill('res-alive', r.rows.filter((row) => row.fate === 'fight'), reward);
      fill('res-beaten', r.rows.filter((row) => row.fate === 'down' || row.fate === 'yield'), reward);
      if (duelView) fill('res-dead', r.bettors, (row) => el('span', '', '+' + row.coins + ' монет'));
      else fill('res-dead', r.rows.filter((row) => row.fate === 'dead'),
        (row) => el('span', '', (row.by ? 'от руки ' + row.by : 'на арене') + ' · ' + row.level + ' ур.'));
    });
    if (r) $('res-next').textContent = 'Возвращение в лудус через ' + Math.max(0, Math.ceil(game.timer)) + ' с';
  }
}

export { PLACES };
