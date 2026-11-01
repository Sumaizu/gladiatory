// симулятор баланса: те же бои, что в игре, только без экрана и быстро. Запуск — python tools/sim.py [опыт]
import { POINTS_PER_LEVEL, START_POINTS, maxHp } from '../site/js/balance.js';
import { clean } from '../site/js/config.js';
import { Game, Roster } from '../site/js/engine.js';
import { RARITIES, makeItem } from '../site/js/gacha.js';

const TYPES = ['sword', 'greatsword', 'spear', 'axe', 'hammer', 'trident'];
const SLOTS = ['head', 'body', 'legs', 'feet'];

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const rarity = (id) => RARITIES.find((r) => r.id === id);

// очки уровня раскладываются по сборке: { str, agi, vit } — доли
function stats(level, build = { str: 1, agi: 1, vit: 1 }) {
  const total = START_POINTS + (level - 1) * POINTS_PER_LEVEL, sum = build.str + build.agi + build.vit;
  const str = Math.round(total * build.str / sum), agi = Math.round(total * build.agi / sum);
  return { str, agi, vit: total - str - agi };
}

// боец: уровень, сборка, оружие (тип и редкость), доспехи (редкость на все слоты или null), вторая рука
function kit(spec, random) {
  const s = stats(spec.level || 5, spec.build);
  const weapon = spec.weapon === null ? null
    : Object.assign(makeItem(() => 0.5, 'weapon', rarity(spec.rarity || 'rare'), spec.weapon || 'sword'));
  const gear = { head: null, body: null, legs: null, feet: null };
  if (spec.armor) for (const slot of SLOTS) gear[slot] = makeItem(() => 0.5, 'armor', rarity(spec.armor), slot);
  return Object.assign({ level: spec.level || 5, weapon, gear, shield: false, nets: 0, sand: 0 }, s,
    spec.hand === 'shield' ? { shield: true } : spec.hand === 'net' ? { nets: 1 } : spec.hand === 'sand' ? { sand: 1 } : {},
    spec.extra || {});
}

// один бой: specs — бойцы, mode — режим. Возвращает исход по каждому бойцу: fight / down / dead и долю здоровья
function battle(specs, { mode = 'ffa', seed = 1, death = 0, boss = -1 } = {}) {
  const random = rng(seed);
  const game = new Game(clean({ ludus: 60, battle: 90, death }), new Roster(), { random, now: () => 1000 });
  game.forceMode = mode;
  game.open();
  specs.forEach((spec, i) => {
    game.feed('P' + i, 'трен', { login: 'p' + i });
    const g = game.members.get('p' + i);
    Object.assign(g, kit(spec, random));
    if (i === boss) Object.assign(g, { level: 10, fights: 30 });
    g.hp = maxHp(g);
  });
  const hp = new Map();
  game.next();
  if (game.duel) game.next();
  for (let i = 0; i < 200 && game.state === 'battle'; i++) {
    for (const g of game.fighters) hp.set(g.login, Math.max(0, g.hp) / maxHp(g));
    game.step(1);
  }
  const rows = game.results ? game.results.rows : [];
  return { rows: specs.map((spec, i) => {
    const row = rows.find((r) => r.login === 'p' + i);
    return { fate: row ? row.fate : 'none', hp: hp.get('p' + i) || 0 };
  }), results: game.results };
}

// 1 на 1: доля побед первого (кто устоял; оба устояли — у кого больше здоровья), стороны меняются
function duel(a, b, n = 200, seed = 1) {
  let wins = 0;
  for (let i = 0; i < n; i++) {
    const swap = i % 2 === 1, r = battle(swap ? [b, a] : [a, b], { seed: seed + i * 7919 }).rows;
    const [ra, rb] = swap ? [r[1], r[0]] : r;
    const score = (x) => (x.fate === 'fight' ? 1 + x.hp : 0);
    if (score(ra) > score(rb)) wins++;
    else if (score(ra) === score(rb)) wins += 0.5;
  }
  return wins / n;
}

const pct = (x) => (x * 100).toFixed(0).padStart(4) + '%';
const pad = (text, n) => String(text).padEnd(n);

const EXPERIMENTS = {
  // проверка самого симулятора: сколько в бою ударов и сколько устояло
  check() {
    const out = ['', 'Проверка: 1 на 1 и 12 бойцов'];
    for (const people of [2, 12]) {
      let hits = 0, standing = 0;
      for (let i = 0; i < 20; i++) {
        const specs = Array.from({ length: people }, (_, k) => ({ level: 5, weapon: TYPES[k % 6], rarity: 'rare' }));
        const { rows, results } = battle(specs, { seed: 7 + i });
        hits += results ? results.rows.reduce((sum, r) => sum + r.hits, 0) : 0;
        standing += rows.filter((r) => r.fate === 'fight').length;
      }
      out.push(people + ' бойцов: ударов за бой ' + (hits / 20).toFixed(0) + ', устояло ' + (standing / 20).toFixed(1));
    }
    return out;
  },
  // оружие 1 на 1: одинаковые бойцы, одна редкость, разное оружие
  weapons() {
    const out = [];
    for (const [level, rare, armor] of [[3, 'common', null], [6, 'mythic', 'rare'], [12, 'legendary', 'epic']]) {
      out.push('', `Оружие 1 на 1 — ${level} ур., оружие ${rare}, доспехи ${armor || 'нет'} (строка против столбца):`);
      out.push(pad('', 12) + TYPES.map((t) => pad(t, 11)).join('') + 'среднее');
      for (const a of TYPES) {
        const row = TYPES.map((b) => (a === b ? 0.5 : duel({ level, weapon: a, rarity: rare, armor }, { level, weapon: b, rarity: rare, armor }, 120)));
        out.push(pad(a, 12) + row.map((x) => pad(pct(x), 11)).join('') + pct(row.reduce((s, x) => s + x, 0) / row.length));
      }
    }
    return out;
  },
  // как в игре: у одноручного во второй руке щит, сеть или мешок (по очереди), у двуручного — ничего
  real() {
    const out = [], ONE = ['sword', 'spear', 'trident'], HANDS = ['shield', 'net', 'sand'];
    const spec = (type, level, rare, armor, i) => ({ level, weapon: type, rarity: rare, armor,
      hand: ONE.includes(type) ? HANDS[i % 3] : 'none' });
    for (const [level, rare, armor] of [[3, 'common', null], [6, 'mythic', 'rare'], [12, 'legendary', 'epic']]) {
      out.push('', `Как в игре, 1 на 1 — ${level} ур., ${rare}, доспехи ${armor || 'нет'}; одноручным — вещь во вторую руку:`);
      out.push(pad('', 12) + TYPES.map((t) => pad(t, 11)).join('') + 'среднее');
      for (const a of TYPES) {
        const row = TYPES.map((b) => {
          if (a === b) return 0.5;
          let sum = 0;
          for (let i = 0; i < 3; i++) sum += duel(spec(a, level, rare, armor, i), spec(b, level, rare, armor, i + 1), 40, 11 + i * 1000);
          return sum / 3;
        });
        out.push(pad(a, 12) + row.map((x) => pad(pct(x), 11)).join('') + pct(row.reduce((s, x) => s + x, 0) / row.length));
      }
    }
    const champ = {}, n = 200;
    for (const t of TYPES) champ[t] = 0;
    for (let i = 0; i < n; i++) {
      const specs = Array.from({ length: 12 }, (_, k) => spec(TYPES[(k + i) % 6], 6, 'mythic', 'rare', k + i));
      const { results } = battle(specs, { seed: 7000 + i * 29 });
      specs.forEach((sp, k) => {
        if (results && results.champion === 'p' + k) champ[sp.weapon]++;
      });
    }
    out.push('', 'Как в игре, все против всех, 12 бойцов 6 ур. — кто стал чемпионом (честно — 17%):');
    for (const t of TYPES) out.push(pad(t, 12) + pct(champ[t] / n));
    return out;
  },
  // оружие в общей свалке: 12 бойцов, оружие по кругу; кто чаще устоял и стал чемпионом
  ffa() {
    const stand = {}, champ = {}, kos = {};
    for (const t of TYPES) stand[t] = champ[t] = kos[t] = 0;
    const n = 150;
    for (let i = 0; i < n; i++) {
      const specs = Array.from({ length: 12 }, (_, k) => ({ level: 6, weapon: TYPES[(k + i) % 6], rarity: 'mythic', armor: 'rare' }));
      const { rows, results } = battle(specs, { seed: 100 + i * 31 });
      rows.forEach((r, k) => {
        const t = specs[k].weapon;
        if (r.fate === 'fight') stand[t]++;
        if (results && results.champion === 'p' + k) champ[t]++;
        const row = results && results.rows.find((x) => x.login === 'p' + k);
        kos[t] += row ? row.kos : 0;
      });
    }
    return ['', 'Все против всех, 12 бойцов 6 ур. (по двое с каждым оружием), ' + n + ' боёв:',
      pad('', 12) + 'чемпион    устоял     нокаутов за бой',
      ...TYPES.map((t) => pad(t, 12) + pad(pct(champ[t] / n), 11) + pad(pct(stand[t] / (n * 2)), 11) + (kos[t] / (n * 2)).toFixed(2))];
  },
  // вторая рука: меч с щитом / сетью / мешком против меча с пустой рукой и против двуручных
  hands() {
    const out = ['', 'Вторая рука, 1 на 1, 6 ур., оружие mythic, доспехи rare (доля побед):'];
    const base = { level: 6, rarity: 'mythic', armor: 'rare' };
    out.push(pad('', 18) + ['sword', 'greatsword', 'axe', 'hammer', 'trident'].map((t) => pad('vs ' + t, 15)).join(''));
    for (const hand of ['none', 'shield', 'net', 'sand']) {
      const me = Object.assign({ weapon: 'sword', hand }, base);
      out.push(pad('меч + ' + hand, 18) + ['sword', 'greatsword', 'axe', 'hammer', 'trident']
        .map((t) => pad(pct(duel(me, Object.assign({ weapon: t }, base), 160)), 15)).join(''));
    }
    // мешок в свалке: 12 бойцов с мечами, у троих — мешок, у троих — щит, у троих — сеть
    const share = { none: [0, 0], shield: [0, 0], net: [0, 0], sand: [0, 0] }, n = 150;
    for (let i = 0; i < n; i++) {
      const hands = ['none', 'shield', 'net', 'sand'];
      const specs = Array.from({ length: 12 }, (_, k) => Object.assign({ weapon: 'sword', hand: hands[(k + i) % 4] }, base));
      const { rows } = battle(specs, { seed: 500 + i * 13 });
      rows.forEach((r, k) => {
        share[specs[k].hand][0] += r.fate === 'fight' ? 1 : 0;
        share[specs[k].hand][1]++;
      });
    }
    out.push('', 'В свалке из 12 мечников (по трое с каждой второй рукой) — доля устоявших:');
    for (const [hand, [ok, all]] of Object.entries(share)) out.push(pad(hand, 12) + pct(ok / all));
    return out;
  },
  // характеристики: все очки в одну — сила, ловкость, выносливость — 1 на 1
  stats() {
    const out = [];
    const builds = { сила: { str: 1, agi: 0, vit: 0 }, ловкость: { str: 0, agi: 1, vit: 0 }, выносл: { str: 0, agi: 0, vit: 1 },
      поровну: { str: 1, agi: 1, vit: 1 }, 'сил 2:1:1': { str: 2, agi: 1, vit: 1 }, 'лов 2:1:1': { str: 1, agi: 2, vit: 1 },
      'вын 2:1:1': { str: 1, agi: 1, vit: 2 } };
    for (const [level, rare, armor] of [[5, 'rare', null], [10, 'epic', 'rare'], [20, 'legendary', 'epic']]) {
      out.push('', `Характеристики 1 на 1 — ${level} ур., меч ${rare}, доспехи ${armor || 'нет'}:`);
      const names = Object.keys(builds);
      out.push(pad('', 11) + names.map((t) => pad(t, 11)).join('') + 'среднее');
      for (const a of names) {
        const row = names.map((b) => (a === b ? 0.5
          : duel({ level, build: builds[a], weapon: 'sword', rarity: rare, armor }, { level, build: builds[b], weapon: 'sword', rarity: rare, armor }, 120)));
        out.push(pad(a, 11) + row.map((x) => pad(pct(x), 11)).join('') + pct(row.reduce((s, x) => s + x, 0) / row.length));
      }
    }
    return out;
  },
  // яма со львами: доля побед и гибель гладиаторов при разной численности и снаряжении
  pit() {
    const out = ['', 'Яма со львами (смерть 10%): победы гладиаторов, сколько пало и погибло в среднем'];
    const tiers = { новички: { level: 1, weapon: null }, середняки: { level: 5, rarity: 'rare', armor: 'common' },
      ветераны: { level: 10, rarity: 'epic', armor: 'rare' }, вперемешку: null };
    for (const [name, tier] of Object.entries(tiers)) {
      for (const people of [3, 6, 10]) {
        let won = 0, down = 0, dead = 0;
        const n = 120;
        for (let i = 0; i < n; i++) {
          const specs = Array.from({ length: people }, (_, k) => {
            if (tier) return Object.assign({ weapon: TYPES[(k + i) % 6] }, tier, tier.weapon === null ? { weapon: null } : {});
            const pick = [{ level: 1, weapon: null }, { level: 4, weapon: TYPES[k % 6], rarity: 'common' },
              { level: 8, weapon: TYPES[(k + 2) % 6], rarity: 'epic', armor: 'rare' }][(k + i) % 3];
            return pick;
          });
          const { rows, results } = battle(specs, { mode: 'pit', seed: 900 + i * 17 + people, death: 10 });
          if (results && results.lionsDown === results.lions) won++;
          down += rows.filter((r) => r.fate !== 'fight').length;
          dead += rows.filter((r) => r.fate === 'dead').length;
        }
        out.push(pad(name, 12) + pad(people + ' бойц.', 9) + 'победы ' + pct(won / n) + '   пало ' + (down / n).toFixed(1)
          + '   погибло ' + (dead / n).toFixed(2));
      }
    }
    return out;
  },
  // испытание парагона: 10 ур. со снаряжением против толпы
  paragon() {
    const out = ['', 'Испытание парагона (10 ур., epic + доспехи rare): выстоял ли он'];
    for (const [crowd, tier] of [[4, { level: 3, rarity: 'common' }], [8, { level: 3, rarity: 'common' }],
      [6, { level: 6, rarity: 'mythic', armor: 'common' }], [10, { level: 6, rarity: 'mythic', armor: 'common' }]]) {
      let stood = 0;
      const n = 100;
      for (let i = 0; i < n; i++) {
        const specs = [{ level: 10, weapon: TYPES[i % 6], rarity: 'epic', armor: 'rare' },
          ...Array.from({ length: crowd }, (_, k) => Object.assign({ weapon: TYPES[(k + i) % 6] }, tier))];
        const { rows } = battle(specs, { mode: null, seed: 3000 + i * 11, boss: 0 });
        if (rows[0].fate === 'fight') stood++;
      }
      out.push(pad(crowd + ' против него, ' + tier.level + ' ур.', 26) + 'выстоял ' + pct(stood / n));
    }
    return out;
  },
};

export async function run(only = '') {
  const lines = [];
  for (const [name, experiment] of Object.entries(EXPERIMENTS)) {
    if (only && !only.split(',').includes(name)) continue;
    const t0 = performance.now();
    lines.push(...experiment());
    lines.push('  (' + ((performance.now() - t0) / 1000).toFixed(1) + ' с)');
  }
  return lines.join('\n');
}
