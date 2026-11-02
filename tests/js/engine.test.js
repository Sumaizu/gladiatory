import { eq, no, ok, test } from './harness.js';
import { playNote, reportPlay } from '../../site/js/stats.js';
import { clean, fromQuery, toQuery } from '../../site/js/config.js';
import { AGI_CAP, WEAPON_TYPES, CRIT_KILL, BLEED, dodgeOf, HP_PER_VIT, RUN_PER_AGI, runOf, TEAMS, DUEL, HIT_REWARD, WEAPON_MULT, forceOf, weaponMult, PIT, POINTS_PER_LEVEL, PARAGON, NET, SAND, SHIELD, SPEAR, armorOf, ratingOf, attackEvery, critOf, damageOf, reachOf, REWARD, START_COINS, START_POINTS, deathChance, maxHp,
  xpNeed } from '../../site/js/balance.js';
import { starOf } from '../../site/js/stars.js';
import { AFK_ROUNDS, END_DELAY, Game, MIN_FIGHTERS, RESULTS_TIME, Roster, plural, readableColor } from '../../site/js/engine.js';
import { PLACES, POST_SPOTS, WARM_SPOTS, inArena } from '../../site/js/places.js';
import { DIVINE, OUTCOMES, PRICE, RARITIES, REFORGE, SHARPEN, TYPES, forgeSpin, rarityOf, sharpChance, SHOW_TIME, SPIN_TIME,
  spin } from '../../site/js/gacha.js';

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
  g.forceMode = 'mode' in options ? options.mode : 'ffa';
  g.open();
  return g;
}

// новички садятся на скамью и боя не видят — в тестах сразу отправляем их на песок
function join(g, ...names) {
  for (const name of names) g.feed(name, 'трен', { login: name.toLowerCase() });
  return names.map((name) => g.members.get(name.toLowerCase()));
}

function newcomers(g, ...names) {
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
  eq(a.hp, before + 2 * HP_PER_VIT);
  g.feed('Brutus', 'лов 5', { login: 'brutus' });
  eq(a.agi, 0, 'без очков ничего не меняется');
});

test('новичок сразу идёт тренироваться', () => {
  const g = game();
  const [a] = newcomers(g, 'Brutus');
  eq(a.place, 'train');
});

test('на скамье в зоне отдыха гладиатор сидит, пока его не отправят', () => {
  const g = game();
  const [a, b] = newcomers(g, 'Brutus', 'Crixus');
  g.feed('Brutus', 'отдых', { login: 'brutus' });
  g.feed('Crixus', 'отдых', { login: 'crixus' });
  for (let i = 0; i < 20 * 20; i++) g.step(0.05);
  eq([a.place, a.pose, a.walking], ['rest', 'sit', false]);
  ok(a.seat !== b.seat, 'у каждого своё место');
  const spot = [a.x, a.y];
  for (let i = 0; i < 20 * 30; i++) g.step(0.05);
  eq([a.x, a.y], spot, 'не встаёт сам');
});

test('лазарета нет: в лудусе раны не лечатся, а после боя у всех полное здоровье', () => {
  const g = game();
  const [a] = join(g, 'Brutus', 'Crixus');
  a.hp = 30;
  for (let i = 0; i < 20 * 30; i++) g.step(0.05);
  eq(a.hp, 30, 'в лудусе само не заживает');
  g.next();
  fight(g);
  for (const m of g.members.values()) eq(m.hp, maxHp(m), m.name);
});

test('команды «лазарет» нет — раненых уносят туда сами после боя', () => {
  const g = game();
  const [a] = newcomers(g, 'Brutus');
  a.hp = 30;
  g.feed('Brutus', 'лазарет', { login: 'brutus' });
  eq(a.place, 'train');
});


test('афк: молчал ' + AFK_ROUNDS + ' раунда — после боя на скамью, а кто писал — на тренировку', () => {
  const g = game({ settings: { ludus: 20, battle: 20, death: 0 } });
  const [afk, b, c] = join(g, 'Afk', 'B', 'C');
  const round = () => {
    for (const m of [b, c]) if (g.members.has(m.login)) g.feed(m.name, 'трен', { login: m.login });
    g.next();
    fight(g);
  };
  // в первом раунде Afk ещё писал (вступил) — после боя он в деле
  round();
  ok(g.isActive(afk));
  no(afk.place === 'rest');
  // ещё два раунда молчит — но первый раунд пока среди последних трёх
  g.next();
  round();
  g.next();
  round();
  ok(g.isActive(afk));
  g.next();
  round();
  no(g.isActive(afk), 'Afk молчал ' + AFK_ROUNDS + ' раунда');
  ok(g.isActive(b), 'B писал');
  eq(afk.place, 'rest');
  ok(afk.afk);
  eq(b.place, 'train');
  // афк написал хоть что-то — встаёт со скамьи
  g.feed('Afk', 'привет', { login: 'afk' });
  eq(afk.place, 'train');
  no(afk.afk);
});

test('на трибуне мест не хватило — отдыхающие стоят в ряд у левой стены', () => {
  const g = game();
  const seats = PLACES.rest.seats.length, names = Array.from({ length: seats + 3 }, (_, i) => 'R' + i);
  for (const name of names) g.feed(name, 'отдых', { login: name.toLowerCase() });
  for (let i = 0; i < 20 * 30; i++) g.step(0.05);
  const all = [...g.members.values()];
  eq(all.filter((m) => m.pose === 'sit').length, seats);
  const line = all.filter((m) => m.seat >= seats);
  eq(line.length, 3);
  for (const m of line) {
    ok(PLACES.rest.line.some((s) => s.x === m.x && s.y === m.y), 'стоит на месте у стены');
    eq(m.pose, null);
  }
});

test('трибуна и стена заняты — дольше всех молчащий неактивный уходит в ворота, пока снова не напишет', () => {
  const g = game();
  const places = PLACES.rest.seats.length + PLACES.rest.line.length;
  const names = Array.from({ length: places }, (_, i) => 'R' + i);
  for (const name of names) g.feed(name, 'отдых', { login: name.toLowerCase() });
  for (let i = 0; i < 20 * 30; i++) g.step(0.05);
  // все давно молчат, а R5 — дольше всех
  for (const m of g.members.values()) m.saidAt = -100;
  g.members.get('r5').saidAt = -500;
  g.feed('Новичок', 'отдых', { login: 'new' });
  const old = g.members.get('r5');
  ok(old.leaving, 'R5 уходит');
  ok(g.members.get('new').seat !== null, 'новичку досталось его место');
  for (let i = 0; i < 20 * 20 && g.members.has('r5'); i++) g.step(0.05);
  no(g.members.has('r5'), 'дошёл до ворот и ушёл');
  ok(g.roster.get('r5'), 'прогресс сохранён');
  eq(g.members.size, places);
  g.feed('R5', 'привет', { login: 'r5' });
  ok(g.members.has('r5'), 'написал — вернулся');
});

test('сам сел на скамью — болтовня в чате его не поднимает', () => {
  const g = game();
  const [a] = join(g, 'Brutus');
  g.feed('Brutus', 'отдых', { login: 'brutus' });
  g.feed('Brutus', 'привет', { login: 'brutus' });
  eq(a.place, 'rest');
});

test('оружие и доспех пока не продаются: команды ничего не делают', () => {
  const g = game();
  const [a] = join(g, 'Brutus');
  a.coins = 10000;
  g.feed('Brutus', 'оружие', { login: 'brutus' });
  g.feed('Brutus', 'доспех', { login: 'brutus' });
  eq([a.weapon, a.gear, a.coins], [null, { head: null, body: null, legs: null, feet: null }, 10000]);
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

test('лудус кончается сам и начинается бой; свободные очки сами не тратятся', () => {
  const g = game();
  const [a] = join(g, 'Brutus', 'Crixus');
  for (let i = 0; i < 20 * 61; i++) g.step(0.05);
  eq(g.state, 'battle');
  // за лудус на тренировке он подрос — очки копятся, но в характеристики сами не идут
  eq(a.points, START_POINTS + POINTS_PER_LEVEL * (a.level - 1));
  eq(a.str + a.agi + a.vit, 0);
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

test('итоги сменяются лудусом, раны не остаются', () => {
  const g = game();
  join(g, 'A', 'B', 'C');
  g.next();
  fight(g);
  for (let i = 0; i < 20 * (RESULTS_TIME + 1); i++) g.step(0.05);
  eq(g.state, 'ludus');
  for (const m of g.members.values()) {
    eq(m.hp, maxHp(m), 'после боя — полное здоровье');
    ok(m.place === 'train' || m.place === 'rest', m.place);
  }
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
  a.weapon = { kind: 'weapon', rarity: 'epic', type: 'spear', sharp: 3 };
  a.shield = true;
  a.nets = 1;
  a.shield = false;
  g.feed('Brutus', 'сила 2', { login: 'brutus' });
  a.hp = maxHp(a) / 2;
  g.stop();
  const again = game({ roster: new Roster(memory, 'k') });
  const [b] = join(again, 'Brutus');
  eq([b.weapon, b.str, b.coins, b.shield, b.nets], [{ kind: 'weapon', rarity: 'epic', type: 'spear', sharp: 3 }, 2, 500,
    false, 1]);
  eq(b.hp, maxHp(b), 'вернулся в игру — здоровье полное');
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

test('формулы: опыт до уровня растёт', () => {
  ok(xpNeed(2) > xpNeed(1));
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

test('гача: монеты снимаются в момент прокрутки, гладиатор идёт к храму и возвращается', () => {
  const g = game({ settings: { ludus: 900 } });
  const [a] = join(g, 'Brutus');
  a.coins = 100;
  a.weapon = weapon('sword');
  g.feed('Brutus', 'трен', { login: 'brutus' });
  g.feed('Brutus', 'гача', { login: 'brutus' });
  eq([a.coins, g.spins.length, a.place], [100, 1, 'temple'], 'в очереди деньги не сняты, сразу идёт к храму');
  g.step(0.1);
  eq(g.spinNow, null, 'пока идёт — не крутится');
  for (let i = 0; i < 20 * 20 && !g.spinNow; i++) g.step(0.05);
  ok(g.spinNow && !g.spinNow.done, 'крутится');
  no(a.walking, 'начал крутить, когда дошёл');
  eq([a.coins, a.place], [100 - PRICE, 'temple']);
  for (let i = 0; i < 20 * SPIN_TIME + 4; i++) g.step(0.05);
  ok(g.spinNow.done, 'приз выдан');
  spinAll(g);
  for (let i = 0; i < 20 * 2; i++) g.step(0.05);
  eq(a.place, 'train', 'вернулся на тренировку');
  ok(SHOW_TIME > 0);
});
test('гача: без денег нельзя, «гача все» — на сколько хватает, но не больше 10', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B');
  a.weapon = weapon('sword');
  b.weapon = weapon('sword');
  a.coins = 29;
  g.feed('A', 'гача', { login: 'a' });
  eq(g.spins.length, 0);
  b.coins = PRICE * 3 + 5;
  g.feed('B', 'гача все', { login: 'b' });
  eq(g.spins.length, 3);
  g.feed('B', 'гача', { login: 'b' });
  eq(g.spins.length, 3, 'в очередь не больше, чем хватает денег');
  b.coins = 10000;
  g.feed('B', 'гача все', { login: 'b' });
  eq(g.spins.length, 10);
});
test('гача: редкость оружия растёт, только если выше своей; урон — сила × вид × редкость; доспех режет урон', () => {
  const g = game();
  const [a] = join(g, 'A');
  const fists = damageOf(a);
  a.weapon = { kind: 'weapon', type: 'sword', rarity: 'plain', sharp: 0 };
  const base = damageOf(a);
  ok(base > fists, 'сильнее кулаков');
  ok(Math.abs(base - forceOf(a) * WEAPON_TYPES.sword.dmg) < 1e-9, 'простое — урон от скрытой силы и вида');
  g._prize(a, { kind: 'item', item: { kind: 'weapon', rarity: 'epic', type: 'sword' } });
  eq(a.weapon.rarity, 'epic');
  ok(Math.abs(damageOf(a) - base * WEAPON_MULT.epic) < 1e-9, 'редкость умножает урон');
  g._prize(a, { kind: 'item', item: { kind: 'weapon', rarity: 'common', type: 'sword' } });
  eq(a.weapon.rarity, 'epic', 'ниже — выброшено');
  g._prize(a, { kind: 'item', item: { kind: 'armor', slot: 'body', rarity: 'rare', power: 8 } });
  eq(armorOf(a), 0.08);
});

test('скрытая сила: с самого начала есть, очки силы её растят; сила-характеристика у новичка 0', () => {
  const g = game();
  const [a] = join(g, 'A');
  eq(a.str, 0);
  ok(forceOf(a) > 0);
  const before = forceOf(a);
  g.feed('A', 'сил', { login: 'a' });
  ok(forceOf(a) > before);
  a.weapon = weapon('hammer');
  const hammer = damageOf(a);
  a.weapon = weapon('sword');
  ok(hammer > damageOf(a), 'у каждого вида свой множитель');
});
test('хроника: из гачи — только легендарное, амулет и взятые щит или сеть', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B');
  a.weapon = { kind: 'weapon', type: 'spear', rarity: 'plain', sharp: 0 };
  g.lines = [];
  g._prize(a, { kind: 'item', item: { kind: 'weapon', rarity: 'epic', type: 'spear' } });
  eq(g.lines.length, 0, 'эпическое — молча');
  g._prize(a, { kind: 'item', item: { kind: 'weapon', rarity: 'legendary', type: 'spear' } });
  eq(g.lines.map((l) => l.text), ['A получает «легендарное копьё»']);
  a.weapon = { kind: 'weapon', rarity: DIVINE.id, type: 'sword', sharp: 0 };
  g._prize(a, { kind: 'item', item: { kind: 'weapon', rarity: 'legendary', type: 'sword' } });
  eq(g.lines.length, 1, 'не надето — молча');
  g._prize(b, { kind: 'shield' });
  g._prize(b, { kind: 'net' });
  g._prize(a, { kind: 'amulet' });
  eq(g.lines.slice(1).map((l) => l.text), ['B берёт щит', 'A надевает божественный амулет']);
});

test('за 5 секунд до боя гача и кузня отменяются: монеты не снимаются, в бою и на итогах команды не запоминаются', () => {
  const g = game({ settings: { ludus: 20, battle: 20 } });
  const [a, b] = join(g, 'A', 'B');
  a.coins = 300;
  b.coins = 300;
  a.weapon = weapon('sword');
  b.weapon = weapon('sword');
  for (let i = 0; i < 20 * 13.5; i++) g.step(0.05);
  g.feed('A', 'гача 5', { login: 'a' });
  g.feed('B', 'улучшить 2', { login: 'b' });
  for (let i = 0; i < 20 * 2 && g.state === 'ludus'; i++) g.step(0.05);
  ok(g.timer <= 5);
  eq([g.spins.length, g.forging.length], [0, 0], 'очереди отменены');
  for (let i = 0; i < 20 * 8 && g.state === 'ludus'; i++) g.step(0.05);
  eq(g.state, 'battle');
  const coins = [a.coins, b.coins];
  ok(coins[0] <= 300 && coins[1] <= 300 && (300 - coins[0]) % PRICE === 0, 'снято только за то, что успели: ' + coins);
  g.feed('A', 'гача', { login: 'a' });
  fight(g);
  eq(g.state, 'results');
  g.feed('B', 'гача', { login: 'b' });
  eq([g.spins.length, g.forging.length], [0, 0], 'в бою и на итогах — не запоминаются');
  const rewarded = [a.coins, b.coins];
  for (let i = 0; i < 20 * 5; i++) g.step(0.05);
  eq([g.spinNow, g.forgeNow, a.coins, b.coins], [null, null, ...rewarded], 'после боя ничего не докручивается');
});
test('гача: остановка игры возвращает монеты за недокрученное', () => {
  const memory = new Memory();
  const g = game({ roster: new Roster(memory, 'k') });
  const [a] = join(g, 'A');
  a.coins = PRICE * 4;
  a.weapon = weapon('sword');
  g.feed('A', 'гача 4', { login: 'a' });
  for (let i = 0; i < 20 * 20 && !g.spinNow; i++) g.step(0.05);
  g.step(0.1);
  ok(g.spinNow && !g.spinNow.done);
  g.stop();
  eq(new Roster(memory, 'k').get('a').coins, PRICE * 4);
});

test('гача: редкости в пропорциях Чатобороны, монет и пустоты нет', () => {
  const random = rng(42), counts = {};
  const n = 40000;
  for (let i = 0; i < n; i++) {
    const r = spin(random), key = r.item ? r.item.rarity : r.kind;
    counts[key] = (counts[key] || 0) + 1;
  }
  // щит, сеть и амулет — прямо доля круток, остальное делят редкости в пропорциях Чатобороны
  const items = 1 - OUTCOMES.reduce((sum, x) => sum + x.chance, 0), rare = RARITIES.reduce((sum, x) => sum + x.chance, 0);
  for (const id of ['handful', 'bag', 'chest', 'void']) eq(counts[id], undefined, 'монет и пустоты из гачи нет');
  for (const [id, want] of [['shield', 0.15], ['net', 0.15], ['amulet', 0.03], ['common', items * 0.27 / rare],
    ['legendary', items * 0.06 / rare]]) {
    const share = counts[id] / n;
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
  ok(damageOf(gs) >= damageOf(s) * 1.5 - 1e-9);
  ok(critOf(gs) > critOf(s));
  ok(reachOf(sp) >= reachOf(s) * 1.4);
  eq([attackEvery(s), damageOf(s)], [attackEvery({ agi: 0, weapon: weapon('sword', 0) }), damageOf({ str: 0, weapon: weapon('sword') })]);
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

test('копьё пробивает часть брони, брошенное — бо́льшую часть', () => {
  const g = game();
  const [a, b, c] = join(g, 'A', 'B', 'C');
  b.gear.body = { kind: 'armor', slot: 'body', rarity: 'legendary', power: 26 };
  a.weapon = weapon('spear');
  g.random = always(0.5);
  let hb = b.hp, hc = c.hp;
  g._attack(a, b);
  g._attack(a, c);
  ok(hb - b.hp < hc - c.hp, 'в ближнем бою броня помогает');
  const sword = join(g, 'S')[0];
  sword.weapon = weapon('sword');
  const { pierce, throwPierce } = WEAPON_TYPES.spear;
  ok(throwPierce > pierce && pierce > 0);
  ok(Math.abs((hb - b.hp) / (hc - c.hp) - (1 - armorOf(b) * (1 - pierce))) < 0.05, 'броня режет меньше');
  hb = b.hp;
  hc = c.hp;
  g._attack(a, b, { ranged: true });
  g._attack(a, c, { ranged: true });
  ok(Math.abs((hb - b.hp) / (hc - c.hp) - (1 - armorOf(b) * (1 - throwPierce))) < 0.05, 'брошенное — ещё меньше');
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
  const spear = a.weapon;
  g.step(0.05);
  ok(a.windup && a.anim === 'throw', 'замах перед броском');
  eq(a.weapon, spear, 'пока замахивается — копьё в руке');
  for (let i = 0; i < 20 && a.weapon; i++) g.step(0.05);
  eq(a.weapon, null, 'копьё брошено');
  ok(g.projectiles.some((p) => p.kind === 'spear' && p.from === a));
  for (let i = 0; i < 20 * 10 && !a.weapon && a.fate === 'fight'; i++) g.step(0.05);
  if (a.fate === 'fight') eq(a.weapon, spear, 'подобрал');
  ok(g.events.some((e) => e.type === 'hit' && e.from === 'a' && e.ranged) || g.events.some((e) => e.type === 'miss'));
});

test('щит: отбивает удар, иногда ломается; с двуручником не работает', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B');
  b.shield = true;
  b.agi = 0;
  // по порядку: уклонение, крит, блок щитом, поломка
  g.random = queue(0.9, 0.9, 0.01, 0.5);
  const hp = b.hp;
  g._attack(a, b);
  eq(b.hp, hp, 'отбил');
  ok(b.shield, 'цел');
  g.random = queue(0.9, 0.9, 0.01, 0.01);
  g._attack(a, b);
  no(b.shield, 'раскололся');
  b.shield = true;
  b.weapon = weapon('greatsword');
  g.random = queue(0.9, 0.9, 0.5);
  g._attack(a, b);
  ok(b.hp < hp, 'с двуручником щит не спасает');
  ok(SHIELD.block > 0 && SHIELD.breaks > 0);
});

test('сеть: оглушает, цель добивают, сеть остаётся для нового броска', () => {
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
  eq(a.nets, 1, 'сеть не тратится');
  ok(a.netCool > 0, 'пока не подобрал — второй раз не бросить');
  g.random = always(0.5);
  for (let i = 0; i < 20 && !(b.stunT > 0); i++) g.step(0.05);
  ok(b.stunT > 0, 'оглушён');
  ok(a.target === b, 'фокусит');
  const x = b.x, y = b.y;
  g.step(0.5);
  if (b.fate === 'fight' && b.stunT > 0) eq([b.x, b.y], [x, y], 'стоит на месте');
  ok(NET.stun >= 2);
});

test('гача: щит и сеть без редкости, занимают вторую руку; пока она занята или двуручник — не выпадают', () => {
  const g = game();
  const [a, b, c] = join(g, 'A', 'B', 'C');
  g._prize(a, { kind: 'shield' });
  ok(a.shield);
  g._prize(a, { kind: 'net' });
  eq(a.nets, 0, 'с щитом сеть не берётся');
  g._prize(b, { kind: 'net' });
  g._prize(b, { kind: 'net' });
  eq(b.nets, NET.max);
  c.weapon = weapon('greatsword');
  const random = rng(9), kinds = new Set(), types = new Set();
  for (let i = 0; i < 4000; i++) {
    const r = spin(random);
    kinds.add(r.kind);
    if (r.item && r.item.kind === 'weapon') types.add(r.item.type);
  }
  ok(kinds.has('shield') && kinds.has('net'), 'свободной руке выпадают');
  eq(types, new Set(['sword', 'greatsword', 'spear', 'axe', 'hammer', 'trident']));
  for (const owner of [a, b, c]) {
    for (let i = 0; i < 3000; i++) {
      const r = spin(random, owner);
      ok(r.kind !== 'shield' && r.kind !== 'net', owner.name + ': ' + r.kind);
    }
  }
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

test('сеть: после броска с небольшим шансом рвётся', () => {
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
  for (let i = 0; i < 20 && g.projectiles.length; i++) g.step(0.05);
  eq(a.nets, 0, 'порвалась');
  ok(g.events.some((e) => e.type === 'nettear' && e.login === 'a'));
  ok(NET.tear > 0 && NET.tear < 0.5 && NET.reload > NET.stun);
});

test('новичок дерётся кулаками: слабее меча, но бьёт чаще', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B');
  eq(a.weapon, null);
  b.weapon = weapon('sword', 0);
  ok(damageOf(a) < damageOf(b));
  ok(attackEvery(a) < attackEvery(b));
  ok(reachOf(a) < reachOf(b));
});

test('первая гача без оружия — в кузне: простое серое оружие случайного вида; остальные крутки ждут его', () => {
  const random = rng(21);
  for (let i = 0; i < 500; i++) {
    const r = spin(random, { weapon: null, gear: {}, shield: false, nets: 0, sand: 0 });
    ok(!r.item || r.item.kind === 'armor', 'без оружия гача оружия не даёт: ' + JSON.stringify(r));
  }
  const g = game({ settings: { ludus: 900 } });
  const [a] = join(g, 'A');
  a.coins = PRICE * 2;
  g.feed('A', 'гача 2', { login: 'a' });
  eq([g.forging.length, g.spins.length, a.place], [1, 1, 'forge'], 'сперва в кузню');
  for (let i = 0; i < 20 * 60 && (g.forgeNow || g.forging.length || g.spinNow || g.spins.length); i++) g.step(0.05);
  ok(a.weapon && TYPES.includes(a.weapon.type), JSON.stringify(a.weapon));
  eq(a.coins, 0, 'обе крутки сделаны');
  eq(a.place, 'train', 'вернулся на тренировку');
  // остальные виды — поровну
  const seen = new Set();
  for (let i = 0; i < 300; i++) seen.add(forgeSpin(random));
  eq(seen.size, TYPES.length);
});

test('инвентарь: броня падает в свой слот, слоты складываются, но не выше потолка', () => {
  const g = game();
  const [a] = join(g, 'A');
  const piece = (slot, power, rarity = 'rare') => ({ kind: 'item', item: { kind: 'armor', slot, rarity, power } });
  g._prize(a, piece('head', 4));
  g._prize(a, piece('feet', 3));
  eq([a.gear.head.power, a.gear.feet.power, a.gear.body], [4, 3, null]);
  eq(armorOf(a), 0.07);
  g._prize(a, piece('head', 2, 'common'));
  eq(a.gear.head.power, 4, 'хуже — выброшено');
  g._prize(a, piece('body', 60, 'legendary'));
  eq(armorOf(a), 0.6, 'не больше потолка');
  const random = rng(4), slots = new Set();
  for (let i = 0; i < 3000; i++) {
    const r = spin(random, { weapon: { type: 'sword' }, shield: true });
    if (r.item && r.item.kind === 'armor') slots.add(r.item.slot);
  }
  eq(slots, new Set(['head', 'body', 'legs', 'feet']));
});

test('инвентарь: старое сохранение с одним доспехом переезжает в слот «тело»', () => {
  const memory = new Memory();
  memory.setItem('k', JSON.stringify({ alive: { x: { name: 'X', armor: { rarity: 'epic', power: 19 } } } }));
  const r = new Roster(memory, 'k');
  eq(r.get('x').gear.body, { kind: 'armor', slot: 'body', rarity: 'epic', power: 19 });
  const g = game({ roster: r });
  const [x] = join(g, 'X');
  eq(armorOf(x), 0.19);
  x.gear.feet = { kind: 'armor', slot: 'feet', rarity: 'rare', power: 2 };
  g.stop();
  eq(new Roster(memory, 'k').get('x').gear.feet.power, 2);
});

test('стартовый капитал — 100 монет', () => {
  eq(START_COINS, 100);
});

test('Яма со львами: лев на каждых ' + PIT.per + ' гладиаторов, хотя бы один и не больше ' + PIT.max, () => {
  const lionsFor = (n) => {
    const g = game({ mode: 'pit' });
    join(g, ...Array.from({ length: n }, (_, i) => 'P' + i));
    g.next();
    return g.fighters.filter((f) => f.lion).length;
  };
  eq([lionsFor(2), lionsFor(7), lionsFor(30)], [1, 3, PIT.max]);
});

test('Яма со львами: чем сильнее команда, тем сильнее львы', () => {
  const mightFor = (level, gear) => {
    const g = game({ mode: 'pit' });
    for (const m of join(g, 'A', 'B', 'C')) {
      m.level = level;
      m.str = m.vit = level;
      if (gear) m.weapon = { kind: 'weapon', type: 'sword', rarity: 'epic', power: 11 };
    }
    g.next();
    const lion = g.fighters.find((f) => f.lion);
    eq(lion.hp, maxHp(lion));
    return lion.might;
  };
  const weak = mightFor(1, false), strong = mightFor(10, true);
  ok(strong > weak * 2, weak + ' → ' + strong);
});

test('Яма со львами: все бьют львов, а львы — гладиаторов', () => {
  const g = game({ mode: 'pit' });
  const people = join(g, 'A', 'B', 'C', 'D', 'E', 'F', 'G');
  g.next();
  const lions = g.fighters.filter((f) => f.lion);
  eq(lions.length, 3);
  for (const l of lions) eq([l.level, l.name], [5, 'Лев']);
  for (let i = 0; i < 20 * 6; i++) g.step(0.05);
  for (const e of g.events.filter((x) => x.type === 'hit')) {
    const from = g.fighters.find((f) => f.login === e.from), to = g.fighters.find((f) => f.login === e.login);
    ok(Boolean(from.lion) !== Boolean(to.lion), e.from + ' бьёт ' + e.login);
  }
  fight(g);
  eq(g.results.mode, 'pit');
  eq(g.results.rows.length, people.length, 'львов в итогах нет');
  no(g.results.rows.some((r) => r.login.startsWith('lion')));
  no(Array.from(g.members.keys()).some((k) => k.startsWith('lion')), 'львы не попали в лудус');
});

test('Яма со львами: от льва гибнут чаще (×' + PIT.deathMult + '), выжившие получают много опыта и золота', () => {
  const g = game({ mode: 'pit', settings: { death: 20 } });
  const [a, b] = join(g, 'A', 'B', 'C');
  g.next();
  const lion = g.fighters.find((f) => f.lion);
  let dead = 0;
  g.random = rng(77);
  for (let i = 0; i < 2000; i++) {
    a.fate = 'fight';
    a.hp = -1;
    g._knockOut(a, lion);
    if (a.fate === 'dead') dead++;
  }
  const share = dead / 2000;
  ok(share > 0.32 && share < 0.5, 'шанс гибели от льва ' + share.toFixed(2));
  a.fate = 'fight';
  a.hp = maxHp(a);
  g.random = rng(3);
  for (const l of g.fighters.filter((f) => f.lion)) {
    l.fate = 'dead';
  }
  g._checkEnd();
  for (let i = 0; i < 20 * 4 && g.state === 'battle'; i++) g.step(0.05);
  const row = g.results.rows.find((r) => r.login === 'a');
  ok(row.xp >= 100 && row.coins >= 80, JSON.stringify(row));
  ok(row.xp > REWARD.standing.xp * 2);
  ok(b);
});

test('вступил в игру — здоровье полное; после боя — тоже', () => {
  const memory = new Memory();
  const g = game({ roster: new Roster(memory, 'k') });
  const [a] = join(g, 'A', 'B');
  a.hp = 10;
  g.stop();
  const again = game({ roster: new Roster(memory, 'k') });
  const [a2] = join(again, 'A', 'B');
  eq(a2.hp, maxHp(a2), 'раны зажили');
  again.next();
  fight(again);
  for (const m of again.members.values()) eq(m.hp, maxHp(m), m.name);
});

test('Дуэль: первый случайный, противник — ближайший по мощи', () => {
  const g = game({ mode: 'duel' });
  const [a, b, c, d, e] = join(g, 'A', 'B', 'C', 'D', 'E');
  for (const m of [a, b]) Object.assign(m, { str: 9, vit: 8, weapon: weapon('sword') });
  a.weapon.sharp = 4;
  b.weapon.sharp = 3;
  ok(ratingOf(a) > ratingOf(b) && ratingOf(b) > ratingOf(c), 'мощь растёт со статами и оружием');
  eq(ratingOf(c), ratingOf(d));
  const seen = new Map();
  for (let i = 0; i < 300; i++) {
    const [first, second] = g._duelPair([a, b, c, d, e]);
    if (!seen.has(first.name)) seen.set(first.name, new Set());
    seen.get(first.name).add(second.name);
  }
  eq(seen.size, 5, 'первым бывает любой');
  eq([...seen.get('A')], ['B']);
  eq([...seen.get('B')], ['A']);
  eq(seen.get('D'), new Set(['C', 'E']), 'из равных — случайный');
});

test('Дуэль: двое — слева и справа, 30 секунд ставок, остальные ждут в лудусе', () => {
  const g = game({ mode: 'duel' });
  const all = join(g, 'A', 'B', 'C', 'D', 'E');
  g.next();
  eq(g.fighters.length, 2);
  const { left, right } = g.duel;
  ok(left.x < right.x, 'первый слева');
  eq(g.timer, DUEL.bet);
  const others = all.filter((m) => m !== left && m !== right);
  for (const m of others) eq(m.fate, null);
  const x = left.x;
  for (let i = 0; i < 20 * 10; i++) g.step(0.05);
  eq(left.x, x, 'пока ставки — стоят');
  no(g.events.some((e) => e.type === 'hit'), 'пока ставки — не дерутся');
  g.feed(others[0].name, '1', { login: others[0].login });
  g.feed(others[1].name, '2', { login: others[1].login });
  g.feed(others[2].name, '2', { login: others[2].login });
  g.feed(others[2].name, '1', { login: others[2].login });
  g.feed(left.name, '2', { login: left.login });
  eq([g.betsOn(1), g.betsOn(2)], [2, 1], 'последняя ставка считается, бойцы не ставят');
  for (let i = 0; i < 20 * 21; i++) g.step(0.05);
  no(g.duel.betting, 'ставки закрыты');
  ok(g.timer > DUEL.bet, 'идёт бой');
});

test('Дуэль: никто не гибнет, обоим опыт, победителю монеты за ставки против, угадавшим по 100', () => {
  const g = game({ mode: 'duel', settings: { death: 100 } });
  const all = join(g, 'A', 'B', 'C', 'D', 'E', 'F');
  g.next();
  const { left, right } = g.duel;
  const others = all.filter((m) => m !== left && m !== right);
  others.forEach((m, i) => g.feed(m.name, i < 3 ? '1' : '2', { login: m.login }));
  const coins = new Map(all.map((m) => [m.login, m.coins]));
  g.next();
  fight(g);
  const r = g.results;
  eq(r.mode, 'duel');
  eq(r.rows.length, 2);
  no(r.rows.some((row) => row.fate === 'dead'), 'при шансе гибели 100% — никто не погиб');
  for (const row of r.rows) ok(row.xp >= DUEL.xp, row.name + ' опыт ' + row.xp);
  const win = r.rows[0], winner = g.members.get(win.login);
  const side = winner === left ? 1 : 2, against = side === 1 ? 1 : 3;
  eq(win.coins, DUEL.perBet * against + HIT_REWARD.coins * win.hits, 'победителю за ставки против него и за удары');
  eq(r.rows[1].coins, HIT_REWARD.coins * r.rows[1].hits);
  const lucky = others.filter((m, i) => (i < 3 ? 1 : 2) === side);
  eq(r.bettors.length, lucky.length);
  for (const m of lucky) eq(m.coins, coins.get(m.login) + DUEL.prize);
  for (const m of others.filter((x) => !lucky.includes(x))) eq(m.coins, coins.get(m.login));
});

test('режимы боя: примерно 11% яма, 23% дуэль, остальное — поровну все против всех и стенка', () => {
  const counts = { pit: 0, duel: 0, ffa: 0, teams: 0 };
  const random = rng(31);
  for (let i = 0; i < 1000; i++) {
    const g = new Game(clean({ ludus: 60, battle: 90 }), new Roster(), { random, now: () => 1 });
    g.open();
    join(g, 'A', 'B', 'C');
    g.next();
    counts[g.mode]++;
  }
  ok(counts.pit > 70 && counts.pit < 150, JSON.stringify(counts));
  ok(counts.duel > 180 && counts.duel < 280, JSON.stringify(counts));
  ok(counts.ffa > 280 && counts.teams > 280, JSON.stringify(counts));
});

test('гача: очередь идёт к храму заранее, каждый крутит, когда дошёл', () => {
  const g = game({ settings: { ludus: 900 } });
  const [a, b] = join(g, 'A', 'B');
  a.coins = b.coins = 100;
  a.weapon = weapon('sword');
  b.weapon = weapon('axe');
  g.feed('A', 'трен', { login: 'a' });
  g.feed('B', 'трен', { login: 'b' });
  for (let i = 0; i < 20 * 10; i++) g.step(0.05);
  g.feed('A', 'гача', { login: 'a' });
  g.feed('B', 'гача', { login: 'b' });
  eq([a.place, b.place], ['temple', 'temple'], 'оба пошли сразу');
  const starts = [];
  for (let i = 0; i < 20 * 40 && (g.spins.length || g.spinNow); i++) {
    const was = g.spinNow;
    g.step(0.05);
    if (g.spinNow && g.spinNow !== was) {
      const who = g.members.get(g.spinNow.login);
      starts.push(who.login + ':' + (who.walking ? 'идёт' : 'на месте'));
    }
  }
  eq(starts, ['a:на месте', 'b:на месте']);
});

test('режим следующего боя выбран заранее, в начале лудуса, и бой идёт именно в нём', () => {
  const g = new Game(clean({ ludus: 60, battle: 20 }), new Roster(), { random: rng(5), now: () => 1 });
  g.open();
  join(g, 'A', 'B', 'C');
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    while (g.state !== 'ludus') g.next();
    const planned = g.nextMode;
    // за 60 боёв кто-нибудь может дорасти и до испытания парагона
    ok(['ffa', 'pit', 'duel', 'teams', 'paragon'].includes(planned), planned);
    for (const m of g.members.values()) g.feed(m.name, 'трен', { login: m.login });
    g.next();
    eq(g.mode, planned);
    seen.add(planned);
    for (const m of g.members.values()) m.hp = 1e9;
  }
  seen.delete('paragon');
  eq(seen, new Set(['ffa', 'pit', 'duel', 'teams']));
});

test('ники стримеров узнаются по логину без учёта регистра', () => {
  eq(starOf('sumaizu'), 'rainbow');
  eq(starOf('SukoshiSSRB'), 'white');
  eq(starOf('higashi_vo'), 'snow');
  eq(starOf('brutus'), null);
  eq(starOf(undefined), null);
});

test('ник того же цвета, что в твиче: тёмный осветляется, но оттенок сохраняется', () => {
  eq(readableColor('#1E90FF', 'abc'), '#1e90ff');
  const dark = readableColor('#0000FF', 'abc'), n = parseInt(dark.slice(1), 16);
  ok((n & 255) === 255 && (n >> 16) > 0 && (n >> 16) < 200);
  const g = game();
  g.feed('Vasya', 'привет', { login: 'vasya', color: '#FF8800' });
  g.feed('Vasya', 'трен', { login: 'vasya', color: '#00FF7F' });
  eq(g.members.get('vasya').color, '#00ff7f');
});

test('кто сидит в зоне отдыха, в бой не выходит, а смотрит', () => {
  const g = game();
  const [a, b, c] = join(g, 'Brutus', 'Crixus', 'Spartak');
  g.feed('Spartak', 'отдых', { login: 'spartak' });
  g.next();
  eq(g.state, 'battle');
  ok(g.fighters.includes(a) && g.fighters.includes(b));
  no(g.fighters.includes(c), 'Spartak на скамье');
  eq(c.fate, null);
});

test('на арену некому — все сидят на отдыхе, бой откладывается', () => {
  const g = game();
  join(g, 'Brutus', 'Crixus', 'Spartak');
  g.feed('Crixus', 'отдых', { login: 'crixus' });
  g.feed('Spartak', 'отдых', { login: 'spartak' });
  g.next();
  eq(g.state, 'ludus');
});


test('в сети не убежать: крит не заставляет бежать, пока сеть не спала', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B');
  g.next();
  b.stunT = NET.stun;
  g._flee(b, 3, 'crit');
  eq(b.fleeT, 0);
  b.stunT = 0;
  g._flee(b, 3, 'crit');
  ok(b.fleeT > 0);
  ok(a);
});

test('копьё после подбора метают снова не раньше чем через ' + SPEAR.cool + ' секунд', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B');
  g.next();
  a.weapon = { kind: 'weapon', type: 'spear', rarity: 'common', power: 2 };
  b.x = a.x + 150;
  b.y = a.y;
  b.hp = 1;
  b.fleeT = 2;
  ok(g._canThrowSpear(a, b));
  // копьё лежит у ног — подбирает
  const spear = a.weapon;
  a.lost = { item: spear, rating: g._ratingWith(a, spear) };
  a.weapon = null;
  g._lay({ kind: 'weapon', item: spear, owner: 'a' }, a.x, a.y, 0);
  for (let i = 0; i < 3; i++) g.step(0.05);
  eq(a.weapon, spear);
  ok(a.spearCool > SPEAR.cool - 0.5);
  b.fleeT = 2;
  no(g._canThrowSpear(a, b));
  a.spearCool = 0;
  ok(g._canThrowSpear(a, b));
});

test('щит блокирует 20% ударов, ломается в 10% блоков, отбитый крит — 20%', () => {
  eq([SHIELD.block, SHIELD.breaks, SHIELD.breaks * SHIELD.critBreaks], [0.2, 0.1, 0.2]);
});

test('божественный амулет: 3% в гаче, второй не выпадает, пока есть первый', () => {
  const owner = { weapon: { type: 'sword' }, shield: false, nets: 0, amulet: false };
  let r = 0;
  const count = (o) => {
    let n = 0;
    for (let i = 0; i < 20000; i++) if (spin(() => ((r = (r * 9301 + 49297) % 233280) / 233280), o).kind === 'amulet') n++;
    return n / 20000;
  };
  const share = count(owner);
  ok(share > 0.02 && share < 0.04, String(share));
  eq(count(Object.assign({}, owner, { amulet: true })), 0);
});

test('божественный амулет спасает от смерти один раз и рассыпается', () => {
  const g = game({ settings: { death: 100 } });
  const [a, b] = join(g, 'A', 'B');
  a.amulet = true;
  g.next();
  a.hp = -1000;
  g._knockOut(a, b);
  eq(a.fate, 'down');
  no(a.amulet);
  b.hp = -1000;
  g._knockOut(b, a);
  eq(b.fate, 'dead');
  fight(g);
  const row = g.results.rows.find((x) => x.login === 'a');
  ok(row.saved);
  ok(g.members.has('a'));
});

test('амулет сохраняется между сессиями', () => {
  const store = new Map(), storage = { getItem: (k) => store.get(k) || null, setItem: (k, v) => store.set(k, v) };
  const roster = new Roster(storage, 'k');
  const g = new Game(SETTINGS, roster);
  g.open();
  g.feed('A', 'привет', { login: 'a' });
  g.members.get('a').amulet = true;
  roster.put(g.members.get('a'));
  roster.save();
  ok(new Roster(storage, 'k').get('a').amulet);
});

test('парагон: дорос до ' + PARAGON.level + ' уровня в лудусе — следующий бой он один против всех', () => {
  const g = game({ mode: null });
  const [a] = join(g, 'A', 'B', 'C', 'D');
  g.open();
  a.fights = PARAGON.fights;
  a.level = PARAGON.level - 1;
  a.xp = 0;
  g._gainXp(a, xpNeed(a.level));
  eq([g.nextMode, g.nextBoss], ['paragon', a]);
  g.next();
  eq([g.mode, g.boss], ['paragon', a]);
  const [, b, c] = g.fighters;
  ok(g._enemy(a, b) && g._enemy(c, a));
  no(g._enemy(b, c), 'остальные заодно');
});

test('парагон: после боя получает парагон и начинает с нуля, выжившие — много опыта', () => {
  const g = game({ settings: { death: 100 }, mode: null });
  const [a, b, c] = join(g, 'A', 'B', 'C');
  a.level = PARAGON.level;
  a.fights = PARAGON.fights;
  a.amulet = true;
  a.coins = 999;
  g.open();
  g.next();
  eq(g.mode, 'paragon');
  a.hp = -1000;
  g._knockOut(a, b);
  eq(a.fate, 'down', 'парагон не погибает');
  fight(g);
  const fresh = g.members.get('a');
  ok(fresh !== a);
  eq([fresh.level, fresh.paragon, fresh.points, fresh.coins, fresh.amulet, fresh.weapon],
    [1, 1, START_POINTS + PARAGON.points, START_COINS + PARAGON.coins, false, null]);
  eq(fresh.fights, 0, 'бои для следующего парагона считаются заново');
  eq(g.results.mode, 'paragon');
  eq(g.results.ascended.paragon, 1);
  for (const m of [b, c]) {
    const row = g.results.rows.find((r) => r.login === m.login);
    ok(row.xp >= PARAGON.reward.beaten.xp, m.login + ' ' + row.xp);
  }
});

test('парагон остаётся за игроком и после смерти', () => {
  const store = new Map(), storage = { getItem: (k) => store.get(k) || null, setItem: (k, v) => store.set(k, v) };
  const roster = new Roster(storage, 'k');
  const g = new Game(SETTINGS, roster);
  g.open();
  g.feed('A', 'привет', { login: 'a' });
  const a = g.members.get('a');
  a.paragon = 2;
  roster.put(a);
  roster.bury(a, 'B', 0);
  roster.save();
  const again = new Game(SETTINGS, new Roster(storage, 'k'));
  again.open();
  again.feed('A', 'привет', { login: 'a' });
  const b = again.members.get('a');
  eq([b.paragon, b.points, b.coins], [2, START_POINTS + 2 * PARAGON.points, START_COINS + 2 * PARAGON.coins]);
});

test('парагон только тем, кто провёл хотя бы ' + PARAGON.fights + ' боёв — афк-тренировкой не накопить', () => {
  const g = game({ mode: null });
  const [a] = join(g, 'A', 'B', 'C');
  a.level = PARAGON.level + 3;
  a.fights = PARAGON.fights - 1;
  g.open();
  no(g.nextMode === 'paragon');
  g.next();
  no(g.mode === 'paragon');
  fight(g);
  g.next();
  eq(g.members.get('a').fights, PARAGON.fights);
  eq(g.nextMode, 'paragon');
});

test('Яма со львами: раненым выходят львы слабее', () => {
  const mightFor = (part) => {
    const g = game({ mode: 'pit' });
    for (const m of join(g, 'A', 'B', 'C', 'D')) m.hp = maxHp(m) * part;
    g.next();
    return g.fighters.find((f) => f.lion).might;
  };
  ok(mightFor(0.4) < mightFor(1) * 0.8);
});

test('смертность: перебор урона почти не влияет, новичка крит не добивает чаще чем в 1.25 раза', () => {
  eq(deathChance(0.1, 0, 150), 0.1);
  ok(Math.abs(deathChance(0.1, 1000, 150) - 0.125) < 1e-9);
  eq(deathChance(1, 0, 150), 1);
});

test('за каждый удар по врагу — +' + HIT_REWARD.xp + ' опыта и +' + HIT_REWARD.coins + ' монеты к итогам', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B');
  g.next();
  g.random = () => 0.5;
  for (let i = 0; i < 3; i++) g._attack(a, b);
  eq(a.hitsNow, 3);
  b.fate = 'down';
  g._checkEnd();
  fight(g);
  const ra = g.results.rows.find((r) => r.login === 'a');
  eq(ra.hits, 3);
  ok(ra.coins >= HIT_REWARD.coins * 3 && ra.xp >= HIT_REWARD.xp * 3);
});

test('кровотечение: после крита течёт кровь, на бегу отнимает здоровье, павший с ним гибнет чаще', () => {
  const g = game({ settings: { death: 10 } });
  const [a, b] = join(g, 'A', 'B', 'C');
  g.next();
  b.bleedT = BLEED.time;
  b.bledBy = a;
  b.fleeT = BLEED.time + 1;
  b.fleeCool = 0;
  const hp = b.hp;
  for (let i = 0; i < 20 * BLEED.time + 5; i++) g.step(0.05);
  const lost = (hp - b.hp) / maxHp(b);
  ok(lost > BLEED.share * 0.8 && lost <= BLEED.share + 0.01, 'за всё кровотечение на бегу теряет ' + lost.toFixed(3));
  ok(g.events.some((e) => e.type === 'bleedtick'), 'урон от крови виден цифрой');
  let dead = 0;
  g.random = rng(5);
  for (let i = 0; i < 4000; i++) {
    b.fate = 'fight';
    b.hp = -1;
    b.bleedT = 1;
    g._knockOut(b, a);
    if (b.fate === 'dead') dead++;
  }
  const share = dead / 4000;
  ok(share > 0.12 && share < 0.18, 'с кровотечением гибнет ' + share.toFixed(3));
});

test('щит, отбивший удар, который был бы критом, ломается вдвое чаще', () => {
  const breaks = (crit) => {
    const g = game();
    const [a] = join(g, 'A', 'B');
    g.next();
    g.random = rng(11);
    let n = 0;
    for (let i = 0; i < 6000; i++) {
      a.shield = true;
      a.stunT = 0;
      if (g._blocked(a, crit) && !a.shield) n++;
    }
    return n;
  };
  const plain = breaks(false), hard = breaks(true);
  ok(hard > plain * 1.6 && hard < plain * 2.5, plain + ' → ' + hard);
});



test('кровотечение: стоя на месте здоровье не теряет', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B');
  g.next();
  b.bleedT = BLEED.time;
  b.bledBy = a;
  b.stunT = BLEED.time;
  const hp = b.hp;
  for (let i = 0; i < 40; i++) g.step(0.05);
  eq(b.hp, hp);
});

test('кровотечение замедляет на ' + BLEED.slow * 100 + '%', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B');
  g.next();
  const run = (bleeding) => {
    a.x = 300;
    a.y = 352;
    a.bleedT = bleeding ? 10 : 0;
    const x = a.x;
    g._walkTo(a, 600, 352, 0.5);
    return a.x - x;
  };
  const free = run(false), slow = run(true);
  ok(Math.abs(slow / free - (1 - BLEED.slow)) < 1e-9, free + ' → ' + slow);
  ok(b);
});

test('стенка на стенку: команды случайные, но поровну', () => {
  const sizes = new Set(), firsts = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const g = game({ mode: 'teams', random: rng(seed) });
    const people = join(g, 'A', 'B', 'C', 'D', 'E', 'F', 'G');
    g.next();
    const reds = people.filter((m) => m.team === 'red'), blues = people.filter((m) => m.team === 'blue');
    eq(reds.length + blues.length, 7);
    ok(Math.abs(reds.length - blues.length) === 1, 'разница не больше одного');
    sizes.add(reds.length);
    firsts.add(people[0].team);
    ok(g._enemy(reds[0], blues[0]));
    no(g._enemy(reds[0], reds[1]), 'свои');
    ok(Math.max(...reds.map((m) => m.x)) < Math.max(...blues.map((m) => m.x)), 'красные слева');
  }
  eq(sizes, new Set([3, 4]), 'лишний попадает то к красным, то к синим');
  eq(firsts.size, 2, 'один и тот же игрок попадает в разные команды');
});

test('стенка на стенку: бой до последней команды, победителям больше, устоявшим ещё больше, смерть возможна', () => {
  const g = game({ mode: 'teams', settings: { death: 100 } });
  const people = join(g, 'A', 'B', 'C', 'D');
  g.next();
  const [a, b, c, d] = people;
  // команды случайные — для проверки расставляем сами
  a.team = d.team = 'red';
  b.team = c.team = 'blue';
  b.hp = -5;
  g._knockOut(b, a);
  eq(b.fate, 'dead');
  c.fate = 'down';
  g._checkEnd();
  ok(g.endIn !== null, 'синих не осталось — конец');
  fight(g);
  const r = g.results;
  eq([r.mode, r.winTeam], ['teams', 'red']);
  const row = (m) => r.rows.find((x) => x.login === m.login);
  const base = (x) => x.xp - 3 * x.hits;
  ok(base(row(d)) >= TEAMS.reward.win.standing.xp, 'победитель устоял');
  ok(base(row(d)) > base(row(c)), 'павший проигравший — меньше');
  no(g.members.has('b'), 'погибший пропал');
  eq(a.team, null, 'после боя команд нет');
});

test('режимы: стенка на стенку выпадает так же часто, как все против всех', () => {
  const counts = { pit: 0, duel: 0, ffa: 0, teams: 0 };
  const random = rng(41);
  const g = new Game(clean({}), new Roster(), { random });
  for (let i = 0; i < 4000; i++) counts[g._rollMode()]++;
  ok(Math.abs(counts.teams - counts.ffa) < 250, JSON.stringify(counts));
  ok(counts.teams > 1200, JSON.stringify(counts));
});

test('испытание парагона: сети его не берут, здоровье и урон вдвое', () => {
  const g = game({ mode: null });
  const [a, b] = join(g, 'A', 'B', 'C');
  a.level = PARAGON.level;
  a.fights = PARAGON.fights;
  a.str = 5;
  a.agi = 4;
  a.vit = 6;
  a.hp = maxHp(a);
  const dmg = damageOf(a), hp = maxHp(a), crit = critOf(a), every = attackEvery(a);
  g.open();
  g.next();
  eq(g.boss, a);
  ok(Math.abs(damageOf(a) - dmg * PARAGON.boost) < 1e-9 && Math.abs(maxHp(a) - hp * PARAGON.boost) < 1e-9);
  eq([critOf(a), attackEvery(a)], [crit, every], 'ловкость не меняется');
  ok(Math.abs(a.hp - maxHp(a)) < 1e-9);
  g.random = () => 0.99;
  g._net(b, a);
  ok(!(a.stunT > 0), 'сеть не держит');
  fight(g);
  const fresh = g.members.get('a');
  ok(!fresh.might && fresh.str === 0);
});




test('двуручник: сектор 100° в сторону цели и в полтора маха длиной', () => {
  const g = game();
  const [a, t, far, side, tooFar] = join(g, 'A', 'T', 'Far', 'Side', 'TooFar');
  g.next();
  a.weapon = weapon('greatsword');
  const reach = reachOf(a);
  a.x = 400; a.y = 350;
  t.x = 400 + reach * 0.9; t.y = 350;
  const at = (v, deg, dist) => { v.x = 400 + Math.cos(deg * Math.PI / 180) * dist; v.y = 350 + Math.sin(deg * Math.PI / 180) * dist; };
  at(far, 45, reach * 1.45);
  at(side, 55, reach * 0.8);
  at(tooFar, 0, reach * 1.6);
  for (const v of [t, far, side, tooFar]) v.agi = 0;
  g.random = always(0.5);
  const hp = new Map([t, far, side, tooFar].map((v) => [v, v.hp]));
  g._swing(a, t, [a, t, far, side, tooFar]);
  ok(t.hp < hp.get(t) && far.hp < hp.get(far), 'цель и тот, что в секторе на полтора маха, задеты');
  eq([side.hp, tooFar.hp], [hp.get(side), hp.get(tooFar)], 'сбоку за 50° и дальше полутора махов — целы');
});

test('короткие команды характеристик: сил, лов, вын', () => {
  const g = game();
  const [a] = join(g, 'A', 'B');
  g.feed('A', 'сил', { login: 'a' });
  g.feed('A', 'лов', { login: 'a' });
  g.feed('A', 'вын', { login: 'a' });
  eq([a.str, a.agi, a.vit, a.points], [1, 1, 1, 0]);
});

test('ловкость ускоряет бег: +' + RUN_PER_AGI * 100 + '% за очко', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B');
  g.next();
  const run = (agi) => {
    a.agi = agi;
    a.x = 300;
    a.y = 352;
    g._walkTo(a, 700, 352, 0.5);
    return a.x - 300;
  };
  const slow = run(0), fast = run(10);
  ok(Math.abs(fast / slow - runOf({ agi: 10 })) < 1e-9 && runOf({ agi: 10 }) > 1.15, slow + ' → ' + fast);
  ok(b);
});

const legendary = (kind, extra) => Object.assign({ kind, rarity: 'legendary', power: 16 }, extra);

test('убил гладиатора насмерть — легендарное оружие становится божественным (×' + DIVINE.mult + '), гача его не меняет', () => {
  const g = game({ settings: { death: 100 } });
  const [a, b, c] = join(g, 'A', 'B', 'C');
  a.weapon = legendary('weapon', { type: 'sword' });
  a.gear.body = legendary('armor', { slot: 'body', power: 26 });
  g.next();
  b.hp = -5;
  g._knockOut(b, a);
  eq(a.weapon.rarity, 'divine');
  ok(Math.abs(weaponMult(a.weapon) - WEAPON_MULT.divine) < 1e-9, 'урон оружия — множитель божественного');
  eq(a.gear.body.rarity, 'legendary', 'сперва оружие, доспех ждёт следующего убийства');
  c.hp = -5;
  g._knockOut(c, a);
  eq([a.gear.body.rarity, a.gear.body.power], ['divine', 39]);
  eq(rarityOf('divine').color, DIVINE.color);
  const r = { kind: 'item', item: { kind: 'weapon', type: 'greatsword', rarity: 'legendary', power: 99 } };
  g._prize(a, r);
  ok(a.weapon.rarity === 'divine' && r.locked, 'гача не меняет оружие');
  g._prize(a, { kind: 'item', item: { kind: 'armor', slot: 'body', rarity: 'legendary', power: 99 } });
  eq(a.gear.body.rarity, 'divine', 'и доспех');
});

test('божественным становится случайный легендарный доспех, если оружие не легендарное', () => {
  const g = game({ settings: { death: 100 } });
  const [a, b] = join(g, 'A', 'B', 'C');
  a.weapon = { kind: 'weapon', type: 'sword', rarity: 'epic', power: 11 };
  a.gear.head = legendary('armor', { slot: 'head', power: 13 });
  a.gear.feet = legendary('armor', { slot: 'feet', power: 8 });
  a.gear.legs = { kind: 'armor', slot: 'legs', rarity: 'epic', power: 8 };
  g.next();
  b.hp = -5;
  g._knockOut(b, a);
  eq(a.weapon.rarity, 'epic');
  eq(a.gear.legs.rarity, 'epic');
  eq([a.gear.head.rarity, a.gear.feet.rarity].filter((x) => x === 'divine').length, 1, 'ровно одна вещь');
});

test('без смерти, льва или легендарных вещей божественного не бывает', () => {
  const g = game({ settings: { death: 0 } });
  const [a, b] = join(g, 'A', 'B', 'C');
  a.weapon = legendary('weapon', { type: 'sword' });
  g.next();
  b.hp = -5;
  g._knockOut(b, a);
  eq(b.fate, 'down');
  eq(a.weapon.rarity, 'legendary', 'просто повалил — не считается');
});

test('гача поднимает редкость своего оружия: вид и заточка те же; та же или ниже — выбрасывается', () => {
  const g = game();
  const [a] = join(g, 'A', 'B');
  a.weapon = { kind: 'weapon', type: 'sword', rarity: 'rare', sharp: 2 };
  g._prize(a, { kind: 'item', item: { kind: 'weapon', type: 'sword', rarity: 'epic' } });
  eq([a.weapon.type, a.weapon.rarity, a.weapon.sharp], ['sword', 'epic', 2]);
  const same = { kind: 'item', item: { kind: 'weapon', type: 'sword', rarity: 'epic' } };
  g._prize(a, same);
  no(same.equipped, 'та же — не меняет');
  g._prize(a, { kind: 'item', item: { kind: 'weapon', type: 'sword', rarity: 'rare' } });
  eq(a.weapon.rarity, 'epic', 'ниже — не меняет');
  a.gear.body = { kind: 'armor', slot: 'body', rarity: 'epic', power: 19 };
  g._prize(a, { kind: 'item', item: { kind: 'armor', slot: 'body', rarity: 'epic', power: 17 } });
  eq(a.gear.body.power, 19, 'доспех — по-прежнему только если крепче');
});

test('гача: оружие выпадает только своего вида; с легендарного оружия и доспеха они больше не выпадают', () => {
  const random = rng(5);
  const owner = { weapon: { type: 'trident', rarity: 'rare' }, gear: { head: { rarity: 'legendary' } }, shield: true, nets: 0,
    sand: 0, amulet: false };
  const kinds = new Set(), slots = new Set();
  for (let i = 0; i < 4000; i++) {
    const r = spin(random, owner);
    if (r.item && r.item.kind === 'weapon') kinds.add(r.item.type);
    if (r.item && r.item.kind === 'armor') slots.add(r.item.slot);
  }
  eq([...kinds], ['trident']);
  no(slots.has('head'), 'легендарный шлем — шлемов больше нет');
  owner.weapon.rarity = 'divine';
  for (let i = 0; i < 2000; i++) {
    const r = spin(random, owner);
    no(r.item && r.item.kind === 'weapon', 'божественное оружие не выпадает');
  }
  // всё легендарное, вторая рука занята, амулет есть — выпадать нечему: крутка не идёт и монеты целы
  const full = { weapon: { type: 'sword', rarity: 'legendary' }, shield: true, nets: 0, sand: 0, amulet: true,
    gear: { head: { rarity: 'legendary' }, body: { rarity: 'divine' }, legs: { rarity: 'legendary' }, feet: { rarity: 'legendary' } } };
  eq(spin(random, full), null);
  const g = game({ settings: { ludus: 900 } });
  const [a] = join(g, 'A');
  Object.assign(a, full, { coins: 100 });
  g.feed('A', 'гача', { login: 'a' });
  for (let i = 0; i < 20 * 20; i++) g.step(0.05);
  eq([g.spinNow, g.spins.length, a.coins], [null, 0, 100]);
});

test('гача: с одноручным оружием и пустой второй рукой щит, сеть и мешок с песком выпадают по 20%', () => {
  const share = (owner) => {
    const random = rng(9), counts = {};
    for (let i = 0; i < 30000; i++) {
      const r = spin(random, owner);
      counts[r.kind] = (counts[r.kind] || 0) + 1;
    }
    return ['shield', 'net', 'sand', 'amulet'].map((kind) => (counts[kind] || 0) / 30000);
  };
  const free = { shield: false, nets: 0, sand: 0, amulet: false };
  for (const type of ['sword', 'spear', 'trident']) {
    const [sh, net, sand, am] = share(Object.assign({ weapon: { type } }, free));
    ok([sh, net, sand].every((x) => Math.abs(x - 0.2) < 0.02) && Math.abs(am - 0.03) < 0.01, type + ': ' + [sh, net, sand, am]);
  }
  for (const type of ['greatsword', 'axe', 'hammer']) {
    eq(share(Object.assign({ weapon: { type } }, free)).slice(0, 3), [0, 0, 0], type + ' — никогда');
  }
  eq(share(Object.assign({ weapon: { type: 'sword' } }, free, { shield: true })).slice(0, 3), [0, 0, 0], 'рука занята — никогда');
  eq(share(Object.assign({ weapon: { type: 'sword' } }, free, { sand: 1 })).slice(0, 3), [0, 0, 0], 'мешок в руке — тоже');
});

test('кузня: выковал или перековал двуручное — вещь из второй руки пропадает', () => {
  const g = game();
  const [a, b, c] = join(g, 'A', 'B', 'C');
  for (const [m, hand] of [[a, { shield: true }], [b, { nets: 1 }], [c, { sand: 1 }]]) {
    Object.assign(m, { weapon: weapon('sword') }, hand);
    const result = { kind: 'reroll', type: 'axe', rarity: 'rare' };
    g._prize(m, result);
    eq([m.weapon.type, m.weapon.rarity, m.shield, m.nets, m.sand, result.offhandLost], ['axe', 'rare', false, 0, 0, true], m.name);
  }
  // одноручное — щит остаётся
  Object.assign(a, { weapon: weapon('sword'), shield: true });
  g._prize(a, { kind: 'reroll', type: 'trident', rarity: 'rare' });
  eq([a.weapon.type, a.shield], ['trident', true]);
});

test('гача: мешок с песком — во вторую руку, только если она свободна', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B');
  const r1 = { kind: 'sand' };
  g._prize(a, r1);
  eq([a.sand, r1.equipped], [1, true]);
  ok(g.lines.some((l) => l.text === 'A берёт мешок с песком' && l.kind === 'sand'));
  b.shield = true;
  const r2 = { kind: 'sand' };
  g._prize(b, r2);
  eq([b.sand, r2.equipped], [0, false]);
  g._prize(a, { kind: 'net' });
  eq(a.nets, 0, 'рука занята мешком — сеть не берётся');
});

test('секира раскалывает щит куда чаще меча', () => {
  for (const [type, broken] of [['axe', true], ['sword', false]]) {
    const g = game();
    const [a, b] = join(g, 'A', 'B');
    g.next();
    a.weapon = weapon(type);
    b.shield = true;
    b.agi = 0;
    // уклонение, крит, блок, поломка (0.5: меч — нет, секира — да)
    g.random = queue(0.99, 0.99, 0.01, 0.5);
    g._attack(a, b);
    eq(b.shield, !broken, type);
  }
});

test('молот бьёт реже и мажет чаще, зато оглушает: звёздочки, не бьёт и не уворачивается', () => {
  ok(attackEvery({ str: 0, agi: 0, weapon: weapon('hammer') }) > attackEvery({ str: 0, agi: 0, weapon: weapon('sword') }));
  const g = game();
  const [a, b] = join(g, 'A', 'B');
  g.next();
  a.weapon = weapon('hammer');
  b.agi = 0;
  // промах: уворот 5% + молот 12% — 0.15 мимо
  g.random = queue(0.15);
  const hp = b.hp;
  g._attack(a, b);
  eq(b.hp, hp, 'молот промахнулся');
  // уклонение, крит, разброс, оглушение
  g.random = queue(0.99, 0.99, 0.5, 0.01);
  g._attack(a, b);
  ok(b.stunT > 1 && b.dazed, 'оглушён');
  ok(g.events.some((e) => e.type === 'daze' && e.login === 'b'));
});

test('трезубец выбивает оружие: оно летит на песок, а безоружный бежит за ним', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B');
  g.next();
  a.weapon = weapon('trident');
  const sword = b.weapon = weapon('sword', 6);
  b.agi = 0;
  // уклонение, крит, разброс, выбить
  g.random = queue(0.99, 0.99, 0.5, 0.01);
  g._attack(a, b);
  eq(b.weapon, null, 'выбили');
  ok(g.projectiles.some((p) => p.kind === 'fling' && p.item === sword));
  g.random = rng(3);
  for (let i = 0; i < 20 * 3 && !g.ground.length; i++) g._stepProjectiles(0.05);
  const lying = g.ground.find((it) => it.item === sword);
  ok(lying && Math.hypot(lying.x - b.x, lying.y - b.y) > 60, 'улетело далеко');
  a.x = 50; a.y = 50;
  for (let i = 0; i < 20 * 8 && b.weapon !== sword && b.fate === 'fight'; i++) g._stepBattle(0.05);
  eq(b.weapon, sword, 'подобрал своё');
});

test('оружие на песке: берут лучшее, если до него вдвое ближе, чем до врага', () => {
  const setup = (rarity, far) => {
    const g = game();
    const [a, b] = join(g, 'A', 'B');
    g.next();
    a.weapon = weapon('sword');
    b.weapon = weapon('sword');
    a.x = 300; a.y = 300; b.x = 300 + 300; b.y = 300;
    const item = Object.assign(weapon('sword'), { rarity });
    g._lay({ kind: 'weapon', item, owner: 'x' }, a.x - far, a.y, 0);
    // dt побольше — шанс решиться сработает наверняка, и за этот шаг он дойдёт и поднимет
    g._seekGround(a, g._standing(), 10);
    return a.weapon === item;
  };
  ok(setup('legendary', 60), 'лучше и рядом — берёт');
  no(setup('rare', 60), 'не лучше — не берёт');
  no(setup('legendary', 200), 'дальше половины пути до врага — не берёт');
});

test('без оружия: бежит к ближайшему, что не хуже прежнего вдвое, иначе — за своим', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B');
  g.next();
  const mine = Object.assign(weapon('sword'), { rarity: 'legendary', sharp: 5 });
  a.weapon = mine;
  const rating = g._ratingWith(a, mine);
  a.weapon = null;
  a.lost = { item: mine, rating };
  a.x = 300; a.y = 300;
  b.stunT = 100;
  b.x = 700;
  g._lay({ kind: 'weapon', item: mine, owner: 'a' }, 450, 300, 0);
  const weak = { kind: 'weapon', type: 'sword', rarity: 'plain', sharp: 0 };
  g._lay({ kind: 'weapon', item: weak, owner: 'x' }, 330, 300, 0);
  ok(g._ratingWith(a, weak) < rating * 0.5);
  g._seekGround(a, g._standing(), 0.05);
  eq(a.goFor.item, mine, 'слабое рядом — бежит за своим');
  a.goFor = null;
  const fair = Object.assign(weapon('spear'), { rarity: 'epic', sharp: 3 });
  g._lay({ kind: 'weapon', item: fair, owner: 'x' }, 360, 300, 0);
  g._seekGround(a, g._standing(), 0.05);
  eq(a.goFor.item, fair, 'не хуже вдвое — ближайшее');
});

test('упавший роняет оружие и вещи; после боя всё возвращается владельцам, кроме сломанного и брошенного', () => {
  const g = game();
  const [a, b, c] = join(g, 'A', 'B', 'C');
  const swordA = a.weapon = weapon('sword', 5);
  const axeB = b.weapon = weapon('axe', 9);
  c.weapon = weapon('sword', 3);
  a.shield = true;
  c.sand = 1;
  g.next();
  g._knockOut(b, c);
  ok(g.ground.some((it) => it.item === axeB), 'секира на песке');
  // A подбирает чужую секиру, теряет щит (раскололся), C бросает мешок
  const it = g.ground.find((x) => x.item === axeB);
  g._pick(a, it);
  eq([a.weapon, a.weaponOf], [axeB, 'b']);
  ok(g.ground.some((x) => x.item === swordA), 'свой меч — на песке');
  g.random = queue(0.99, 0.99, 0.01, 0.01);
  a.weapon = swordA;
  g._attack(c, a);
  a.weapon = axeB;
  eq(a.shield, false, 'щит раскололся');
  g._throw(c, a, 'sand');
  eq(c.sand, 0);
  // в бою в хранилище — своё
  g.roster.put(a);
  eq(g.roster.data.get('a').weapon.type, 'sword');
  g.random = rng(4);
  g._endBattle();
  eq([a.weapon, a.shield, b.weapon, c.sand], [swordA, false, axeB, 0]);
  eq(g.ground.length, 0);
});

test('сеть после боя снова в руке, даже если её не успели подобрать', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B');
  a.nets = 1;
  g.next();
  a.netCool = 4;
  g._endBattle();
  eq([a.nets, a.netCool], [1, 0]);
});

test('убил чужим легендарным — качается не оружие, а доспех', () => {
  const g = game();
  const [a] = join(g, 'A', 'B');
  g.next();
  const blade = { kind: 'weapon', type: 'sword', rarity: 'legendary', power: 16 };
  a.weapon = blade;
  a.weaponOf = 'b';
  a.gear.body = { kind: 'armor', slot: 'body', rarity: 'legendary', power: 26 };
  g._bless(a);
  eq([a.weapon, a.gear.body.rarity], [blade, 'divine']);
  // своё легендарное — качается оружие, и после боя оно тоже божественное
  const own = { kind: 'weapon', type: 'axe', rarity: 'legendary', power: 16 };
  a.weapon = own;
  a.home.weapon = own;
  a.weaponOf = 'a';
  g._bless(a);
  eq([a.weapon.rarity, a.home.weapon.rarity], ['divine', 'divine']);
});

test('добил своим брошенным легендарным копьём — божественным становится копьё', () => {
  const g = game({ settings: { death: 100 } });
  const [a, b] = join(g, 'A', 'B', 'C');
  g.next();
  const spear = { kind: 'weapon', type: 'spear', rarity: 'legendary', power: 16 };
  a.weapon = spear;
  a.home.weapon = spear;
  a.gear.body = { kind: 'armor', slot: 'body', rarity: 'legendary', power: 26 };
  b.x = a.x + 150;
  b.y = a.y;
  b.hp = 1;
  b.fleeT = 2;
  b.agi = 0;
  g._throw(a, b, 'spear');
  eq(a.weapon, null);
  g.random = () => 0.5;
  for (let i = 0; i < 20 && g.projectiles.length; i++) g._stepProjectiles(0.05);
  eq(b.fate, 'dead');
  eq([spear.rarity, a.gear.body.rarity], ['divine', 'legendary'], 'качается копьё, а не доспех');
  ok(g.ground.some((it) => it.item === spear), 'божественное копьё лежит на песке');
  g._endBattle();
  eq(a.weapon.rarity, 'divine', 'и после боя оно у владельца божественное');
});

test('тренировка: у каждого столба два места, на занятое никто не встаёт; кому не хватило — разминается', () => {
  const g = game();
  const all = join(g, ...Array.from({ length: 40 }, (_, i) => 'T' + i));
  for (let i = 0; i < 20 * 20; i++) g.step(0.05);
  const spots = all.map((m) => m.spot).filter(Boolean);
  eq(new Set(spots).size, spots.length, 'у каждого своё место');
  ok(spots.every((id) => POST_SPOTS.some((s) => s.id === id) || WARM_SPOTS.some((s) => s.id === id)));
  // все места у столбов заняты — новичок идёт разминаться на песок
  all.forEach((m, i) => {
    m.spot = POST_SPOTS[i] ? POST_SPOTS[i].id : WARM_SPOTS[i].id;
  });
  const [late] = join(g, 'Late');
  ok(late.drill && WARM_SPOTS.some((s) => s.id === late.spot), 'разминается');
  eq(late.dummy, null);
  // у столба стоит лицом к нему
  const free = POST_SPOTS[0];
  all[0].spot = null;
  g.random = () => 0.9;
  const at = g._spot(late, 'train');
  eq([at.x, at.y, late.spot, late.spotFace], [free.x, free.y, free.id, free.face]);
});

const until = (g, done, seconds = 60) => {
  for (let i = 0; i < 20 * seconds && !done(); i++) g.step(0.05);
};
const idle = (g) => !g.forgeNow && !g.forging.length && !g.spinNow && !g.spins.length;

test('заточка: «улучшить» за 100 монет у точила, +1 за удачную; шанс падает, +10 — урон втрое', () => {
  eq(sharpChance(0), SHARPEN.chance);
  ok(Math.abs(sharpChance(5) / sharpChance(4) - SHARPEN.fall) < 1e-9, 'шанс падает в геометрической прогрессии');
  ok(sharpChance(9) < 0.2);
  const blade = { kind: 'weapon', type: 'sword', rarity: 'rare', sharp: 10 };
  ok(Math.abs(weaponMult(blade) - 3 * WEAPON_MULT.rare) < 1e-9, '+10 — втрое');
  const g = game({ settings: { ludus: 900 } });
  const [a] = join(g, 'A');
  g.feed('A', 'улучшить', { login: 'a' });
  eq(g.forging.length, 0, 'без оружия точить нечего');
  a.weapon = weapon('sword');
  a.coins = SHARPEN.price * 2 + 50;
  g.feed('A', 'улучшить все', { login: 'a' });
  eq([g.forging.length, a.place], [2, 'sharpen'], 'на сколько хватает денег; идёт к точилу');
  g.random = () => 0.01;
  until(g, () => idle(g));
  eq([a.weapon.sharp, a.coins, a.place], [2, 50, 'train']);
});

test('заточка: неудача — оружие цело, но с шансом 25% ломается; дальше +10 не точится', () => {
  const g = game();
  const [a] = join(g, 'A');
  a.weapon = Object.assign(weapon('axe'), { sharp: 6 });
  const seq = (...xs) => () => xs.shift();
  g.random = seq(0.99, 0.9);
  const miss = g._roll(a, { kind: 'sharpen' });
  eq([miss.ok, miss.broke, miss.to], [false, false, 6]);
  g._prize(a, miss);
  eq(a.weapon.sharp, 6, 'не вышло — заточка та же');
  g.random = seq(0.99, SHARPEN.breaks - 0.01);
  const broke = g._roll(a, { kind: 'sharpen' });
  ok(broke.broke);
  g.lines = [];
  g._prize(a, broke);
  eq(a.weapon, null, 'сломалось');
  eq(g.lines.map((l) => l.kind), ['broke']);
  a.weapon = Object.assign(weapon('sword'), { sharp: SHARPEN.max });
  a.coins = 1000;
  g.feed('A', 'улучшить', { login: 'a' });
  for (let i = 0; i < 20 * 10; i++) g.step(0.05);
  eq([a.weapon.sharp, a.coins], [SHARPEN.max, 1000], '+10 — предел, монеты целы');
});

test('перековка: «реролл» за 300 — другой вид, та же редкость, заточка сначала', () => {
  const g = game({ settings: { ludus: 900 } });
  const [a] = join(g, 'A');
  a.weapon = { kind: 'weapon', type: 'sword', rarity: 'epic', sharp: 3 };
  a.coins = REFORGE.price + 10;
  g.feed('A', 'реролл', { login: 'a' });
  g.feed('A', 'реролл', { login: 'a' });
  eq([g.forging.length, a.place], [1, 'forge'], 'одна перековка за раз; идёт к наковальне');
  until(g, () => idle(g));
  ok(a.weapon.type !== 'sword' && TYPES.includes(a.weapon.type), a.weapon.type);
  eq([a.weapon.rarity, a.weapon.sharp, a.coins, a.place], ['epic', 0, 10, 'train']);
  for (let i = 0; i < 300; i++) ok(forgeSpin(Math.random, 'axe') !== 'axe');
});

test('мешок с песком бросают, только когда у самого меньше половины здоровья; слепота — на ' + SAND.time + ' с', () => {
  const thrown = (part) => {
    const g = game();
    const [a, b] = join(g, 'A', 'B');
    g.next();
    Object.assign(a, { weapon: weapon('sword'), sand: 1, x: 300, y: 360 });
    Object.assign(b, { x: 420, y: 360, stunT: 100 });
    a.hp = maxHp(a) * part;
    g.random = () => 0.01;
    g._stepBattle(0.5);
    return a.sand === 0;
  };
  no(thrown(0.9), 'здоровья много — держит');
  ok(thrown(0.4), 'меньше половины — бросает');
  eq(SAND.time, 10);
});

test('мешок с песком слепит врагов вокруг цели (своих в стенке — нет), слепой мажет чаще', () => {
  const g = game({ mode: 'teams' });
  const all = join(g, 'A', 'B', 'C', 'D');
  g.next();
  const [a] = all;
  const mates = all.filter((m) => m.team === a.team), foes = all.filter((m) => m.team !== a.team);
  for (const m of all) {
    m.x = 400;
    m.y = 300;
  }
  a.x = 200;
  g._sand(a, 400, 300);
  ok(foes.every((m) => m.blindT === SAND.time), 'враги ослепли');
  ok(mates.every((m) => !(m.blindT > 0)), 'свои — нет');
  const blind = foes[0], target = mates[mates.length - 1];
  target.agi = 0;
  g.random = queue(0.3);
  const hp = target.hp;
  g._attack(blind, target);
  eq(target.hp, hp, 'слепой промахнулся');
});

test('копейщик может метнуть копьё и в далёкую цель, а в ближнюю — нет', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B');
  g.next();
  a.weapon = weapon('spear');
  g.random = () => 0;
  ok(g._canThrowFar(a, b, SPEAR.far + 20, 0.05), 'далеко — может');
  no(g._canThrowFar(a, b, SPEAR.far - 20, 0.05), 'близко — бьёт в руках');
  a.spearCool = 1;
  no(g._canThrowFar(a, b, SPEAR.far + 20, 0.05), 'после подбора — ждёт');
  a.spearCool = 0;
  a.weapon = weapon('sword');
  no(g._canThrowFar(a, b, SPEAR.far + 20, 0.05), 'только копьё');
});

test('ловкость сверх потолка уворота даёт больше крита', () => {
  const at = (agi) => critOf({ agi, weapon: weapon('sword') });
  const before = at(AGI_CAP) - at(AGI_CAP - 1), after = at(AGI_CAP + 1) - at(AGI_CAP);
  ok(after > before * 1.9, before + ' → ' + after);
  eq(dodgeOf({ agi: AGI_CAP + 10 }), dodgeOf({ agi: AGI_CAP }), 'уворот упёрся в потолок');
});

test('выносливость: +' + HP_PER_VIT + ' здоровья за очко', () => {
  eq(maxHp({ level: 1, vit: 1 }) - maxHp({ level: 1, vit: 0 }), 25);
});

test('испытание парагона: от критов не убегает, кровотечения нет, а его жертвы гибнут как обычно', () => {
  const g = game({ mode: null, settings: { death: 100 } });
  const [a, b, c] = join(g, 'A', 'B', 'C');
  a.level = PARAGON.level;
  a.fights = PARAGON.fights;
  g.open();
  g.next();
  eq(g.boss, a);
  a.hp = 1e6;
  g.random = () => 0;
  for (let i = 0; i < 5; i++) g._attack(b, a);
  ok(!(a.fleeT > 0), 'не убегает от крита');
  ok(!(a.bleedT > 0), 'кровь не течёт');
  // и от тяжёлых ран не бежит
  a.hp = maxHp(a) * 0.1;
  a.fleeCool = 0;
  for (let i = 0; i < 20; i++) g._stepBattle(0.05);
  ok(!(a.fleeT > 0), 'израненный не убегает');
  c.hp = -5;
  g._knockOut(c, a);
  eq(c.fate, 'dead', 'убитый парагоном погибает как обычно');
});

test('сеть бросают и вплотную, не только издали — иначе на дуэли сеть часто так и не летит', () => {
  const g = game({ mode: 'duel' });
  join(g, 'A', 'B', 'C');
  g.next();
  g.next();
  const { left, right } = g.duel;
  left.nets = 1;
  left.shield = false;
  left.weapon = weapon('sword');
  right.x = left.x + 30;
  right.y = left.y;
  left.target = right;
  left.retarget = 10;
  let thrown = false;
  for (let i = 0; i < 20 * 15 && !thrown; i++) {
    g.step(0.05);
    thrown = g.events.some((e) => e.type === 'throw' && e.kind === 'net' && e.login === left.login);
  }
  ok(thrown, 'вплотную сеть тоже летит');
});

test('добили критом — гибнет в ' + CRIT_KILL + ' раза чаще', () => {
  const g = game({ settings: { death: 10 } });
  const [a, b] = join(g, 'A', 'B', 'C');
  g.next();
  const rate = (crit) => {
    g.random = rng(21);
    let dead = 0;
    for (let i = 0; i < 6000; i++) {
      b.fate = 'fight';
      b.hp = -1;
      b.bleedT = 0;
      g._knockOut(b, a, crit);
      if (b.fate === 'dead') dead++;
    }
    return dead / 6000;
  };
  const plain = rate(false), hard = rate(true);
  ok(hard / plain > 1.35 && hard / plain < 1.65, plain + ' → ' + hard);
});

test('брошенное копьё: крит вдвое чаще, но промах на 20% чаще', () => {
  const g = game();
  const [a, b] = join(g, 'A', 'B', 'C');
  g.next();
  a.weapon = weapon('spear');
  b.agi = 0;
  b.shield = false;
  const stats = (ranged) => {
    g.random = rng(13);
    let miss = 0, crit = 0;
    const N = 8000;
    for (let i = 0; i < N; i++) {
      b.hp = 1e9;
      b.fate = 'fight';
      const was = g.events.length;
      g._attack(a, b, { ranged });
      const e = g.events[g.events.length - 1];
      if (e.type === 'miss') miss++;
      else if (e.type === 'hit' && e.crit) crit++;
    }
    return [miss / N, crit / N];
  };
  const [m0, c0] = stats(false), [m1, c1] = stats(true);
  ok(Math.abs(m1 - m0 - SPEAR.miss) < 0.03, 'промах ' + m0 + ' → ' + m1);
  ok(c1 / (1 - m1) > c0 / (1 - m0) * 1.7, 'крит ' + c0 + ' → ' + c1);
});

test('сдаться командой нельзя: «сдаюсь» — просто сообщение в чат', () => {
  const g = game();
  const [a] = join(g, 'A', 'B', 'C');
  g.next();
  g.feed('A', 'сдаюсь', { login: 'a' });
  eq(a.fate, 'fight');
});

// движковые тесты не трогают отрисовку — а синтаксическая ошибка в ней ломает весь оверлей; проверяем, что модули грузятся
test('все модули оверлея и страницы загружаются без синтаксических ошибок', async () => {
  for (const name of ['draw', 'view', 'art', 'rules', 'stars', 'sound', 'demo', 'chat', 'config', 'overlay', 'page']) {
    try {
      await import('../../site/js/' + name + '.js');
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(name + '.js: ' + error.message);
    }
  }
});

test('парагон: «Дальше» меняется, когда претендент заходит посреди лудуса, и возвращается, когда он садится на скамью', () => {
  const store = new Map(), storage = { getItem: (k) => store.get(k) || null, setItem: (k, v) => store.set(k, v) };
  const roster = new Roster(storage, 'k');
  const first = new Game(SETTINGS, roster, { random: rng(3) });
  first.open();
  first.feed('Hero', 'привет', { login: 'hero' });
  Object.assign(first.members.get('hero'), { level: PARAGON.level, fights: PARAGON.fights });
  roster.put(first.members.get('hero'));
  roster.save();
  const g = new Game(SETTINGS, new Roster(storage, 'k'), { random: rng(5) });
  g.open();
  join(g, 'A', 'B');
  const rolled = g.nextMode;
  no(rolled === 'paragon');
  g.feed('Hero', 'привет', { login: 'hero' });
  eq([g.nextMode, g.nextBoss && g.nextBoss.login], ['paragon', 'hero'], 'зашёл — сверху сразу испытание');
  g.feed('Hero', 'отдых', { login: 'hero' });
  eq([g.nextMode, g.nextBoss], [rolled, null], 'сел на скамью — прежний режим');
  g.feed('Hero', 'трен', { login: 'hero' });
  eq(g.nextMode, 'paragon');
  g.next();
  eq([g.mode, g.boss && g.boss.login], ['paragon', 'hero'], 'и бой — тот, что написан сверху');
});

test('настройки: окошко под вебку — без вебки, с вебкой, витубер; старые ссылки читаются', () => {
  eq(['none', 'cam', 'vtuber', '0', '1', 'false', ''].map((webcam) => clean({ webcam }).webcam),
    ['none', 'cam', 'vtuber', 'none', 'cam', 'none', 'none']);
  eq([clean({ webcam: true }).webcam, clean({ webcam: false }).webcam, clean({}).webcam], ['cam', 'none', 'cam']);
  eq([toQuery({ webcam: 'vtuber' }), toQuery({ webcam: 'cam' }), toQuery({ bg: false })], ['webcam=vtuber', '', '']);
  eq(fromQuery('?webcam=0&bg=0').webcam, 'none');
  no('bg' in clean({ bg: false }));
});

test('статистика: отметка о запуске — только с каналом и только с сайта gamesonstream.ru', () => {
  eq(playNote('gladiatory', { channel: '', webcam: 'cam' }, false), null);
  eq(playNote('gladiatory', { channel: 'some_one', webcam: 'vtuber' }, true),
    { game: 'gladiatory', channel: 'some_one', mode: 'vtuber', place: 'browser' });
  eq(playNote('gladiatory', { channel: 'some_one', webcam: 'none' }, false).place, 'obs');
  eq([reportPlay({ game: 'x' }, '127.0.0.1'), reportPlay({ game: 'x' }, 'sumaizu.github.io'), reportPlay(null, 'gamesonstream.ru')],
    [false, false, false]);
});
