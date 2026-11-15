// NEON SURGE — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  accel: 2600,
  maxSpeed: 430,
  drag: 0.86, // per-step velocity retention when no input (applied as pow(drag, dt*60))
  fireInterval: 0.125, // seconds between shots while holding fire
  bulletSpeed: 780,
  bulletRadius: 4,
  dashSpeed: 1400,
  dashTime: 0.16, // seconds of dash
  dashCooldown: 1.6, // seconds before the next dash
  invulnerable: 1.5, // seconds of mercy after a hit
};

export const LIVES = 3;

/** Seconds of play per level, and the last level: spawns and speeds stop growing there. */
export const LEVEL = { seconds: 25, max: 10 };

export const ENEMY = {
  // kind: radius, hp, speed, base speed growth per level, score, colour key
  chaser: { radius: 14, hp: 1, speed: 140, speedPerLevel: 10, score: 50 },
  weaver: { radius: 13, hp: 1, speed: 110, speedPerLevel: 8, score: 100, minLevel: 2, shotInterval: 2.4, orbSpeed: 210 },
  splitter: { radius: 21, hp: 3, speed: 80, speedPerLevel: 6, score: 150, minLevel: 3 },
  mini: { radius: 9, hp: 1, speed: 200, speedPerLevel: 8, score: 25 },
};

export const SPAWN = {
  interval: 0.8, // seconds between spawns at level 1
  intervalScale: 0.82, // per level
  minInterval: 0.2,
  warnTime: 0.6, // seconds a spawn ring warns before the enemy activates
  maxAlive: 18, // +3 per level
  surgeEvery: 18, // seconds between surge waves (a burst of fresh enemies)
};

export const CORE = {
  radius: 8,
  points: 25,
  magnetRadius: 120,
  magnetSpeed: 420,
  life: 8, // seconds before a dropped core fades
};

export const COMBO = {
  window: 3.0, // seconds without a kill/pickup before the combo resets
  perMult: 4, // kills/pickups per +1 multiplier
  maxMult: 8,
};

/** Pool sizes: allocated once at boot, nothing allocates in the loop. */
export const POOL = { enemies: 48, bullets: 96, orbs: 48, cores: 64, particles: 256, texts: 24 };

export const PALETTE = {
  backdropTop: '#12041f',
  backdropBottom: '#05010d',
  grid: '#3b115f',
  gridBright: '#7b2ff7',
  star: '#ffffff',
  sun: '#ff2e88',
  sunLow: '#ff9a3d',
  player: '#00f0ff',
  playerCore: '#e8ffff',
  bullet: '#aefcff',
  chaser: '#ff2e88',
  weaver: '#00e5ff',
  splitter: '#ff9a3d',
  mini: '#ff5c8a',
  orb: '#c86bff',
  core: '#ffe14d',
  coreRing: '#fff3a0',
  text: '#f4f0ff',
  muted: '#9d8fc9',
  danger: '#ff3b5c',
  panel: 'rgba(16, 4, 34, 0.82)',
  panelBorder: '#7b2ff7',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'neon-surge.best';
