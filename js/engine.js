import { BEATEN_HP, HEAL_RATE, LEVEL_MAX, MOVE_SPEED, POINTS_PER_LEVEL, REACH, BODY, REWARD, START_COINS,
  START_POINTS, STATS, TRAIN_XP, NET, SHIELD, SPEAR, armorOf, reachOf, shieldUp, typeOf, attackEvery, critOf, crowdBonus, damageOf, deathChance, dodgeOf, maxHp, xpNeed,
  CRIT_HIT, SPREAD } from './balance.js';
import { ARENA, DUMMIES, ENTRANCE, PLACES, clampToArena, pointIn } from './places.js';
import { PRICE, QUEUE_CAP, RUSH, SHOW_TIME, SPIN_TIME, cleanItem, itemText, spin } from './gacha.js';

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
export const GACHA_WORDS = new Set(['гача', 'крутить']);
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
const DUEL_TIME = 6;
// бегство: от крита — с шансом, от ран — когда здоровья меньше четверти; потом передышка без бегства
const FLEE = { critChance: 0.75, critTime: [2, 1.5], low: 0.25, lowTime: [3, 2], rest: 5, speed: 1.2, sense: 170,
  ignored: 220 };
const RETARGET = [3.5, 3.5];
const REVENGE = 0.35;
// враг выше уровнем притягивает: за каждый уровень разницы цель «ближе» на per пикселей, не больше cap уровней
const LEVEL_PULL = { per: 70, cap: 4 };
const PICK_SOFT = 50;
const CIRCLE = 0.3;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const INVISIBLE = /[​‌‍⁠﻿­͏⠀\u{E0000}]/gu;
const IGNORED = new Set(BOTS);
const SAVED = ['name', 'color', 'level', 'xp', 'coins', 'str', 'agi', 'vit', 'points', 'weapon', 'armor', 'shield', 'nets', 'hp',
  'fights', 'wins', 'kos', 'kills', 'born'];
const COUNTS = ['level', 'xp', 'coins', 'str', 'agi', 'vit', 'points', 'nets', 'fights', 'wins', 'kos',
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
    weapon: null, armor: null, shield: false, nets: 0, hp: 1, fights: 0, wins: 0, kos: 0, kills: 0, born: now };
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
        g.weapon = cleanItem(entry.weapon, 'weapon');
        g.armor = cleanItem(entry.armor, 'armor');
        g.shield = entry.shield === true;
        g.nets = Math.min(NET.max, g.nets);
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
    for (const field of SAVED) entry[field] = g[field] && typeof g[field] === 'object' ? Object.assign({}, g[field]) : g[field];
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
    this.roundStart = 0;
    this.spins = [];
    this.spinNow = null;
    this.projectiles = [];
    this.lastRoundStart = 0;
    this._saveIn = SAVE_EVERY;
  }

  configure(settings) {
    this.settings = settings;
    if (this.state === 'ludus') this.timer = Math.min(this.timer, settings.ludus);
    if (this.state === 'battle') this.timer = Math.min(this.timer, settings.battle);
  }

  // --- фазы ---

  // раунд — это лудус и бой после него; помним начало прошлого, чтобы отличать активных от афк
  open() {
    this.lastRoundStart = this.state === 'stopped' ? this.clock : this.roundStart;
    this.roundStart = this.clock;
    this.state = 'ludus';
    this.paused = false;
    this.timer = this.settings.ludus;
    this.fighters = [];
    this.endIn = null;
    this.notice = '';
    this._emit('phase', { state: 'ludus' });
  }

  stop() {
    // недокрученные гачи возвращаем монетами
    for (const s of this.spins.concat(this.spinNow && !this.spinNow.done ? [this.spinNow] : [])) {
      const g = this.members.get(s.login);
      if (g) g.coins += PRICE;
    }
    this._saveAll();
    this.state = 'stopped';
    this.paused = false;
    this.members.clear();
    this.fighters = [];
    this.results = null;
    this.cards = [];
    this.lines = [];
    this.endIn = null;
    this.spins = [];
    this.spinNow = null;
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
    this.spins = [];
    this.spinNow = null;
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
    g.saidAt = this.clock;
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
    if (GACHA_WORDS.has(word)) {
      this._gacha(g, arg);
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

  // --- гача ---

  _gacha(g, arg) {
    if (this.state === 'battle' && g.fate) {
      this._line(g.name + ': в бою не до гачи — после боя', 'warn');
      return;
    }
    const queued = this.spins.filter((s) => s.login === g.login).length
      + (this.spinNow && this.spinNow.login === g.login ? 1 : 0);
    const afford = Math.floor(g.coins / PRICE);
    const wanted = arg === 'все' || arg === 'всё' ? afford : Math.max(1, Math.trunc(Number(arg)) || 1);
    const n = Math.min(wanted, afford, QUEUE_CAP - queued);
    if (n <= 0) {
      this._line(afford ? g.name + ': уже крутишь, подожди очереди'
        : g.name + ': гача стоит ' + PRICE + ' монет, у тебя ' + g.coins, 'warn');
      return;
    }
    g.coins -= n * PRICE;
    for (let i = 0; i < n; i++) this.spins.push({ login: g.login });
    this._line(g.name + ' крутит гачу' + (n > 1 ? ' ×' + n : '') + ' (−' + n * PRICE + ' монет)', 'buy');
    if (g.place !== 'temple' && !g.fate) {
      g.back = g.place;
      this._arrive(g, 'temple', true);
    }
    this._keep(g);
  }

  _stepGacha(dt) {
    if (!this.spinNow) {
      while (this.spins.length && !this.members.has(this.spins[0].login)) this.spins.shift();
      if (!this.spins.length) return;
      const { login } = this.spins.shift(), rush = this.spins.length >= RUSH.queue;
      this.spinNow = { id: ++this.eventId, login, result: spin(this.random), t: 0, done: false,
        spin: rush ? RUSH.spin : SPIN_TIME, show: rush ? RUSH.show : SHOW_TIME };
      this._emit('spin', { login, spinId: this.spinNow.id });
    }
    const s = this.spinNow, g = this.members.get(s.login);
    s.t += dt;
    if (!s.done && s.t >= s.spin) {
      s.done = true;
      if (g) this._prize(g, s.result);
    }
    if (s.t < s.spin + s.show) return;
    this.spinNow = null;
    const more = this.spins.some((next) => next.login === s.login);
    if (g && !more && !g.fate && g.place === 'temple') {
      const back = g.back === 'heal' && g.hp >= maxHp(g) ? 'train' : g.back || 'rest';
      this._arrive(g, back === 'temple' ? 'rest' : back, true);
    }
  }

  _prize(g, result) {
    if (result.coins) {
      g.coins += result.coins;
      this._line(g.name + ': +' + result.coins + ' монет из гачи', 'buy');
    } else if (result.kind === 'shield') {
      result.equipped = !g.shield;
      if (g.shield) this._line(g.name + ': второй щит не нужен — выброшен', 'info');
      else this._line(g.name + ' берёт щит' + (typeOf(g).hands === 2 ? ' — заработает, когда в руке не двуручник' : ''), 'level');
      g.shield = true;
    } else if (result.kind === 'net') {
      result.equipped = g.nets < NET.max;
      if (result.equipped) g.nets++;
      this._line(g.name + (result.equipped ? ' берёт сеть (сетей: ' + g.nets + ')' : ': больше ' + NET.max + ' сетей не унести — выброшена'),
        result.equipped ? 'level' : 'info');
    } else if (result.item) {
      const item = result.item, current = g[item.kind];
      if (!current || item.power > current.power) {
        g[item.kind] = item;
        result.equipped = true;
        this._line(g.name + ' надевает «' + itemText(item) + '»', 'level');
      } else {
        this._line(g.name + ': «' + itemText(item) + '» не лучше своего — выброшено', 'info');
      }
    } else {
      this._line(g.name + ': в гаче пусто', 'info');
    }
    this._emit('prize', { login: g.login, result });
    this._keep(g);
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
        const active = this.isActive(g);
        this._line(g.name + ' вылечился и ' + (active ? 'идёт тренироваться' : 'садится отдохнуть'), 'heal');
        this._arrive(g, active ? 'train' : 'rest', true);
      }
      if (g.place === 'train' && !g.walking) this._gainXp(g, TRAIN_XP * dt);
    }
    this._saveIn -= dt;
    if (this._saveIn <= 0) {
      this._saveIn = SAVE_EVERY;
      this._saveAll();
    }
  }

  // писал в чат хоть раз с начала прошлого раунда — не афк
  isActive(g) {
    return g.saidAt !== undefined && g.saidAt >= this.lastRoundStart;
  }

  _stroll(g, dt) {
    g.swing = Math.max(0, g.swing - dt);
    if (!g.walking) {
      if (g.place === 'rest' || g.place === 'heal' || g.place === 'temple') return;
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
      g.fleeT = 0;
      g.fleeCool = 0;
      g.circle = 0;
      g.stunT = 0;
      g.spearOut = null;
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
    this.projectiles = [];
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
  // цель: ближе, раненая, не убегает, ещё не окружена другими — и охотнее та, что выше уровнем
  _pickTarget(g, standing) {
    const hunted = new Map();
    for (const other of standing) if (other !== g && other.target) hunted.set(other.target, (hunted.get(other.target) || 0) + 1);
    const best = [];
    for (const other of standing) {
      if (other === g) continue;
      const d = Math.hypot(other.x - g.x, other.y - g.y);
      const busy = (hunted.get(other) || 0) - (other.target === g ? 1 : 0);
      const weak = 1 - Math.max(0, other.hp) / maxHp(other);
      const stronger = Math.min(LEVEL_PULL.cap, Math.max(0, other.level - g.level));
      best.push({ other, score: d + CROWDING * Math.max(0, busy) + (other.fleeT > 0 ? FLEE.ignored : 0) - weak * 70
        - stronger * LEVEL_PULL.per });
    }
    if (!best.length) return null;
    // взвешенный выбор: чем лучше счёт, тем вероятнее, но шанс есть и у остальных
    const top = Math.min(...best.map((b) => b.score));
    let roll = this.random() * best.reduce((sum, b) => sum + (b.w = Math.exp((top - b.score) / PICK_SOFT)), 0);
    for (const b of best) {
      roll -= b.w;
      if (roll < 0) return b.other;
    }
    return best[0].other;
  }

  _flee(g, time, why) {
    if (g.fleeT > 0 || g.fate !== 'fight') return;
    g.fleeT = time;
    g.fleeCool = time + FLEE.rest;
    g.target = null;
    this._emit('flee', { login: g.login, x: g.x, y: g.y, why });
  }

  // убегает от ближайших врагов; у стены скользит вдоль неё, а не упирается
  _runAway(g, standing, dt) {
    let ax = 0, ay = 0;
    for (const other of standing) {
      if (other === g || other.fleeT > 0) continue;
      const dx = g.x - other.x, dy = g.y - other.y, d = Math.hypot(dx, dy) || 1;
      if (d > FLEE.sense) continue;
      ax += dx / d * (FLEE.sense - d);
      ay += dy / d * (FLEE.sense - d);
    }
    if (!ax && !ay) {
      ax = g.x - ARENA.cx;
      ay = g.y - ARENA.cy;
    }
    const cx = (g.x - ARENA.cx) / ARENA.rx, cy = (g.y - ARENA.cy) / ARENA.ry, edge = Math.hypot(cx, cy);
    if (edge > 0.75) {
      const len = Math.hypot(ax, ay) || 1, tx = -cy, ty = cx, side = tx * ax + ty * ay >= 0 ? 1 : -1;
      const pull = (edge - 0.75) * 4;
      ax = ax / len - cx * pull + tx * side * pull;
      ay = ay / len - cy * pull + ty * side * pull;
    }
    const len = Math.hypot(ax, ay) || 1, speed = MOVE_SPEED * FLEE.speed * (1 + 0.01 * g.agi);
    g.x += ax / len * speed * dt;
    g.y += ay / len * speed * dt;
    if (Math.abs(ax) > 0.01) g.face = ax > 0 ? 1 : -1;
    g.walking = true;
  }

  _stepBattle(dt) {
    const standing = this._standing();
    for (const g of this.fighters) {
      g.swing = Math.max(0, g.swing - dt);
      g.flash = Math.max(0, g.flash - dt);
    }
    this._stepProjectiles(dt);
    for (const g of standing) {
      if (g.fate !== 'fight') continue;
      g.retarget -= dt;
      g.cool = Math.max(0, g.cool - dt);
      g.fleeT = Math.max(0, (g.fleeT || 0) - dt);
      g.fleeCool = Math.max(0, (g.fleeCool || 0) - dt);
      if (g.stunT > 0) {
        // в сети: стоит, не бьёт и не убегает
        g.stunT = Math.max(0, g.stunT - dt);
        g.walking = false;
        continue;
      }
      if (g.fleeT <= 0 && g.fleeCool <= 0 && g.hp < maxHp(g) * FLEE.low && this._standing().length > 2) {
        this._flee(g, FLEE.lowTime[0] + this.random() * FLEE.lowTime[1], 'low');
      }
      if (g.fleeT > 0) {
        this._runAway(g, standing, dt);
        continue;
      }
      if (g.spearOut) {
        // бросил копьё — ждёт, пока долетит, потом бежит подбирать
        if (g.spearOut.flying) {
          g.walking = false;
          continue;
        }
        if (this._walkTo(g, g.spearOut.x, g.spearOut.y, dt) < SPEAR.pickup) {
          g.spearOut = null;
          this._emit('pickup', { login: g.login, x: g.x, y: g.y });
        }
        continue;
      }
      const fighting = standing.filter((s) => s.fate === 'fight');
      const t0 = g.target;
      const prey = t0 && this._canThrowSpear(g, t0);
      // цель убегает, а рядом есть другие — переключиться почти сразу (копейщик сначала пробует метнуть)
      if (t0 && t0.fleeT > 0 && !prey && fighting.some((s) => s !== g && s !== t0 && !(s.fleeT > 0))) {
        g.retarget = Math.min(g.retarget, 0.2 + this.random() * 0.3);
      }
      if (!g.target || g.target.fate !== 'fight' || g.retarget <= 0) {
        g.target = this._pickTarget(g, fighting);
        g.retarget = RETARGET[0] + this.random() * RETARGET[1];
      }
      const t = g.target;
      if (!t) {
        g.walking = false;
        continue;
      }
      const dx = t.x - g.x, dy = t.y - g.y, d = Math.hypot(dx, dy) || 1;
      if (Math.abs(dx) > 2) g.face = dx > 0 ? 1 : -1;
      if (g.cool <= 0 && this._canThrowSpear(g, t)) {
        this._throw(g, t, 'spear');
        g.cool = attackEvery(g);
        continue;
      }
      if (g.nets > 0 && !(t.stunT > 0) && d >= NET.range[0] && d <= NET.range[1] && this.random() < dt * NET.chance) {
        g.nets--;
        this._throw(g, t, 'net');
        continue;
      }
      const reach = reachOf(g);
      if (d > reach) {
        const speed = MOVE_SPEED * (1 + 0.01 * g.agi);
        const stepLen = Math.min(d - reach * 0.8, speed * dt);
        g.x += dx / d * stepLen;
        g.y += dy / d * stepLen;
        g.walking = true;
      } else if (g.cool <= 0) {
        g.walking = false;
        this._swing(g, t, fighting);
        g.cool = attackEvery(g) * (0.9 + this.random() * 0.2);
      } else {
        // между ударами кружит вокруг противника
        if (!g.circle || this.random() < dt * 0.4) g.circle = this.random() < 0.5 ? -1 : 1;
        const step = MOVE_SPEED * CIRCLE * dt;
        g.x += -dy / d * g.circle * step;
        g.y += dx / d * g.circle * step;
        g.walking = g.cool > 0.25;
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

  _walkTo(g, x, y, dt) {
    const dx = x - g.x, dy = y - g.y, d = Math.hypot(dx, dy);
    if (d < 1) return d;
    const stepLen = Math.min(d, MOVE_SPEED * 1.1 * dt);
    g.x += dx / d * stepLen;
    g.y += dy / d * stepLen;
    if (Math.abs(dx) > 1) g.face = dx > 0 ? 1 : -1;
    g.walking = true;
    return d - stepLen;
  }

  // копьё метают в убегающего и израненного, если он не слишком далеко
  _canThrowSpear(g, t) {
    if (!g.weapon || g.weapon.type !== 'spear' || g.spearOut || t.fate !== 'fight' || !(t.fleeT > 0)) return false;
    const d = Math.hypot(t.x - g.x, t.y - g.y);
    return t.hp < maxHp(t) * SPEAR.low && d >= SPEAR.range[0] && d <= SPEAR.range[1];
  }

  _throw(g, t, kind) {
    g.swing = 0.3;
    if (kind === 'spear') g.spearOut = { x: g.x, y: g.y, flying: true };
    this.projectiles.push({ kind, from: g, to: t, x: g.x, y: g.y - 30, speed: kind === 'spear' ? SPEAR.speed : NET.speed,
      angle: 0 });
    this._emit('throw', { login: g.login, kind, x: g.x, y: g.y });
    if (kind === 'net') this._line(g.name + ' бросает сеть в ' + t.name, 'info');
  }

  // снаряд летит за целью; долетел — удар копьём или сеть
  _stepProjectiles(dt) {
    for (const p of this.projectiles) {
      const tx = p.to.x, ty = p.to.y - 30, dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      p.angle = Math.atan2(dy, dx);
      const stepLen = p.speed * dt;
      if (d > Math.max(12, stepLen)) {
        p.x += dx / d * stepLen;
        p.y += dy / d * stepLen;
        continue;
      }
      p.done = true;
      const a = p.from, t = p.to, alive = t.fate === 'fight';
      if (p.kind === 'spear') {
        if (alive && a.fate === 'fight') this._attack(a, t, { mult: typeOf(a).throw, ranged: true });
        a.spearOut = { x: t.x + (this.random() - 0.5) * 30, y: t.y + 4 + this.random() * 10 };
        clampToArena(a.spearOut, 30);
      } else if (alive) {
        this._net(a, t);
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.done);
  }

  _net(a, t) {
    if (this.random() < dodgeOf(t)) {
      this._emit('miss', { x: t.x, y: t.y, login: t.login });
      return;
    }
    if (this._blocked(t)) return;
    t.stunT = NET.stun;
    t.fleeT = 0;
    t.target = null;
    t.flash = 0.18;
    if (a.fate === 'fight') {
      a.target = t;
      a.retarget = NET.focus;
    }
    this._emit('stun', { login: t.login, x: t.x, y: t.y, from: a.login });
    this._line(a.name + ' опутал сетью ' + t.name, 'down');
  }

  // щит: шанс отбить любой удар, при отбитии иногда ломается
  _blocked(d) {
    if (!shieldUp(d) || d.stunT > 0 || this.random() >= SHIELD.block) return false;
    this._emit('block', { login: d.login, x: d.x, y: d.y });
    if (this.random() < SHIELD.breaks) {
      d.shield = false;
      this._emit('shieldbreak', { login: d.login, x: d.x, y: d.y });
      this._line('У ' + d.name + ' раскололся щит', 'warn');
    }
    return true;
  }

  // двуручник бьёт всех перед собой в пределах досягаемости
  _swing(a, t, fighting) {
    if (!typeOf(a).cleave) {
      this._attack(a, t);
      return;
    }
    const reach = reachOf(a) * 1.15;
    const victims = fighting.filter((v) => v !== a && v.fate === 'fight' && (v === t
      || (v.x - a.x) * a.face > -6 && Math.hypot(v.x - a.x, v.y - a.y) <= reach));
    for (const v of victims) if (v.fate === 'fight') this._attack(a, v);
  }

  _attack(a, d, { mult = 1, ranged = false } = {}) {
    if (!ranged) a.swing = 0.3;
    const stunned = d.stunT > 0;
    if (!stunned && this.random() < dodgeOf(d)) {
      this._emit('miss', { x: d.x, y: d.y, login: d.login });
      return;
    }
    if (this._blocked(d)) return;
    const crit = this.random() < critOf(a);
    const armor = typeOf(a).pierce ? 0 : armorOf(d);
    let dmg = damageOf(a) * mult * (1 + SPREAD * (2 * this.random() - 1)) * (crit ? CRIT_HIT : 1) * (1 - armor);
    dmg = Math.max(1, Math.round(dmg));
    d.hp -= dmg;
    d.flash = 0.18;
    a.dealt += dmg;
    this._emit('hit', { x: d.x, y: d.y, amount: dmg, crit, login: d.login, from: a.login, ranged });
    if (d.hp <= 0) {
      this._knockOut(d, a);
      return;
    }
    if (crit && this.random() < FLEE.critChance) this._flee(d, FLEE.critTime[0] + this.random() * FLEE.critTime[1], 'crit');
    // ударили сбоку — может развернуться на обидчика
    else if (d.target !== a && !(d.fleeT > 0) && this.random() < REVENGE) {
      d.target = a;
      d.retarget = RETARGET[0] + this.random() * RETARGET[1];
    }
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
    this.projectiles = [];
    for (const g of this.members.values()) {
      g.spearOut = null;
      g.stunT = 0;
    }
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
    this._stepGacha(dt);
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
