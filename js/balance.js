export const START_COINS = 20;
export const START_POINTS = 3;
export const POINTS_PER_LEVEL = 2;
export const LEVEL_MAX = 99;

export const HP_BASE = 150;
export const HP_PER_LEVEL = 6;
export const HP_PER_VIT = 15;
export const DAMAGE_BASE = 10;
export const DAMAGE_PER_STR = 2;
export const DAMAGE_PER_WEAPON = 3;
export const SPREAD = 0.15;
export const ATTACK_EVERY = 1.25;
export const HASTE_PER_AGI = 0.04;
export const DODGE_BASE = 0.05;
export const DODGE_PER_AGI = 0.012;
export const DODGE_MAX = 0.35;
export const CRIT_BASE = 0.05;
export const CRIT_PER_AGI = 0.006;
export const CRIT_HIT = 1.75;
export const ARMOR_PER_TIER = 0.07;

export const STATS = [
  { id: 'str', name: 'Сила', words: ['сила', 'сил'], text: '+' + DAMAGE_PER_STR + ' к урону' },
  { id: 'agi', name: 'Ловкость', words: ['ловкость', 'лов'], text: 'быстрее бьёт, чаще уворачивается и критует' },
  { id: 'vit', name: 'Выносливость', words: ['выносливость', 'вын'], text: '+' + HP_PER_VIT + ' к здоровью' },
];

export const WEAPONS = ['Деревянный меч', 'Бронзовый гладиус', 'Железный гладиус', 'Стальной гладиус',
  'Закалённый гладиус', 'Гладиус мастера', 'Золотой гладиус'];
export const ARMORS = ['Набедренная повязка', 'Кожаный доспех', 'Бронзовый доспех', 'Кольчуга',
  'Пластинчатый доспех', 'Доспех центуриона', 'Золотой доспех'];
export const GEAR_MAX = WEAPONS.length - 1;

// цена следующей ступени оружия или доспеха
export const gearPrice = (tier) => Math.round(30 * Math.pow(tier + 1, 1.5) / 5) * 5;

// в лудусе, доля здоровья в секунду
export const HEAL_RATE = { yard: 0.004, rest: 0.008, heal: 0.03, train: 0, forge: 0.004 };
export const BEATEN_HP = 0.15;
export const TRAIN_XP = 0.4;
export const healPrice = (level) => 5 + 2 * level;

export const MOVE_SPEED = 70;
export const REACH = 36;
export const BODY = 28;

export const REWARD = {
  standing: { xp: 40, coins: 25, xpPerKo: 15, coinsPerKo: 8 },
  beaten: { xp: 15, coins: 8, xpPerKo: 10, coinsPerKo: 5 },
  champion: 1.5,
};

export const xpNeed = (level) => Math.round(40 * Math.pow(level, 1.4));

export function maxHp(g) {
  return HP_BASE + HP_PER_LEVEL * (g.level - 1) + HP_PER_VIT * g.vit;
}

export function damageOf(g) {
  return DAMAGE_BASE + DAMAGE_PER_STR * g.str + DAMAGE_PER_WEAPON * g.weapon;
}

export const attackEvery = (g) => ATTACK_EVERY / (1 + HASTE_PER_AGI * g.agi);
export const dodgeOf = (g) => Math.min(DODGE_MAX, DODGE_BASE + DODGE_PER_AGI * g.agi);
export const critOf = (g) => CRIT_BASE + CRIT_PER_AGI * g.agi;
export const armorOf = (g) => ARMOR_PER_TIER * g.armor;

// чем больше бойцов на арене, тем щедрее награда
export const crowdBonus = (fighters) => Math.min(2, 1 + 0.03 * Math.max(0, fighters - 2));

// шанс смертельной травмы растёт, если удар пришёлся сильно ниже нуля
export function deathChance(base, overkill, hpMax) {
  if (base <= 0) return 0;
  return Math.min(0.9, base * (1 + Math.max(0, overkill) / Math.max(1, hpMax)));
}
