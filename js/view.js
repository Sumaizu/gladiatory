import { ARMORS, STATS, WEAPONS, maxHp, xpNeed } from './balance.js';
import { FIELD_H, FIELD_W, DUMMIES, PLACES } from './places.js';
import { FONT, drawCrowd, drawGladiator, drawLabel, drawLudusLife, drawSigns, drawSoon, paintArena, paintLudus } from './draw.js';
import { plural } from './engine.js';
import { ambience, play, setSound } from './sound.js';
import { P } from './art.js';

const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 720;
const DOM_EVERY = 0.2;
const FADE = 0.7;
const FLOAT_TIME = 1.1;
// мир рисуется в низком разрешении и растягивается крупными пикселями — как в Domina
const PIXEL = 1;
const BLOOD = ['#8f1414', '#a8191b', '#6e0d0f', '#c22a22'];
const WHERE = {
  train: 'трен', heal: 'лазарет', rest: 'отдых',
  fight: 'в бою', down: 'пал', yield: 'сдался', dead: 'погиб',
};

const COMMANDS = {
  ludus: [['трен', 'тренироваться: опыт'], ['лазарет', 'лечиться бесплатно'], ['отдых', 'сесть на скамью'],
    ['сила · ловкость · выносливость', 'вложить очко'], ['проф', 'твоя карточка'],
    ['что угодно', 'стать гладиатором']],
  battle: [['сдаюсь', 'сдаться и точно выжить, но награда меньше'], ['проф', 'твоя карточка'],
    ['что угодно', 'вступить: в бой пойдёшь следующим']],
};
COMMANDS.results = COMMANDS.ludus;

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function clock(seconds) {
  seconds = Math.max(0, Math.ceil(seconds));
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}

export class View {
  constructor() {
    this.canvas = $('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.world = $('world');
    this.wctx = this.world.getContext('2d');
    this.world.width = Math.round(FIELD_W / PIXEL);
    this.world.height = Math.round(FIELD_H / PIXEL);
    this.drops = [];
    this.stains = null;
    this.scale = 1;
    this.backs = {};
    this.people = [];
    this.scene = null;
    this.fade = 0;
    this.game = null;
    this.seen = 0;
    this.floats = [];
    this.dummyHits = DUMMIES.map(() => 0);
    this.domIn = 0;
    this.keys = {};
    this.roar = 0;
    this.time = 0;
    this.settings = null;
    this.quiet = false;
    window.addEventListener('resize', () => this._fit());
    this._fit();
    $('stage').hidden = false;
  }

  use(settings) {
    this.settings = settings;
    document.body.classList.toggle('nocam', !settings.webcam);
    document.body.classList.toggle('nobg', !settings.bg);
    setSound(settings.sound, settings.volume);
  }

  _fit() {
    this.scale = Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT) || 1;
    $('stage').style.setProperty('--k', this.scale);
    const ratio = Math.max(1, Math.min(3, this.scale * (window.devicePixelRatio || 1)));
    if (ratio === this.ratio) return;
    this.ratio = ratio;
    this.canvas.width = Math.round(FIELD_W * ratio);
    this.canvas.height = Math.round(FIELD_H * ratio);
    this.backs = {};
  }

  _back(name) {
    if (this.backs[name]) return this.backs[name];
    const back = document.createElement('canvas');
    back.width = this.world.width;
    back.height = this.world.height;
    const ctx = back.getContext('2d');
    ctx.scale(1 / PIXEL, 1 / PIXEL);
    if (name === 'arena') this.people = paintArena(ctx);
    else this.signs = paintLudus(ctx);
    this.backs[name] = back;
    return back;
  }

  // demo — пример на странице: без звука
  frame(game, dt, demo) {
    this.time += dt;
    this.quiet = demo;
    if (game !== this.game) {
      this.game = game;
      this.seen = game ? game.eventId : 0;
      this.floats = [];
      this.keys = {};
      this.scene = null;
      if (this.cardNodes) for (const box of this.cardNodes.values()) box.remove();
      this.cardNodes = new Map();
    }
    if (!game) return;
    const scene = game.state === 'battle' ? 'arena' : 'ludus';
    if (scene !== this.scene) {
      if (this.scene !== null) this.fade = FADE;
      this.scene = scene;
      this.stains = null;
      this.drops = [];
    }
    this._events(game);
    this._noise(game, scene, demo);
    this.fade = Math.max(0, this.fade - dt);
    this.roar = Math.max(0, this.roar - dt * 0.8);
    for (let i = 0; i < this.dummyHits.length; i++) this.dummyHits[i] = Math.max(0, this.dummyHits[i] - dt);
    this._draw(game, scene, dt);
    this.domIn -= dt;
    if (this.domIn <= 0) {
      this.domIn = DOM_EVERY;
      this._dom(game);
    }
  }

  // фон: гул трибун на арене, тихий лудус; последние секунды лудуса — отсчёт
  _noise(game, scene, demo) {
    const live = !demo && game.state !== 'stopped' && !game.paused;
    ambience(live ? scene : null, live ? this.roar : 0);
    const left = Math.ceil(game.timer);
    if (live && game.state === 'ludus' && left <= 5 && left > 0 && left !== this.tick) play(left === 1 ? 'tickLast' : 'tick');
    this.tick = left;
  }

  _events(game) {
    for (const event of game.events) {
      if (event.id <= this.seen) continue;
      this.seen = event.id;
      this._event(game, event);
    }
  }

  _event(game, e) {
    const sound = (name) => {
      if (!this.quiet) play(name);
    };
    if (e.type === 'hit') {
      this._bleed(e.x, e.y - 22, e.crit ? 9 : 4);
      this.floats.push({ x: e.x + (Math.random() - 0.5) * 14, y: e.y - 46, text: String(e.amount), crit: e.crit,
        life: FLOAT_TIME, kind: 'hit' });
      this.roar = Math.min(1, this.roar + (e.crit ? 0.25 : 0.05));
      sound(e.crit ? 'crit' : 'hit');
    } else if (e.type === 'miss') {
      this.floats.push({ x: e.x, y: e.y - 46, text: 'мимо', life: FLOAT_TIME * 0.8, kind: 'miss' });
      sound('miss');
    } else if (e.type === 'down') {
      if (e.fate !== 'yield') this._bleed(e.x, e.y - 12, e.fate === 'dead' ? 22 : 8);
      if (e.fate === 'dead') this._stain(e.x + 4, e.y + 2, 13);
      const text = e.fate === 'dead' ? 'погиб' : e.fate === 'yield' ? 'сдался' : 'пал';
      this.floats.push({ x: e.x, y: e.y - 60, text, life: 2.2, kind: e.fate });
      this.roar = 1;
      sound(e.fate === 'dead' ? 'death' : 'down');
    } else if (e.type === 'level') {
      const g = game.members.get(e.login);
      if (g) this.floats.push({ x: g.x, y: g.y - 70, text: 'уровень ' + e.level, life: 2, kind: 'level', follow: g });
      sound('level');
    } else if (e.type === 'buy') {
      sound('coin');
    } else if (e.type === 'join') {
      sound('join');
    } else if (e.type === 'go') {
      sound(e.place === 'heal' ? 'heal' : e.place === 'train' ? 'train' : 'step');
    } else if (e.type === 'phase') {
      this._banner(game, e.state);
      if (e.state === 'battle') sound('horn');
      if (e.state === 'results') sound(game.results && game.results.champion ? 'champion' : 'cheer');
    }
  }

  _banner(game, state) {
    const box = $('banner');
    if (state === 'results') {
      box.hidden = true;
      return;
    }
    box.className = 'banner ' + state;
    $('banner-title').textContent = state === 'battle' ? 'В БОЙ!' : 'ЛУДУС';
    $('banner-text').textContent = state === 'battle' ? 'Все против всех · ' + game.fighters.length + ' '
      + plural(game.fighters.length, 'гладиатор', 'гладиатора', 'гладиаторов')
      : 'Готовьтесь к бою: ' + clock(game.timer);
    box.hidden = true;
    void box.offsetWidth;
    box.hidden = false;
    clearTimeout(this._bannerOff);
    this._bannerOff = setTimeout(() => {
      box.hidden = true;
    }, 2400);
  }

  _bleed(x, y, n) {
    if (this.scene !== 'arena') return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 110;
      this.drops.push({ x, y, z: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5, vz: 60 + Math.random() * 90,
        r: 1.5 + Math.random() * 2.5, color: BLOOD[Math.floor(Math.random() * BLOOD.length)] });
    }
  }

  _stain(x, y, r, color = BLOOD[2]) {
    if (!this.stains) return;
    const ctx = this.stains.getContext('2d');
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x / PIXEL, y / PIXEL, r / PIXEL, r * 0.45 / PIXEL, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _blood(ctx, dt) {
    for (const d of this.drops) {
      d.vz -= 420 * dt;
      d.z += d.vz * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.z <= 0) {
        d.dead = true;
        this._stain(d.x, d.y, d.r * 1.6, d.color);
        continue;
      }
      ctx.fillStyle = d.color;
      ctx.fillRect(d.x - d.r / 2, d.y - d.z - d.r / 2, d.r, d.r);
    }
    this.drops = this.drops.filter((d) => !d.dead);
  }

  _draw(game, scene, dt) {
    const w = this.wctx;
    w.setTransform(1, 0, 0, 1, 0, 0);
    w.imageSmoothingEnabled = false;
    w.drawImage(this._back(scene), 0, 0);
    if (scene === 'arena') {
      if (!this.stains) {
        this.stains = document.createElement('canvas');
        this.stains.width = this.world.width;
        this.stains.height = this.world.height;
      }
      w.drawImage(this.stains, 0, 0);
    }
    w.setTransform(1 / PIXEL, 0, 0, 1 / PIXEL, 0, 0);
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    const t = this.time;
    let figures;
    if (scene === 'arena') {
      drawCrowd(w, this.people, t, Math.min(1, this.roar + 0.15));
      figures = game.fighters.slice();
    } else {
      figures = Array.from(game.members.values()).filter((g) => !g.fate);
      for (const g of figures) {
        if (g.place !== 'train' || g.walking || g.swing <= 0) continue;
        DUMMIES.forEach((d, i) => {
          if (Math.hypot(d.x - g.x, d.y - g.y) >= 46) return;
          if (this.dummyHits[i] < 0.2 && !this.quiet) play('thwack');
          this.dummyHits[i] = 0.4;
        });
      }
      drawLudusLife(w, t, this.dummyHits);
      drawSigns(ctx, this.signs || []);
      drawSoon(ctx, t);
    }
    const lying = (g) => scene === 'arena' && (g.fate === 'down' || g.fate === 'dead');
    figures.sort((a, b) => (lying(b) - lying(a)) || a.y - b.y);
    for (const g of figures) drawGladiator(w, g, t, scene);
    if (scene === 'arena') this._blood(w, dt);
    const cards = new Set(game.cards.map((c) => c.login));
    for (const g of figures) drawLabel(ctx, g, scene, cards.has(g.login));
    this._floats(ctx, dt);
    if (this.fade > 0) {
      const k = this.fade / FADE;
      ctx.fillStyle = 'rgba(10,8,14,' + Math.min(1, k * 1.4).toFixed(3) + ')';
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    }
  }

  _floats(ctx, dt) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floats) {
      f.life -= dt;
      const total = f.kind === 'hit' || f.kind === 'miss' ? FLOAT_TIME : 2;
      const k = 1 - Math.max(0, f.life) / total;
      const x = f.follow ? f.follow.x : f.x, y = (f.follow ? f.follow.y - 70 : f.y) - k * 26;
      const alpha = Math.min(1, f.life * 3);
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      let size = 15, color = '#fff';
      if (f.kind === 'hit') {
        size = f.crit ? 22 : 15;
        color = f.crit ? '#ffd34d' : '#ffffff';
      } else if (f.kind === 'miss') {
        size = 13;
        color = '#c9d3dc';
      } else if (f.kind === 'dead') {
        size = 22;
        color = '#ff6b5e';
      } else if (f.kind === 'down' || f.kind === 'yield') {
        size = 18;
        color = '#f1e7d4';
      } else if (f.kind === 'level') {
        size = 17;
        color = '#ffd34d';
      }
      ctx.font = Math.round(size * 0.8) + 'px "Press Start 2P", ' + FONT;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20,12,10,.85)';
      ctx.strokeText(f.text, x, y);
      ctx.fillStyle = color;
      ctx.fillText(f.text, x, y);
      ctx.globalAlpha = 1;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
  }

  // --- DOM ---

  _set(id, key, build) {
    if (this.keys[id] === key) return;
    this.keys[id] = key;
    build($(id));
  }

  _dom(game) {
    const state = game.state;
    const phase = { ludus: 'Лудус · подготовка', battle: 'Арена · все против всех', results: 'Итоги боя' }[state] || '';
    this._set('phase', state, (node) => {
      node.textContent = phase;
      node.className = 'phase ' + state;
    });
    const left = state === 'stopped' ? '' : clock(game.timer);
    this._set('clock', left + (state === 'battle' && game.timer < 15), (node) => {
      node.textContent = left;
      node.classList.toggle('hot', state === 'battle' && game.timer < 15);
    });
    this._status(game);
    this._roster(game);
    this._feed(game);
    this._cards(game);
    this._results(game);
    this._set('pause', String(game.paused), (node) => {
      node.hidden = !game.paused;
      $('pause-text').textContent = 'Стример поставил игру на паузу';
    });
  }

  _status(game) {
    const key = game.state + '|' + game.notice + '|' + (game.state === 'battle' ? game.waiting : '');
    this._set('status', key, (node) => {
      node.replaceChildren();
      if (game.notice) {
        node.append(el('span', 'warn', game.notice));
      } else if (game.state === 'battle') {
        node.append(el('small', '', game.waiting ? 'В лудусе ждут следующего боя: ' + game.waiting
          : 'Бой до последнего на ногах'));
      } else if (game.state === 'results') {
        node.append(el('small', '', 'Награды розданы — скоро снова в лудус'));
      } else {
        node.append(el('small', '', 'Напиши в чат что угодно — и ты гладиатор'));
      }
    });
    this._set('commands', game.state, (node) => {
      const list = COMMANDS[game.state] || COMMANDS.ludus;
      node.replaceChildren(...list.map(([word, text]) => {
        const item = el('span', 'command');
        item.append(el('code', '', word), el('small', '', text));
        return item;
      }));
    });
  }

  _roster(game) {
    const battle = game.state === 'battle';
    const list = Array.from(game.members.values());
    const fateOrder = { fight: 0, yield: 1, down: 1, dead: 2 };
    list.sort((a, b) => (battle ? (fateOrder[a.fate] ?? 3) - (fateOrder[b.fate] ?? 3) : 0)
      || b.level - a.level || b.xp - a.xp || a.name.localeCompare(b.name));
    const room = this.settings && this.settings.webcam ? 6 : 14;
    const shown = list.slice(0, room);
    const key = shown.map((g) => [g.login, g.level, Math.round(g.hp / maxHp(g) * 20), battle ? g.fate : g.place,
      g.walking && !battle].join(':')).join('|') + '#' + list.length + '#' + game.roster.fallen.length;
    this._set('roster', key, (node) => {
      node.replaceChildren(...shown.map((g) => {
        const li = el('li', g.fate === 'dead' && battle ? 'gone' : '');
        const lvl = el('span', 'lvl', String(g.level));
        lvl.style.background = g.color;
        const where = battle && g.fate ? g.fate : g.place;
        const part = Math.max(0, Math.min(1, g.hp / maxHp(g)));
        const bar = el('span', 'hp'), fill = el('i', part > 0.5 ? '' : part > 0.25 ? 'mid' : 'low');
        fill.style.width = (part * 100).toFixed(0) + '%';
        bar.append(fill);
        li.append(lvl, el('span', 'name', g.name), el('span', 'where ' + where, battle && !g.fate ? 'ждёт' : WHERE[where]),
          bar);
        return li;
      }));
      $('count').textContent = list.length ? String(list.length) : '';
      $('more').textContent = list.length > room ? '…и ещё ' + (list.length - room) : '';
      $('empty').hidden = list.length > 0;
      const fallen = game.roster.fallen.length;
      $('fallen').textContent = fallen ? 'павших: ' + fallen : '';
    });
  }

  _feed(game) {
    const lines = game.lines.slice(-7);
    const key = lines.map((l) => l.id).join(',');
    this._set('feed', key, (node) => {
      node.replaceChildren(...lines.slice().reverse().map((line) => {
        const li = el('li', line.kind, line.text);
        li.title = line.text;
        return li;
      }));
    });
  }

  // карточку не пересоздаём, а обновляем изнутри: иначе анимация появления мигает
  _cards(game) {
    const cards = game.cards.map((c) => game.members.get(c.login)).filter(Boolean);
    const node = $('cards');
    this.cardNodes = this.cardNodes || new Map();
    for (const [login, box] of this.cardNodes) {
      if (cards.some((g) => g.login === login)) continue;
      box.remove();
      this.cardNodes.delete(login);
    }
    for (const g of cards) {
      let box = this.cardNodes.get(g.login);
      const key = [g.level, Math.floor(g.xp), Math.round(g.hp), g.coins, g.str, g.agi, g.vit, g.points, g.weapon,
        g.armor, g.fights].join(':');
      if (!box) {
        box = el('div', 'profile');
        box.dataset.key = '';
        this.cardNodes.set(g.login, box);
      }
      if (box.parentNode !== node) node.append(box);
      if (box.dataset.key === key) continue;
      box.dataset.key = key;
      box.style.setProperty('--c', g.color);
      box.replaceChildren(...this._profile(g));
    }
  }

  _profile(g) {
    const box = { parts: [], append(...items) { this.parts.push(...items); } };
    const top = el('div', 'top');
    top.append(el('span', 'who', g.name), el('span', 'lv', g.level + ' ур.'));
    const bar = (kind, part, text) => {
      const node = el('div', 'bar ' + kind), fill = el('i');
      fill.style.width = (Math.max(0, Math.min(1, part)) * 100).toFixed(1) + '%';
      node.append(fill, el('span', '', text));
      return node;
    };
    const hpMax = maxHp(g), need = xpNeed(g.level);
    const stats = el('div', 'stats');
    for (const stat of STATS) {
      const cell = el('div');
      cell.append(el('b', '', String(g[stat.id])), el('small', '', stat.name.toLowerCase()));
      stats.append(cell);
    }
    const gear = el('div', 'gear');
    const line = (label, value) => {
      const p = el('div');
      p.append(label + ': ', el('b', '', value));
      return p;
    };
    gear.append(line('Оружие', WEAPONS[g.weapon]), line('Доспех', ARMORS[g.armor]),
      line('Монеты', String(g.coins)),
      line('Бои', g.fights + ' · побед ' + g.wins + ' · нокаутов ' + g.kos + ' · убийств ' + g.kills));
    box.append(top, bar('hp', g.hp / hpMax, Math.round(g.hp) + ' / ' + hpMax + ' здоровья'),
      bar('xp', g.xp / need, Math.floor(g.xp) + ' / ' + need + ' опыта'), stats);
    if (g.points > 0) {
      box.append(el('div', 'gear points', 'Свободных очков: ' + g.points + ' — пиши «сила», «ловкость» или «выносливость»'));
    }
    box.append(gear);
    return box.parts;
  }

  _results(game) {
    const r = game.state === 'results' ? game.results : null;
    this._set('results', r ? 'on' + game.eventId : 'off', (node) => {
      node.hidden = !r;
      if (!r) return;
      const champ = r.rows.find((row) => row.login === r.champion);
      $('champion').replaceChildren();
      if (champ) {
        $('champion').append('Чемпион арены — ', el('b', '', champ.name));
      } else {
        $('champion').textContent = 'Время вышло — чемпиона нет';
      }
      const fill = (id, rows, describe) => {
        const items = rows.slice(0, 11).map((row) => {
          const li = el('li');
          const name = el('b', '', row.name);
          name.style.color = row.color;
          li.append(name, describe(row));
          return li;
        });
        if (rows.length > 11) items.push(el('li', 'none', '…и ещё ' + (rows.length - 11)));
        if (!rows.length) items.push(el('li', 'none', 'никого'));
        $(id).replaceChildren(...items);
      };
      const reward = (row) => {
        const span = el('span', '', '+' + row.xp + ' опыта · +' + row.coins + ' монет'
          + (row.kos ? ' · нокаутов ' + row.kos : ''));
        if (row.ups) span.append(' · ', el('span', 'up', row.level + ' ур.!'));
        return span;
      };
      fill('res-alive', r.rows.filter((row) => row.fate === 'fight'), reward);
      fill('res-beaten', r.rows.filter((row) => row.fate === 'down' || row.fate === 'yield'), reward);
      fill('res-dead', r.rows.filter((row) => row.fate === 'dead'),
        (row) => el('span', '', (row.by ? 'от руки ' + row.by : 'на арене') + ' · ' + row.level + ' ур.'));
    });
    if (r) $('res-next').textContent = 'Возвращение в лудус через ' + Math.max(0, Math.ceil(game.timer)) + ' с';
  }
}

export { PLACES };
