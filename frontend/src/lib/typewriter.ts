// Typewriter sounds for focus mode, synthesized with the Web Audio API so
// the app ships no audio files. Each theme builds its sounds from noise
// bursts and short oscillators with a little randomness per keystroke.

export type SoundTheme = 'off' | 'typewriter' | 'soft' | 'mechanical';

export const SOUND_THEMES: [SoundTheme, string][] = [
  ['off', 'No sound'],
  ['typewriter', 'Typewriter'],
  ['soft', 'Soft pads'],
  ['mechanical', 'Mechanical keys'],
];

const LS_THEME = 'bs-focus-sound';
const LS_VOLUME = 'bs-focus-volume';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

let theme: SoundTheme = (localStorage.getItem(LS_THEME) as SoundTheme) || 'typewriter';
let volume = Number(localStorage.getItem(LS_VOLUME) ?? '0.6');

export function getSoundTheme(): SoundTheme {
  return theme;
}

export function setSoundTheme(t: SoundTheme) {
  theme = t;
  localStorage.setItem(LS_THEME, t);
}

export function getSoundVolume(): number {
  return volume;
}

export function setSoundVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  localStorage.setItem(LS_VOLUME, String(volume));
  if (master) master.gain.value = volume;
}

function ensureContext(): AudioContext | null {
  if (theme === 'off') return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 0.1);
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function rand(spread: number): number {
  return 1 + (Math.random() * 2 - 1) * spread;
}

// noiseBurst plays filtered noise: the "clack" component of a keystroke.
function noiseBurst(freq: number, q: number, gain: number, duration: number, when = 0) {
  if (!ctx || !master || !noiseBuffer) return;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.playbackRate.value = rand(0.1);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq * rand(0.15);
  filter.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain * rand(0.2), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(filter).connect(g).connect(master);
  src.start(t);
  src.stop(t + duration + 0.02);
}

// thump plays a short pitched knock: the body of the key hitting bottom.
function thump(freq: number, gain: number, duration: number, type: OscillatorType = 'triangle', when = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq * rand(0.08), t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), t + duration);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain * rand(0.15), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

// ding is the carriage-return bell.
function ding(freq: number, gain: number) {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.65);
  // A faint overtone makes it ring like a real bell.
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = freq * 2.7;
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(gain * 0.3, t);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o2.connect(g2).connect(master);
  o2.start(t);
  o2.stop(t + 0.4);
}

// warmUp creates (and resumes) the audio context ahead of the first key.
export function warmUp() {
  ensureContext();
}

// playKey makes the sound for one keydown event in the current theme.
// Every key sounds: characters get the full strike, everything else
// (shift, arrows, tab…) a lighter click, like the levers of a real machine.
export function playKey(key: string, repeated: boolean) {
  if (theme === 'off' || repeated) return;
  const c = ensureContext();
  if (!c) return;
  if (c.state === 'suspended') {
    // First stroke after idle: resume, then play so nothing is swallowed.
    void c.resume().then(() => strike(key));
    return;
  }
  strike(key);
}

function strike(key: string) {
  const isSpace = key === ' ';
  const isEnter = key === 'Enter';
  const isBackspace = key === 'Backspace' || key === 'Delete';
  const isChar = key.length === 1 || isBackspace;
  if (!isChar && !isEnter && !isSpace) {
    // Modifier and movement keys: a light mechanical click.
    switch (theme) {
      case 'typewriter':
        noiseBurst(1800, 1.2, 0.14, 0.04);
        break;
      case 'soft':
        thump(150, 0.07, 0.04, 'sine');
        break;
      case 'mechanical':
        noiseBurst(3000, 2, 0.12, 0.03);
        break;
    }
    return;
  }

  switch (theme) {
    case 'typewriter':
      if (isEnter) {
        ding(1320, 0.22);
        noiseBurst(900, 0.8, 0.25, 0.18, 0.02); // carriage slide
        thump(110, 0.3, 0.09, 'triangle', 0.16);
      } else if (isSpace) {
        thump(95, 0.35, 0.07);
        noiseBurst(1400, 1, 0.18, 0.05);
      } else if (isBackspace) {
        noiseBurst(3200, 2, 0.3, 0.05);
      } else {
        noiseBurst(2600, 1.5, 0.4, 0.06);
        thump(160, 0.22, 0.05);
      }
      break;
    case 'soft':
      if (isEnter) {
        thump(140, 0.22, 0.12, 'sine');
      } else if (isSpace) {
        thump(90, 0.2, 0.09, 'sine');
      } else {
        thump(170, 0.14, 0.06, 'sine');
        noiseBurst(1200, 1, 0.06, 0.04);
      }
      break;
    case 'mechanical':
      if (isEnter) {
        noiseBurst(1800, 1.2, 0.4, 0.08);
        thump(120, 0.3, 0.08);
      } else if (isSpace) {
        noiseBurst(1500, 1, 0.3, 0.07);
        thump(100, 0.3, 0.07);
      } else {
        noiseBurst(4200, 2.5, 0.32, 0.035);
        noiseBurst(2200, 1.5, 0.18, 0.05, 0.012);
        thump(190, 0.12, 0.04);
      }
      break;
  }
}
