import { BEATEN_HP, GEAR_MAX, HEAL_RATE, LEVEL_MAX, MOVE_SPEED, POINTS_PER_LEVEL, REACH, BODY, REWARD, START_COINS,
  START_POINTS, STATS, TRAIN_XP, armorOf, attackEvery, critOf, crowdBonus, damageOf, deathChance, dodgeOf, maxHp, xpNeed,
  CRIT_HIT, SPREAD } from './balance.js';
import { ARENA, DUMMIES, ENTRANCE, PLACES, clampToArena, pointIn } from './places.js';

export const COMMANDS = new Map([
  ['!гладиаторы-пауза', 'pause'],
  ['!гладиаторы-дальше', 'next'],
  ['!гладиаторы-сброс', 'reset'],
]);
export const BOTS = [
  'nightbot', 'streamelements', 'streamlabs', 'moobot', 'fossabot', 'wizebot', 'jeetbot', 'soundalerts', 'sery_bot',
  'kofistreambot', 'tangiabot', 'botisimo', 'lumiastream', 'streamstickers', 'creatisbot', 'own3d', 'dixperbro',
  'pokemoncommunitygame', 'songlistbot', 'pretzelrocks', 'restreambot', 'commanderroot', 'frostytoolsdotcom',
];
export const CARD_WORDS = new Set(['профиль', 'проф']);
export const YIELD_WORDS = new Set(['сдаюсь', 'сдаться', 'сдался']);
export const MIN_FIGHTERS = 2;
export const RESULTS_TIME = 12;
export const END_DELAY = 2.5;
export const CARD_TIME = 8;
export const CARDS_MAX = 3;
export const FEED_MAX = 8;
export const FALLEN_MAX = 30;
export const TICK = 0.05;
export const NAME_MAX = 16;
export const PALETTE = ['#e0524a', '#4f8fe8', '#3fb877', '#e8a23a', '#a46be0', '#2fb5c4', '#e66aa7', '#9cb83a',
  '#d9783a', '#6a7be8'];

const SAVE_EVERY = 15;
const STEP_MAX = 1;
const EVENTS_MAX = 400;
const STROLL = 1.4;
const CROWDING = 160;
const DUEL_TIME = 12;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const INVISIBLE = /[​‌‍⁠﻿­͏⠀\u{E0000}]/gu;
const IGNORED = new Set(BOTS);
const SAVED = ['name', 'color', 'level', 'xp', 'coins', 'str', 'agi', 'vit', 'points', 'weapon', 'armor', 'hp',
  'fights', 'wins', 'kos', 'kills', 'born'];
const COUNTS = ['level', 'xp', 'coins', 'str', 'agi', 'vit', 'points', 'weapon', 'armor', 'fights', 'wins', 'kos',
  'kills'];

const PLACE_BY_WORD = new Map();
for (const [id, place] of Object.entries(PLACES)) for (const word of place.words) PLACE_BY_WORD.set(word, id);
const STAT_BY_WORD = new Map();
for (const stat of STATS) for (const word of stat.words) STAT_BY_WORD.set(word, stat.id);

function hashColor(login) {
  let h = 0;
  for (const ch of login) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// тёмные цвета чата плохо видно на песке — осветляем
export function readableColor(color, login) {
  if (!COLOR_RE.test(color || '')) return hashColor(login);
  const n = parseInt(color.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (0.299 * r + 0.587 * g + 0.114 * b >= 70) return color.toLowerCase();
  return hashColor(login);
}

export function newGladiator(login, name, color, now) {
  return { login, name, color, level: 1, xp: 0, coins: START_COINS, str: 0, agi: 0, vit: 0, points: START_POINTS,
    weapon: 0, armor: 0, hp: 1, fights: 0, wins: 0, kos: 0, kills: 0, born: now };
}

export class Roster {
  constructor(storage = null, key = 'gladiatory.roster') {
    this.storage = storage;
    this.key = key;
    this.data = new Map();
    this.fallen = [];
    if (!storage) return;
    try {
      const saved = JSON.parse(storage.getItem(key) || '{}');
      for (const [login, entry] of Object.entries(saved.alive || {})) {
        if (!entry || typeof entry !== 'object') continue;
        const g = newGladiator(login, String(entry.name || login), readableColor(entry.color, login),
          Number(entry.born) || 0);
        for (const field of COUNTS) {
          if (Number.isFinite(Number(entry[field]))) g[field] = Math.max(0, Math.trunc(Number(entry[field])));
        }
        g.level = Math.max(1, Math.min(LEVEL_MAX, g.level));
        g.weapon = Math.min(GEAR_MAX, g.weapon);
        g.armor = Math.min(GEAR_MAX, g.armor);
        g.hp = Number.isFinite(Number(entry.hp)) ? Math.max(0.01, Math.min(1, Number(entry.hp))) : 1;
        this.data.set(login, g);
      }
      this.fallen = (Array.isArray(saved.fallen) ? saved.fallen : []).filter((f) => f && f.name).slice(0, FALLEN_MAX)
        .map((f) => ({ name: String(f.name), level: Math.max(1, Math.trunc(Number(f.level)) || 1),
          fights: Math.max(0, Math.trunc(Number(f.fights)) || 0), kills: Math.max(0, Math.trunc(Number(f.kills)) || 0),
          by: String(f.by || ''), at: Number(f.at) || 0 }));
    } catch (error) {
      this.data = new Map();
      this.fallen = [];
    }
  }

  get size() {
    return this.data.size;
  }

  get(login) {
    return this.data.get(login) || null;
  }

  // в хранилище здоровье лежит долей от максимума, чтобы не зависеть от формул
  put(g) {
    const entry = {};
    for (const field of SAVED) entry[field] = g[field];
    entry.hp = Math.max(0.01, Math.min(1, g.hp / maxHp(g)));
    entry.hp = Math.round(entry.hp * 1000) / 1000;
    this.data.set(g.login, entry);
  }

  bury(g, by, at) {
    this.data.delete(g.login);
    this.fallen.unshift({ name: g.name, level: g.level, fights: g.fights, kills: g.kills, by: by || '', at });
    this.fallen.length = Math.min(this.fallen.length, FALLEN_MAX);
  }

  reset() {
    this.data = new Map();
    this.fallen = [];
    this.save();
  }

  save() {
    if (!this.storage) return;
    try {
      const alive = {};
      for (const [login, entry] of this.data) alive[login] = entry;
      this.storage.setItem(this.key, JSON.stringify({ alive, fallen: this.fallen }));
    } catch (error) {
      return;
    }
  }
}

export class Game {
  constructor(settings, roster = new Roster(), { random = Math.random, now = () => Date.now() / 1000 } = {}) {
    this.settings = settings;
    this.roster = roster;
    this.random = random;
    this.now = now;
    this.state = 'stopped';
    this.paused = false;
    this.timer = 0;
    this.clock = 0;
    this.members = new Map();
    this.fighters = [];
    this.results = null;
    this.notice = '';
    this.events = [];
    this.eventId = 0;
    this.lines = [];
    this.lineId = 0;
    this.cards = [];
    this.endIn = null;
    this._carry = 0;
    this._saveIn = SAVE_EVERY;
  }

  configure(settings) {
    this.settings = settings;
    if (this.state === 'ludus') this.timer = Math.min(this.timer, settings.ludus);
    if (this.state === 'battle') this.timer = Math.min(this.timer, settings.battle);
  }

  // --- фазы ---

  open() {
    this.state = 'ludus';
    this.paused = false;
    this.timer = this.settings.ludus;
    this.fighters = [];
    this.endIn = null;
    this.notice = '';
    this._emit('phase', { state: 'ludus' });
  }

  stop() {
    this._saveAll();
    this.state = 'stopped';
    this.paused = false;
    this.members.clear();
    this.fighters = [];
    this.results = null;
    this.cards = [];
    this.lines = [];
    this.endIn = null;
  }

  setPaused(paused) {
    if (this.state === 'stopped' || this.paused === paused) return false;
    this.paused = paused;
    return true;
  }

  pause() {
    this.setPaused(!this.paused);
    return this.paused;
  }

  next() {
    if (this.state === 'ludus') this._startBattle();
    else if (this.state === 'battle') this._endBattle();
    else if (this.state === 'results') this.open();
  }

  resetAll() {
    this.roster.reset();
    this.members.clear();
    this.fighters = [];
    this.cards = [];
    this.results = null;
    this.lines = [];
    this._line('Все гладиаторы стёрты. Пиши в чат — и начинай заново', 'info');
    if (this.state !== 'stopped') this.open();
  }

  get waiting() {
    if (this.state !== 'battle') return 0;
    let n = 0;
    for (const g of this.members.values()) if (!g.fate) n++;
    return n;
  }

  // --- чат ---

  feed(name, text, meta = {}) {
    if (this.state === 'stopped') return;
    name = String(name || '').replace(INVISIBLE, '').trim();
    const login = String(meta.login || name).toLowerCase();
    if (!login || IGNORED.has(login)) return;
    text = String(text || '').replace(INVISIBLE, '').trim().toLowerCase().replace(/ё/g, 'е');
    const words = text.split(/\s+/).filter(Boolean);
    const first = words[0] || '';
    if (COMMANDS.has(first)) {
      if (meta.mod && this.settings.chat_commands) this._modCommand(COMMANDS.get(first));
      return;
    }
    let g = this.members.get(login);
    if (!g) g = this._join(login, name || login, meta.color);
    this._command(g, first, words[1] || '');
  }

  _modCommand(action) {
    if (action === 'pause') this.pause();
    else if (action === 'next' && !this.paused) this.next();
    else if (action === 'reset') this.resetAll();
  }

  _join(login, name, color) {
    const saved = this.roster.get(login);
    let g;
    if (saved) {
      g = Object.assign(newGladiator(login, saved.name, saved.color, saved.born), saved, { login });
      g.hp = Math.max(1, Math.round(saved.hp * maxHp(g)));
      this._line(g.name + ' возвращается в лудус', 'join');
    } else {
      g = newGladiator(login, name.slice(0, NAME_MAX), readableColor(color, login), this.now());
      g.hp = maxHp(g);
      const fell = this.roster.fallen.find((f) => f.name.toLowerCase() === login);
      this._line(fell ? g.name + ' начинает заново новым бойцом' : 'Новый гладиатор: ' + g.name, 'join');
      this.roster.put(g);
      this.roster.save();
    }
    g.name = name.slice(0, NAME_MAX) || g.name;
    g.fate = null;
    this.members.set(login, g);
    this._arrive(g, 'rest');
    this._emit('join', { login });
    return g;
  }

  _command(g, word, arg) {
    if (!word) return;
    if (CARD_WORDS.has(word)) {
      this._showCard(g);
      return;
    }
    if (YIELD_WORDS.has(word)) {
      this._yield(g);
      return;
    }
    if (this.state === 'battle' && g.fate) return;
    if (PLACE_BY_WORD.has(word)) this._goTo(g, PLACE_BY_WORD.get(word));
    else if (STAT_BY_WORD.has(word)) this._spend(g, STAT_BY_WORD.get(word), arg);
  }

  _showCard(g) {
    this.cards = this.cards.filter((card) => card.login !== g.login);
    this.cards.push({ login: g.login, until: this.clock + CARD_TIME });
    if (this.cards.length > CARDS_MAX) this.cards.shift();
  }

  _goTo(g, place) {
    if (g.place === place) return;
    if (place === 'heal') {
      if (g.hp >= maxHp(g)) {
        this._line(g.name + ' здоров — в лазарете делать нечего', 'info');
        return;
      }
      this._line(g.name + ' ложится в лазарет', 'heal');
    } else if (place === 'train') {
      this._line(g.name + ' идёт тренироваться', 'info');
    } else if (place === 'rest') {
      this._line(g.name + ' садится отдохнуть', 'info');
    }
    this._emit('go', { login: g.login, place });
    this._arrive(g, place, true);
  }

  _spend(g, stat, arg) {
    if (g.points <= 0) {
      this._line(g.name + ': свободных очков нет — их дают за уровни', 'warn');
      return;
    }
    const wanted = arg === 'все' || arg === 'всё' ? g.points : Math.max(1, Math.trunc(Number(arg)) || 1);
    const n = Math.min(g.points, wanted);
    const was = maxHp(g);
    g.points -= n;
    g[stat] += n;
    if (stat === 'vit') g.hp += maxHp(g) - was;
    const name = STATS.find((s) => s.id === stat).name;
    this._line(g.name + ': ' + name.toLowerCase() + ' +' + n, 'stat');
    this._keep(g);
  }

  _yield(g) {
    if (this.state !== 'battle' || g.fate !== 'fight') return;
    g.fate = 'yield';
    g.by = '';
    this._line(g.name + ' бросает оружие и сдаётся', 'yield');
    this._emit('down', { login: g.login, fate: 'yield', x: g.x, y: g.y });
    this._checkEnd();
  }

  // --- лудус ---

  // в отдыхе и лазарете у каждого своё место: сидит или лежит, пока его не отправят дальше
  _arrive(g, place, walk = false) {
    g.place = place;
    g.seat = null;
    if (!walk || g.x === undefined) {
      g.x = ENTRANCE.x;
      g.y = ENTRANCE.y + (this.random() - 0.5) * 60;
    }
    const target = this._spot(g, place);
    g.tx = target.x;
    g.ty = target.y;
    g.wait = 0;
    g.face = g.tx >= g.x ? 1 : -1;
    g.walking = true;
    g.swing = 0;
    g.pose = null;
  }

  _spot(g, place) {
    const seats = PLACES[place].seats;
    if (seats) {
      const taken = new Set();
      for (const other of this.members.values()) {
        if (other !== g && other.place === place && other.seat !== null && other.seat !== undefined) taken.add(other.seat);
      }
      const free = seats.findIndex((_, i) => !taken.has(i));
      if (free >= 0) {
        g.seat = free;
        return seats[free];
      }
      return pointIn(PLACES[place].walk, this.random);
    }
    if (place === 'train') {
      const dummy = DUMMIES[Math.floor(this.random() * DUMMIES.length)];
      const side = this.random() < 0.5 ? -1 : 1;
      g.dummy = dummy;
      return { x: dummy.x + side * 26, y: dummy.y + 3 };
    }
    return pointIn(PLACES[place].walk, this.random);
  }

  _stepLudus(dt) {
    for (const g of this.members.values()) {
      if (g.fate) continue;
      this._stroll(g, dt);
      const hpMax = maxHp(g);
      const rate = g.walking ? 0 : HEAL_RATE[g.place] || 0;
      g.hp = Math.min(hpMax, g.hp + rate * hpMax * dt);
      if (g.place === 'heal' && g.hp >= hpMax) {
        this._line(g.name + ' вылечился и выходит из лазарета', 'heal');
        this._arrive(g, 'rest', true);
      }
      if (g.place === 'train' && !g.walking) this._gainXp(g, TRAIN_XP * dt);
    }
    this._saveIn -= dt;
    if (this._saveIn <= 0) {
      this._saveIn = SAVE_EVERY;
      this._saveAll();
    }
  }

  _stroll(g, dt) {
    g.swing = Math.max(0, g.swing - dt);
    if (!g.walking) {
      if (g.place === 'rest' || g.place === 'heal') return;
      g.wait -= dt;
      if (g.place === 'train' && g.swing <= 0 && this.random() < dt * 1.6) g.swing = 0.3;
      if (g.wait > 0) return;
      const p = this._spot(g, g.place);
      g.tx = p.x;
      g.ty = p.y;
      g.walking = true;
      return;
    }
    const dx = g.tx - g.x, dy = g.ty - g.y, d = Math.hypot(dx, dy);
    const speed = MOVE_SPEED * STROLL;
    if (d <= speed * dt) {
      g.x = g.tx;
      g.y = g.ty;
      g.walking = false;
      g.wait = 4 + this.random() * 5;
      if (g.place === 'rest') g.pose = 'sit';
      else if (g.place === 'heal') g.pose = 'lie';
      if (g.place === 'train' && g.dummy) g.face = g.dummy.x >= g.x ? 1 : -1;
      return;
    }
    g.x += dx / d * speed * dt;
    g.y += dy / d * speed * dt;
    if (Math.abs(dx) > 1) g.face = dx > 0 ? 1 : -1;
  }

  _gainXp(g, amount) {
    if (g.level >= LEVEL_MAX) return 0;
    g.xp += amount;
    let ups = 0;
    while (g.level < LEVEL_MAX && g.xp >= xpNeed(g.level)) {
      g.xp -= xpNeed(g.level);
      g.level++;
      g.points += POINTS_PER_LEVEL;
      g.hp += maxHp(g) - maxHp(Object.assign({}, g, { level: g.level - 1 }));
      ups++;
    }
    if (ups) {
      const points = ups * POINTS_PER_LEVEL;
      this._line(g.name + ' достигает ' + g.level + ' уровня (+' + points + ' ' + plural(points, 'очко', 'очка', 'очков')
        + ')', 'level');
      this._emit('level', { login: g.login, level: g.level });
    }
    return ups;
  }

  // --- бой ---

  _startBattle() {
    const ready = Array.from(this.members.values());
    if (ready.length < MIN_FIGHTERS) {
      this.timer = this.settings.ludus;
      this.notice = 'Нужно хотя бы ' + MIN_FIGHTERS + ' гладиатора — бой откладывается';
      this._line(this.notice, 'warn');
      return false;
    }
    this.notice = '';
    this.state = 'battle';
    this.timer = this.settings.battle;
    this.endIn = null;
    this.cards = [];
    this.fighters = ready;
    const n = ready.length, spots = this._spots(n);
    ready.forEach((g, i) => {
      while (g.points > 0) {
        g[STATS[Math.floor(this.random() * STATS.length)].id]++;
        g.points--;
      }
      g.hp = Math.min(g.hp, maxHp(g));
      g.x = spots[i].x;
      g.y = spots[i].y;
      g.fate = 'fight';
      g.seat = null;
      g.pose = null;
      g.cool = 0.6 + this.random() * attackEvery(g);
      g.target = null;
      g.retarget = 0;
      g.swing = 0;
      g.flash = 0;
      g.walking = false;
      g.kosNow = 0;
      g.killsNow = 0;
      g.dealt = 0;
      g.by = '';
    });
    // соседи становятся парами — бой сразу распадается на поединки по всей арене
    const free = new Set(ready);
    for (const g of ready) {
      if (!free.has(g)) continue;
      free.delete(g);
      let near = null;
      for (const other of free) {
        if (!near || Math.hypot(other.x - g.x, other.y - g.y) < Math.hypot(near.x - g.x, near.y - g.y)) near = other;
      }
      if (!near) continue;
      free.delete(near);
      g.target = near;
      near.target = g;
      g.retarget = near.retarget = DUEL_TIME;
    }
    for (const g of ready) if (g.target) g.face = g.target.x >= g.x ? 1 : -1;
    this._line('Бой начинается! На арене ' + n + ' ' + plural(n, 'гладиатор', 'гладиатора', 'гладиаторов'), 'battle');
    this._emit('phase', { state: 'battle' });
    return true;
  }

  // места на арене: равномерно по всему песку, не ближе друг к другу, чем можно
  _spots(n) {
    const spots = [];
    const gap = Math.max(BODY * 1.6, Math.min(110, Math.sqrt(Math.PI * ARENA.rx * ARENA.ry * 0.55 / Math.max(1, n))));
    for (let i = 0; i < n; i++) {
      let best = null, bestGap = -1;
      for (let attempt = 0; attempt < 30; attempt++) {
        const a = this.random() * Math.PI * 2, r = Math.sqrt(this.random()) * 0.8;
        const p = { x: ARENA.cx + Math.cos(a) * (ARENA.rx - 40) * r, y: ARENA.cy + Math.sin(a) * (ARENA.ry - 34) * r };
        let near = Infinity;
        for (const s of spots) near = Math.min(near, Math.hypot(s.x - p.x, s.y - p.y));
        if (near > bestGap) {
          best = p;
          bestGap = near;
        }
        if (near >= gap) break;
      }
      spots.push(best);
    }
    return spots;
  }

  _standing() {
    return this.fighters.filter((g) => g.fate === 'fight');
  }

  // ищем ближайшего, но кого ещё мало кто бьёт: толпа распадается на поединки
  _pickTarget(g, standing) {
    const hunted = new Map();
    for (const other of standing) if (other !== g && other.target) hunted.set(other.target, (hunted.get(other.target) || 0) + 1);
    let best = [];
    for (const other of standing) {
      if (other === g) continue;
      const d = Math.hypot(other.x - g.x, other.y - g.y);
      const busy = (hunted.get(other) || 0) - (other.target === g ? 1 : 0);
      best.push({ other, score: d + CROWDING * Math.max(0, busy) });
    }
    if (!best.length) return null;
    best.sort((a, b) => a.score - b.score);
    best = best.slice(0, 2);
    return best[Math.floor(this.random() * best.length)].other;
  }

  _stepBattle(dt) {
    const standing = this._standing();
    for (const g of this.fighters) {
      g.swing = Math.max(0, g.swing - dt);
      g.flash = Math.max(0, g.flash - dt);
    }
    for (const g of standing) {
      if (g.fate !== 'fight') continue;
      g.retarget -= dt;
      g.cool = Math.max(0, g.cool - dt);
      if (!g.target || g.target.fate !== 'fight' || g.retarget <= 0) {
        g.target = this._pickTarget(g, standing.filter((s) => s.fate === 'fight'));
        g.retarget = DUEL_TIME;
      }
      const t = g.target;
      if (!t) {
        g.walking = false;
        continue;
      }
      const dx = t.x - g.x, dy = t.y - g.y, d = Math.hypot(dx, dy) || 1;
      if (Math.abs(dx) > 2) g.face = dx > 0 ? 1 : -1;
      if (d > REACH) {
        const speed = MOVE_SPEED * (1 + 0.01 * g.agi);
        const stepLen = Math.min(d - REACH * 0.8, speed * dt);
        g.x += dx / d * stepLen;
        g.y += dy / d * stepLen;
        g.walking = true;
      } else {
        g.walking = false;
        if (g.cool <= 0) {
          this._attack(g, t);
          g.cool = attackEvery(g) * (0.9 + this.random() * 0.2);
        }
      }
    }
    const alive = this._standing();
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j];
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d >= BODY) continue;
        if (d < 0.01) {
          dx = this.random() - 0.5;
          dy = this.random() - 0.5;
          d = Math.hypot(dx, dy) || 1;
        }
        const push = (BODY - d) / 2;
        a.x -= dx / d * push;
        a.y -= dy / d * push;
        b.x += dx / d * push;
        b.y += dy / d * push;
      }
    }
    for (const g of alive) clampToArena(g, 26);
  }

  _attack(a, d) {
    a.swing = 0.3;
    if (this.random() < dodgeOf(d)) {
      this._emit('miss', { x: d.x, y: d.y, login: d.login });
      return;
    }
    const crit = this.random() < critOf(a);
    let dmg = damageOf(a) * (1 + SPREAD * (2 * this.random() - 1)) * (crit ? CRIT_HIT : 1) * (1 - armorOf(d));
    dmg = Math.max(1, Math.round(dmg));
    d.hp -= dmg;
    d.flash = 0.18;
    a.dealt += dmg;
    this._emit('hit', { x: d.x, y: d.y, amount: dmg, crit, login: d.login, from: a.login });
    if (d.hp <= 0) this._knockOut(d, a);
  }

  _knockOut(d, a) {
    const hpMax = maxHp(d);
    const chance = deathChance(this.settings.death / 100, -d.hp, hpMax);
    const dead = this.random() < chance;
    d.fate = dead ? 'dead' : 'down';
    d.by = a.name;
    d.hp = dead ? 0 : Math.max(1, Math.round(hpMax * BEATEN_HP));
    a.kosNow++;
    if (dead) a.killsNow++;
    a.target = null;
    if (dead) this._line(d.name + ' погибает от руки ' + a.name, 'death');
    else this._line(a.name + ' валит ' + d.name + ' — тот сдаётся', 'down');
    this._emit('down', { login: d.login, fate: d.fate, x: d.x, y: d.y, by: a.login });
    this._checkEnd();
  }

  _checkEnd() {
    if (this.state === 'battle' && this.endIn === null && this._standing().length <= 1) this.endIn = END_DELAY;
  }

  _endBattle() {
    const n = this.fighters.length, bonus = crowdBonus(n), standing = this._standing();
    const champion = standing.length === 1 ? standing[0] : null;
    const rows = [];
    for (const g of this.fighters) {
      const fate = g.fate;
      g.fights++;
      g.kos += g.kosNow;
      g.kills += g.killsNow;
      let xp = 0, coins = 0;
      if (fate === 'fight' || fate === 'down' || fate === 'yield') {
        const r = fate === 'fight' ? REWARD.standing : REWARD.beaten;
        const mult = bonus * (g === champion ? REWARD.champion : 1);
        xp = Math.round((r.xp + r.xpPerKo * g.kosNow) * mult);
        coins = Math.round((r.coins + r.coinsPerKo * g.kosNow) * mult);
        if (fate === 'fight') g.wins++;
      }
      const row = { login: g.login, name: g.name, color: g.color, fate, xp, coins, kos: g.kosNow, kills: g.killsNow,
        by: g.by, level: g.level, ups: 0 };
      if (fate === 'dead') {
        this.roster.bury(g, g.by, this.now());
        this.members.delete(g.login);
      } else {
        g.coins += coins;
        row.ups = this._gainXp(g, xp);
        row.level = g.level;
        g.fate = null;
        g.target = null;
        this._arrive(g, g.hp < maxHp(g) ? 'heal' : 'rest');
        this.roster.put(g);
      }
      rows.push(row);
    }
    const order = { fight: 0, down: 1, yield: 1, dead: 2 };
    rows.sort((a, b) => order[a.fate] - order[b.fate] || b.kos - a.kos || b.xp - a.xp);
    this.results = { champion: champion ? champion.login : null, rows, fighters: n };
    this.roster.save();
    this.fighters = [];
    this.endIn = null;
    this.state = 'results';
    this.timer = RESULTS_TIME;
    const wounded = rows.filter((row) => row.fate !== 'dead' && this.members.get(row.login)?.place === 'heal').length;
    if (wounded) this._line('Раненых уносят в лазарет: ' + wounded, 'heal');
    if (champion) this._line(champion.name + ' — чемпион арены!', 'champion');
    else this._line('Время вышло — бой окончен', 'battle');
    this._emit('phase', { state: 'results' });
  }

  // --- такт ---

  step(dt) {
    if (this.state === 'stopped' || this.paused) return;
    dt = Math.max(0, Math.min(STEP_MAX, dt));
    this._carry += dt;
    while (this._carry >= TICK) {
      this._carry -= TICK;
      this._tick(TICK);
      if (this.state === 'stopped') return;
    }
  }

  _tick(dt) {
    this.clock += dt;
    this.cards = this.cards.filter((card) => card.until > this.clock && this.members.has(card.login));
    if (this.state === 'ludus' || this.state === 'results') this._stepLudus(dt);
    else if (this.state === 'battle') {
      this._stepBattle(dt);
      for (const g of this.members.values()) if (!g.fate) this._stroll(g, dt);
    }
    if (this.state === 'battle' && this.endIn !== null) {
      this.endIn -= dt;
      if (this.endIn <= 0) {
        this._endBattle();
        return;
      }
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    if (this.state === 'ludus') this._startBattle();
    else if (this.state === 'battle') this._endBattle();
    else if (this.state === 'results') this.open();
  }

  // --- служебное ---

  _keep(g) {
    this.roster.put(g);
    this.roster.save();
  }

  _saveAll() {
    for (const g of this.members.values()) if (!g.fate) this.roster.put(g);
    this.roster.save();
  }

  _emit(type, data = {}) {
    this.events.push(Object.assign({ id: ++this.eventId, type, at: this.clock }, data));
    if (this.events.length > EVENTS_MAX) this.events.splice(0, this.events.length - EVENTS_MAX);
  }

  _line(text, kind) {
    this.lines.push({ id: ++this.lineId, text, kind, at: this.clock });
    if (this.lines.length > FEED_MAX) this.lines.shift();
  }
}

export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
