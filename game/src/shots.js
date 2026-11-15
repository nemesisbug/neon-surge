// The screenshot scenes behind ?shot=start|play|action|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (chase cores, shoot the nearest enemy, dash away when one gets close), so the frame is
// what a real game looks like and the same seed always gives the same frame. The end
// scene's pilot is reckless on purpose (no dash, flies at enemies), so it gets caught.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 22;
const ACTION_SECONDS = 48;
const END_LIMIT_SECONDS = 600;

/** Steer the ship: return { move, aimX, aimY, firing, dash }. */
function autopilot(state, reckless) {
  const p = state.player;
  let enemy = null;
  let enemyD2 = Infinity;
  for (const e of state.enemies) {
    if (!e.active || e.warn > 0) continue;
    const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d2 < enemyD2) {
      enemyD2 = d2;
      enemy = e;
    }
  }
  let core = null;
  let coreD2 = Infinity;
  for (const c of state.cores) {
    if (!c.active) continue;
    const d2 = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
    if (d2 < coreD2) {
      coreD2 = d2;
      core = c;
    }
  }
  const aimX = enemy !== null
    ? enemy.x + enemy.vx * (Math.sqrt(enemyD2) / 780) * 0.9
    : p.x;
  const aimY = enemy !== null
    ? enemy.y + enemy.vy * (Math.sqrt(enemyD2) / 780) * 0.9
    : p.y - 120;

  let mx = 0;
  let my = 0;
  if (reckless) {
    // Fly straight at the nearest enemy and never dash: a hurried player's end.
    if (enemy !== null) {
      mx = (enemy.x - p.x) / Math.sqrt(enemyD2);
      my = (enemy.y - p.y) / Math.sqrt(enemyD2);
    }
    return { move: { x: mx, y: my }, aimX, aimY, firing: enemy !== null, dash: false };
  }
  const danger = enemy !== null && enemyD2 < 130 * 130;
  if (danger) {
    // Flee the nearest enemy, dash if it is very close.
    const d = Math.sqrt(enemyD2);
    mx = (p.x - enemy.x) / d;
    my = (p.y - enemy.y) / d;
    return { move: { x: mx, y: my }, aimX, aimY, firing: true, dash: enemyD2 < 70 * 70 };
  }
  if (core !== null && coreD2 < 420 * 420) {
    const d = Math.sqrt(coreD2);
    mx = (core.x - p.x) / d;
    my = (core.y - p.y) / d;
  } else if (enemy !== null) {
    // Keep some distance but stay in range: orbit the enemy.
    const d = Math.sqrt(enemyD2);
    mx = (enemy.x - p.x) / d;
    my = (enemy.y - p.y) / d;
    if (d < 240) {
      mx = -my * 0.6;
      my = mx * 0.6 + (enemy.y - p.y) / d;
    }
  } else {
    mx = (FIELD.width / 2 - p.x) / FIELD.width;
    my = (FIELD.height / 2 - p.y) / FIELD.height;
  }
  const len = Math.hypot(mx, my) || 1;
  return { move: { x: mx / len, y: my / len }, aimX, aimY, firing: enemy !== null, dash: false };
}

/**
 * Set `world` to the named scene (start, play, action or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'action' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { move: { x: 0, y: 0 }, aimX: 640, aimY: 300, firing: false, dash: false }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const seconds = name === 'end' ? END_LIMIT_SECONDS : name === 'action' ? ACTION_SECONDS : PLAY_SECONDS;
  const reckless = name === 'end';
  let over = false;
  for (let i = 0; i < seconds / STEP; i += 1) {
    const ctrl = autopilot(world.state, reckless);
    if (world.step(STEP, ctrl, false) & EVENT_OVER) {
      over = true;
      break;
    }
  }
  if (!over && name === 'action') {
    // End the action scene mid-surge, so the frame is dense with fresh enemies.
    world.surge(6 + world.state.level);
    for (let i = 0; i < 1.2 / STEP; i += 1) {
      const ctrl = autopilot(world.state, false);
      if (world.step(STEP, ctrl, false) & EVENT_OVER) {
        over = true;
        break;
      }
    }
  }
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: over ? world.state.score : 0 };
}
