export const START_COINS = 20;
export const START_POINTS = 3;
export const POINTS_PER_LEVEL = 2;
export const LEVEL_MAX = 99;

export const HP_BASE = 150;
export const HP_PER_LEVEL = 6;
export const HP_PER_VIT = 15;
export const DAMAGE_BASE = 10;
export const DAMAGE_PER_STR = 2;
export const SPREAD = 0.15;
export const ATTACK_EVERY = 1.25;
export const HASTE_PER_AGI = 0.04;
export const DODGE_BASE = 0.05;
export const DODGE_PER_AGI = 0.012;
export const DODGE_MAX = 0.35;
export const CRIT_BASE = 0.05;
export const CRIT_PER_AGI = 0.006;
export const CRIT_HIT = 1.75;

export const STATS = [
  { id: 'str', name: 'Сила', words: ['сила', 'сил'], text: '+' + DAMAGE_PER_STR + ' к урону' },
  { id: 'agi', name: 'Ловкость', words: ['ловкость', 'лов'], text: 'быстрее бьёт, чаще уворачивается и критует' },
  { id: 'vit', name: 'Выносливость', words: ['выносливость', 'вын'], text: '+' + HP_PER_VIT + ' к здоровью' },
];


// цена следующей ступени оружия или доспеха
export const gearPrice = (tier) => Math.round(30 * Math.pow(tier + 1, 1.5) / 5) * 5;

// в лудусе, доля здоровья в секунду
export const HEAL_RATE = { rest: 0.003, heal: 0.015, train: 0 };
export const BEATEN_HP = 0.15;
export const TRAIN_XP = 0.4;

export const MOVE_SPEED = 70;
export const REACH = 36;
export const BODY = 28;

// выстоявшие получают чуть больше сдавшихся, но не в разы — чтобы чемпион не улетал по уровню
export const REWARD = {
  standing: { xp: 30, coins: 25, xpPerKo: 8, coinsPerKo: 8 },
  beaten: { xp: 25, coins: 18, xpPerKo: 8, coinsPerKo: 5 },
  champion: 1.25,
};

export const xpNeed = (level) => Math.round(40 * Math.pow(level, 1.4));

export function maxHp(g) {
  return HP_BASE + HP_PER_LEVEL * (g.level - 1) + HP_PER_VIT * g.vit;
}

// виды оружия из гачи. rate — во сколько раз реже удар, dmg — множитель урона, reach — дальность,
// hands: 2 — щит не работает, cleave — бьёт всех перед собой, pierce — урон сквозь броню, throw — бросок
export const WEAPON_TYPES = {
  fists: { name: 'кулаки', gender: 'p', rate: 0.85, dmg: 0.6, reach: 0.85, crit: 0, hands: 1 },
  sword: { name: 'меч', gender: 'm', rate: 1, dmg: 1, reach: 1, crit: 0, hands: 1 },
  greatsword: { name: 'двуручный меч', gender: 'm', rate: 1.5, dmg: 1.6, reach: 1.1, crit: 0.1, hands: 2, cleave: true },
  spear: { name: 'копьё', gender: 'n', rate: 1.1, dmg: 1, reach: 1.6, crit: 0, hands: 1, pierce: true, throw: 2.2 },
};
// без оружия — кулаки
export const typeOf = (g) => (g.weapon ? WEAPON_TYPES[g.weapon.type] || WEAPON_TYPES.sword : WEAPON_TYPES.fists);
export const reachOf = (g) => REACH * typeOf(g).reach;
export const twoHanded = (g) => typeOf(g).hands === 2;
export const shieldUp = (g) => Boolean(g.shield) && !twoHanded(g);
export const netUp = (g) => g.nets > 0 && !g.shield && !twoHanded(g);
// вторая рука: щит или сеть. Занята или в руках двуручник — ни щит, ни сеть из гачи не выпадают
export const offhandFree = (g) => !g.shield && !(g.nets > 0) && !twoHanded(g);
export const SHIELD = { block: 0.25, breaks: 0.08 };
// сеть многоразовая: после броска reload секунд на то, чтобы её подобрать, и шанс tear, что она порвётся
export const NET = { stun: 3, range: [50, 170], chance: 1.2, speed: 320, focus: 6, max: 1, reload: 5, tear: 0.15 };
export const SPEAR = { low: 0.4, range: [60, 300], speed: 420, pickup: 14 };

export function damageOf(g) {
  return (DAMAGE_BASE + DAMAGE_PER_STR * g.str + (g.weapon ? g.weapon.power : 0)) * typeOf(g).dmg;
}

export const attackEvery = (g) => ATTACK_EVERY * typeOf(g).rate / (1 + HASTE_PER_AGI * g.agi);
export const dodgeOf = (g) => Math.min(DODGE_MAX, DODGE_BASE + DODGE_PER_AGI * g.agi);
export const critOf = (g) => CRIT_BASE + CRIT_PER_AGI * g.agi + typeOf(g).crit;
// доспех из гачи режет входящий урон на свой процент
// снаряжение по слотам: share — какая доля «брони» редкости приходится на вещь; вместе режут урон, но не больше ARMOR_CAP
export const ARMOR_SLOTS = {
  head: { name: 'шлем', gender: 'm', share: 0.5, label: 'Голова' },
  body: { name: 'броня', gender: 'f', share: 1, label: 'Тело' },
  legs: { name: 'поножи', gender: 'p', share: 0.4, label: 'Штаны' },
  feet: { name: 'сапоги', gender: 'p', share: 0.3, label: 'Ноги' },
};
export const SLOT_IDS = Object.keys(ARMOR_SLOTS);
export const ARMOR_CAP = 0.6;
export const emptyGear = () => ({ head: null, body: null, legs: null, feet: null });
export const armorOf = (g) => {
  let sum = 0;
  for (const slot of SLOT_IDS) if (g.gear && g.gear[slot]) sum += g.gear[slot].power;
  return Math.min(ARMOR_CAP, sum / 100);
};

// чем больше бойцов на арене, тем щедрее награда
export const crowdBonus = (fighters) => Math.min(2, 1 + 0.03 * Math.max(0, fighters - 2));

// шанс смертельной травмы растёт, если удар пришёлся сильно ниже нуля
export function deathChance(base, overkill, hpMax) {
  if (base <= 0) return 0;
  return Math.min(0.9, base * (1 + Math.max(0, overkill) / Math.max(1, hpMax)));
}
