import { TwitchChat } from './chat.js';
import { clean, fromQuery } from './config.js';
import { demoGame } from './demo.js';
import { Game, Roster } from './engine.js';
import { playAll, unlock } from './sound.js';
import { playNote, reportPlay } from './stats.js';
import { View } from './view.js';

const CODE_FILES = ['overlay.html', 'css/overlay.css', 'js/overlay.js', 'js/view.js', 'js/draw.js', 'js/engine.js',
  'js/balance.js', 'js/places.js', 'js/chat.js', 'js/config.js', 'js/demo.js', 'js/sound.js', 'js/art.js', 'js/gacha.js',
  'js/stars.js', 'js/stats.js'];
const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const UPDATE_CHECK_SECONDS = LOCAL ? 5 : 300;
const RELOAD_PAUSE_SECONDS = LOCAL ? 0 : 600;
const STATS_EVERY_SECONDS = 600;
const STEP_MS = 50;
const RELOAD_CHECK_MS = 500;
const FRAME_MAX = 0.1;
const EMBEDDED = new URLSearchParams(location.search).get('embed') === '1';

const fileUrl = (name) => new URL(name, location.href).href;

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

async function filesFingerprint() {
  const marks = await Promise.all(CODE_FILES.map(async (name) => {
    const response = await fetch(fileUrl(name), { method: 'HEAD', cache: 'no-store' });
    if (!response.ok) throw new Error(name);
    return response.headers.get('etag') || response.headers.get('last-modified') || '';
  }));
  return marks.join('|');
}

// новая версия игры подхватывается сама, но только между боями
function watchUpdates(canReload) {
  let fingerprint = null, ready = false, fetching = false;
  const prepare = () => {
    if (fetching) return;
    fetching = true;
    const done = () => {
      ready = true;
    };
    Promise.all(CODE_FILES.map((name) => fetch(fileUrl(name), { cache: 'reload' }))).then(done, done);
  };
  const reload = () => {
    const storage = browserStorage();
    const last = storage ? Number(storage.getItem('gladiatory.reloaded')) || 0 : 0;
    if (!ready || !canReload() || Date.now() - last < RELOAD_PAUSE_SECONDS * 1000) return;
    if (storage) storage.setItem('gladiatory.reloaded', String(Date.now()));
    location.reload();
  };
  const check = async () => {
    try {
      const current = await filesFingerprint();
      if (fingerprint === null) fingerprint = current;
      if (current !== fingerprint) prepare();
    } catch (error) {
      return;
    }
  };
  check();
  setInterval(check, UPDATE_CHECK_SECONDS * 1000);
  setInterval(reload, RELOAD_CHECK_MS);
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
  watchVisibility(show, hide);
  watchUpdates(() => game.state === 'stopped' || game.state === 'results'
    || game.state === 'ludus' && game.members.size === 0);
}

run(new View());
