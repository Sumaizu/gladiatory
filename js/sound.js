// все звуки синтезируются на лету — файлов нет
const GAP = { hit: 0.07, crit: 0.1, miss: 0.12, down: 0.15, death: 0.4, horn: 1, level: 0.3, coin: 0.15, join: 0.2,
  cheer: 1.5 };

let audio = null;
let master = null;
let noiseBuffer = null;
let enabled = true;
let volume = 0.7;
const lastPlayed = new Map();

function context() {
  if (!audio) {
    try {
      audio = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      return null;
    }
    master = audio.createGain();
    master.connect(audio.destination);
    noiseBuffer = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  master.gain.value = volume * 0.5;
  return audio;
}

function tone(ac, { freq, to = null, dur, type = 'sine', gain = 0.3, at = 0 }) {
  const start = ac.currentTime + at;
  const osc = ac.createOscillator(), amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(amp).connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function hiss(ac, { dur, gain = 0.3, freq = 2000, q = 1, at = 0, kind = 'bandpass' }) {
  const start = ac.currentTime + at;
  const src = ac.createBufferSource(), filter = ac.createBiquadFilter(), amp = ac.createGain();
  src.buffer = noiseBuffer;
  filter.type = kind;
  filter.frequency.value = freq;
  filter.Q.value = q;
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter).connect(amp).connect(master);
  src.start(start, Math.random() * 0.5);
  src.stop(start + dur + 0.05);
}

const SOUNDS = {
  hit(ac) {
    hiss(ac, { dur: 0.08, gain: 0.35, freq: 2600, q: 2 });
    tone(ac, { freq: 1400 + Math.random() * 500, dur: 0.12, type: 'triangle', gain: 0.12 });
  },
  crit(ac) {
    hiss(ac, { dur: 0.12, gain: 0.45, freq: 3200, q: 3 });
    tone(ac, { freq: 2100, to: 1500, dur: 0.25, type: 'triangle', gain: 0.18 });
  },
  miss(ac) {
    hiss(ac, { dur: 0.16, gain: 0.18, freq: 900, q: 0.7 });
  },
  down(ac) {
    tone(ac, { freq: 140, to: 50, dur: 0.3, type: 'sine', gain: 0.5 });
    hiss(ac, { dur: 0.25, gain: 0.2, freq: 400, q: 0.6, kind: 'lowpass' });
  },
  death(ac) {
    tone(ac, { freq: 98, dur: 1.6, type: 'sine', gain: 0.45 });
    tone(ac, { freq: 147, dur: 1.2, type: 'sine', gain: 0.2 });
    tone(ac, { freq: 233, dur: 0.9, type: 'triangle', gain: 0.08 });
  },
  horn(ac) {
    for (const [freq, at] of [[196, 0], [262, 0.22], [330, 0.44]]) {
      tone(ac, { freq, dur: 0.5, type: 'sawtooth', gain: 0.09, at });
      tone(ac, { freq: freq * 1.005, dur: 0.5, type: 'square', gain: 0.04, at });
    }
  },
  level(ac) {
    [523, 659, 784, 1046].forEach((freq, i) => tone(ac, { freq, dur: 0.22, type: 'triangle', gain: 0.16, at: i * 0.07 }));
  },
  coin(ac) {
    tone(ac, { freq: 988, dur: 0.08, type: 'square', gain: 0.07 });
    tone(ac, { freq: 1319, dur: 0.25, type: 'square', gain: 0.07, at: 0.07 });
  },
  join(ac) {
    tone(ac, { freq: 440, to: 660, dur: 0.18, type: 'triangle', gain: 0.12 });
  },
  cheer(ac) {
    hiss(ac, { dur: 1.6, gain: 0.25, freq: 1100, q: 0.4 });
    hiss(ac, { dur: 1.2, gain: 0.15, freq: 2400, q: 0.8, at: 0.1 });
  },
};

export function setSound(on, level) {
  enabled = Boolean(on);
  volume = Math.max(0, Math.min(1, level / 100));
  if (master) master.gain.value = volume * 0.5;
}

export function play(name) {
  if (!enabled || volume <= 0 || !SOUNDS[name]) return;
  const ac = context();
  if (!ac) return;
  const now = ac.currentTime;
  if (now - (lastPlayed.get(name) || -10) < (GAP[name] || 0.1)) return;
  lastPlayed.set(name, now);
  SOUNDS[name](ac);
}

export function playAll(level) {
  const was = [enabled, volume];
  setSound(true, level);
  ['horn', 'hit', 'crit', 'down', 'level', 'death'].forEach((name, i) => setTimeout(() => {
    lastPlayed.delete(name);
    play(name);
    if (i === 5) setSound(was[0], was[1] * 100);
  }, i * 450));
}
