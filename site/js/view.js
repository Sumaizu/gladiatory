import { ARMOR_SLOTS, SLOT_IDS, STATS, TEAMS, armorOf, critOf, damageOf, maxHp, twoHanded, xpNeed } from './balance.js';
import { RARITIES, itemText, outcomeOf, rarityOf, spin } from './gacha.js';
import { FIELD_H, FIELD_W, DUMMIES, PLACES } from './places.js';
import { FONT, drawCrowd, drawGladiator, drawThrown, drawLabel, drawLudusLife, drawSigns, drawSoon, paintArena, paintLudus } from './draw.js';
import { plural } from './engine.js';
import { ambience, play, setSound } from './sound.js';
import { P, Pix } from './art.js';
import { RAINBOW_CYCLE, SNOW_CYCLE, starOf } from './stars.js';

const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 720;
const DOM_EVERY = 0.2;
const FADE = 0.7;
const FLOAT_TIME = 1.1;
// мир рисуется в низком разрешении и растягивается крупными пикселями — как в Domina
const PIXEL = 1;
const BLOOD = ['#8f1414', '#a8191b', '#6e0d0f', '#c22a22'];
const shadeBlood = (hex, k) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16)
  * k))).toString(16).padStart(2, '0')).join('');
const WHERE = {
  train: 'трен', heal: 'лазарет', rest: 'отдых',
  fight: 'в бою', down: 'пал', dead: 'погиб',
};

const COMMANDS = {
  ludus: [['трен', 'тренироваться: опыт'], ['лазарет', 'лечиться бесплатно'], ['отдых', 'сесть на скамью и не идти в бой'],
    ['гача', '30 монет: оружие, доспех, щит, сеть, амулет'], ['сил · лов · вын', 'вложить очко'],
    ['проф', 'твоя карточка']],
  battle: [['проф', 'твоя карточка'],
    ['трен', 'встать со скамьи: в бой пойдёшь следующим']],
};
COMMANDS.results = COMMANDS.ludus;

// флажок парагона — как в Чатобороне: золотое полотнище на перекладине, цифра поверх
const FLAG = { rod: '#8a5a12', rodLight: '#e6b54a', knob: '#ffe08a', edge: '#6b4106', top: '#ffe58a', mid: '#f5b82e',
  low: '#c98a12' };
let flagUrl = null;
function flagImage(width = 14, height = 19, scale = 3) {
  if (!flagUrl) {
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const g = canvas.getContext('2d');
    g.scale(scale, scale);
    const rod = Math.max(2, height * 0.1), left = width * 0.13, right = width * 0.87, notch = height * 0.2;
    const line = Math.max(0.8, width / 16);
    g.beginPath();
    g.moveTo(left, rod * 0.6);
    g.lineTo(right, rod * 0.6);
    g.lineTo(right, height - line / 2);
    g.lineTo(width / 2, height - notch);
    g.lineTo(left, height - line / 2);
    g.closePath();
    const cloth = g.createLinearGradient(0, rod, 0, height);
    cloth.addColorStop(0, FLAG.top);
    cloth.addColorStop(0.5, FLAG.mid);
    cloth.addColorStop(1, FLAG.low);
    g.fillStyle = cloth;
    g.fill();
    g.lineJoin = 'round';
    g.lineWidth = line;
    g.strokeStyle = FLAG.edge;
    g.stroke();
    const bar = g.createLinearGradient(0, 0, 0, rod);
    bar.addColorStop(0, FLAG.rodLight);
    bar.addColorStop(1, FLAG.rod);
    g.fillStyle = bar;
    g.beginPath();
    g.moveTo(line, line / 2);
    g.lineTo(width - line, line / 2);
    g.arcTo(width - line / 2, line / 2, width - line / 2, rod, rod / 2);
    g.arcTo(width - line / 2, rod, line, rod, rod / 2);
    g.lineTo(line, rod);
    g.arcTo(line / 2, rod, line / 2, line / 2, rod / 2);
    g.arcTo(line / 2, line / 2, width - line, line / 2, rod / 2);
    g.closePath();
    g.fill();
    g.stroke();
    for (const x of [line * 1.6, width - line * 1.6]) {
      g.beginPath();
      g.arc(x, rod / 2, rod * 0.32, 0, Math.PI * 2);
      g.fillStyle = FLAG.knob;
      g.fill();
    }
    flagUrl = canvas.toDataURL();
  }
  const img = document.createElement('img');
  img.className = 'flag';
  img.src = flagUrl;
  img.alt = '';
  return img;
}

function paragonTag(paragon) {
  const node = el('span', 'paragon-tag');
  node.title = 'Парагон ' + paragon;
  node.append(flagImage(), el('b', '', String(paragon)));
  return node;
}

// иконки характеристик — фигуры в стиле сердца из Чатобороны: светлый край сверху-слева, тень снизу-справа, тёмная обводка.
// # — заливка, k — складка, s — подошва
const STAT_ICONS = {
  // сила — красный кулак
  str: { base: '#dc2626', light: '#fca5a5', dark: '#7f1d1d', k: '#991b1b', rows: [
    '...##.##.##.',
    '..##########',
    '..##########',
    '.#k##k##k###',
    '############',
    '##kkkkkk####',
    '############',
    '.##########.',
    '..#########.',
    '..########..',
    '...######...',
    '...######...',
    '...######...'] },
  // ловкость — зелёный ботинок
  agi: { base: '#16a34a', light: '#86efac', dark: '#14532d', k: '#bbf7d0', s: '#3b2a1c', rows: [
    '.#######....',
    '.#######....',
    '..#####.....',
    '..##k##.....',
    '..#####.....',
    '..##k##.....',
    '..#####.....',
    '..##k####...',
    '..########..',
    '..#########.',
    '.##########.',
    '.ssssssssss.',
    '.sss........'] },
  // выносливость — жёлтый крест
  vit: { base: '#facc15', light: '#fef9c3', dark: '#a16207', rows: [
    '....####....',
    '....####....',
    '....####....',
    '....####....',
    '############',
    '############',
    '############',
    '############',
    '....####....',
    '....####....',
    '....####....',
    '....####....'] },
};
const statUrls = {};
function statIcon(id) {
  if (!statUrls[id]) {
    const spec = STAT_ICONS[id], p = new Pix(16, 16), rows = spec.rows;
    const ox = Math.floor((16 - rows[0].length) / 2), oy = Math.floor((16 - rows.length) / 2);
    const on = (x, y) => y >= 0 && y < rows.length && x >= 0 && x < rows[y].length && rows[y][x] !== '.';
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        let color = spec.base;
        if (ch === 's' || ch === 'k') color = spec[ch];
        else if (!on(x, y - 1) || !on(x - 1, y)) color = spec.light;
        else if (!on(x, y + 1) || !on(x + 1, y)) color = spec.dark;
        p.px(ox + x, oy + y, color);
      }
    });
    p.outline('#15111d');
    const src = p.canvas(), big = document.createElement('canvas');
    big.width = big.height = 64;
    const ctx = big.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, 64, 64);
    statUrls[id] = big.toDataURL();
  }
  return statUrls[id];
}

function iconImg(src, className = 'ico') {
  const img = document.createElement('img');
  img.className = className;
  img.src = src;
  img.alt = '';
  return img;
}

// ник стримера получает свой класс: радуга, белый, тимьян, сердце или снег
// список и карточки пересоздаются по нескольку раз в секунду: фазу переливания ставим сразу при создании, от общих
// часов (как у подписей на холсте), — иначе новый ник на кадр начинал анимацию сначала и дёргался
function nick(className, name, login, tag = 'span') {
  const star = starOf(login);
  const node = el(tag, [className, star && 'star ' + star].filter(Boolean).join(' '), name);
  const cycle = STAR_CYCLES[star];
  if (cycle) node.style.setProperty('--phase', -(Date.now() % cycle) + 'ms');
  return node;
}

const STAR_CYCLES = { rainbow: RAINBOW_CYCLE, snow: SNOW_CYCLE };

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
  amulet: '<svg viewBox="0 0 16 16"><path d="M4 1.5Q8 7 12 1.5" stroke="#d4af37" stroke-width="1.3" fill="none"/><path d="M8 5.5l4 4.5-4 4.5-4-4.5z" fill="currentColor"/><path d="M8 7.5l1.6 2.5L8 12z" fill="#ffd0d4" opacity=".7"/></svg>',
  void: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2"/></svg>',
};
// ширина окна барабана = ширина .fortune (312) минус отступы (20)
const ROLL = { speed: 18, wait: 3, fade: 0.8 };
const MODE_NAMES = { ffa: 'Все против всех', pit: 'Яма со львами', duel: 'Дуэль', paragon: 'Испытание парагона',
  teams: 'Стенка на стенку' };
const MODE_HINTS = { ffa: '— каждый сам за себя', pit: '— все вместе против львов', duel: '— один на один, остальные ставят',
  paragon: '— один против всех', teams: '— красные против синих' };
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
    window.addEventListener('resize', () => {
      this._fit();
      this.rosterFit = null;
    });
    this._fit();
    $('stage').hidden = false;
  }

  use(settings) {
    this.settings = settings;
    document.body.classList.toggle('nocam', settings.webcam === 'none');
    document.body.classList.toggle('vtuber', settings.webcam === 'vtuber');
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
    // мир — в разрешении экрана: пиксель-арт растягивается без сглаживания, а кровь рисуется гладко и чётко
    this.world.width = this.canvas.width;
    this.world.height = this.canvas.height;
    if (this.stains) {
      const old = this.stains;
      this.stains = this._stainLayer();
      this.stains.getContext('2d').drawImage(old, 0, 0, this.stains.width, this.stains.height);
    }
  }

  _back(name) {
    if (this.backs[name]) return this.backs[name];
    const back = document.createElement('canvas');
    // фон — в разрешении поля, на экран растягивается без сглаживания
    back.width = Math.round(FIELD_W / PIXEL);
    back.height = Math.round(FIELD_H / PIXEL);
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
      this._bleed(e.x, e.y - 12, e.fate === 'dead' ? 22 : 8);
      if (e.fate === 'dead') this._stain(e.x + 4, e.y + 2, 13);
      const text = e.saved ? 'амулет спас!' : e.fate === 'dead' ? 'погиб' : 'пал';
      this.floats.push({ x: e.x, y: e.y - 60, text, life: e.saved ? 3 : 2.2, kind: e.saved ? 'saved' : e.fate });
      this.roar = 1;
      sound(e.saved ? 'jackpot' : e.fate === 'dead' ? 'death' : 'down');
    } else if (e.type === 'bleedtick') {
      const g = game.fighters.find((f) => f.login === e.login);
      this.floats.push({ x: e.x + (Math.random() - 0.5) * 10, y: e.y - 46, text: '-' + e.amount, life: FLOAT_TIME,
        kind: 'bleedtick' });
      if (g) this._bleed(g.x, g.y - 22, 3, 0.4);
    } else if (e.type === 'bleed') {
      const g = game.fighters.find((f) => f.login === e.login);
      this.floats.push({ x: e.x, y: e.y - 60, text: 'кровотечение', life: 1.6, kind: 'bleed', follow: g });
      this._bleed(e.x, e.y - 22, 10, 1.2);
    } else if (e.type === 'divine') {
      const g = game.fighters.find((f) => f.login === e.login);
      this.floats.push({ x: e.x, y: e.y - 70, text: e.slot === 'weapon' ? 'божественное оружие!' : 'божественный доспех!',
        life: 3, kind: 'saved', follow: g });
      sound('jackpot');
    } else if (e.type === 'paragon') {
      sound('champion');
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
      sound(rank >= 3 || r.kind === 'amulet' ? 'jackpot' : rank >= 0 || r.coins || r.kind === 'shield' || r.kind === 'net' ? 'coin'
        : 'miss');
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
    const boss = state === 'battle' && game.boss;
    const people = game.fighters.filter((g) => !g.lion).length, lions = game.fighters.length - people;
    const teams = state === 'battle' && game.mode === 'teams';
    const reds = teams ? game.fighters.filter((g) => g.team === 'red').length : 0;
    $('banner-title').textContent = duel ? (duel.betting ? 'ДУЭЛЬ' : 'В БОЙ!') : pit ? 'ЯМА СО ЛЬВАМИ' : boss ? 'ИСПЫТАНИЕ ПАРАГОНА'
      : teams ? 'СТЕНКА НА СТЕНКУ'
      : state === 'battle' ? 'В БОЙ!' : 'ЛУДУС';
    $('banner-text').textContent = duel ? duel.left.name + ' против ' + duel.right.name
      + (duel.betting ? ' · ставки ' + Math.ceil(game.timer) + ' с' : '')
      : teams ? 'Красные (' + reds + ') против синих (' + (people - reds) + ')'
      : boss ? boss.name + ' против всех · ' + (people - 1) + ' ' + plural(people - 1, 'гладиатор', 'гладиатора', 'гладиаторов')
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

  // брызги: z — высота над песком; спрей мелких капель и несколько крупных
  _bleed(x, y, n, spread = 1) {
    if (this.scene !== 'arena') return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (30 + Math.random() * 120) * spread, big = Math.random() < 0.3;
      this.drops.push({ x, y: y + 22, z: 22, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.45,
        vz: 40 + Math.random() * 110, r: big ? 1.6 + Math.random() * 1.4 : 0.6 + Math.random() * 0.9,
        color: BLOOD[Math.floor(Math.random() * BLOOD.length)] });
    }
  }

  _stainLayer() {
    const layer = document.createElement('canvas');
    layer.width = this.world.width;
    layer.height = this.world.height;
    return layer;
  }

  // пятно на песке: неровная лужица с тёмным краем, мелкие брызги вокруг и блик
  _stain(x, y, r, color = BLOOD[2]) {
    if (!this.stains) return;
    const ctx = this.stains.getContext('2d');
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    const lobes = 5 + Math.floor(Math.random() * 4), turn = Math.random() * Math.PI * 2;
    ctx.beginPath();
    for (let i = 0; i <= lobes * 2; i++) {
      const a = turn + i / (lobes * 2) * Math.PI * 2, k = i % 2 ? 0.7 + Math.random() * 0.2 : 0.95 + Math.random() * 0.35;
      const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k * 0.5;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.quadraticCurveTo(x + Math.cos(a - 0.3) * r * k * 1.1, y + Math.sin(a - 0.3) * r * k * 0.55, px, py);
    }
    ctx.closePath();
    const fill = ctx.createRadialGradient(x - r * 0.2, y - r * 0.12, r * 0.1, x, y, r * 1.2);
    fill.addColorStop(0, shadeBlood(color, 1.15));
    fill.addColorStop(0.65, color);
    fill.addColorStop(1, shadeBlood(color, 0.6));
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = fill;
    ctx.fill();
    // влажный блик
    if (r > 3) {
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#ff9a8a';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.3, y - r * 0.15, r * 0.25, r * 0.08, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // мелкие брызги вокруг
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = shadeBlood(color, 0.8);
    for (let i = 0, n = Math.round(r / 2); i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = r * (1.1 + Math.random() * 0.9);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.5, 0.3 + Math.random() * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _blood(ctx, dt) {
    for (const d of this.drops) {
      d.vz -= 420 * dt;
      d.z += d.vz * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.z <= 0) {
        d.dead = true;
        this._stain(d.x, d.y, d.r * 1.8, d.color);
        continue;
      }
      // капля в полёте: круглая, вытянута по скорости, с бликом
      const sx = d.x, sy = d.y - d.z, speed = Math.hypot(d.vx, d.vy - d.vz) || 1;
      const stretch = Math.min(2.4, 1 + speed / 260), ang = Math.atan2(d.vy - d.vz, d.vx);
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.ellipse(sx, sy, d.r * stretch, d.r, ang, 0, Math.PI * 2);
      ctx.fill();
      if (d.r > 1.2) {
        ctx.fillStyle = 'rgba(255,170,160,.45)';
        ctx.beginPath();
        ctx.arc(sx - d.r * 0.3, sy - d.r * 0.3, d.r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    this.drops = this.drops.filter((d) => !d.dead);
  }

  _draw(game, scene, dt) {
    const w = this.wctx;
    w.setTransform(1, 0, 0, 1, 0, 0);
    w.imageSmoothingEnabled = false;
    w.drawImage(this._back(scene), 0, 0, this.world.width, this.world.height);
    if (scene === 'arena') {
      if (!this.stains) this.stains = this._stainLayer();
      w.drawImage(this.stains, 0, 0);
    }
    w.setTransform(this.ratio / PIXEL, 0, 0, this.ratio / PIXEL, 0, 0);
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
      // кровотечение: с бегущего капает, за ним остаётся дорожка
      for (const g of figures) {
        if (!(g.bleedT > 0) || g.fate !== 'fight' || Math.random() > dt * (g.walking ? 14 : 5)) continue;
        this.drops.push({ x: g.x + (Math.random() - 0.5) * 8, y: g.y, z: 14 + Math.random() * 10, vx: 0, vy: 0, vz: 0,
          r: 0.7 + Math.random() * 0.8, color: BLOOD[Math.floor(Math.random() * BLOOD.length)] });
      }
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
      const total = f.kind === 'hit' || f.kind === 'miss' || f.kind === 'bleedtick' ? FLOAT_TIME : 2;
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
      } else if (f.kind === 'down') {
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
      } else if (f.kind === 'bleedtick') {
        size = 13;
        color = '#ff4b4b';
      } else if (f.kind === 'bleed') {
        size = 14;
        color = '#ff4b4b';
      } else if (f.kind === 'saved') {
        size = 20;
        color = '#ff5a64';
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
      : game.mode === 'pit' ? 'Арена · Яма со львами' : game.boss ? 'Арена · Испытание парагона'
        : game.mode === 'teams' ? 'Арена · Стенка на стенку' : 'Арена · все против всех';
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
    this._duelCards(game);
    this._results(game);
    this._fortune(game);
    this._set('pause', String(game.paused), (node) => {
      node.hidden = !game.paused;
      $('pause-text').textContent = 'Стример поставил игру на паузу';
    });
  }

  _status(game) {
    const duel = game.duel;
    const key = game.state + '|' + game.mode + '|' + game.nextMode + '|' + (game.nextBoss ? game.nextBoss.login : '') + '|' + game.notice + '|' + (game.state === 'battle' ? game.waiting + ':' + game.watching : '')
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
        const what = game.mode === 'pit' ? 'Все вместе против львов — выжившим щедрая награда'
          : game.boss ? 'Все против ' + game.boss.name + ' — выжившим много опыта'
            : game.mode === 'teams' ? 'Красные против синих — победившей команде больше' : 'Бой до последнего на ногах';
        const off = [game.waiting && 'ждут следующего боя: ' + game.waiting,
          game.watching && 'смотрят со скамьи: ' + game.watching].filter(Boolean).join(' · ');
        node.append(el('small', '', off ? off[0].toUpperCase() + off.slice(1) : what));
      } else if (game.state === 'results') {
        node.append(el('small', '', 'Награды розданы — скоро снова в лудус'));
      } else if (game.state === 'ludus' && game.nextMode) {
        node.append(el('small', '', 'Дальше:'), el('b', 'next-mode ' + game.nextMode, MODE_NAMES[game.nextMode]),
          el('small', '', game.nextMode === 'paragon' && game.nextBoss ? '— ' + game.nextBoss.name + ' против всех'
            : MODE_HINTS[game.nextMode]));
      } else {
        node.append(el('small', '', 'Напиши в чат что угодно — и ты гладиатор'));
      }
    });
    const betting = duel && duel.betting;
    this._set('commands', game.state + (duel ? (betting ? 'bet' : 'duel') + duel.left.login + duel.right.login : ''), (node) => {
      const list = betting ? [['1', 'ставка на ' + duel.left.name], ['2', 'ставка на ' + duel.right.name],
        ['что угодно', 'вступить и тоже поставить']]
        : COMMANDS[game.state] || COMMANDS.ludus;
      node.replaceChildren(...list.map(([word, text]) => {
        const item = el('span', 'command');
        item.append(el('code', '', word), el('small', '', text));
        return item;
      }));
    });
  }

  // в списке — только активные: кто на скамье (отдых и афк), не показан, но в числе гладиаторов учтён.
  // На дуэли оба бойца закреплены сверху, под чертой; прокручивается только остальной список
  _roster(game) {
    const battle = game.state === 'battle';
    const all = Array.from(game.members.values());
    const pinned = battle && game.duel ? [game.duel.left, game.duel.right] : [];
    const list = all.filter((g) => !pinned.includes(g) && (g.fate || g.place !== 'rest'));
    const fateOrder = { fight: 0, down: 1, dead: 2 };
    list.sort((a, b) => (battle ? (fateOrder[a.fate] ?? 3) - (fateOrder[b.fate] ?? 3) : 0)
      || b.level - a.level || b.xp - a.xp || a.name.localeCompare(b.name));
    const bets = game.duel ? game.duel.bets : null;
    const sign = (g) => [g.login, g.color, g.team, g.paragon, g.level, g.points, g.coins, Math.round(g.hp / maxHp(g) * 20),
      battle ? g.fate : g.place, g.walking && !battle].join(':');
    const key = all.length + '#' + (bets ? Array.from(bets).join(',') : '') + pinned.map(sign).join('|') + '#'
      + list.map(sign).join('|');
    const row = (g) => {
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
      gold.append(el('i', 'coin'), String(g.coins));
      // в стенке на стенку во время боя ник — цвета команды
      const team = battle && g.team ? TEAMS.colors[g.team] : null;
      const name = team ? el('span', 'name', g.name) : nick('name', g.name, g.login);
      if (team) name.style.color = team;
      else if (!starOf(g.login)) name.style.color = g.color;
      const who = el('span', 'who');
      who.append(name);
      if (g.paragon) who.append(paragonTag(g.paragon));
      li.append(lvl, who, gold,
        el('span', 'where ' + where, battle && !g.fate ? (bets && bets.has(g.login) ? 'ставка ' + bets.get(g.login) : 'ждёт')
          : WHERE[where] || ''), bar);
      return li;
    };
    this._set('roster', key, (node) => {
      const top = $('roster-top');
      top.replaceChildren(...pinned.map(row));
      top.hidden = !pinned.length;
      node.replaceChildren(...list.map(row));
      $('count').textContent = all.length ? String(all.length) : '';
      $('empty').hidden = all.length > 0;
      this.rosterFit = null;
    });
  }

  // не влезли — список стоит наверху, плавно едет вниз, стоит внизу, гаснет и снова появляется сверху; и так по кругу
  _scrollRoster(dt) {
    const box = $('roster-box'), list = $('roster');
    if (!this.rosterFit) this.rosterFit = { over: Math.max(0, list.scrollHeight - box.clientHeight) };
    const over = this.rosterFit.over, s = this.rollState || (this.rollState = { y: 0, step: 'top', wait: ROLL.wait });
    let alpha = 1;
    if (over <= 0) {
      Object.assign(s, { y: 0, step: 'top', wait: ROLL.wait });
    } else if (s.step === 'down') {
      s.y = Math.min(over, s.y + ROLL.speed * dt);
      if (s.y >= over) Object.assign(s, { step: 'bottom', wait: ROLL.wait });
    } else if (s.step === 'jump') {
      // половину времени гаснет внизу, половину проявляется наверху
      s.wait -= dt;
      if (s.wait <= ROLL.fade / 2) s.y = 0;
      alpha = Math.abs(s.wait / (ROLL.fade / 2) - 1);
      if (s.wait <= 0) Object.assign(s, { step: 'top', wait: ROLL.wait });
    } else if ((s.wait -= dt) <= 0) {
      Object.assign(s, s.step === 'top' ? { step: 'down' } : { step: 'jump', wait: ROLL.fade });
    }
    const y = Math.round(Math.min(s.y, over)), shown = y + ':' + alpha.toFixed(2);
    if (shown !== this.rollShown) {
      this.rollShown = shown;
      list.style.transform = 'translateY(' + -y + 'px)';
      list.style.opacity = alpha < 1 ? alpha.toFixed(2) : '';
    }
  }

  // новые сверху; длинное сообщение переносится, а старое, что не влезло целиком, не показываем
  _feed(game) {
    const lines = game.lines;
    const key = lines.map((l) => l.id).join(',') + '|' + this.settings?.webcam;
    this._set('feed', key, (node) => {
      node.replaceChildren(...lines.slice().reverse().map((line) => el('li', line.kind, line.text)));
      const room = node.clientHeight;
      let full = false;
      for (const li of node.children) {
        full = full || li.offsetTop - node.offsetTop + li.offsetHeight > room;
        li.hidden = full;
      }
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
      const key = [g.paragon, g.level, Math.floor(g.xp), Math.round(g.hp), g.coins, g.str, g.agi, g.vit, g.points,
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

  // карточка: сверху имя и уровень; ниже кукла со снаряжением, характеристики столбиком, здоровье, урон и мелкие цифры
  // дуэль началась (ставки кончились) — профили бойцов в верхних углах поля (левый — слева, правый — справа),
  // чтобы не закрывали бегающих бойцов; держатся до конца боя
  _duelCards(game) {
    const d = game.state === 'battle' && game.duel && !game.duel.betting ? game.duel : null, box = $('duel-cards');
    const sign = (g) => [g.login, g.color, g.level, g.paragon, g.coins, g.points, g.str, g.agi, g.vit, g.fights, g.shield, g.nets, g.amulet,
      JSON.stringify(g.weapon), JSON.stringify(g.gear)].join(':');
    const key = d ? sign(d.left) + '|' + sign(d.right) : '';
    if (box.dataset.key === key) return;
    box.dataset.key = key;
    box.replaceChildren();
    if (!d) return;
    for (const [g, side] of [[d.left, 'left'], [d.right, 'right']]) {
      const card = el('div', 'profile duel ' + side);
      card.style.setProperty('--c', g.color);
      card.append(...this._profile(g));
      box.append(card);
    }
  }

  _profile(g) {
    const top = el('div', 'top');
    const lv = el('span', 'lv');
    if (g.paragon) lv.append(paragonTag(g.paragon), ' ');
    lv.append(g.level + ' ур.');
    top.append(nick('who', g.name, g.login), lv);
    const hpMax = maxHp(g);
    const chip = (icon, value, title, extra = '') => {
      const node = el('span', 'chip' + extra);
      node.title = title;
      node.append(icon, el('b', '', value));
      return node;
    };
    // кукла: шлем, броня, поножи, сапоги сверху вниз; правая рука слева от брони, левая справа, амулет над правой
    const doll = el('div', 'doll');
    const slot = (area, label, name, color, extra = '') => {
      const cell = el('span', 'icon' + (color ? '' : ' empty') + extra);
      cell.title = label;
      cell.style.gridArea = area;
      cell.style.setProperty('--c', color || '#5b5468');
      cell.innerHTML = ICONS[name];
      doll.append(cell);
    };
    const w = g.weapon, wName = w ? (w.type === 'sword' ? 'weapon' : w.type) : 'fists', wColor = w && rarityOf(w.rarity).color;
    slot('amulet', 'Божественный амулет: спасёт от смерти', 'amulet', g.amulet ? outcomeOf('amulet').color : '');
    slot('right', 'Правая рука', wName, wColor);
    if (twoHanded(g)) slot('left', 'Левая рука: двуручное оружие', wName, wColor, ' twin');
    else slot('left', 'Левая рука', g.nets > 0 && !g.shield ? 'net' : 'shield', g.shield || g.nets > 0 ? '#d9a441' : '');
    for (const id of SLOT_IDS) {
      const item = g.gear && g.gear[id];
      slot(id, ARMOR_SLOTS[id].label, id === 'body' ? 'armor' : id, item && rarityOf(item.rarity).color);
    }
    // характеристики столбиком, под ними свободные очки; справа здоровье, урон, монеты, а мелко — крит, броня и бои
    // (очки и монеты — те же значки, что в списке гладиаторов)
    const stats = el('div', 'col stats');
    stats.append(...STATS.map((stat) => chip(iconImg(statIcon(stat.id), 'ico small'), String(g[stat.id]), stat.name, ' small')));
    if (g.points > 0) stats.append(el('em', 'points', '+' + g.points));
    const info = el('div', 'col info');
    const notes = el('div', 'small-line');
    notes.append('крит ' + Math.round(critOf(g) * 100) + '%', el('br'), 'броня ' + Math.round(armorOf(g) * 100) + '%', el('br'),
      'боёв: ' + g.fights);
    info.append(chip(iconImg('images/heart.png'), String(Math.round(hpMax)), 'Максимум здоровья'),
      chip(iconImg('images/might.png'), String(Math.round(damageOf(g))), 'Урон'),
      chip(el('i', 'coin'), String(g.coins), 'Монеты', ' gold'), notes);
    const body = el('div', 'body');
    body.append(doll, stats, info);
    return [top, body];
  }

  // --- гача ---

  _cell(result) {
    const cell = el('span', 'cell');
    let color, icon;
    if (result.item) {
      color = rarityOf(result.item.rarity).color;
      icon = result.item.kind === 'weapon' ? (result.item.type === 'sword' ? 'weapon' : result.item.type)
        : result.item.slot === 'body' ? 'armor' : result.item.slot;
    } else if (result.kind === 'shield' || result.kind === 'net' || result.kind === 'amulet') {
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
        prize.append(itemText(r.item), el('small', '', r.equipped ? 'надевает' : r.locked ? 'божественная вещь не меняется'
          : r.item.kind === 'weapon' ? 'редкость ниже своей — выброшено' : 'не лучше своего — выброшено'));
      } else if (now.done && r.kind === 'amulet') {
        prize.style.color = outcomeOf(r.kind).color;
        prize.append(outcomeOf(r.kind).name, el('small', '', 'один раз спасёт от смерти'));
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
      } else if (r.mode === 'teams') {
        if (r.winTeam) {
          const team = el('b', '', r.winTeam === 'red' ? 'красные' : 'синие');
          team.style.color = TEAMS.colors[r.winTeam];
          $('champion').append('Стенку взяли ', team, '!');
        } else {
          $('champion').textContent = 'Стенка на стенку — ничья';
        }
      } else if (r.mode === 'paragon' && r.ascended) {
        const up = r.ascended;
        $('champion').append(up.stood ? '' : 'Гладиаторы одолели ', nick('', up.name, up.login, 'b'),
          up.stood ? ' выстоял против всех и получает ' : ' — он получает ', paragonTag(up.paragon),
          ' парагон ' + up.paragon + ' и начинает заново');
      } else if (champ) {
        $('champion').append('Чемпион арены — ', nick('', champ.name, champ.login, 'b'));
      } else {
        $('champion').textContent = 'Время вышло — чемпиона нет';
      }
      const fill = (id, rows, describe) => {
        const items = rows.slice(0, 11).map((row) => {
          const li = el('li');
          const team = r.mode === 'teams' && row.team ? TEAMS.colors[row.team] : null;
          const name = team ? el('b', '', row.name) : nick('', row.name, row.login, 'b');
          if (team) name.style.color = team;
          else if (!starOf(row.login)) name.style.color = row.color;
          li.append(name, describe(row));
          return li;
        });
        if (rows.length > 11) items.push(el('li', 'none', '…и ещё ' + (rows.length - 11)));
        if (!rows.length) items.push(el('li', 'none', 'никого'));
        $(id).replaceChildren(...items);
      };
      const reward = (row) => {
        if (row.paragon) {
          const span = el('span', '', 'получает ');
          span.append(paragonTag(row.paragon), ' парагон ' + row.paragon);
          return span;
        }
        const span = el('span', '', '+' + row.xp + ' опыта · +' + row.coins + ' монет'
          + (row.kos ? ' · нокаутов ' + row.kos : '') + (row.saved ? ' · спас амулет' : ''));
        if (row.ups) span.append(' · ', el('span', 'up', row.level + ' ур.!'));
        return span;
      };
      fill('res-alive', r.rows.filter((row) => row.fate === 'fight'), reward);
      fill('res-beaten', r.rows.filter((row) => row.fate === 'down'), reward);
      if (duelView) fill('res-dead', r.bettors, (row) => el('span', '', '+' + row.coins + ' монет'));
      else fill('res-dead', r.rows.filter((row) => row.fate === 'dead'),
        (row) => el('span', '', (row.by ? 'от руки ' + row.by : 'на арене') + ' · ' + row.level + ' ур.'));
    });
    if (r) $('res-next').textContent = 'Возвращение в лудус через ' + Math.max(0, Math.ceil(game.timer)) + ' с';
  }
}

export { PLACES };
