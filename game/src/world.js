// NEON SURGE's rules and state, with no drawing and no browser in it: the player ship,
// the enemy pool (chasers, weavers, splitters, minis), bullets, enemy orbs, cores,
// particles and floating texts, spawning, collisions, combo, score, lives and levels.
// step() advances one fixed step and returns what happened as bit flags, so the caller
// can react (sound, announcements) without the world knowing about screens or sound.
// Nothing here allocates after createWorld returns.
import { COMBO, CORE, ENEMY, FIELD, LEVEL, LIVES, PLAYER, POOL, SPAWN } from './config.js';

export const KIND_CHASER = 0;
export const KIND_WEAVER = 1;
export const KIND_SPLITTER = 2;
export const KIND_MINI = 3;

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_PICKUP = 4;
export const EVENT_OVER = 8;
export const EVENT_LEVEL = 16;
export const EVENT_DASH = 32;
export const EVENT_SHOOT = 64;
export const EVENT_ENEMY_SHOOT = 128;

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0, angle: -Math.PI / 2,
    radius: PLAYER.radius, invuln: 0, dashTime: 0, dashCd: 0, dashX: 0, dashY: 0,
    fireTimer: 0, hidden: false,
  };

  function makePool(size, init) {
    const pool = [];
    for (let i = 0; i < size; i += 1) pool.push(init());
    return pool;
  }

  const enemies = makePool(POOL.enemies, () => ({
    active: false, kind: KIND_CHASER, x: 0, y: 0, vx: 0, vy: 0, r: 10, hp: 1,
    speed: 0, t: 0, seed: 0, shotTimer: 0, warn: 0,
  }));
  const bullets = makePool(POOL.bullets, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, r: 4, life: 0 }));
  const orbs = makePool(POOL.orbs, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, r: 6, life: 0 }));
  const cores = makePool(POOL.cores, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, r: 8, life: 0 }));
  const particles = makePool(POOL.particles, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff',
  }));
  const texts = makePool(POOL.texts, () => ({ active: false, x: 0, y: 0, life: 0, maxLife: 1, text: '', color: '#fff', size: 18 }));
  const trail = makePool(12, () => ({ active: false, x: 0, y: 0, angle: 0, life: 0 }));

  const state = {
    player, enemies, bullets, orbs, cores, particles, texts, trail,
    time: 0, elapsed: 0, level: 1, score: 0, lives: LIVES, kills: 0,
    combo: 0, comboTimer: 0, mult: 1,
    shake: 0, flash: 0, spawnTimer: 0.8, surgeTimer: SPAWN.surgeEvery, shotsFired: 0, shotsHit: 0,
  };

  function free(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
    return null;
  }

  function burst(x, y, color, count, speed, size) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (p === null) return;
      const a = random() * TAU;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.maxLife = 0.35 + random() * 0.45;
      p.life = p.maxLife;
      p.size = size * (0.6 + random() * 0.8);
      p.color = color;
    }
  }

  function addText(x, y, text, color, size) {
    const t = free(texts);
    if (t === null) return;
    t.active = true;
    t.x = x;
    t.y = y;
    t.maxLife = 0.9;
    t.life = t.maxLife;
    t.text = text;
    t.color = color;
    t.size = size;
  }

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.vx = 0;
    player.vy = 0;
    player.angle = -Math.PI / 2;
    player.invuln = 0;
    player.dashTime = 0;
    player.dashCd = 0;
    player.fireTimer = 0;
    player.hidden = false;
    for (const p of [enemies, bullets, orbs, cores, particles, texts, trail]) {
      for (const item of p) item.active = false;
    }
    state.time = 0;
    state.elapsed = 0;
    state.level = 1;
    state.score = 0;
    state.lives = LIVES;
    state.kills = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.mult = 1;
    state.shake = 0;
    state.flash = 0;
    state.spawnTimer = 0.8;
    state.surgeTimer = SPAWN.surgeEvery;
    state.shotsFired = 0;
    state.shotsHit = 0;
  }

  /** A surge wave: burst-spawn `count` enemies at the edges, with the usual warning. */
  function surge(count) {
    for (let i = 0; i < count; i += 1) spawnEnemy(pickKind());
    addText(FIELD.width / 2, 150, 'SURGE!', '#ff2e88', 40);
    state.shake = Math.min(1, state.shake + 0.3);
  }

  function comboGain() {
    state.combo += 1;
    state.comboTimer = COMBO.window;
    state.mult = Math.min(COMBO.maxMult, 1 + Math.floor(state.combo / COMBO.perMult));
  }

  function dropCore(x, y) {
    const c = free(cores);
    if (c === null) return;
    c.active = true;
    c.x = x;
    c.y = y;
    const a = random() * TAU;
    c.vx = Math.cos(a) * 40;
    c.vy = Math.sin(a) * 40;
    c.r = CORE.radius;
    c.life = CORE.life;
  }

  function killEnemy(e, events) {
    e.active = false;
    state.kills += 1;
    comboGain();
    const gained = (e.kind === KIND_CHASER ? ENEMY.chaser.score
      : e.kind === KIND_WEAVER ? ENEMY.weaver.score
      : e.kind === KIND_SPLITTER ? ENEMY.splitter.score : ENEMY.mini.score) * state.mult;
    state.score += gained;
    addText(e.x, e.y - 10, `+${gained}`, '#ffe14d', 18);
    const color = e.kind === KIND_CHASER ? '#ff2e88' : e.kind === KIND_WEAVER ? '#00e5ff' : e.kind === KIND_SPLITTER ? '#ff9a3d' : '#ff5c8a';
    burst(e.x, e.y, color, e.kind === KIND_SPLITTER ? 26 : 16, 260, 3);
    burst(e.x, e.y, '#ffffff', 6, 160, 2);
    state.shake = Math.min(1, state.shake + (e.kind === KIND_SPLITTER ? 0.45 : 0.22));
    if (e.kind === KIND_SPLITTER) {
      for (let i = 0; i < 2; i += 1) spawnEnemy(KIND_MINI, e.x + (i === 0 ? -14 : 14), e.y);
      dropCore(e.x - 10, e.y);
      dropCore(e.x + 10, e.y);
    } else {
      dropCore(e.x, e.y);
    }
    return events | EVENT_KILL;
  }

  function spawnEnemy(kind, x, y) {
    const e = free(enemies);
    if (e === null) return null;
    const def = kind === KIND_CHASER ? ENEMY.chaser : kind === KIND_WEAVER ? ENEMY.weaver : kind === KIND_SPLITTER ? ENEMY.splitter : ENEMY.mini;
    e.active = true;
    e.kind = kind;
    e.x = x ?? -30;
    e.y = y ?? -30;
    if (x === undefined) {
      // Enter from a random edge.
      const edge = Math.floor(random() * 4);
      if (edge === 0) { e.x = random() * FIELD.width; e.y = -24; }
      else if (edge === 1) { e.x = random() * FIELD.width; e.y = FIELD.height + 24; }
      else if (edge === 2) { e.x = -24; e.y = random() * FIELD.height; }
      else { e.x = FIELD.width + 24; e.y = random() * FIELD.height; }
    }
    e.vx = 0;
    e.vy = 0;
    e.r = def.radius;
    e.hp = def.hp;
    e.speed = def.speed + def.speedPerLevel * (state.level - 1);
    e.t = 0;
    e.seed = random() * TAU;
    e.shotTimer = ENEMY.weaver.shotInterval * (0.7 + random() * 0.6);
    e.warn = SPAWN.warnTime;
    return e;
  }

  function pickKind() {
    const roll = random();
    const wWeaver = state.level >= 2 ? 0.22 + state.level * 0.01 : 0;
    const wSplitter = state.level >= 3 ? 0.12 + state.level * 0.008 : 0;
    if (roll < wSplitter) return KIND_SPLITTER;
    if (roll < wSplitter + wWeaver) return KIND_WEAVER;
    return KIND_CHASER;
  }

  function fireBullet() {
    const b = free(bullets);
    if (b === null) return;
    const a = player.angle;
    b.active = true;
    b.x = player.x + Math.cos(a) * (player.radius + 6);
    b.y = player.y + Math.sin(a) * (player.radius + 6);
    b.vx = Math.cos(a) * PLAYER.bulletSpeed + player.vx * 0.4;
    b.vy = Math.sin(a) * PLAYER.bulletSpeed + player.vy * 0.4;
    b.r = PLAYER.bulletRadius;
    b.life = 0.9;
    state.shotsFired += 1;
    burst(b.x, b.y, '#aefcff', 2, 90, 2);
  }

  function fireOrb(e) {
    const o = free(orbs);
    if (o === null) return;
    const a = Math.atan2(player.y - e.y, player.x - e.x);
    o.active = true;
    o.x = e.x;
    o.y = e.y;
    o.vx = Math.cos(a) * ENEMY.weaver.orbSpeed;
    o.vy = Math.sin(a) * ENEMY.weaver.orbSpeed;
    o.r = 6;
    o.life = 3.2;
  }

  function hurtPlayer(events) {
    state.lives -= 1;
    player.invuln = PLAYER.invulnerable;
    state.shake = 1;
    state.flash = 0.7;
    state.combo = 0;
    state.mult = 1;
    state.comboTimer = 0;
    burst(player.x, player.y, '#ff3b5c', 24, 300, 3);
    burst(player.x, player.y, '#00f0ff', 10, 200, 2);
    if (state.lives <= 0) return events | EVENT_HIT | EVENT_OVER;
    return events | EVENT_HIT;
  }

  /**
   * One fixed step. `ctrl` is { move: {x,y}, aimX, aimY, firing, dash }.
   * With `harmless` set (the title screen's backdrop) things drift but nothing
   * touches the player, nothing scores, and the player stays hidden.
   */
  function step(dt, ctrl, harmless) {
    let events = 0;
    state.time += dt;
    if (!harmless) state.elapsed += dt;
    const level = Math.min(LEVEL.max, 1 + Math.floor(state.elapsed / LEVEL.seconds));
    if (level !== state.level) {
      state.level = level;
      events |= EVENT_LEVEL;
      if (!harmless) addText(FIELD.width / 2, 200, `LEVEL ${level}`, '#00f0ff', 44);
    }

    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.mult = 1;
      }
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.8);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 2.2);

    // --- player ---
    player.hidden = harmless;
    if (!harmless) {
      player.angle = Math.atan2(ctrl.aimY - player.y, ctrl.aimX - player.x);
      if (player.invuln > 0) player.invuln -= dt;
      if (player.dashCd > 0) player.dashCd -= dt;
      if (ctrl.dash && player.dashCd <= 0 && player.dashTime <= 0) {
        const dx = ctrl.move.x !== 0 || ctrl.move.y !== 0 ? ctrl.move.x : Math.cos(player.angle);
        const dy = ctrl.move.x !== 0 || ctrl.move.y !== 0 ? ctrl.move.y : Math.sin(player.angle);
        player.dashX = dx;
        player.dashY = dy;
        player.dashTime = PLAYER.dashTime;
        player.dashCd = PLAYER.dashCooldown;
        events |= EVENT_DASH;
      }
      if (player.dashTime > 0) {
        player.dashTime -= dt;
        player.vx = player.dashX * PLAYER.dashSpeed;
        player.vy = player.dashY * PLAYER.dashSpeed;
        const g = free(trail);
        if (g !== null) {
          g.active = true;
          g.x = player.x;
          g.y = player.y;
          g.angle = player.angle;
          g.life = 0.25;
        }
      } else {
        player.vx += ctrl.move.x * PLAYER.accel * dt;
        player.vy += ctrl.move.y * PLAYER.accel * dt;
        const drag = PLAYER.drag ** (dt * 60);
        player.vx *= drag;
        player.vy *= drag;
        const speed = Math.hypot(player.vx, player.vy);
        if (speed > PLAYER.maxSpeed) {
          player.vx = (player.vx / speed) * PLAYER.maxSpeed;
          player.vy = (player.vy / speed) * PLAYER.maxSpeed;
        }
      }
      player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + player.vx * dt));
      player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y + player.vy * dt));
      player.fireTimer -= dt;
      if (ctrl.firing && player.fireTimer <= 0) {
        fireBullet();
        player.fireTimer = PLAYER.fireInterval;
        events |= EVENT_SHOOT;
      }
    }

    // --- spawning ---
    const alive = enemies.reduce((n, e) => n + (e.active ? 1 : 0), 0);
    const maxAlive = Math.min(POOL.enemies, SPAWN.maxAlive + state.level * 3);
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && alive < maxAlive) {
      spawnEnemy(pickKind());
      const interval = Math.max(SPAWN.minInterval, SPAWN.interval * SPAWN.intervalScale ** (state.level - 1));
      state.spawnTimer += interval;
    }
    if (!harmless) {
      state.surgeTimer -= dt;
      if (state.surgeTimer <= 0) {
        surge(3 + state.level);
        state.surgeTimer = SPAWN.surgeEvery;
      }
    }

    // --- enemies ---
    for (const e of enemies) {
      if (!e.active) continue;
      e.t += dt;
      if (e.warn > 0) {
        e.warn -= dt;
        continue;
      }
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (harmless) {
        // Title backdrop: drift slowly, never chase.
        e.x += Math.cos(e.seed) * 24 * dt;
        e.y += Math.sin(e.seed) * 24 * dt;
        if (e.x < -40) e.x = FIELD.width + 30;
        if (e.x > FIELD.width + 40) e.x = -30;
        if (e.y < -40) e.y = FIELD.height + 30;
        if (e.y > FIELD.height + 40) e.y = -30;
        continue;
      }
      if (e.kind === KIND_WEAVER) {
        const wob = Math.sin(e.t * 3 + e.seed) * 0.7;
        const px = -dy / d;
        const py = dx / d;
        e.vx = (dx / d) * e.speed + px * wob * e.speed * 0.8;
        e.vy = (dy / d) * e.speed + py * wob * e.speed * 0.8;
        e.shotTimer -= dt;
        if (e.shotTimer <= 0 && d < 560) {
          fireOrb(e);
          e.shotTimer = ENEMY.weaver.shotInterval;
          events |= EVENT_ENEMY_SHOOT;
        }
      } else {
        e.vx = (dx / d) * e.speed;
        e.vy = (dy / d) * e.speed;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      // Touching the player hurts (unless dashing through or invulnerable).
      if (player.dashTime <= 0 && player.invuln <= 0 && dist2(e.x, e.y, player.x, player.y) < (e.r + player.radius) ** 2) {
        e.active = false;
        burst(e.x, e.y, '#ff2e88', 14, 240, 3);
        events = hurtPlayer(events);
        if (events & EVENT_OVER) return events;
      }
    }

    // --- bullets ---
    for (const b of bullets) {
      if (!b.active) continue;
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      for (const e of enemies) {
        if (!e.active || e.warn > 0) continue;
        if (dist2(b.x, b.y, e.x, e.y) < (b.r + e.r) ** 2) {
          b.active = false;
          state.shotsHit += 1;
          e.hp -= 1;
          burst(b.x, b.y, '#aefcff', 4, 140, 2);
          if (e.hp <= 0) events = killEnemy(e, events);
          break;
        }
      }
    }

    // --- enemy orbs ---
    for (const o of orbs) {
      if (!o.active) continue;
      o.life -= dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (o.life <= 0 || o.x < -20 || o.x > FIELD.width + 20 || o.y < -20 || o.y > FIELD.height + 20) {
        o.active = false;
        continue;
      }
      if (!harmless && player.dashTime <= 0 && player.invuln <= 0 && dist2(o.x, o.y, player.x, player.y) < (o.r + player.radius) ** 2) {
        o.active = false;
        events = hurtPlayer(events);
        if (events & EVENT_OVER) return events;
      }
    }

    // --- cores ---
    for (const c of cores) {
      if (!c.active) continue;
      c.life -= dt;
      if (c.life <= 0) {
        c.active = false;
        continue;
      }
      const d2 = dist2(c.x, c.y, player.x, player.y);
      if (!harmless && d2 < CORE.magnetRadius ** 2) {
        const d = Math.sqrt(d2) || 1;
        c.vx += ((player.x - c.x) / d) * CORE.magnetSpeed * dt * 6;
        c.vy += ((player.y - c.y) / d) * CORE.magnetSpeed * dt * 6;
      } else {
        c.vx *= 0.98;
        c.vy *= 0.98;
      }
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (!harmless && d2 < (CORE.radius + player.radius + 6) ** 2) {
        c.active = false;
        comboGain();
        const gained = CORE.points * state.mult;
        state.score += gained;
        addText(c.x, c.y - 8, `+${gained}`, '#ffe14d', 16);
        burst(c.x, c.y, '#ffe14d', 8, 150, 2);
        events |= EVENT_PICKUP;
      }
    }

    // --- particles / texts / trail ---
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
    for (const t of texts) {
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) t.active = false;
      else t.y -= 34 * dt;
    }
    for (const g of trail) {
      if (!g.active) continue;
      g.life -= dt;
      if (g.life <= 0) g.active = false;
    }

    return events;
  }

  reset();
  return { state, reset, step, surge };
}
