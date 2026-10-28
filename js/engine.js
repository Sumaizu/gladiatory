import { AFK_ROUNDS, CRIT_KILL, TEAMS, BLEED, HIT_REWARD, PARAGON, pitStrength, powerOf, BEATEN_HP, HEAL_RATE, LEVEL_MAX, MOVE_SPEED, POINTS_PER_LEVEL, REACH, BODY, REWARD, START_COINS,
  START_POINTS, STATS, TRAIN_XP, SLOT_IDS, PIT, DUEL, emptyGear, NET, SHIELD, SPEAR, armorOf, netUp, reachOf, shieldUp, typeOf, attackEvery, critOf, crowdBonus, runOf, damageOf, deathChance, dodgeOf, maxHp, xpNeed,
  CRIT_HIT, SPREAD } from './balance.js';
import { ARENA, DUMMIES, ENTRANCE, PLACES, clampToArena, pointIn } from './places.js';
import { DIVINE, PRICE, QUEUE_CAP, RUSH, SHOW_TIME, SPIN_TIME, cleanItem, itemText, rankOf, spin } from './gacha.js';

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
const GACHA_CLOSE = 5;
// если до лудильни не дойти (застрял, увели), крутка всё равно начнётся через столько секунд
const TEMPLE_WAIT = 6;
// враг выше уровнем притягивает: за каждый уровень разницы цель «ближе» на per пикселей, не больше cap уровней
const LEVEL_PULL = { per: 70, cap: 4 };
const PICK_SOFT = 50;
// с кровотечением двигается медленнее
const pace = (g) => (g.bleedT > 0 ? 1 - BLEED.slow : 1);
const CIRCLE = 0.3;
export { AFK_ROUNDS };
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const INVISIBLE = /[​‌‍⁠﻿­͏⠀\u{E0000}]/gu;
const IGNORED = new Set(BOTS);
const SAVED = ['name', 'color', 'level', 'xp', 'coins', 'str', 'agi', 'vit', 'points', 'weapon', 'gear', 'shield',
  'nets', 'amulet', 'hp',
  'fights', 'wins', 'kos', 'kills', 'paragon', 'born'];
const COUNTS = ['level', 'xp', 'coins', 'str', 'agi', 'vit', 'points', 'nets', 'fights', 'wins', 'kos',
  'kills', 'paragon'];

const PLACE_BY_WORD = new Map();
for (const [id, place] of Object.entries(PLACES)) for (const word of place.words) PLACE_BY_WORD.set(word, id);
const STAT_BY_WORD = new Map();
for (const stat of STATS) for (const word of stat.words) STAT_BY_WORD.set(word, stat.id);

function hashColor(login) {
  let h = 0;
  for (const ch of login) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// ник того же цвета, что в твиче; слишком тёмный осветляем, не меняя оттенка (как в Чатобороне)
export function readableColor(color, login) {
  if (!COLOR_RE.test(color || '')) return hashColor(login);
  const n = parseInt(color.slice(1), 16);
  let rgb = [n >> 16, (n >> 8) & 255, n & 255];
  const light = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  if (light < 0.45) {
    const lift = (0.45 - light) / (1 - light);
    rgb = rgb.map((c) => Math.round(c + (255 - c) * lift));
  }
  return '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');
}

export function newGladiator(login, name, color, now, paragon = 0) {
  return { login, name, color, level: 1, xp: 0, coins: START_COINS + PARAGON.coins * paragon, str: 0, agi: 0, vit: 0,
    points: START_POINTS + PARAGON.points * paragon, weapon: null, gear: emptyGear(), shield: false, nets: 0, amulet: false,
    paragon, hp: 1, fights: 0, wins: 0, kos: 0, kills: 0, born: now };
}

export class Roster {
  constructor(storage = null, key = 'gladiatory.roster') {
    this.storage = storage;
    this.key = key;
    this.data = new Map();
    this.fallen = [];
    // парагон остаётся за логином и после смерти
    this.paragons = new Map();
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
        g.gear = emptyGear();
        for (const slot of SLOT_IDS) g.gear[slot] = cleanItem(entry.gear && entry.gear[slot], 'armor');
        // старые сохранения: один доспех — в слот «тело»
        if (!entry.gear && entry.armor) g.gear.body = cleanItem(Object.assign({}, entry.armor, { slot: 'body' }), 'armor');
        for (const slot of SLOT_IDS) if (g.gear[slot]) g.gear[slot].slot = slot;
        g.shield = entry.shield === true;
        g.amulet = entry.amulet === true;
        g.nets = Math.min(NET.max, g.nets);
        g.hp = Number.isFinite(Number(entry.hp)) ? Math.max(0.01, Math.min(1, Number(entry.hp))) : 1;
        this.data.set(login, g);
      }
      for (const [login, n] of Object.entries(saved.paragons || {})) {
        if (Number(n) > 0) this.paragons.set(login, Math.trunc(Number(n)));
      }
      this.fallen = (Array.isArray(saved.fallen) ? saved.fallen : []).filter((f) => f && f.name).slice(0, FALLEN_MAX)
        .map((f) => ({ name: String(f.name), level: Math.max(1, Math.trunc(Number(f.level)) || 1),
          fights: Math.max(0, Math.trunc(Number(f.fights)) || 0), kills: Math.max(0, Math.trunc(Number(f.kills)) || 0),
          by: String(f.by || ''), at: Number(f.at) || 0 }));
    } catch (error) {
      this.data = new Map();
      this.fallen = [];
      this.paragons = new Map();
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
    for (const field of SAVED) entry[field] = g[field] && typeof g[field] === 'object' ? JSON.parse(JSON.stringify(g[field])) : g[field];
    entry.hp = Math.max(0.01, Math.min(1, g.hp / maxHp(g)));
    entry.hp = Math.round(entry.hp * 1000) / 1000;
    this.data.set(g.login, entry);
    if (g.paragon > 0) this.paragons.set(g.login, g.paragon);
  }

  bury(g, by, at) {
    this.data.delete(g.login);
    this.fallen.unshift({ name: g.name, level: g.level, fights: g.fights, kills: g.kills, by: by || '', at });
    this.fallen.length = Math.min(this.fallen.length, FALLEN_MAX);
  }

  reset() {
    this.data = new Map();
    this.fallen = [];
    this.paragons = new Map();
    this.save();
  }

  save() {
    if (!this.storage) return;
    try {
      const alive = {};
      for (const [login, entry] of this.data) alive[login] = entry;
      this.storage.setItem(this.key, JSON.stringify({ alive, fallen: this.fallen,
        paragons: Object.fromEntries(this.paragons) }));
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
    this.spins = [];
    this.spinNow = null;
    this.projectiles = [];
    this.duel = null;
    this.roundStarts = [];
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
    if (this.state === 'stopped') this.roundStarts = [];
    this.roundStarts.push(this.clock);
    if (this.roundStarts.length > AFK_ROUNDS) this.roundStarts.shift();
    this.state = 'ludus';
    this.paused = false;
    this.timer = this.settings.ludus;
    // режим следующего боя известен заранее — его пишут сверху лудуса; дорос до парагона — его испытание первым делом
    this.rolledMode = this.forceMode || this._rollMode();
    this.nextBoss = null;
    this._planNext();
    this.fighters = [];
    this.endIn = null;
    this.notice = '';
    this._emit('phase', { state: 'ludus' });
  }

  stop() {
    // недокрученную гачу возвращаем монетами (в очереди деньги ещё не сняты)
    if (this.spinNow && !this.spinNow.done) {
      const g = this.members.get(this.spinNow.login);
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
    else if (this.state === 'battle' && this.duel && this.duel.betting) this._duelFight();
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

  // не на арене: ждут следующего боя на песке или в лазарете, а со скамьи просто смотрят
  get waiting() {
    if (this.state !== 'battle') return 0;
    let n = 0;
    for (const g of this.members.values()) if (!g.fate && g.place !== 'rest') n++;
    return n;
  }

  get watching() {
    if (this.state !== 'battle') return 0;
    let n = 0;
    for (const g of this.members.values()) if (!g.fate && g.place === 'rest') n++;
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
    // сменил цвет в твиче — ник в игре меняется вместе с ним
    else if (COLOR_RE.test(meta.color || '')) g.color = readableColor(meta.color, login);
    g.saidAt = this.clock;
    // афк со скамьи написал хоть что-то — снова в деле: раненый в лазарет, здоровый на тренировку
    if (g.afk && !g.fate && g.place === 'rest') {
      const hurt = g.hp < maxHp(g);
      this._line(g.name + ' вернулся и ' + (hurt ? 'идёт в лазарет' : 'идёт тренироваться'), 'info');
      this._arrive(g, hurt ? 'heal' : 'train', true);
    }
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
      g = Object.assign(newGladiator(login, saved.name, saved.color, saved.born), JSON.parse(JSON.stringify(saved)), { login });
      if (COLOR_RE.test(color || '')) g.color = readableColor(color, login);
      // вернулся в игру — раны прошлых боёв успели зажить
      g.hp = maxHp(g);
      this._line(g.name + ' возвращается в лудус', 'join');
    } else {
      g = newGladiator(login, name.slice(0, NAME_MAX), readableColor(color, login), this.now(),
        this.roster.paragons.get(login) || 0);
      g.hp = maxHp(g);
      const fell = this.roster.fallen.find((f) => f.name.toLowerCase() === login);
      this._line(fell ? g.name + ' начинает заново новым бойцом' : 'Новый гладиатор: ' + g.name, 'join');
      this.roster.put(g);
      this.roster.save();
    }
    g.name = name.slice(0, NAME_MAX) || g.name;
    g.fate = null;
    this.members.set(login, g);
    // только что написал — значит, в деле: сразу на тренировку
    this._arrive(g, 'train');
    this._emit('join', { login });
    return g;
  }

  _command(g, word, arg) {
    if (!word) return;
    if (CARD_WORDS.has(word)) {
      this._showCard(g);
      return;
    }
    if ((word === '1' || word === '2') && this.duel && this.duel.betting) {
      this._bet(g, Number(word));
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

  // монеты снимаются в момент прокрутки; в очередь — не больше, чем хватает денег
  _gacha(g, arg) {
    const queued = this.spins.filter((s) => s.login === g.login).length;
    const afford = Math.floor(g.coins / PRICE) - queued;
    const wanted = arg === 'все' || arg === 'всё' ? afford : Math.max(1, Math.trunc(Number(arg)) || 1);
    const n = Math.min(wanted, afford, QUEUE_CAP - queued);
    if (n <= 0) {
      this._line(afford > 0 ? g.name + ': очередь полна, подожди'
        : g.name + ': гача стоит ' + PRICE + ' монет, у тебя ' + g.coins + (queued ? ' (и ' + queued + ' в очереди)' : ''),
      'warn');
      return;
    }
    for (let i = 0; i < n; i++) this.spins.push({ login: g.login });
    const open = this._gachaOpen(SPIN_TIME), later = open ? '' : ' — закрутится после боя';
    if (open) this._toTemple(g);
    this._line(g.name + ' встаёт в очередь гачи' + (n > 1 ? ' ×' + n : '') + later, 'buy');
  }

  // гача крутится в лудусе, пока до боя больше GACHA_CLOSE секунд (и приз успеет выпасть), и на итогах
  _gachaOpen(spinTime) {
    if (this.state === 'ludus') return this.timer > GACHA_CLOSE + spinTime;
    return this.state === 'results';
  }

  _stepGacha(dt) {
    if (!this.spinNow) {
      const rush = this.spins.length > RUSH.queue, time = rush ? RUSH.spin : SPIN_TIME;
      if (!this._gachaOpen(time)) return;
      while (this.spins.length) {
        const head = this.members.get(this.spins[0].login);
        if (head && head.coins >= PRICE) break;
        if (head) this._line(head.name + ': на гачу не хватило монет', 'warn');
        this.spins.shift();
      }
      if (!this.spins.length) return;
      const head = this.spins[0], g = this.members.get(head.login);
      // крутка начинается, когда гладиатор дошёл до лудильни
      if (!g.fate && (g.place !== 'temple' || g.walking)) {
        if (g.place !== 'temple') this._toTemple(g);
        head.wait = (head.wait || 0) + dt;
        if (head.wait < TEMPLE_WAIT) return;
      }
      this.spins.shift();
      g.coins -= PRICE;
      this.spinNow = { id: ++this.eventId, login: g.login, result: spin(this.random, g), t: 0, done: false, paid: true,
        spin: time, show: rush ? RUSH.show : SHOW_TIME };
      this._emit('spin', { login: g.login, spinId: this.spinNow.id });
      this._keep(g);
    }
    const s = this.spinNow, g = this.members.get(s.login);
    s.t += dt;
    if (!s.done && s.t >= s.spin) {
      s.done = true;
      if (g) this._prize(g, s.result);
    }
    if (s.t < s.spin + s.show) return;
    this._closeSpin();
  }

  _toTemple(g) {
    if (g.fate || g.place === 'temple') return;
    g.back = g.place;
    this._arrive(g, 'temple', true);
  }

  _closeSpin() {
    const s = this.spinNow, g = s && this.members.get(s.login);
    this.spinNow = null;
    if (!s) return;
    if (!s.done && g) {
      // не докрутили — монеты назад, прокрутка снова в начало очереди
      g.coins += PRICE;
      this.spins.unshift({ login: s.login });
    }
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
      result.equipped = !g.shield && !(g.nets > 0);
      if (result.equipped) {
        g.shield = true;
        this._line(g.name + ' берёт щит', 'level');
      } else {
        this._line(g.name + ': вторая рука занята — щит выброшен', 'info');
      }
    } else if (result.kind === 'amulet') {
      result.equipped = !g.amulet;
      g.amulet = true;
      this._line(g.name + ' надевает божественный амулет — он спасёт от смерти', 'champion');
    } else if (result.kind === 'net') {
      result.equipped = !g.shield && !(g.nets > 0);
      if (result.equipped) g.nets = 1;
      this._line(g.name + (result.equipped ? ' берёт сеть' : ': вторая рука занята — сеть выброшена'),
        result.equipped ? 'level' : 'info');
    } else if (result.item) {
      const item = result.item;
      if (item.kind === 'armor' && !g.gear) g.gear = emptyGear();
      const current = item.kind === 'armor' ? g.gear[item.slot] : g.weapon;
      if (current && current.rarity === DIVINE.id) {
        result.locked = true;
        this._line(g.name + ': божественную вещь гача не меняет — «' + itemText(item) + '» выброшено', 'info');
      // оружие той же редкости или выше заменяет старое, даже если урон меньше; доспех — только если крепче
      } else if (!current || (item.kind === 'weapon' ? rankOf(item) >= rankOf(current) : item.power > current.power)) {
        if (item.kind === 'armor') g.gear[item.slot] = item;
        else g.weapon = item;
        result.equipped = true;
        this._line(g.name + ' надевает «' + itemText(item) + '»', 'level');
      } else {
        this._line(g.name + ': «' + itemText(item) + '» ' + (item.kind === 'weapon' ? 'реже своего' : 'не лучше своего')
          + ' — выброшено', 'info');
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


  // --- лудус ---

  // в отдыхе и лазарете у каждого своё место: сидит или лежит, пока его не отправят дальше
  _arrive(g, place, walk = false) {
    g.place = place;
    g.afk = false;
    // сел на скамью или встал с неё — мог появиться или пропасть претендент на парагон
    if (this.members.get(g.login) === g) this._planNext();
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
        g.afk = !active;
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
  // писал ли хоть что-то за последние AFK_ROUNDS раундов, считая текущий
  isActive(g) {
    return g.saidAt !== undefined && g.saidAt >= (this.roundStarts[0] ?? 0);
  }

  _stroll(g, dt) {
    g.swing = Math.max(0, g.swing - dt);
    if (!g.walking) {
      if (g.place === 'rest' || g.place === 'heal' || g.place === 'temple') return;
      g.wait -= dt;
      if (g.place === 'train' && g.swing <= 0 && this.random() < dt * 1.6) {
        g.swing = 0.3;
        g.jab = (g.jab || 0) + 1;
      }
      if (g.wait > 0) return;
      const p = this._spot(g, g.place);
      g.tx = p.x;
      g.ty = p.y;
      g.walking = true;
      return;
    }
    const dx = g.tx - g.x, dy = g.ty - g.y, d = Math.hypot(dx, dy);
    const speed = MOVE_SPEED * STROLL * runOf(g);
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
      if (g.level >= PARAGON.level) this._planNext();
    }
    return ups;
  }

  // кто будет в следующем бою: пересчитываем при каждом изменении в лудусе — дорос, зашёл в игру, встал со скамьи
  // или ушёл на неё. Есть претендент на парагон — его испытание, нет — режим, выпавший в начале лудуса
  _planNext() {
    if (this.state !== 'ludus') return;
    const boss = this.forceMode ? null : this._paragonNext();
    if (boss && boss !== this.nextBoss) this._line(boss.name + ' дорос до парагона — следующий бой он один против всех!', 'champion');
    this.nextBoss = boss;
    this.nextMode = boss ? 'paragon' : this.rolledMode;
  }

  // --- бой ---

  _startBattle() {
    // кто сидит на скамье в зоне отдыха, в бой не идёт — смотрит со стороны
    const ready = Array.from(this.members.values()).filter((g) => g.place !== 'rest');
    if (ready.length < MIN_FIGHTERS) {
      this.timer = this.settings.ludus;
      this.notice = 'Нужно хотя бы ' + MIN_FIGHTERS + ' гладиатора не на отдыхе — бой откладывается';
      this._line(this.notice, 'warn');
      return false;
    }
    this.notice = '';
    if (this.spinNow) this._closeSpin();
    this.state = 'battle';
    this.timer = this.settings.battle;
    this.endIn = null;
    this.cards = [];
    const boss = this.forceMode ? null : this._paragonNext(ready);
    this.mode = this.forceMode || (boss ? 'paragon' : this.rolledMode || this._rollMode());
    this.nextMode = null;
    this.nextBoss = null;
    this.boss = this.mode === 'paragon' ? boss : null;
    if (this.boss) {
      // испытание: здоровье и урон вдвое (текущее здоровье растёт в той же пропорции)
      const was = maxHp(this.boss);
      this.boss.might = PARAGON.boost;
      this.boss.hp *= maxHp(this.boss) / was;
    }
    this.duel = null;
    if (this.mode === 'duel') {
      // двое случайных: первый встаёт слева (ставка «1»), второй справа (ставка «2»)
      const pool = ready.slice(), pair = [];
      for (let i = 0; i < 2; i++) pair.push(pool.splice(Math.floor(this.random() * pool.length), 1)[0]);
      this.duel = { left: pair[0], right: pair[1], bets: new Map(), betting: true, winner: null };
      ready.length = 0;
      ready.push(...pair);
      this.timer = DUEL.bet;
    }
    for (const g of this.members.values()) g.team = null;
    if (this.mode === 'teams') {
      // случайно, но поровну: перемешиваем и раздаём через одного; лишний при нечётном — в случайную команду
      const order = ready.slice();
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const first = this.random() < 0.5 ? 'red' : 'blue', second = first === 'red' ? 'blue' : 'red';
      order.forEach((g, i) => {
        g.team = i % 2 === 0 ? first : second;
      });
    }
    const lions = this.mode === 'pit' ? this._lions(ready) : [];
    this.fighters = ready.concat(lions);
    const all = this.fighters, n = ready.length;
    const spots = this.duel ? [{ x: ARENA.cx - DUEL.gap, y: ARENA.cy + 10 }, { x: ARENA.cx + DUEL.gap, y: ARENA.cy + 10 }]
      : this._spots(all.length);
    // в стенке красные начинают слева, синие справа
    if (this.mode === 'teams') spots.sort((a, b) => a.x - b.x);
    const side = this.mode === 'teams' ? all.slice().sort((a, b) => (a.team === 'red' ? 0 : 1) - (b.team === 'red' ? 0 : 1))
      : all;
    side.forEach((g, i) => {
      g.x = spots[i].x;
      g.y = spots[i].y;
    });
    all.forEach((g) => {
      g.hp = Math.min(g.hp, maxHp(g));
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
      g.netCool = 0;
      g.spearOut = null;
      g.spearCool = 0;
      g.savedNow = false;
      g.bleedT = 0;
      g.bledBy = null;
      g.bleedLoss = 0;
      g.lastX = undefined;
      g.hitsNow = 0;
      g.by = '';
    });
    // соседи становятся парами — бой сразу распадается на поединки по всей арене (в яме цели ищут сами)
    const free = new Set(this.mode === 'ffa' ? ready : []);
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
    if (this.duel) {
      this.duel.left.face = 1;
      this.duel.right.face = -1;
    }
    if (this.boss) {
      // парагон в центре, остальные вокруг
      const b = this.boss, near = all.filter((g) => g !== b && Math.hypot(g.x - ARENA.cx, g.y - ARENA.cy) < 90);
      for (const g of near) {
        const a = Math.atan2(g.y - ARENA.cy, g.x - ARENA.cx) || this.random() * 6.28;
        g.x = ARENA.cx + Math.cos(a) * 120;
        g.y = ARENA.cy + Math.sin(a) * 90;
      }
      b.x = ARENA.cx;
      b.y = ARENA.cy;
    }
    this.projectiles = [];
    if (this.duel) {
      this._line('Дуэль! ' + this.duel.left.name + ' против ' + this.duel.right.name + '. Ставки: 1 — за '
        + this.duel.left.name + ', 2 — за ' + this.duel.right.name, 'battle');
    } else if (this.mode === 'teams') {
      const red = ready.filter((g) => g.team === 'red').length;
      this._line('Стенка на стенку! Красные (' + red + ') против синих (' + (n - red) + ')', 'battle');
    } else if (this.boss) {
      this._line('Испытание парагона! ' + this.boss.name + ' (' + this.boss.level + ' ур.) против всех: ' + (n - 1) + ' '
        + plural(n - 1, 'гладиатор', 'гладиатора', 'гладиаторов'), 'champion');
    } else if (this.mode === 'pit') {
      this._line('Яма со львами! ' + lions.length + ' ' + plural(lions.length, 'лев', 'льва', 'львов') + ' против ' + n + ' '
        + plural(n, 'гладиатора', 'гладиаторов', 'гладиаторов'), 'battle');
    } else {
      this._line('Бой начинается! На арене ' + n + ' ' + plural(n, 'гладиатор', 'гладиатора', 'гладиаторов'), 'battle');
    }
    this._emit('phase', { state: 'battle', mode: this.mode });
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

  // ставка зрителя: последняя считается; бойцы не ставят
  _bet(g, side) {
    const d = this.duel;
    if (g === d.left || g === d.right) {
      this._line(g.name + ': участники дуэли не ставят', 'warn');
      return;
    }
    const was = d.bets.get(g.login);
    d.bets.set(g.login, side);
    if (was !== side) this._emit('bet', { login: g.login, side });
  }

  betsOn(side) {
    let n = 0;
    if (this.duel) for (const s of this.duel.bets.values()) if (s === side) n++;
    return n;
  }

  _duelFight() {
    const d = this.duel;
    d.betting = false;
    this.timer = this.settings.battle;
    const a = this.betsOn(1), b = this.betsOn(2);
    d.left.target = d.right;
    d.right.target = d.left;
    this._line('Ставки сделаны: за ' + d.left.name + ' — ' + a + ', за ' + d.right.name + ' — ' + b + '. Бой!', 'battle');
    this._emit('phase', { state: 'battle', mode: 'duel', fight: true });
  }

  // кто дорос до парагона, провёл нужное число боёв и не сидит на скамье — выходит один против всех
  // (по одному за бой, старший первым)
  _paragonNext(pool = null) {
    let best = null;
    for (const g of pool || this.members.values()) {
      if (g.lion || g.level < PARAGON.level || g.fights < PARAGON.fights || g.place === 'rest') continue;
      if (!best || g.level > best.level || g.level === best.level && g.xp > best.xp) best = g;
    }
    if (!best) return null;
    // одному не с кем драться
    const others = (pool || Array.from(this.members.values())).filter((g) => g !== best && g.place !== 'rest');
    return others.length ? best : null;
  }

  _rollMode() {
    const roll = this.random();
    const rest = 1 - PIT.chance - DUEL.chance;
    return roll < PIT.chance ? 'pit' : roll < PIT.chance + DUEL.chance ? 'duel'
      : roll < PIT.chance + DUEL.chance + rest * TEAMS.share ? 'teams' : 'ffa';
  }

  // львы для «Ямы со львами»: не гладиаторы, в лудус и сохранение не попадают
  _lions(people) {
    const count = Math.max(1, Math.min(PIT.max, Math.round(people.length / PIT.per)));
    // сила стороны — (сумма урона в секунду) × (сумма живучести); львы получают strength от силы гладиаторов
    let dps = 0, ehp = 0;
    for (const g of people) {
      // раненый выходит с тем здоровьем, что есть, — львы под него слабее
      const p = powerOf(g);
      dps += p.dps;
      ehp += p.ehp * Math.max(0.1, Math.min(1, g.hp / maxHp(g)));
    }
    const lions = [];
    for (let i = 0; i < count; i++) {
      lions.push(Object.assign(newGladiator('lion' + (i + 1), 'Лев', '#c98a3e', 0), PIT.lion, { lion: true,
        weapon: { kind: 'weapon', type: 'claws', rarity: 'common', power: 0 }, points: 0 }));
    }
    const one = powerOf(lions[0]);
    // сила львов растёт как might² (здоровье и урон сразу)
    const even = Math.sqrt(pitStrength(people.length) * dps * ehp / (count * count * one.dps * one.ehp));
    // новички без вещей против льва слабее, чем выходит по формуле, а одетые ветераны — сильнее: чуть выравниваем
    const [pivot, tilt] = PIT.tilt, might = pivot * Math.pow(even / pivot, tilt);
    for (const lion of lions) {
      lion.might = Math.max(PIT.might[0], Math.min(PIT.might[1], might));
      lion.hp = maxHp(lion);
    }
    return lions;
  }

  // в обычном бою враги все, в яме — только другая сторона
  _enemy(a, b) {
    if (a === b) return false;
    if (this.mode === 'pit') return Boolean(a.lion) !== Boolean(b.lion);
    if (this.boss) return (a === this.boss) !== (b === this.boss);
    if (this.mode === 'teams') return a.team !== b.team;
    return true;
  }

  // ищем ближайшего, но кого ещё мало кто бьёт: толпа распадается на поединки
  // цель: ближе, раненая, не убегает, ещё не окружена другими — и охотнее та, что выше уровнем
  _pickTarget(g, standing) {
    const hunted = new Map();
    for (const other of standing) if (other !== g && other.target) hunted.set(other.target, (hunted.get(other.target) || 0) + 1);
    const best = [];
    for (const other of standing) {
      if (!this._enemy(g, other)) continue;
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
    // в сети не убежать, пока она не спадёт
    if (g.fleeT > 0 || g.stunT > 0 || g.fate !== 'fight') return;
    g.fleeT = time;
    g.fleeCool = time + FLEE.rest;
    g.target = null;
    this._emit('flee', { login: g.login, x: g.x, y: g.y, why });
  }

  // убегает от ближайших врагов; у стены скользит вдоль неё, а не упирается
  _runAway(g, standing, dt) {
    let ax = 0, ay = 0;
    for (const other of standing) {
      if (!this._enemy(g, other) || other.fleeT > 0) continue;
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
    const len = Math.hypot(ax, ay) || 1, speed = MOVE_SPEED * FLEE.speed * runOf(g) * pace(g);
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
    if (this.duel && this.duel.betting) {
      for (const g of standing) g.walking = false;
      return;
    }
    this._stepProjectiles(dt);
    for (const g of standing) {
      if (g.fate !== 'fight') continue;
      g.retarget -= dt;
      g.cool = Math.max(0, g.cool - dt);
      g.fleeT = Math.max(0, (g.fleeT || 0) - dt);
      g.fleeCool = Math.max(0, (g.fleeCool || 0) - dt);
      g.netCool = Math.max(0, (g.netCool || 0) - dt);
      g.spearCool = Math.max(0, (g.spearCool || 0) - dt);
      if (g.bleedT > 0) {
        // кровотечение: теряет здоровье, только если за прошлый такт и правда сдвинулся с места
        g.bleedT = Math.max(0, g.bleedT - dt);
        const moved = g.lastX !== undefined && Math.hypot(g.x - g.lastX, g.y - g.lastY) > 0.5;
        if (moved) {
          const loss = BLEED.share / BLEED.time * maxHp(g) * dt;
          g.hp -= loss;
          g.bleedLoss = (g.bleedLoss || 0) + loss;
        }
        // накапало заметно — показываем цифрой
        if (g.bleedLoss >= 3 || g.bleedT <= 0 && g.bleedLoss >= 1) {
          this._emit('bleedtick', { login: g.login, x: g.x, y: g.y, amount: Math.round(g.bleedLoss) });
          g.bleedLoss = 0;
        }
        if (g.hp <= 0) {
          this._knockOut(g, g.bledBy || g);
          continue;
        }
      }
      g.lastX = g.x;
      g.lastY = g.y;
      if (g.stunT > 0) {
        // в сети: стоит, не бьёт и не убегает
        g.stunT = Math.max(0, g.stunT - dt);
        g.walking = false;
        continue;
      }
      if (!g.lion && g.fleeT <= 0 && g.fleeCool <= 0 && g.hp < maxHp(g) * FLEE.low && this._standing().length > 2) {
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
          g.spearCool = SPEAR.cool;
          this._emit('pickup', { login: g.login, x: g.x, y: g.y });
        }
        continue;
      }
      const fighting = standing.filter((s) => s.fate === 'fight');
      const t0 = g.target;
      const prey = t0 && this._canThrowSpear(g, t0);
      // цель убегает, а рядом есть другие — переключиться почти сразу (копейщик сначала пробует метнуть)
      if (t0 && t0.fleeT > 0 && !prey && fighting.some((s) => this._enemy(g, s) && s !== t0 && !(s.fleeT > 0))) {
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
      if (g.cool <= 0 && (this._canThrowSpear(g, t) || this._canThrowFar(g, t, d, dt))) {
        this._throw(g, t, 'spear');
        g.cool = attackEvery(g);
        continue;
      }
      if (netUp(g) && !(g.netCool > 0) && !(t.stunT > 0) && t !== this.boss && d <= NET.range[1]
        && this.random() < dt * (d >= NET.range[0] ? NET.chance : NET.close)) {
        g.netCool = NET.reload;
        this._throw(g, t, 'net');
        continue;
      }
      const reach = reachOf(g);
      if (d > reach) {
        const speed = MOVE_SPEED * runOf(g) * pace(g);
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
        const step = MOVE_SPEED * CIRCLE * runOf(g) * pace(g) * dt;
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
    const stepLen = Math.min(d, MOVE_SPEED * 1.1 * runOf(g) * pace(g) * dt);
    g.x += dx / d * stepLen;
    g.y += dy / d * stepLen;
    if (Math.abs(dx) > 1) g.face = dx > 0 ? 1 : -1;
    g.walking = true;
    return d - stepLen;
  }

  // копьё метают в убегающего и израненного, если он не слишком далеко
  // далёкую цель копейщик тоже может достать броском, не дожидаясь, пока подбежит
  _canThrowFar(g, t, d, dt) {
    if (!g.weapon || g.weapon.type !== 'spear' || g.spearOut || g.spearCool > 0 || t.fate !== 'fight') return false;
    return d >= SPEAR.far && d <= SPEAR.range[1] && this.random() < dt * SPEAR.farChance;
  }

  _canThrowSpear(g, t) {
    if (!g.weapon || g.weapon.type !== 'spear' || g.spearOut || g.spearCool > 0 || t.fate !== 'fight' || !(t.fleeT > 0)) {
      return false;
    }
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
      } else {
        if (alive) this._net(a, t);
        if (this.random() < NET.tear && a.nets > 0) {
          a.nets = 0;
          this._emit('nettear', { login: a.login, x: t.x, y: t.y });
          this._line('У ' + a.name + ' порвалась сеть', 'warn');
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.done);
  }

  _net(a, t) {
    if (this.random() < dodgeOf(t)) {
      this._emit('miss', { x: t.x, y: t.y, login: t.login });
      return;
    }
    // парагона в его испытании сеть не держит
    if (t === this.boss) {
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
  _blocked(d, crit = false) {
    if (!shieldUp(d) || d.stunT > 0 || this.random() >= SHIELD.block) return false;
    this._emit('block', { login: d.login, x: d.x, y: d.y, crit });
    if (this.random() < SHIELD.breaks * (crit ? SHIELD.critBreaks : 1)) {
      d.shield = false;
      this._emit('shieldbreak', { login: d.login, x: d.x, y: d.y });
      this._line('У ' + d.name + ' раскололся щит', 'warn');
    }
    return true;
  }

  // двуручник бьёт всех перед собой в пределах досягаемости
  _swing(a, t, fighting) {
    const cleave = typeOf(a).cleave;
    if (!cleave) {
      this._attack(a, t);
      return;
    }
    // сектор в arc градусов в сторону цели, длиной в полтора маха
    const reach = reachOf(a) * cleave.reach, aim = Math.atan2(t.y - a.y, t.x - a.x), half = cleave.arc / 2 * Math.PI / 180;
    const inArc = (v) => {
      const d = Math.hypot(v.x - a.x, v.y - a.y);
      if (d > reach) return false;
      if (d < 1) return true;
      const off = Math.abs(Math.atan2(Math.sin(Math.atan2(v.y - a.y, v.x - a.x) - aim), Math.cos(Math.atan2(v.y - a.y, v.x - a.x) - aim)));
      return off <= half;
    };
    const victims = fighting.filter((v) => this._enemy(a, v) && v.fate === 'fight' && (v === t || inArc(v)));
    for (const v of victims) if (v.fate === 'fight') this._attack(a, v);
  }

  _attack(a, d, { mult = 1, ranged = false } = {}) {
    if (!ranged) {
      a.swing = 0.3;
      a.jab = (a.jab || 0) + 1;
    }
    const stunned = d.stunT > 0;
    // брошенное копьё промахивается чаще (и по запутанному в сети), зато чаще критует
    const spear = ranged && typeOf(a).throw;
    if (this.random() < (stunned ? 0 : dodgeOf(d)) + (spear ? SPEAR.miss : 0)) {
      this._emit('miss', { x: d.x, y: d.y, login: d.login });
      return;
    }
    // крит решается до щита: отбитый крит бьёт по щиту сильнее
    const crit = this.random() < critOf(a) * (spear ? SPEAR.critMult : 1);
    if (this._blocked(d, crit)) return;
    // копьё пробивает часть брони, а брошенное — всю
    const pierce = typeOf(a).pierce || 0;
    const armor = pierce && ranged ? 0 : armorOf(d) * (1 - pierce);
    let dmg = damageOf(a) * mult * (1 + SPREAD * (2 * this.random() - 1)) * (crit ? CRIT_HIT : 1) * (1 - armor);
    dmg = Math.max(1, Math.round(dmg));
    d.hp -= dmg;
    d.flash = 0.18;
    a.dealt += dmg;
    if (!a.lion) a.hitsNow = (a.hitsNow || 0) + 1;
    this._emit('hit', { x: d.x, y: d.y, amount: dmg, crit, login: d.login, from: a.login, ranged });
    if (d.hp <= 0) {
      this._knockOut(d, a, crit);
      return;
    }
    // парагона в испытании кровь не берёт
    if (crit && d !== this.boss && this.random() < BLEED.chance) {
      if (!(d.bleedT > 0)) this._emit('bleed', { login: d.login, x: d.x, y: d.y });
      d.bleedT = BLEED.time;
      d.bledBy = a;
    }
    if (crit && !d.lion && d !== this.boss && this.random() < FLEE.critChance) this._flee(d, FLEE.critTime[0] + this.random() * FLEE.critTime[1], 'crit');
    // ударили сбоку — может развернуться на обидчика
    else if (d.target !== a && !(d.fleeT > 0) && this.random() < REVENGE) {
      d.target = a;
      d.retarget = RETARGET[0] + this.random() * RETARGET[1];
    }
  }

  _knockOut(d, a, crit = false) {
    const hpMax = maxHp(d);
    // лев погибает всегда; от лап льва гибнут втрое чаще
    const chance = d.lion ? 1 : this.duel || d === this.boss ? 0
      : deathChance(this.settings.death / 100, -d.hp, hpMax) * (a.lion ? PIT.deathMult : 1)
        * (d.bleedT > 0 ? BLEED.deathMult : 1) * (crit ? CRIT_KILL : 1);
    let dead = Boolean(d.lion) || chance > 0 && this.random() < (chance >= 1 ? 1 : Math.min(0.95, chance));
    // божественный амулет забирает смерть на себя и рассыпается
    const saved = dead && !d.lion && d.amulet;
    if (saved) {
      dead = false;
      d.amulet = false;
      d.savedNow = true;
    }
    d.fate = dead ? 'dead' : 'down';
    d.by = a.name;
    d.bleedT = 0;
    d.hp = dead ? 0 : Math.max(1, Math.round(hpMax * BEATEN_HP));
    a.kosNow++;
    if (dead) a.killsNow++;
    if (dead && !d.lion && !a.lion) this._bless(a);
    a.target = null;
    if (d.lion) this._line(a.name + ' сражает льва!', 'champion');
    else if (a.lion) this._line(dead ? 'Лев растерзал ' + d.name : 'Лев повалил ' + d.name + ' — тот жив', dead ? 'death' : 'down');
    else if (dead) this._line(d.name + ' погибает от руки ' + a.name, 'death');
    else if (saved) this._line('Божественный амулет спасает ' + d.name + ' от смерти — и рассыпается', 'champion');
    else this._line(a.name + ' валит ' + d.name + ' — тот повержен, но жив', 'down');
    this._emit('down', { login: d.login, fate: d.fate, x: d.x, y: d.y, by: a.login, lion: Boolean(d.lion), saved });
    this._checkEnd();
  }

  // убил гладиатора насмерть — одна легендарная вещь становится божественной: сперва оружие, потом случайный доспех
  _bless(g) {
    let slot = null;
    if (g.weapon && g.weapon.rarity === 'legendary') slot = 'weapon';
    else {
      const armor = SLOT_IDS.filter((id) => g.gear && g.gear[id] && g.gear[id].rarity === 'legendary');
      if (armor.length) slot = armor[Math.floor(this.random() * armor.length)];
    }
    if (!slot) return;
    const was = slot === 'weapon' ? g.weapon : g.gear[slot];
    const item = Object.assign({}, was, { rarity: DIVINE.id, power: Math.round(was.power * DIVINE.mult) });
    if (slot === 'weapon') g.weapon = item;
    else g.gear[slot] = item;
    this._line(g.name + ': «' + itemText(was) + '» напивается крови и становится божественным — «' + itemText(item) + '»',
      'champion');
    this._emit('divine', { login: g.login, x: g.x, y: g.y, slot });
  }

  _checkEnd() {
    if (this.state !== 'battle' || this.endIn !== null) return;
    const standing = this._standing();
    const boss = this.boss;
    const over = this.mode === 'pit' ? !standing.some((g) => g.lion) || !standing.some((g) => !g.lion)
      : boss ? !standing.includes(boss) || standing.every((g) => g === boss)
        : this.mode === 'teams' ? new Set(standing.map((g) => g.team)).size <= 1
          : standing.length <= 1;
    if (over) this.endIn = END_DELAY;
  }

  _endBattle() {
    const pit = this.mode === 'pit', people = this.fighters.filter((g) => !g.lion);
    const lions = this.fighters.filter((g) => g.lion);
    const n = people.length, bonus = crowdBonus(n), standing = this._standing().filter((g) => !g.lion);
    const duel = this.duel;
    let winner = null;
    if (duel) {
      const l = duel.left, r = duel.right, share = (g) => (g.fate === 'fight' ? g.hp / maxHp(g) : -1);
      winner = share(l) >= share(r) ? l : r;
      duel.winner = winner;
    }
    const teams = this.mode === 'teams';
    const champion = duel ? winner : !pit && !this.boss && !teams && standing.length === 1 ? standing[0] : null;
    // стенка: побеждает команда, у которой больше стоящих на ногах (поровну — у кого больше здоровья); ничья — никто
    let winTeam = null;
    if (teams) {
      const score = (team) => standing.filter((g) => g.team === team)
        .reduce((sum, g) => sum + 1000 + g.hp / maxHp(g), 0);
      const red = score('red'), blue = score('blue');
      winTeam = red > blue ? 'red' : blue > red ? 'blue' : null;
    }
    const rows = [];
    for (const g of people) {
      const fate = g.fate;
      g.fights++;
      g.kos += g.kosNow;
      g.kills += g.killsNow;
      let xp = 0, coins = 0;
      if (duel) {
        // дуэль: обоим много опыта, победителю — монеты за ставки против него
        xp = DUEL.xp;
        if (g === winner) {
          coins = DUEL.perBet * this.betsOn(g === this.duel.left ? 2 : 1);
          g.wins++;
        }
      } else if (g === this.boss) {
        // парагон после боя всё равно начинает заново — опыт и монеты ему ни к чему
        if (fate === 'fight') g.wins++;
      } else if (this.boss && fate !== 'dead') {
        // выстоял против парагона — много опыта
        const r = fate === 'fight' ? PARAGON.reward.standing : PARAGON.reward.beaten;
        xp = r.xp + PARAGON.reward.perKo.xp * g.kosNow;
        coins = r.coins + PARAGON.reward.perKo.coins * g.kosNow;
        if (fate === 'fight') g.wins++;
      } else if (pit && fate !== 'dead') {
        // выжил в яме — много опыта и золота
        const r = fate === 'fight' ? PIT.reward.standing : PIT.reward.beaten;
        xp = Math.round((r.xp + PIT.reward.perKo.xp * g.kosNow) * bonus);
        coins = Math.round((r.coins + PIT.reward.perKo.coins * g.kosNow) * bonus);
        if (fate === 'fight') g.wins++;
      } else if (teams && fate !== 'dead') {
        const side = g.team === winTeam ? TEAMS.reward.win : TEAMS.reward.lose;
        const r = fate === 'fight' ? side.standing : side.beaten;
        xp = Math.round((r.xp + TEAMS.reward.perKo.xp * g.kosNow) * bonus);
        coins = Math.round((r.coins + TEAMS.reward.perKo.coins * g.kosNow) * bonus);
        if (g.team === winTeam) g.wins++;
      } else if (fate === 'fight' || fate === 'down') {
        const r = fate === 'fight' ? REWARD.standing : REWARD.beaten;
        const mult = bonus * (g === champion ? REWARD.champion : 1);
        xp = Math.round((r.xp + r.xpPerKo * g.kosNow) * mult);
        coins = Math.round((r.coins + r.coinsPerKo * g.kosNow) * mult);
        if (fate === 'fight') g.wins++;
      }
      // за каждый удар по врагу — сверху, если выжил (парагону ни к чему — он начинает заново)
      if (fate !== 'dead' && g !== this.boss) {
        xp += HIT_REWARD.xp * (g.hitsNow || 0);
        coins += HIT_REWARD.coins * (g.hitsNow || 0);
      }
      const row = { login: g.login, name: g.name, color: g.color, fate, xp, coins, kos: g.kosNow, kills: g.killsNow,
        hits: g.hitsNow || 0, team: g.team || null,
        by: g.by, level: g.level, ups: 0, saved: Boolean(g.savedNow) };
      g.savedNow = false;
      if (fate === 'dead') {
        this.roster.bury(g, g.by, this.now());
        this.members.delete(g.login);
      } else {
        g.coins += coins;
        row.ups = this._gainXp(g, xp);
        row.level = g.level;
        g.fate = null;
        g.target = null;
        // писал в чат — раненый в лазарет, здоровый на тренировку; молчал AFK_ROUNDS раундов — на скамью
        const active = this.isActive(g);
        this._arrive(g, !active ? 'rest' : g.hp < maxHp(g) ? 'heal' : 'train');
        g.afk = !active;
        this.roster.put(g);
      }
      rows.push(row);
    }
    // парагон: как бы ни кончился бой, получает парагон и начинает с нуля, как после смерти
    const boss = this.boss;
    let ascended = null;
    if (boss) {
      boss.might = 0;
      boss.hp = Math.min(boss.hp, maxHp(boss));
    }
    if (boss && this.members.get(boss.login) === boss) {
      const fresh = newGladiator(boss.login, boss.name, boss.color, this.now(), (boss.paragon || 0) + 1);
      fresh.hp = maxHp(fresh);
      fresh.saidAt = boss.saidAt;
      this.members.set(boss.login, fresh);
      this._arrive(fresh, 'train');
      this.roster.put(fresh);
      this.cards = this.cards.filter((card) => card.login !== boss.login);
      const row = rows.find((r) => r.login === boss.login);
      ascended = { login: boss.login, name: boss.name, paragon: fresh.paragon, stood: Boolean(row && row.fate === 'fight') };
      if (row) {
        row.paragon = fresh.paragon;
        row.level = 1;
      }
      this._emit('paragon', { login: boss.login, paragon: fresh.paragon });
    }
    const order = { fight: 0, down: 1, dead: 2 };
    rows.sort((a, b) => order[a.fate] - order[b.fate] || b.kos - a.kos || b.xp - a.xp);
    let bettors = [];
    if (duel) {
      // угадавшим — монеты, без опыта
      const side = winner === duel.left ? 1 : 2;
      for (const [login, bet] of duel.bets) {
        const m = this.members.get(login);
        if (bet !== side || !m) continue;
        m.coins += DUEL.prize;
        this.roster.put(m);
        bettors.push({ login, name: m.name, color: m.color, coins: DUEL.prize });
      }
      for (const row of rows) if (row.login !== winner.login && row.fate === 'fight') row.fate = 'down';
      rows.sort((a, b) => (b.login === winner.login) - (a.login === winner.login));
    }
    this.results = { champion: champion ? champion.login : null, rows, fighters: n, ascended,
      mode: duel ? 'duel' : pit ? 'pit' : boss ? 'paragon' : teams ? 'teams' : 'ffa', winTeam, bettors, bets: duel ? [this.betsOn(1), this.betsOn(2)] : null,
      lions: lions.length, lionsDown: lions.filter((g) => g.fate !== 'fight').length };
    this.projectiles = [];
    for (const g of this.members.values()) {
      g.spearOut = null;
      g.stunT = 0;
      g.team = null;
      g.bleedT = 0;
      g.bledBy = null;
    }
    this.roster.save();
    this.fighters = [];
    this.endIn = null;
    this.state = 'results';
    this.mode = null;
    this.duel = null;
    this.boss = null;
    this.timer = RESULTS_TIME;
    const wounded = rows.filter((row) => row.fate !== 'dead' && this.members.get(row.login)?.place === 'heal').length;
    if (wounded) this._line('Раненых уносят в лазарет: ' + wounded, 'heal');
    const benched = rows.filter((row) => this.members.get(row.login)?.afk).length;
    if (benched) this._line('Молчат уже ' + AFK_ROUNDS + ' раунда — на скамью: ' + benched, 'info');
    if (duel) {
      this._line('Дуэль выиграл ' + winner.name + '! Угадали ставку: ' + bettors.length + ' — по ' + DUEL.prize + ' монет',
        'champion');
    } else if (pit) {
      const won = this.results.lionsDown === lions.length;
      this._line(won ? 'Львы повержены! Выжившие получают щедрую награду' : !standing.length ? 'Львы победили'
        : 'Время вышло — львы уходят в клетки', won ? 'champion' : 'battle');
    } else if (teams) {
      this._line(winTeam ? 'Стенку взяли ' + TEAMS.names[winTeam] + '!' : 'Стенка на стенку — ничья', 'champion');
    } else if (ascended) {
      this._line((ascended.stood ? ascended.name + ' выстоял против всех' : 'Гладиаторы одолели ' + ascended.name) + ' — он получает '
        + ascended.paragon + '-й парагон и начинает заново', 'champion');
    } else if (champion) this._line(champion.name + ' — чемпион арены!', 'champion');
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
    else if (this.state === 'battle' && this.duel && this.duel.betting) this._duelFight();
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
