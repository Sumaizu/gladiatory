import { eq, no, ok, test } from './harness.js';
import { clean, fromQuery, toQuery } from '../../../js/config.js';
import { HEAL_RATE, NET, SHIELD, armorOf, attackEvery, critOf, damageOf, reachOf, REWARD, START_COINS, START_POINTS, deathChance, maxHp,
  xpNeed } from '../../../js/balance.js';
import { END_DELAY, Game, MIN_FIGHTERS, RESULTS_TIME, Roster, plural, readableColor } from '../../../js/engine.js';
import { inArena } from '../../../js/places.js';
import { PRICE, RARITIES, SHOW_TIME, SPIN_TIME, spin } from '../../../js/gacha.js';

const SETTINGS = clean({ ludus: 60, battle: 90, death: 0 });

class Memory {
  constructor() {
    this.items = new Map();
  }

  getItem(key) {
    return this.items.has(key) ? this.items.get(key) : null;
  }

  setItem(key, value) {
    this.items.set(key, String(value));
  }
}

function rng(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function game(options = {}) {
  const g = new Game(Object.assign({}, SETTINGS, options.settings || {}), options.roster || new Roster(),
    { random: options.random || rng(7), now: () => 1000 });
  g.open();
  return g;
}

function join(g, ...names) {
  for (const name of names) g.feed(name, 'привет', { login: name.toLowerCase() });
  return names.map((name) => g.members.get(name.toLowerCase()));
}

function fight(g, limit = 600) {
  for (let i = 0; i < limit * 20 && g.state === 'battle'; i++) g.step(0.05);
}

test('настройки: границы и ссылка', () => {
  const s = clean({ ludus: 5, battle: 9999, death: -3, channel: 'https://twitch.tv/SumaiZu' });
  eq([s.ludus, s.battle, s.death, s.channel], [20, 600, 0, 'sumaizu']);
  eq(fromQuery(toQuery(s)), s);
  eq(toQuery(clean({})), '');
});

test('любое сообщение делает гладиатором', () => {
  const g = game();
  const [a] = join(g, 'Brutus');
  ok(a);
  eq([a.level, a.coins, a.points, a.hp], [1, START_COINS, START_POINTS, maxHp(a)]);
  eq(g.roster.size, 1);
  g.feed('Brutus', 'ещё раз', { login: 'brutus' });
  eq(g.members.size, 1);
});

test('боты и пустые ники не вступают', () => {
  const g = game();
  g.feed('Nightbot', 'привет', { login: 'nightbot' });
  g.feed('', '', {});
  eq(g.members.size, 0);
});

test('до старта сообщения не считаются', () => {
  const g = new Game(SETTINGS, new Roster());
  g.feed('Brutus', 'привет', { login: 'brutus' });
  eq(g.members.size, 0);
});

test('тёмный цвет чата заменяется на читаемый', () => {
  ok(readableColor('#000010', 'abc') !== '#000010');
  eq(readableColor('#FF8800', 'abc'), '#ff8800');
});

test('очки характеристик: сила, все, выносливость сразу даёт здоровье', () => {
  const g = game();
  const [a] = join(g, 'Brutus');
  g.feed('Brutus', 'сила', { login: 'brutus' });
  eq([a.str, a.points], [1, 2]);
  const before = a.hp;
  g.feed('Brutus', 'выносливость все', { login: 'brutus' });
  eq([a.vit, a.points], [2, 0]);
  eq(a.hp, before + 30);
  g.feed('Brutus', 'лов 5', { login: 'brutus' });
  eq(a.agi, 0, 'без очков ничего не меняется');
});

test('новичок садится на скамью в зоне отдыха и сидит, пока его не отправят', () => {
  const g = game();
  const [a, b] = join(g, 'Brutus', 'Crixus');
  for (let i = 0; i < 20 * 20; i++) g.step(0.05);
  eq([a.place, a.pose, a.walking], ['rest', 'sit', false]);
  ok(a.seat !== b.seat, 'у каждого своё место');
  const spot = [a.x, a.y];
  for (let i = 0; i < 20 * 30; i++) g.step(0.05);
  eq([a.x, a.y], spot, 'не встаёт сам');
});

test('лазарет бесплатный и лечит быстрее отдыха', () => {
  const g = game();
  const [a, b] = join(g, 'Brutus', 'Crixus');
  a.hp = b.hp = 30;
  g.feed('Brutus', 'лазарет', { login: 'brutus' });
  eq([a.place, a.coins], ['heal', START_COINS]);
  for (let i = 0; i < 20 * 30; i++) g.step(0.05);
  eq(a.pose, 'lie');
  ok(a.hp > b.hp, 'в лазарете здоровья больше');
});

test('здоровому в лазарет не надо', () => {
  const g = game();
  const [a] = join(g, 'Brutus');
  g.feed('Brutus', 'лазарет', { login: 'brutus' });
  eq(a.place, 'rest');
});

test('вылечился в лазарете и писал в чат — идёт тренироваться', () => {
  const g = game();
  const [a] = join(g, 'Brutus');
  a.hp = maxHp(a) - 1;
  g.feed('Brutus', 'лазарет', { login: 'brutus' });
  for (let i = 0; i < 20 * 20; i++) g.step(0.05);
  eq(a.place, 'train');
  eq(a.hp, maxHp(a));
});

test('афк: не писал ни в прошлом раунде, ни сейчас — после лазарета садится отдыхать', () => {
  const g = game({ settings: { ludus: 20, battle: 20 } });
  const [afk, b, c] = join(g, 'Afk', 'B', 'C');
  // первый раунд: все писали (вступили); второй раунд — Afk молчит
  for (const round of [1, 2, 3]) {
    if (round > 1) g.feed('B', 'трен', { login: 'b' });
    g.next();
    fight(g);
    g.next();
  }
  ok(g.isActive(b), 'B писал');
  no(g.isActive(afk), 'Afk молчал два раунда');
  for (const m of [afk, b]) {
    m.hp = maxHp(m) - 1;
    m.place = 'heal';
    m.walking = false;
  }
  for (let i = 0; i < 20 * 15 && (afk.place === 'heal' || b.place === 'heal'); i++) g.step(0.05);
  eq(afk.place, 'rest');
  eq(b.place, 'train');
  ok(c);
});

test('оружие и доспех пока не продаются: команды ничего не делают', () => {
  const g = game();
  const [a] = join(g, 'Brutus');
  a.coins = 10000;
  g.feed('Brutus', 'оружие', { login: 'brutus' });
  g.feed('Brutus', 'доспех', { login: 'brutus' });
  eq([a.weapon, a.armor, a.coins], [null, null, 10000]);
});

test('бой не начнётся, пока гладиаторов меньше двух', () => {
  const g = game();
  join(g, 'Brutus');
  g.next();
  eq(g.state, 'ludus');
  ok(g.notice.includes(String(MIN_FIGHTERS)));
  join(g, 'Crixus');
  g.next();
  eq(g.state, 'battle');
  eq(g.notice, '');
});

test('лудус кончается сам и начинается бой; очки распределяются сами', () => {
  const g = game();
  const [a] = join(g, 'Brutus', 'Crixus');
  for (let i = 0; i < 20 * 61; i++) g.step(0.05);
  eq(g.state, 'battle');
  eq(a.points, 0);
  eq(a.str + a.agi + a.vit, START_POINTS);
});

test('бой: все на арене, внутри стен, дерутся до одного', () => {
  const g = game();
  const fighters = join(g, 'A', 'B', 'C', 'D', 'E', 'F');
  g.next();
  eq(g.fighters.length, 6);
  for (let i = 0; i < 100; i++) g.step(0.05);
  for (const f of fighters) ok(inArena(f.x, f.y), f.name + ' на арене');
  fight(g);
  eq(g.state, 'results');
  const r = g.results;
  eq(r.rows.length, 6);
  eq(r.rows.filter((row) => row.fate === 'fight').length, 1);
  ok(r.champion);
});

test('награды: чемпион больше всех, павшие — меньше, но тоже получают', () => {
  const g = game();
  join(g, 'A', 'B', 'C');
  g.next();
  fight(g);
  const rows = g.results.rows;
  const champ = rows.find((row) => row.login === g.results.champion);
  const beaten = rows.filter((row) => row.fate === 'down');
  ok(beaten.length === 2);
  for (const row of beaten) {
    ok(row.xp >= REWARD.beaten.xp && row.coins >= REWARD.beaten.coins);
    ok(champ.xp > row.xp);
  }
  eq(g.members.get(champ.login).wins, 1);
  for (const row of rows) eq(g.members.get(row.login).fights, 1);
});

test('при шансе гибели 100% проигравшие погибают и пропадают', () => {
  const memory = new Memory();
  const g = game({ settings: { death: 100 }, roster: new Roster(memory, 'k') });
  join(g, 'A', 'B', 'C', 'D');
  g.next();
  fight(g);
  const dead = g.results.rows.filter((row) => row.fate === 'dead');
  eq(dead.length, 3);
  for (const row of dead) {
    no(g.members.has(row.login), 'не в лудусе');
    eq(g.roster.get(row.login), null, 'стёрт из сохранения');
    ok(row.by, 'известно, кто убил');
  }
  eq(g.roster.fallen.length, 3);
  const saved = new Roster(memory, 'k');
  eq(saved.size, 1);
  eq(saved.fallen.length, 3);
});

test('погибший пишет снова — новый гладиатор 1 уровня', () => {
  const g = game({ settings: { death: 100 } });
  join(g, 'A', 'B');
  g.next();
  fight(g);
  const dead = g.results.rows.find((row) => row.fate === 'dead');
  g.feed(dead.name, 'я вернулся', { login: dead.login });
  const fresh = g.members.get(dead.login);
  eq([fresh.level, fresh.fights, fresh.coins], [1, 0, START_COINS]);
  ok(g.lines.some((line) => line.text.includes('заново')));
});

test('при шансе гибели 0% никто не гибнет', () => {
  const g = game();
  join(g, 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H');
  g.next();
  fight(g);
  eq(g.results.rows.filter((row) => row.fate === 'dead').length, 0);
});

test('сдаюсь: только в бою, спасает от гибели, бой кончается', () => {
  const g = game({ settings: { death: 100 } });
  const [a, b] = join(g, 'A', 'B');
  g.feed('A', 'сдаюсь', { login: 'a' });
  eq(a.fate, null, 'в лудусе не работает');
  g.next();
  g.feed('A', 'сдаюсь', { login: 'a' });
  eq(a.fate, 'yield');
  eq(g.endIn, END_DELAY);
  fight(g);
  eq(g.results.champion, 'b');
  const row = g.results.rows.find((r) => r.login === 'a');
  eq(row.fate, 'yield');
  ok(g.members.has('a'));
  eq(b.wins, 1);
});

test('кто пришёл во время боя, ждёт в лудусе и бьётся в следующем', () => {
  const g = game();
  join(g, 'A', 'B');
  g.next();
  const [late] = join(g, 'Late');
  eq(late.fate, null);
  eq(g.waiting, 1);
  g.feed('Late', 'трен', { login: 'late' });
  eq(late.place, 'train');
  no(g.fighters.includes(late));
  fight(g);
  eq(g.results.rows.length, 2);
  g.next();
  g.next();
  ok(g.fighters.includes(late));
});

test('итоги сменяются лудусом, раны остаются', () => {
  const g = game();
  join(g, 'A', 'B', 'C');
  g.next();
  fight(g);
  for (let i = 0; i < 20 * (RESULTS_TIME + 1); i++) g.step(0.05);
  eq(g.state, 'ludus');
  const hurt = Array.from(g.members.values()).filter((m) => m.hp < maxHp(m));
  ok(hurt.length >= 2, 'павшие вернулись ранеными');
  for (const m of g.members.values()) eq(m.place, m.hp < maxHp(m) ? 'heal' : 'rest', 'раненые — в лазарет');
  ok(Array.from(g.members.values()).some((m) => m.place === 'heal'));
});

test('время боя вышло — выстоявших несколько, чемпиона нет', () => {
  const g = game({ settings: { battle: 20 } });
  const all = join(g, 'A', 'B', 'C', 'D');
  for (const m of all) m.vit = 300;
  g.next();
  for (const m of all) m.hp = maxHp(m);
  fight(g, 25);
  eq(g.state, 'results');
  eq(g.results.champion, null);
  ok(g.results.rows.filter((row) => row.fate === 'fight').length >= 2);
});

test('сохранение: прогресс переживает перезапуск', () => {
  const memory = new Memory();
  const g = game({ roster: new Roster(memory, 'k') });
  const [a] = join(g, 'Brutus');
  a.coins = 500;
  a.weapon = { kind: 'weapon', rarity: 'epic', power: 11, type: 'spear' };
  a.shield = true;
  a.nets = 2;
  g.feed('Brutus', 'сила 2', { login: 'brutus' });
  a.hp = maxHp(a) / 2;
  g.stop();
  const again = game({ roster: new Roster(memory, 'k') });
  const [b] = join(again, 'Brutus');
  eq([b.weapon, b.str, b.coins, b.shield, b.nets], [{ kind: 'weapon', rarity: 'epic', power: 11, type: 'spear' }, 2, 500,
    true, 2]);
  eq(b.hp, Math.round(maxHp(b) / 2));
});

test('сброс стирает всех', () => {
  const memory = new Memory();
  const g = game({ roster: new Roster(memory, 'k') });
  join(g, 'A', 'B');
  g.feed('Mod', '!гладиаторы-сброс', { login: 'mod', mod: true });
  eq(g.members.size, 0);
  eq(new Roster(memory, 'k').size, 0);
});

test('команды модераторов: только модерам и при включённой настройке', () => {
  const g = game();
  join(g, 'A', 'B');
  g.feed('Viewer', '!гладиаторы-пауза', { login: 'viewer' });
  no(g.paused);
  no(g.members.has('viewer'), 'команда не делает гладиатором');
  g.feed('Mod', '!гладиаторы-пауза', { login: 'mod', mod: true });
  ok(g.paused);
  g.feed('Mod', '!гладиаторы-пауза', { login: 'mod', mod: true });
  no(g.paused);
  g.feed('Mod', '!гладиаторы-дальше', { login: 'mod', mod: true });
  eq(g.state, 'battle');
  g.configure(Object.assign({}, g.settings, { chat_commands: false }));
  g.feed('Mod', '!гладиаторы-пауза', { login: 'mod', mod: true });
  no(g.paused);
});

test('пауза останавливает время', () => {
  const g = game();
  g.setPaused(true);
  const t = g.timer;
  g.step(1);
  eq(g.timer, t);
});

test('шанс гибели растёт от сильного удара, но не выше 90%', () => {
  eq(deathChance(0, 100, 100), 0);
  eq(deathChance(0.2, 0, 100), 0.2);
  ok(deathChance(0.2, 50, 100) > 0.2);
  eq(deathChance(0.8, 500, 100), 0.9);
});

test('формулы: опыт до уровня растёт, лазарет лечит быстрее отдыха', () => {
  ok(xpNeed(2) > xpNeed(1));
  ok(HEAL_RATE.heal > HEAL_RATE.rest && HEAL_RATE.rest > 0);
  eq(plural(1, 'а', 'б', 'в') + plural(3, 'а', 'б', 'в') + plural(11, 'а', 'б', 'в'), 'абв');
});

test('карточка профиля появляется и пропадает', () => {
  const g = game();
  join(g, 'A');
  g.feed('A', 'проф', { login: 'a' });
  eq(g.cards.length, 1);
  for (let i = 0; i < 20 * 9; i++) g.step(0.05);
  eq(g.cards.length, 0);
});

test('испорченное сохранение не ломает игру', () => {
  const memory = new Memory();
  memory.setItem('k', '{битый json');
  eq(new Roster(memory, 'k').size, 0);
  memory.setItem('k', JSON.stringify({ alive: { x: { name: 'X', level: 'abc', hp: 7, weapon: 99 } }, fallen: [1, null] }));
  const r = new Roster(memory, 'k');
  eq([r.get('x').level, r.get('x').hp, r.get('x').weapon], [1, 1, null]);
  eq(r.fallen.length, 0);
});

const spinAll = (g) => {
  for (let i = 0; i < 20 * 200 && (g.spinNow || g.spins.length); i++) g.step(0.05);
};

test('гача: 30 монет, гладиатор идёт к храму, приз выдаётся после прокрутки и он возвращается', () => {
  const g = game({ settings: { ludus: 900 } });
  const [a] = join(g, 'Brutus');
  a.coins = 100;
  g.feed('Brutus', 'трен', { login: 'brutus' });
  g.feed('Brutus', 'гача', { login: 'brutus' });
  eq([a.coins, a.place, g.spins.length], [100 - PRICE, 'temple', 1]);
  g.step(0.1);
  ok(g.spinNow && !g.spinNow.done, 'крутится');
  for (let i = 0; i < 20 * SPIN_TIME + 4; i++) g.step(0.05);
  ok(g.spinNow.done, 'приз выдан');
  spinAll(g);
  for (let i = 0; i < 20 * 2; i++) g.step(0.05);
  eq(a.place, 'train', 'вернулся на тренировку');
  ok(SHOW_TIME > 0);
});

test('гача: без денег нельзя, «гача все» — на все монеты, но не больше 10', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B');
  a.coins = 29;
  g.feed('A', 'гача', { login: 'a' });
  eq(g.spins.length, 0);
  ok(g.lines.some((l) => l.text.includes('30 монет')));
  b.coins = PRICE * 3 + 5;
  g.feed('B', 'гача все', { login: 'b' });
  eq([g.spins.length, b.coins], [3, 5]);
  b.coins = 10000;
  g.feed('B', 'гача все', { login: 'b' });
  eq(g.spins.length, 10);
});

test('гача: вещь надевается, только если лучше; оружие даёт урон, доспех режет урон', () => {
  const g = game();
  const [a] = join(g, 'A');
  const base = damageOf(a);
  g._prize(a, { kind: 'item', item: { kind: 'weapon', rarity: 'epic', power: 11 } });
  eq(damageOf(a), base + 11);
  g._prize(a, { kind: 'item', item: { kind: 'weapon', rarity: 'common', power: 2 } });
  eq(a.weapon.power, 11, 'хуже — выброшено');
  g._prize(a, { kind: 'item', item: { kind: 'armor', rarity: 'rare', power: 8 } });
  eq(armorOf(a), 0.08);
  g._prize(a, { kind: 'handful', coins: 12 });
  eq(a.coins, START_COINS + 12);
});

test('гача: в бою бойцу нельзя, ждущему в лудусе можно', () => {
  const g = game();
  const [a] = join(g, 'A', 'B');
  a.coins = 100;
  g.next();
  g.feed('A', 'гача', { login: 'a' });
  eq(g.spins.length, 0);
  const [late] = join(g, 'Late');
  late.coins = 60;
  g.feed('Late', 'гача', { login: 'late' });
  eq(g.spins.length, 1);
});

test('гача: остановка игры возвращает монеты за недокрученное', () => {
  const memory = new Memory();
  const g = game({ roster: new Roster(memory, 'k') });
  const [a] = join(g, 'A');
  a.coins = PRICE * 4;
  g.feed('A', 'гача 4', { login: 'a' });
  g.step(0.1);
  g.stop();
  eq(new Roster(memory, 'k').get('a').coins, PRICE * 4);
});

test('гача: шансы редкостей как в Чатобороне, монет нет', () => {
  const random = rng(42), counts = {};
  const n = 40000;
  for (let i = 0; i < n; i++) {
    const r = spin(random), key = r.item ? r.item.rarity : r.kind;
    counts[key] = (counts[key] || 0) + 1;
  }
  const total = 0.132 + 0.04 + 0.05 + RARITIES.reduce((sum, x) => sum + x.chance, 0);
  for (const id of ['handful', 'bag', 'chest']) eq(counts[id], undefined, 'монет из гачи нет');
  for (const [id, chance] of [['void', 0.132], ['common', 0.27], ['legendary', 0.06]]) {
    const share = counts[id] / n, want = chance / total;
    ok(Math.abs(share - want) < want * 0.12, id + ': ' + share.toFixed(3) + ' против ' + want.toFixed(3));
  }
});

const always = (value) => () => value;

test('арена: от крита гладиатор убегает, не бьёт и удаляется от обидчика', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B', 'C');
  g.next();
  // по порядку: не увернулся, крит, разброс урона, испугался, длительность бегства
  const rolls = [0.9, 0.01, 0.5, 0.01, 0.5];
  g.random = () => (rolls.length ? rolls.shift() : 0.5);
  a.x = 400; a.y = 350; b.x = 430; b.y = 350;
  b.agi = 0;
  g._attack(a, b);
  ok(b.fleeT > 0, 'убегает');
  ok(b.target === null, 'бросил цель');
  ok(g.events.some((e) => e.type === 'flee' && e.login === 'b'));
  g.random = rng(3);
  const was = Math.hypot(b.x - a.x, b.y - a.y), hits = g.events.filter((e) => e.type === 'hit' && e.from === 'b').length;
  for (let i = 0; i < 20; i++) g.step(0.05);
  ok(Math.hypot(b.x - a.x, b.y - a.y) > was, 'дальше от обидчика');
  eq(g.events.filter((e) => e.type === 'hit' && e.from === 'b').length, hits, 'пока бежит — не бьёт');
});

test('арена: раненый меньше чем на четверть убегает, потом возвращается в бой', () => {
  const g = game();
  const [a] = join(g, 'A', 'B', 'C', 'D');
  g.next();
  a.hp = maxHp(a) * 0.2;
  g.step(0.05);
  ok(a.fleeT > 0, 'убегает');
  for (let i = 0; i < 20 * 6; i++) g.step(0.05);
  if (a.fate === 'fight') {
    eq(a.fleeT, 0, 'бегство кончилось');
    ok(a.fleeCool >= 0);
  }
});

test('арена: цель убегает — нападающий переключается на другого', () => {
  const g = game();
  const [a, b, c] = join(g, 'A', 'B', 'C');
  g.next();
  a.target = b;
  a.retarget = 10;
  b.fleeT = 3;
  b.fleeCool = 8;
  for (let i = 0; i < 20; i++) g.step(0.05);
  ok(a.target === c || a.target !== b, 'бьёт не беглеца');
});

test('арена: цели время от времени меняются сами', () => {
  const g = game();
  const all = join(g, 'A', 'B', 'C', 'D', 'E', 'F');
  g.next();
  for (const m of all) m.vit = 200;
  for (const m of all) m.hp = maxHp(m);
  const first = new Map(all.map((m) => [m.login, m.target && m.target.login]));
  for (let i = 0; i < 20 * 15; i++) g.step(0.05);
  ok(all.some((m) => m.target && m.target.login !== first.get(m.login)), 'кто-то сменил цель');
});

test('арена: ударили сбоку — может развернуться на обидчика', () => {
  const g = game();
  const [a, b, c] = join(g, 'A', 'B', 'C');
  g.next();
  b.target = c;
  b.agi = 0;
  c.vit = 0;
  g.random = always(0.3);
  g._attack(a, b);
  ok(b.target === a, 'развернулся на A');
});

const weapon = (type, power = 4) => ({ kind: 'weapon', rarity: 'rare', power, type });
const queue = (...rolls) => () => (rolls.length ? rolls.shift() : 0.5);

test('оружие: двуручник бьёт реже и сильнее, крит выше; копьё дальше', () => {
  const g = game();
  const [s, gs, sp] = join(g, 'S', 'G', 'P');
  s.weapon = weapon('sword');
  gs.weapon = weapon('greatsword');
  sp.weapon = weapon('spear');
  ok(attackEvery(gs) > attackEvery(s) * 1.4);
  ok(damageOf(gs) > damageOf(s) * 1.5);
  ok(critOf(gs) > critOf(s));
  ok(reachOf(sp) > reachOf(s) * 1.5);
  eq([attackEvery(s), damageOf(s)], [attackEvery({ agi: 0, weapon: null }), damageOf({ str: 0, weapon: weapon('sword') })]);
});

test('двуручник задевает всех перед собой, но не тех, кто сзади', () => {
  const g = game();
  const [a, front1, front2, back] = join(g, 'A', 'F1', 'F2', 'B');
  g.next();
  a.weapon = weapon('greatsword');
  a.x = 400; a.y = 350; a.face = 1;
  front1.x = 430; front1.y = 350;
  front2.x = 425; front2.y = 370;
  back.x = 370; back.y = 350;
  for (const v of [front1, front2, back]) v.agi = 0;
  g.random = always(0.5);
  const hp = [front1.hp, front2.hp, back.hp];
  g._swing(a, front1, [a, front1, front2, back]);
  ok(front1.hp < hp[0] && front2.hp < hp[1], 'передние задеты');
  eq(back.hp, hp[2], 'задний цел');
});

test('копьё пробивает броню', () => {
  const g = game();
  const [a, b, c] = join(g, 'A', 'B', 'C');
  b.armor = { kind: 'armor', rarity: 'legendary', power: 26 };
  c.armor = null;
  a.weapon = weapon('spear');
  g.random = always(0.5);
  const hb = b.hp, hc = c.hp;
  g._attack(a, b);
  g._attack(a, c);
  eq(hb - b.hp, hc - c.hp);
});

test('копьё: в израненного беглеца метают, потом бегут подбирать', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B', 'C');
  g.next();
  a.weapon = weapon('spear');
  a.x = 300; a.y = 350; b.x = 450; b.y = 350;
  b.hp = maxHp(b) * 0.3;
  b.fleeT = 3;
  b.fleeCool = 8;
  b.agi = 0;
  a.target = b;
  a.cool = 0;
  a.retarget = 10;
  g.step(0.05);
  ok(a.spearOut, 'копьё брошено');
  ok(g.projectiles.some((p) => p.kind === 'spear' && p.from === a));
  for (let i = 0; i < 20 * 10 && a.spearOut && a.fate === 'fight'; i++) g.step(0.05);
  if (a.fate === 'fight') eq(a.spearOut, null, 'подобрал');
  ok(g.events.some((e) => e.type === 'hit' && e.from === 'a' && e.ranged) || g.events.some((e) => e.type === 'miss'));
});

test('щит: отбивает удар, иногда ломается; с двуручником не работает', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B');
  b.shield = true;
  b.agi = 0;
  g.random = queue(0.9, 0.01, 0.5);
  const hp = b.hp;
  g._attack(a, b);
  eq(b.hp, hp, 'отбил');
  ok(b.shield, 'цел');
  g.random = queue(0.9, 0.01, 0.01);
  g._attack(a, b);
  no(b.shield, 'раскололся');
  b.shield = true;
  b.weapon = weapon('greatsword');
  g.random = queue(0.9, 0.01, 0.9, 0.5);
  g._attack(a, b);
  ok(b.hp < hp, 'с двуручником щит не спасает');
  ok(SHIELD.block > 0 && SHIELD.breaks > 0);
});

test('сеть: одноразовая, оглушает и цель добивают', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B', 'C');
  g.next();
  a.nets = 1;
  a.x = 300; a.y = 350; b.x = 400; b.y = 350;
  b.agi = 0;
  a.target = b;
  a.retarget = 10;
  g.random = always(0.001);
  g.step(0.05);
  eq(a.nets, 0, 'сеть потрачена');
  g.random = always(0.5);
  for (let i = 0; i < 20 && !(b.stunT > 0); i++) g.step(0.05);
  ok(b.stunT > 0, 'оглушён');
  ok(a.target === b, 'фокусит');
  const x = b.x, y = b.y;
  g.step(0.5);
  if (b.fate === 'fight' && b.stunT > 0) eq([b.x, b.y], [x, y], 'стоит на месте');
  ok(NET.stun >= 2);
});

test('гача: щит и сеть без редкости; сетей не больше трёх, второй щит не нужен', () => {
  const g = game();
  const [a] = join(g, 'A');
  g._prize(a, { kind: 'shield' });
  ok(a.shield);
  g._prize(a, { kind: 'shield' });
  ok(g.lines.some((l) => l.text.includes('второй щит')));
  for (let i = 0; i < 5; i++) g._prize(a, { kind: 'net' });
  eq(a.nets, NET.max);
  const random = rng(9), kinds = new Set(), types = new Set();
  for (let i = 0; i < 4000; i++) {
    const r = spin(random);
    kinds.add(r.kind);
    if (r.item && r.item.kind === 'weapon') types.add(r.item.type);
  }
  ok(kinds.has('shield') && kinds.has('net'));
  eq(types, new Set(['sword', 'greatsword', 'spear']));
});

test('арена: врага выше уровнем выбирают чаще, чем равного или слабее', () => {
  const g = game();
  const [a, strong, equal, weak] = join(g, 'A', 'Strong', 'Equal', 'Weak');
  a.level = 5;
  strong.level = 8;
  equal.level = 5;
  weak.level = 2;
  a.x = 400; a.y = 350;
  strong.x = 520; strong.y = 350;
  equal.x = 460; equal.y = 350;
  weak.x = 400; weak.y = 410;
  const picks = { strong: 0, equal: 0, weak: 0 };
  g.random = rng(11);
  for (let i = 0; i < 300; i++) picks[g._pickTarget(a, [a, strong, equal, weak]).login]++;
  ok(picks.strong > picks.equal && picks.strong > picks.weak, JSON.stringify(picks));
});
