// гача в лудильне: редкости в тех же пропорциях, что в Чатобороне; монет и пустоты нет; щит и сеть — без редкости.
// Оружие гача не даёт: первое (простое, серое) выковывается в кузне, а гача только поднимает его редкость
import { ARMOR_SLOTS, SHARPEN, SLOT_IDS, WEAPON_TYPES, offhandFree } from './balance.js';
export const PRICE = 30;
export { SHARPEN };
// кузня: перековка — новый вид оружия той же редкости
export const REFORGE = { price: 300 };
export const sharpChance = (level) => SHARPEN.chance * Math.pow(SHARPEN.fall, level);
// крутка вдвое быстрее прежней — лудус теперь минута
export const SPIN_TIME = 1.1;
export const SHOW_TIME = 1.5;
export const RUSH = { queue: 6, spin: 0.5, show: 0.7 };
export const QUEUE_CAP = 10;
export const SPREAD = 0.15;

// chance — прямо доля круток: щит, сеть и мешок с песком по 15%, амулет 3%; остальное — оружие и доспехи по редкостям.
// Вещи для второй руки — только при свободной второй руке; у кого одноручное оружие, а второй вещи нет, — чаще
// (offhand: втроём 60% круток, как раньше щит и сеть вдвоём)
export const OUTCOMES = [
  { id: 'shield', name: 'Щит', color: '#d9a441', chance: 0.15, offhand: 4 / 3 },
  { id: 'net', name: 'Сеть', color: '#a8c4b0', chance: 0.15, offhand: 4 / 3 },
  { id: 'sand', name: 'Мешок с песком', color: '#d6b46e', chance: 0.15, offhand: 4 / 3 },
  // спасает от смерти один раз и рассыпается; пока он есть, второй не выпадает. Шанс всегда ровно 3%
  { id: 'amulet', name: 'Божественный амулет', color: '#ff3b47', chance: 0.03 },
  // выпадает, только если кроме амулета выпасть больше нечему
  { id: 'nothing', name: 'Ничего', color: '#8a8478', chance: 0 },
];
const AMULET = OUTCOMES.find((o) => o.id === 'amulet').chance;

// armor — процент, на который режется входящий урон (урон оружия от редкости — WEAPON_MULT в balance.js)
export const RARITIES = [
  { id: 'common', name: 'Обычный', n: 'Обычное', f: 'Обычная', p: 'Обычные', color: '#4ade80', chance: 0.27, armor: 4 },
  { id: 'rare', name: 'Редкий', n: 'Редкое', f: 'Редкая', p: 'Редкие', color: '#60a5fa', chance: 0.2, armor: 8 },
  { id: 'mythic', name: 'Мифический', n: 'Мифическое', f: 'Мифическая', p: 'Мифические', color: '#c084fc', chance: 0.1,
    armor: 13 },
  { id: 'epic', name: 'Эпический', n: 'Эпическое', f: 'Эпическая', p: 'Эпические', color: '#facc15', chance: 0.07,
    armor: 19 },
  { id: 'legendary', name: 'Легендарный', n: 'Легендарное', f: 'Легендарная', p: 'Легендарные', color: '#f97316',
    chance: 0.06, armor: 26 },
];
// простое оружие из кузни — серое, без редкости; в гаче не выпадает
export const PLAIN = { id: 'plain', name: 'Простой', n: 'Простое', f: 'Простая', p: 'Простые', color: '#9ca3af' };

// божественные вещи в гаче не выпадают: убил гладиатора насмерть — одна его легендарная вещь становится божественной
// (сперва оружие, если оно легендарное, иначе случайный легендарный доспех). Доспех ×mult, оружие — множитель урона
// из WEAPON_MULT, и гача её больше не меняет — до смерти или парагона
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

export const rarityOf = (id) => RARITIES.find((rarity) => rarity.id === id) || (id === DIVINE.id ? DIVINE
  : id === PLAIN.id ? PLAIN : null);
// простое — -1, как и пустой слот: для гачи оно ниже любой редкости
export const rankOf = (item) => (!item ? -1 : item.rarity === DIVINE.id ? RARITIES.length
  : RARITIES.findIndex((rarity) => rarity.id === item.rarity));
// с легендарной редкости вещь (оружие или доспех в своём слоте) из гачи больше не выпадает
export const maxedOut = (item) => rankOf(item) >= RARITIES.length - 1;


// броня выпадает в случайный слот: шлем, броня, поножи или сапоги. Оружие — только вид и редкость, без чисел
export function makeItem(random, kind, rarity, type = null) {
  if (kind === 'armor') {
    const roll = 1 - SPREAD + 2 * SPREAD * random();
    const slot = type || SLOT_IDS[Math.floor(random() * SLOT_IDS.length)];
    return { kind, slot, rarity: rarity.id, power: Math.max(1, Math.round(rarity.armor * ARMOR_SLOTS[slot].share * roll)) };
  }
  return { kind, rarity: rarity.id, type: type || TYPES[Math.floor(random() * TYPES.length)], sharp: 0 };
}

// owner — кто крутит. Щит, сеть и мешок выпадают, только если его вторая рука свободна; оружие — только его же вид
// (выпадает редкость), доспех — в слоты, где ещё нет легендарного. Легендарное (или божественное) оружие и доспехи
// больше не выпадают; если выпадать нечему — null
export function spin(random, owner = null) {
  const amulet = !owner || !owner.amulet;
  const outcomes = OUTCOMES.filter((o) => o.chance > 0 && o.id !== 'amulet' && (!owner || !o.offhand || offhandFree(owner)));
  // одноручное оружие и пустая вторая рука — вещи для неё чаще
  const oneHand = owner && owner.weapon && (WEAPON_TYPES[owner.weapon.type] || WEAPON_TYPES.sword).hands === 1;
  const weights = outcomes.map((o) => o.chance * (oneHand && o.offhand ? o.offhand : 1));
  const weapon = !owner || Boolean(owner.weapon) && !maxedOut(owner.weapon);
  const slots = SLOT_IDS.filter((slot) => !owner || !maxedOut(owner.gear && owner.gear[slot]));
  // остаток после щита, сети, мешка и амулета — оружие и доспех поровну (что из них ещё может выпасть)
  const items = weapon || slots.length ? Math.max(0, 1 - AMULET - weights.reduce((sum, w) => sum + w, 0)) : 0;
  const others = weights.reduce((sum, w) => sum + w, 0) + items;
  if (others <= 0 && !amulet) return null;
  // амулет — всегда ровно 3%, сколько бы другого ни осталось; кроме него выпасть нечему — остальное «ничего»
  let roll = random();
  if (amulet && roll < AMULET) return { kind: 'amulet' };
  if (others <= 0) return { kind: 'nothing' };
  roll = (roll - (amulet ? AMULET : 0)) / (1 - (amulet ? AMULET : 0)) * others;
  for (let i = 0; i < outcomes.length; i++) {
    roll -= weights[i];
    if (roll < 0) return { kind: outcomes[i].id };
  }
  const rarity = pick(RARITIES, random);
  if (weapon && (!slots.length || random() < 0.5)) {
    return { kind: 'item', item: makeItem(random, 'weapon', rarity, owner ? owner.weapon.type : null) };
  }
  return { kind: 'item', item: makeItem(random, 'armor', rarity, slots[Math.floor(random() * slots.length)]) };
}

// кузня: какой вид оружия выкуется (первое оружие или перековка) — любой, кроме нынешнего
export function forgeSpin(random, except = null) {
  const types = TYPES.filter((type) => type !== except);
  return types[Math.floor(random() * types.length)];
}

const adjective = (rarity, gender) => (!rarity ? '' : gender === 'n' ? rarity.n : gender === 'f' ? rarity.f
  : gender === 'p' ? rarity.p : rarity.name);

// у заточенного оружия — ступень заточки: «Редкий меч +3»
export function itemName(item) {
  const rarity = rarityOf(item.rarity);
  const what = item.kind === 'armor' ? ARMOR_SLOTS[item.slot] || ARMOR_SLOTS.body
    : WEAPON_TYPES[item.type] || WEAPON_TYPES.sword;
  return adjective(rarity, what.gender) + ' ' + what.name + (item.sharp ? ' +' + item.sharp : '');
}

// урон оружия не показываем (он зависит от силы — виден в карточке), броню — процентом
export const itemText = (item) => itemName(item) + (item.kind === 'armor' ? ' +' + item.power + '% ' + KINDS.armor.stat : '');

// для рисунка: 0 — ничего, 1–5 — редкость, легендарное — золото, божественное — красное
export const tierOf = (item) => (item ? rankOf(item) + 1 + (item.rarity === 'legendary' || item.rarity === DIVINE.id ? 1 : 0)
  : 0);

export const outcomeOf = (id) => OUTCOMES.find((outcome) => outcome.id === id) || null;

export function cleanItem(raw, kind) {
  if (!raw || typeof raw !== 'object' || !rarityOf(raw.rarity)) return null;
  if (kind === 'weapon') {
    // у старых сохранений у оружия было число урона — теперь только вид, редкость и заточка
    const sharp = Math.max(0, Math.min(SHARPEN.max, Math.trunc(Number(raw.sharp)) || 0));
    return { kind, rarity: raw.rarity, type: TYPES.includes(raw.type) ? raw.type : 'sword', sharp };
  }
  const power = Math.trunc(Number(raw.power));
  if (!(power > 0) || raw.rarity === PLAIN.id) return null;
  return { kind, rarity: raw.rarity, power: Math.min(power, 99), slot: ARMOR_SLOTS[raw.slot] ? raw.slot : 'body' };
}
