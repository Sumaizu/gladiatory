import { Game, Roster } from './engine.js';
import { RARITIES, makeItem } from './gacha.js';

const NAMES = ['Kitsune_Neko', 'Brutus', 'ЛысыйКабан', 'Spartak_88', 'MaximusTV', 'Ржавый_Гвоздь', 'Lupa', 'Crixus',
  'Феникс', 'Ironhide', 'Котлета', 'NightWolf', 'Варвар', 'Gannicus'];
const COLORS = ['#ff6b5e', '#5fb4ff', '#7ee08a', '#ffc94d', '#c58cff', '#4fd6d6', '#ff8fc8', '#b8e05a', '#ff9d4d',
  '#8fa2ff', '#ffe08a', '#9ef0c8', '#f08a5d', '#a3c4ff'];
const ACTIONS = ['трен', 'трен', 'трен', 'отдых', 'гача', 'гача', 'гача', 'улучшить', 'улучшить', 'реролл', 'сил', 'лов', 'вын',
  'проф'];
// в примере все уже обжились: оружие от редкого до легендарного, броня средняя и хорошая, кое-где заточка
const GOOD = ['rare', 'mythic', 'mythic', 'epic', 'epic', 'legendary'];
const TYPES = ['sword', 'greatsword', 'spear', 'axe', 'hammer', 'trident'];

// пример на странице до запуска: выдуманные игроки и короткие фазы; крутят гачу, точат и перековывают оружие
export function demoGame(settings) {
  const game = new Game(Object.assign({}, settings, { ludus: 22, battle: 45 }), new Roster());
  game.open();
  NAMES.forEach((name, i) => game.feed(name, 'привет', { login: 'demo' + i, color: COLORS[i] }));
  const rarity = (id) => RARITIES.find((r) => r.id === id);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  [...game.members.values()].forEach((g, i) => {
    g.level = 3 + Math.floor(Math.random() * 8);
    g.weapon = makeItem(Math.random, 'weapon', rarity(pick(GOOD)), TYPES[i % TYPES.length]);
    g.weapon.sharp = Math.random() < 0.5 ? Math.floor(Math.random() * 6) : 0;
    for (const slot of ['head', 'body', 'legs', 'feet']) {
      g.gear[slot] = Math.random() < 0.8 ? makeItem(Math.random, 'armor', rarity(pick(GOOD.slice(0, 5))), slot) : null;
    }
    const oneHand = ['sword', 'spear', 'trident'].includes(g.weapon.type);
    if (oneHand) [() => { g.shield = true; }, () => { g.nets = 1; }, () => { g.sand = 1; }, () => {}][i % 4]();
    g.amulet = i % 5 === 2;
    g.coins = 250 + Math.floor(Math.random() * 400);
  });
  // для наглядности: у одного красный череп, у другого огонёк серии
  const shown = [...game.members.values()];
  shown[3].skull = 2;
  shown[5].streak = 4;
  game.feed(NAMES[0], 'проф', { login: 'demo0' });
  let wait = 2;
  const step = game.step.bind(game);
  game.step = (dt) => {
    step(dt);
    wait -= dt;
    if (wait > 0) return;
    wait = 1.5 + Math.random() * 3;
    const i = Math.floor(Math.random() * NAMES.length);
    if (game.state === 'battle') return;
    game.feed(NAMES[i], ACTIONS[Math.floor(Math.random() * ACTIONS.length)], { login: 'demo' + i, color: COLORS[i] });
  };
  return game;
}
