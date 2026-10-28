import { eq, no, ok, test } from './harness.js';
import { clean, fromQuery, toQuery } from '../../../js/config.js';
import { GEAR_MAX, HEAL_RATE, REWARD, START_COINS, START_POINTS, deathChance, gearPrice, healPrice, maxHp,
  xpNeed } from '../../../js/balance.js';
import { END_DELAY, Game, MIN_FIGHTERS, RESULTS_TIME, Roster, plural, readableColor } from '../../../js/engine.js';
import { inArena } from '../../../js/places.js';

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

test('лазарет стоит монет и лечит быстрее отдыха', () => {
  const g = game();
  const [a, b] = join(g, 'Brutus', 'Crixus');
  a.hp = b.hp = 30;
  g.feed('Brutus', 'лазарет', { login: 'brutus' });
  g.feed('Crixus', 'отдых', { login: 'crixus' });
  eq(a.coins, START_COINS - healPrice(1));
  eq(a.place, 'heal');
  for (let i = 0; i < 200; i++) g.step(0.05);
  ok(a.hp > b.hp, 'в лазарете здоровья больше');
});

test('лазарет: без монет и здоровому нельзя', () => {
  const g = game();
  const [a, b] = join(g, 'Brutus', 'Crixus');
  g.feed('Brutus', 'лазарет', { login: 'brutus' });
  eq([a.place, a.coins], ['yard', START_COINS], 'здоровый');
  b.hp = 10;
  b.coins = 0;
  g.feed('Crixus', 'лазарет', { login: 'crixus' });
  eq(b.place, 'yard', 'без монет');
});

test('вылечился в лазарете — выходит во двор', () => {
  const g = game();
  const [a] = join(g, 'Brutus');
  a.hp = maxHp(a) - 1;
  g.feed('Brutus', 'лазарет', { login: 'brutus' });
  for (let i = 0; i < 40; i++) g.step(0.05);
  eq(a.place, 'yard');
  eq(a.hp, maxHp(a));
});

test('тренировка даёт опыт и уровень с очками', () => {
  const g = game({ settings: { ludus: 900 } });
  const [a] = join(g, 'Brutus');
  g.feed('Brutus', 'трен', { login: 'brutus' });
  for (let i = 0; i < 20 * 400; i++) g.step(0.05);
  ok(a.level >= 2, 'уровень вырос');
  eq(a.points, START_POINTS + 2 * (a.level - 1));
  eq(a.hp <= maxHp(a), true);
});

test('кузница: оружие и доспех за монеты, цена растёт, предел', () => {
  const g = game();
  const [a] = join(g, 'Brutus');
  a.coins = 10000;
  g.feed('Brutus', 'оружие', { login: 'brutus' });
  g.feed('Brutus', 'доспех', { login: 'brutus' });
  eq([a.weapon, a.armor, a.coins], [1, 1, 10000 - 2 * gearPrice(0)]);
  ok(gearPrice(1) > gearPrice(0));
  for (let i = 0; i < 10; i++) g.feed('Brutus', 'меч', { login: 'brutus' });
  eq(a.weapon, GEAR_MAX);
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
  g.feed('Brutus', 'оружие', { login: 'brutus' });
  g.feed('Brutus', 'сила 2', { login: 'brutus' });
  a.hp = maxHp(a) / 2;
  g.stop();
  const again = game({ roster: new Roster(memory, 'k') });
  const [b] = join(again, 'Brutus');
  eq([b.weapon, b.str, b.coins], [1, 2, 500 - gearPrice(0)]);
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

test('формулы: опыт до уровня растёт, отдых лечит быстрее двора', () => {
  ok(xpNeed(2) > xpNeed(1));
  ok(HEAL_RATE.rest > HEAL_RATE.yard && HEAL_RATE.heal > HEAL_RATE.rest);
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
  eq([r.get('x').level, r.get('x').hp, r.get('x').weapon], [1, 1, GEAR_MAX]);
  eq(r.fallen.length, 0);
});
