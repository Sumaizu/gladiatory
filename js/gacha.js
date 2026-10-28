// гача в храме Фортуны: шансы как в Чатобороне, монеты пересчитаны под цену 30
export const PRICE = 30;
export const SPIN_TIME = 2.2;
export const SHOW_TIME = 3;
export const RUSH = { queue: 6, spin: 0.9, show: 1.4 };
export const QUEUE_CAP = 10;
export const SPREAD = 0.15;

export const OUTCOMES = [
  { id: 'void', name: 'Пустота', color: '#8b8f98', chance: 0.132 },
  { id: 'handful', name: 'Горстка монет', color: '#facc15', chance: 0.075, coins: [1, 30] },
  { id: 'bag', name: 'Мешок монет', color: '#e8a33d', chance: 0.0675, coins: [31, 90] },
  { id: 'chest', name: 'Сундук монет', color: '#ffb020', chance: 0.0075, coins: [91, 300] },
];

// weapon — прибавка к урону, armor — процент, на который режется входящий урон
export const RARITIES = [
  { id: 'common', name: 'Обычный', color: '#4ade80', chance: 0.27, weapon: 2, armor: 4 },
  { id: 'rare', name: 'Редкий', color: '#60a5fa', chance: 0.2, weapon: 4, armor: 8 },
  { id: 'mythic', name: 'Мифический', color: '#c084fc', chance: 0.1, weapon: 7, armor: 13 },
  { id: 'epic', name: 'Эпический', color: '#facc15', chance: 0.07, weapon: 11, armor: 19 },
  { id: 'legendary', name: 'Легендарный', color: '#f97316', chance: 0.06, weapon: 16, armor: 26 },
];

export const KINDS = { weapon: { name: 'гладиус', stat: 'урона' }, armor: { name: 'доспех', stat: 'брони' } };

function pick(list, random) {
  let roll = random() * list.reduce((sum, item) => sum + item.chance, 0);
  for (const item of list) {
    roll -= item.chance;
    if (roll < 0) return item;
  }
  return list[list.length - 1];
}

export const rarityOf = (id) => RARITIES.find((rarity) => rarity.id === id) || null;
export const rankOf = (item) => (item ? RARITIES.findIndex((rarity) => rarity.id === item.rarity) : -1);

export function makeItem(random, kind, rarity) {
  const base = rarity[kind], roll = 1 - SPREAD + 2 * SPREAD * random();
  return { kind, rarity: rarity.id, power: Math.max(1, Math.round(base * roll)) };
}

export function spin(random) {
  const roll = pick(OUTCOMES.concat(RARITIES), random);
  if (roll.coins) {
    const [low, high] = roll.coins;
    return { kind: roll.id, coins: low + Math.floor(random() * (high - low + 1)) };
  }
  if (OUTCOMES.includes(roll)) return { kind: roll.id };
  return { kind: 'item', item: makeItem(random, random() < 0.5 ? 'weapon' : 'armor', roll) };
}

export function itemName(item) {
  const rarity = rarityOf(item.rarity);
  return (rarity ? rarity.name : '') + ' ' + KINDS[item.kind].name;
}

export const itemText = (item) => itemName(item) + ' +' + item.power + (item.kind === 'armor' ? '% ' : ' ')
  + KINDS[item.kind].stat;

// для рисунка: 0 — ничего, 1–5 — редкость, легендарное — золото
export const tierOf = (item) => (item ? rankOf(item) + 1 + (item.rarity === 'legendary' ? 1 : 0) : 0);

export const outcomeOf = (id) => OUTCOMES.find((outcome) => outcome.id === id) || null;

export function cleanItem(raw, kind) {
  if (!raw || typeof raw !== 'object' || !rarityOf(raw.rarity)) return null;
  const power = Math.trunc(Number(raw.power));
  return power > 0 ? { kind, rarity: raw.rarity, power: Math.min(power, 99) } : null;
}
