import { Game, Roster } from './engine.js';
import { RARITIES, makeItem } from './gacha.js';

const NAMES = ['Kitsune_Neko', 'Brutus', 'ЛысыйКабан', 'Spartak_88', 'MaximusTV', 'Ржавый_Гвоздь', 'Lupa', 'Crixus',
  'Феникс', 'Ironhide', 'Котлета', 'NightWolf', 'Варвар', 'Gannicus'];
const COLORS = ['#ff6b5e', '#5fb4ff', '#7ee08a', '#ffc94d', '#c58cff', '#4fd6d6', '#ff8fc8', '#b8e05a', '#ff9d4d',
  '#8fa2ff', '#ffe08a', '#9ef0c8', '#f08a5d', '#a3c4ff'];
const ACTIONS = ['трен', 'трен', 'трен', 'лазарет', 'отдых', 'гача', 'гача', 'сила', 'ловкость', 'выносливость', 'проф'];

// пример на странице до запуска: выдуманные игроки и короткие фазы
export function demoGame(settings) {
  const game = new Game(Object.assign({}, settings, { ludus: 22, battle: 45 }), new Roster());
  game.open();
  NAMES.forEach((name, i) => game.feed(name, 'привет', { login: 'demo' + i, color: COLORS[i] }));
  // на скамье в бой не ходят — большинство сразу отправляем тренироваться
  NAMES.forEach((name, i) => { if (i % 4 !== 3) game.feed(name, 'трен', { login: 'demo' + i }); });
  for (const g of game.members.values()) {
    g.level = 1 + Math.floor(Math.random() * 8);
    const any = () => RARITIES[Math.floor(Math.random() * RARITIES.length)];
    g.weapon = Math.random() < 0.7 ? makeItem(Math.random, 'weapon', any()) : null;
    for (const slot of ['head', 'body', 'legs', 'feet']) {
      g.gear[slot] = Math.random() < 0.5 ? makeItem(Math.random, 'armor', any(), slot) : null;
    }
    g.hp = g.hp * (0.5 + Math.random() * 0.5);
    g.coins = 40 + Math.floor(Math.random() * 200);
  }
  game.lines = [];
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
