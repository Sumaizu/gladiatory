// гача в храме Фортуны: шансы редкостей как в Чатобороне, монет не выпадает; щит и сеть — без редкости
import { WEAPON_TYPES, offhandFree } from './balance.js';
export const PRICE = 30;
export const SPIN_TIME = 2.2;
export const SHOW_TIME = 3;
export const RUSH = { queue: 6, spin: 0.9, show: 1.4 };
export const QUEUE_CAP = 10;
export const SPREAD = 0.15;

export const OUTCOMES = [
  { id: 'void', name: 'Пустота', color: '#8b8f98', chance: 0.132 },
  { id: 'shield', name: 'Щит', color: '#d9a441', chance: 0.04 },
  { id: 'net', name: 'Сеть', color: '#a8c4b0', chance: 0.05 },
];

// weapon — прибавка к урону, armor — процент, на который режется входящий урон
export const RARITIES = [
  { id: 'common', name: 'Обычный', n: 'Обычное', color: '#4ade80', chance: 0.27, weapon: 2, armor: 4 },
  { id: 'rare', name: 'Редкий', n: 'Редкое', color: '#60a5fa', chance: 0.2, weapon: 4, armor: 8 },
  { id: 'mythic', name: 'Мифический', n: 'Мифическое', color: '#c084fc', chance: 0.1, weapon: 7, armor: 13 },
  { id: 'epic', name: 'Эпический', n: 'Эпическое', color: '#facc15', chance: 0.07, weapon: 11, armor: 19 },
  { id: 'legendary', name: 'Легендарный', n: 'Легендарное', color: '#f97316', chance: 0.06, weapon: 16, armor: 26 },
];

export const KINDS = { weapon: { name: 'меч', stat: 'урона' }, armor: { name: 'доспех', stat: 'брони' } };
export const TYPES = Object.keys(WEAPON_TYPES);

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

export function makeItem(random, kind, rarity, type = null) {
  const base = rarity[kind], roll = 1 - SPREAD + 2 * SPREAD * random();
  const item = { kind, rarity: rarity.id, power: Math.max(1, Math.round(base * roll)) };
  if (kind === 'weapon') item.type = type || TYPES[Math.floor(random() * TYPES.length)];
  return item;
}

// owner — кто крутит: щит и сеть выпадают, только если его вторая рука свободна
export function spin(random, owner = null) {
  const outcomes = owner && !offhandFree(owner) ? OUTCOMES.filter((o) => o.id !== 'shield' && o.id !== 'net') : OUTCOMES;
  const roll = pick(outcomes.concat(RARITIES), random);
  if (roll.coins) {
    const [low, high] = roll.coins;
    return { kind: roll.id, coins: low + Math.floor(random() * (high - low + 1)) };
  }
  if (OUTCOMES.includes(roll)) return { kind: roll.id };
  return { kind: 'item', item: makeItem(random, random() < 0.5 ? 'weapon' : 'armor', roll) };
}

export function itemName(item) {
  const rarity = rarityOf(item.rarity);
  if (item.kind !== 'weapon') return (rarity ? rarity.name : '') + ' ' + KINDS[item.kind].name;
  const type = WEAPON_TYPES[item.type] || WEAPON_TYPES.sword;
  return (rarity ? (type.gender === 'n' ? rarity.n : rarity.name) : '') + ' ' + type.name;
}

export const itemText = (item) => itemName(item) + ' +' + item.power + (item.kind === 'armor' ? '% ' : ' ')
  + KINDS[item.kind].stat;

// для рисунка: 0 — ничего, 1–5 — редкость, легендарное — золото
export const tierOf = (item) => (item ? rankOf(item) + 1 + (item.rarity === 'legendary' ? 1 : 0) : 0);

export const outcomeOf = (id) => OUTCOMES.find((outcome) => outcome.id === id) || null;

export function cleanItem(raw, kind) {
  if (!raw || typeof raw !== 'object' || !rarityOf(raw.rarity)) return null;
  const power = Math.trunc(Number(raw.power));
  if (!(power > 0)) return null;
  const item = { kind, rarity: raw.rarity, power: Math.min(power, 99) };
  if (kind === 'weapon') item.type = WEAPON_TYPES[raw.type] ? raw.type : 'sword';
  return item;
}
