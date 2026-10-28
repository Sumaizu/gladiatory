// гача в храме Фортуны: шансы редкостей как в Чатобороне, монет не выпадает; щит и сеть — без редкости
import { ARMOR_SLOTS, SLOT_IDS, WEAPON_TYPES, offhandFree } from './balance.js';
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
  { id: 'common', name: 'Обычный', n: 'Обычное', f: 'Обычная', p: 'Обычные', color: '#4ade80', chance: 0.27, weapon: 2,
    armor: 4 },
  { id: 'rare', name: 'Редкий', n: 'Редкое', f: 'Редкая', p: 'Редкие', color: '#60a5fa', chance: 0.2, weapon: 4, armor: 8 },
  { id: 'mythic', name: 'Мифический', n: 'Мифическое', f: 'Мифическая', p: 'Мифические', color: '#c084fc', chance: 0.1,
    weapon: 7, armor: 13 },
  { id: 'epic', name: 'Эпический', n: 'Эпическое', f: 'Эпическая', p: 'Эпические', color: '#facc15', chance: 0.07,
    weapon: 11, armor: 19 },
  { id: 'legendary', name: 'Легендарный', n: 'Легендарное', f: 'Легендарная', p: 'Легендарные', color: '#f97316',
    chance: 0.06, weapon: 16, armor: 26 },
];

export const KINDS = { weapon: { name: 'меч', stat: 'урона' }, armor: { name: 'доспех', stat: 'брони' } };
export const TYPES = Object.keys(WEAPON_TYPES).filter((type) => type !== 'fists');

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

// броня выпадает в случайный слот: шлем, броня, поножи или сапоги
export function makeItem(random, kind, rarity, type = null) {
  const roll = 1 - SPREAD + 2 * SPREAD * random();
  if (kind === 'armor') {
    const slot = type || SLOT_IDS[Math.floor(random() * SLOT_IDS.length)];
    return { kind, slot, rarity: rarity.id, power: Math.max(1, Math.round(rarity.armor * ARMOR_SLOTS[slot].share * roll)) };
  }
  return { kind, rarity: rarity.id, power: Math.max(1, Math.round(rarity.weapon * roll)),
    type: type || TYPES[Math.floor(random() * TYPES.length)] };
}

// owner — кто крутит: щит и сеть выпадают, только если его вторая рука свободна
export function spin(random, owner = null) {
  const outcomes = owner && !offhandFree(owner) ? OUTCOMES.filter((o) => o.id !== 'shield' && o.id !== 'net') : OUTCOMES;
  // у кого ещё нет оружия, тому первая же гача гарантированно даёт оружие
  if (owner && !owner.weapon) return { kind: 'item', item: makeItem(random, 'weapon', pick(RARITIES, random)) };
  const roll = pick(outcomes.concat(RARITIES), random);
  if (roll.coins) {
    const [low, high] = roll.coins;
    return { kind: roll.id, coins: low + Math.floor(random() * (high - low + 1)) };
  }
  if (OUTCOMES.includes(roll)) return { kind: roll.id };
  return { kind: 'item', item: makeItem(random, random() < 0.5 ? 'weapon' : 'armor', roll) };
}

const adjective = (rarity, gender) => (!rarity ? '' : gender === 'n' ? rarity.n : gender === 'f' ? rarity.f
  : gender === 'p' ? rarity.p : rarity.name);

export function itemName(item) {
  const rarity = rarityOf(item.rarity);
  const what = item.kind === 'armor' ? ARMOR_SLOTS[item.slot] || ARMOR_SLOTS.body
    : WEAPON_TYPES[item.type] || WEAPON_TYPES.sword;
  return adjective(rarity, what.gender) + ' ' + what.name;
}

// коротко для слота инвентаря: редкость видна цветом
export function slotText(item) {
  const what = item.kind === 'armor' ? ARMOR_SLOTS[item.slot] || ARMOR_SLOTS.body
    : WEAPON_TYPES[item.type] || WEAPON_TYPES.sword;
  return what.name + ' +' + item.power + (item.kind === 'armor' ? '%' : '');
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
  if (kind === 'armor') item.slot = ARMOR_SLOTS[raw.slot] ? raw.slot : 'body';
  return item;
}
