import { TwitchChat } from './chat.js';
import { clean, fromQuery } from './config.js';
import { demoGame } from './demo.js';
import { Game, Roster } from './engine.js';
import { playAll, unlock } from './sound.js';
import { playNote, reportPlay } from './stats.js';
import { View } from './view.js';

const STATS_EVERY_SECONDS = 600;
const STEP_MS = 50;
const FRAME_MAX = 0.1;
const EMBEDDED = new URLSearchParams(location.search).get('embed') === '1';

function browserStorage() {
  try {
    localStorage.getItem('gladiatory');
    return localStorage;
  } catch (error) {
    return null;
  }
}

function watchVisibility(onShow, onHide) {
  const pageShown = () => document.visibilityState !== 'hidden';
  const report = (shown) => (shown ? onShow() : onHide());
  document.addEventListener('visibilitychange', () => report(pageShown()));
  window.addEventListener('obsSourceVisibleChanged', (event) => report(Boolean(event.detail && event.detail.visible)));
  if (pageShown()) onShow();
}

function run(view) {
  let settings = fromQuery(location.search);
  let live = !EMBEDDED;
  let demo = null;
  let pausedByHiding = false;
  const storage = browserStorage();
  const rosterFor = (channel) => new Roster(storage, 'gladiatory.roster.' + (channel || '_'));
  const game = new Game(settings, rosterFor(settings.channel));
  const chat = new TwitchChat({
    channel: settings.channel,
    onMessage: (name, text, mod, details) => game.feed(name, text, Object.assign({ mod }, details)),
  });
  view.use(settings);
  if (!live) demo = demoGame(settings);

  let stepped = performance.now();
  setInterval(() => {
    const now = performance.now(), dt = (now - stepped) / 1000;
    stepped = now;
    if (live) game.step(dt);
    else if (demo) demo.step(dt);
  }, STEP_MS);
  let drawn = performance.now();
  const frame = (now) => {
    const dt = Math.max(0, Math.min(FRAME_MAX, (now - drawn) / 1000));
    drawn = now;
    view.frame(live ? game : demo, dt, !live);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  const show = () => {
    if (game.state === 'stopped') game.open();
    else if (pausedByHiding) game.setPaused(false);
    pausedByHiding = false;
    notePlay();
  };
  const hide = () => {
    if (game.setPaused(true)) pausedByHiding = true;
  };

  const notePlay = () => {
    if (live && game.state !== 'stopped' && !pausedByHiding) reportPlay(playNote('gladiatory', settings, EMBEDDED));
  };
  setInterval(notePlay, STATS_EVERY_SECONDS * 1000);

  window.gladiatory = {
    game,
    chat,
    view,
    playSounds: playAll,
    get live() {
      return live;
    },
    apply(next) {
      next = clean(next);
      if (next.channel !== settings.channel) {
        chat.setChannel(next.channel);
        game.roster = rosterFor(next.channel);
        game.members.clear();
      }
      settings = next;
      game.configure(settings);
      view.use(settings);
    },
    start() {
      unlock();
      live = true;
      chat.start();
      game.stop();
      game.open();
      notePlay();
    },
    stop() {
      live = false;
      game.stop();
      chat.stop();
      demo = demoGame(settings);
    },
    pause() {
      return game.pause();
    },
    reset() {
      game.resetAll();
    },
  };
  if (EMBEDDED) return;
  chat.start();
  // сам оверлей не перезагружается: перезапуск сбросил бы бой и выкинул всех гладиаторов из игры.
  // Новую версию подхватит, когда стример сам обновит источник в OBS
  watchVisibility(show, hide);
}

run(new View());
