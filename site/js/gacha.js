// гача в лудильне: редкости в тех же пропорциях, что в Чатобороне; монет и пустоты нет; щит и сеть — без редкости
import { ARMOR_SLOTS, SLOT_IDS, WEAPON_TYPES, offhandFree } from './balance.js';
export const PRICE = 30;
// крутка вдвое быстрее прежней — лудус теперь минута
export const SPIN_TIME = 1.1;
export const SHOW_TIME = 1.5;
export const RUSH = { queue: 6, spin: 0.5, show: 0.7 };
export const QUEUE_CAP = 10;
export const SPREAD = 0.15;

// chance — прямо доля круток: щит и сеть по 15%, амулет 3%; остальное — оружие и доспехи по редкостям.
// Щит и сеть — только при свободной второй руке; у кого в руке меч или копьё, а второй вещи нет, — вдвое чаще (offhand)
export const OUTCOMES = [
  { id: 'shield', name: 'Щит', color: '#d9a441', chance: 0.15, offhand: 2 },
  { id: 'net', name: 'Сеть', color: '#a8c4b0', chance: 0.15, offhand: 2 },
  // спасает от смерти один раз и рассыпается; пока он есть, второй не выпадает
  { id: 'amulet', name: 'Божественный амулет', color: '#ff3b47', chance: 0.03 },
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

// божественные вещи в гаче не выпадают: убил гладиатора насмерть — одна его легендарная вещь становится божественной
// (сперва оружие, если оно легендарное, иначе случайный легендарный доспех). Сила вещи ×mult, и гача её больше не меняет —
// до смерти или парагона
export const DIVINE = { id: 'divine', name: 'Божественный', n: 'Божественное', f: 'Божественная', p: 'Божественные',
  color: '#ff3b3b', mult: 1.5 };

export const KINDS = { weapon: { name: 'меч', stat: 'урона' }, armor: { name: 'доспех', stat: 'брони' } };
export const TYPES = Object.keys(WEAPON_TYPES).filter((type) => type !== 'fists' && type !== 'claws');

function pick(list, random) {
  let roll = random() * list.reduce((sum, item) => sum + item.chance, 0);
  for (const item of list) {
    roll -= item.chance;
    if (roll < 0) return item;
  }
  return list[list.length - 1];
}

export const rarityOf = (id) => RARITIES.find((rarity) => rarity.id === id) || (id === DIVINE.id ? DIVINE : null);
export const rankOf = (item) => (!item ? -1 : item.rarity === DIVINE.id ? RARITIES.length
  : RARITIES.findIndex((rarity) => rarity.id === item.rarity));

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
  const outcomes = OUTCOMES.filter((o) => !owner || (o.id === 'amulet' ? !owner.amulet
    : o.id !== 'shield' && o.id !== 'net' || offhandFree(owner)));
  // у кого ещё нет оружия, тому первая же гача гарантированно даёт оружие
  if (owner && !owner.weapon) return { kind: 'item', item: makeItem(random, 'weapon', pick(RARITIES, random)) };
  // меч или копьё и пустая вторая рука — щит и сеть вдвое чаще
  const oneHand = owner && owner.weapon && (owner.weapon.type === 'sword' || owner.weapon.type === 'spear');
  let roll = random();
  for (const o of outcomes) {
    roll -= o.chance * (oneHand && o.offhand ? o.offhand : 1);
    if (roll < 0) return { kind: o.id };
  }
  return { kind: 'item', item: makeItem(random, random() < 0.5 ? 'weapon' : 'armor', pick(RARITIES, random)) };
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

// для рисунка: 0 — ничего, 1–5 — редкость, легендарное — золото, божественное — красное
export const tierOf = (item) => (item ? rankOf(item) + 1 + (item.rarity === 'legendary' || item.rarity === DIVINE.id ? 1 : 0)
  : 0);

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
