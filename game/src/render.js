// The renderer: everything the player sees, painted on one canvas. The playfield is a
// fixed 1280x720 logical area scaled to the window (letterboxed). Neon glow comes from
// shadowBlur on the few shapes that need it and one 'lighter' pass for particles;
// the rest is flat colour, so the frame stays fast.
import { FIELD, FONT, PALETTE } from './config.js';
import { KIND_CHASER, KIND_MINI, KIND_SPLITTER, KIND_WEAVER } from './world.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;

const TAU = Math.PI * 2;

const stars = [];
const nebulae = [];
{
  const rnd = createRandom(1337);
  for (let i = 0; i < 170; i += 1) {
    stars.push({ x: rnd() * FIELD.width, y: rnd() * FIELD.height, r: 0.5 + rnd() * 1.6, tw: rnd() * TAU });
  }
  const nebColors = ['123, 47, 247', '255, 46, 136', '0, 229, 255', '255, 154, 61'];
  for (let i = 0; i < 6; i += 1) {
    nebulae.push({ x: rnd() * FIELD.width, y: rnd() * FIELD.height * 0.62, r: 130 + rnd() * 190, color: nebColors[i % nebColors.length] });
  }
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = PALETTE.panelBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();
}

function text(ctx, str, x, y, size, color, align = 'center', weight = 700) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  function drawBackground(time) {
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, PALETTE.backdropTop);
    g.addColorStop(1, PALETTE.backdropBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    // Starfield with a slow twinkle.
    for (const s of stars) {
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(time * 1.4 + s.tw);
      ctx.fillStyle = PALETTE.star;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // Nebula blobs: soft colour washes across the sky.
    for (const n of nebulae) {
      const ng = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      ng.addColorStop(0, `rgba(${n.color}, 0.10)`);
      ng.addColorStop(1, `rgba(${n.color}, 0)`);
      ctx.fillStyle = ng;
      ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }

    // Faint full-field dot grid above the horizon, so the sky is never empty.
    ctx.fillStyle = 'rgba(123, 47, 247, 0.16)';
    for (let gx = 40; gx < FIELD.width; gx += 80) {
      for (let gy = 40; gy < 460; gy += 80) ctx.fillRect(gx, gy, 2, 2);
    }

    // Perspective grid floor, scrolling slowly toward the viewer.
    const horizon = 470;
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 16; i += 1) {
      const x = (i / 16) * FIELD.width;
      ctx.moveTo(FIELD.width / 2 + (x - FIELD.width / 2) * 0.25, horizon);
      ctx.lineTo(x, FIELD.height);
    }
    const scroll = (time * 24) % 46;
    for (let i = 0; i < 6; i += 1) {
      const t = i / 6;
      const y = horizon + (FIELD.height - horizon) * t * t + scroll * t;
      if (y > FIELD.height) continue;
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
    }
    ctx.stroke();
    // Horizon glow.
    const hg = ctx.createLinearGradient(0, horizon - 26, 0, horizon + 26);
    hg.addColorStop(0, 'rgba(123, 47, 247, 0)');
    hg.addColorStop(0.5, 'rgba(123, 47, 247, 0.35)');
    hg.addColorStop(1, 'rgba(123, 47, 247, 0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, horizon - 26, FIELD.width, 52);
  }

  function drawSun(time) {
    const cx = FIELD.width / 2;
    const cy = 300;
    const r = 150 + Math.sin(time * 0.8) * 4;
    const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    g.addColorStop(0, PALETTE.sun);
    g.addColorStop(1, PALETTE.sunLow);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.clip();
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // Scanline slits across the sun's lower half.
    ctx.fillStyle = PALETTE.backdropTop;
    for (let i = 0; i < 5; i += 1) {
      const y = cy + 12 + i * 22;
      ctx.fillRect(cx - r, y, r * 2, 3 + i * 2);
    }
    ctx.restore();
    ctx.save();
    ctx.shadowColor = PALETTE.sun;
    ctx.shadowBlur = 60;
    ctx.strokeStyle = 'rgba(255, 46, 136, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawCore(c, time) {
    const pulse = 1 + Math.sin(time * 6 + c.x) * 0.15;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(Math.PI / 4);
    ctx.shadowColor = PALETTE.core;
    ctx.shadowBlur = 8;
    ctx.fillStyle = PALETTE.core;
    const s = c.r * pulse;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = PALETTE.coreRing;
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 6 + c.x);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r + 6, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawEnemy(e, time) {
    if (e.warn > 0) {
      // Spawn warning: a shrinking ring where the enemy will appear.
      const p = 1 - e.warn / 0.6;
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.45 * p;
      ctx.strokeStyle = '#ff2e88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 26 * (1 - p), 0, TAU);
      ctx.stroke();
      ctx.restore();
      return;
    }
    const color = e.kind === KIND_CHASER ? PALETTE.chaser : e.kind === KIND_WEAVER ? PALETTE.weaver : e.kind === KIND_SPLITTER ? PALETTE.splitter : PALETTE.mini;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (e.kind === KIND_CHASER) {
      ctx.rotate(Math.atan2(e.vy, e.vx) + Math.PI / 2);
      ctx.moveTo(0, -e.r);
      ctx.lineTo(e.r * 0.85, e.r * 0.8);
      ctx.lineTo(0, e.r * 0.35);
      ctx.lineTo(-e.r * 0.85, e.r * 0.8);
      ctx.closePath();
    } else if (e.kind === KIND_WEAVER) {
      const w = Math.sin(e.t * 3 + e.seed) * 0.2;
      ctx.rotate(w);
      ctx.rect(-e.r * 0.8, -e.r * 0.8, e.r * 1.6, e.r * 1.6);
    } else if (e.kind === KIND_SPLITTER) {
      ctx.rotate(e.t * 0.8);
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * TAU;
        ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
      }
      ctx.closePath();
    } else {
      ctx.rotate(e.t * 4);
      ctx.moveTo(0, -e.r);
      ctx.lineTo(e.r, 0);
      ctx.lineTo(0, e.r);
      ctx.lineTo(-e.r, 0);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // Splitter hit points: a bright core per remaining hp.
    if (e.kind === KIND_SPLITTER) {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < e.hp; i += 1) ctx.fillRect(e.x - 8 + i * 8, e.y - 3, 5, 6);
      ctx.restore();
    }
  }

  function drawPlayer(p, time) {
    if (p.hidden) return;
    // Dash afterimages.
    // (The trail ghosts are drawn by the caller from state.trail.)
    const blink = p.invuln > 0 && Math.floor(time * 14) % 2 === 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle + Math.PI / 2);
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 14;
    ctx.fillStyle = PALETTE.player;
    ctx.strokeStyle = PALETTE.playerCore;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(14, 14);
    ctx.lineTo(0, 7);
    ctx.lineTo(-14, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Engine flame.
    const flame = 10 + Math.sin(time * 30) * 4 + Math.hypot(p.vx, p.vy) * 0.02;
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ff9a3d';
    ctx.fillStyle = '#ff9a3d';
    ctx.beginPath();
    ctx.moveTo(-6, 14);
    ctx.lineTo(0, 14 + flame);
    ctx.lineTo(6, 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHud(s, best) {
    // Score, top left.
    text(ctx, String(s.score).padStart(6, '0'), 24, 34, 34, PALETTE.text, 'left');
    text(ctx, `BEST ${Math.max(best, s.score)}`, 24, 62, 14, PALETTE.muted, 'left', 600);
    // Combo badge under the score.
    if (s.mult > 1) {
      const w = 92;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 225, 77, 0.16)';
      ctx.strokeStyle = PALETTE.core;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(24, 76, w, 30, 8);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      text(ctx, `COMBO x${s.mult}`, 24 + w / 2, 92, 17, PALETTE.core);
      const frac = Math.max(0, s.comboTimer / 3);
      ctx.fillStyle = PALETTE.core;
      ctx.fillRect(24, 110, w * frac, 4);
    }
    // Level + progress, top centre.
    text(ctx, `LEVEL ${s.level}`, FIELD.width / 2, 30, 20, PALETTE.text);
    const levelFrac = s.level >= 10 ? 1 : (s.elapsed % 25) / 25;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(FIELD.width / 2 - 110, 46, 220, 6);
    ctx.fillStyle = PALETTE.gridBright;
    ctx.fillRect(FIELD.width / 2 - 110, 46, 220 * levelFrac, 6);
    // Lives + dash, top right.
    for (let i = 0; i < 3; i += 1) {
      const x = FIELD.width - 32 - i * 34;
      ctx.save();
      ctx.translate(x, 32);
      ctx.fillStyle = i < s.lives ? PALETTE.player : 'rgba(255,255,255,0.15)';
      ctx.shadowColor = PALETTE.player;
      ctx.shadowBlur = i < s.lives ? 10 : 0;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(9, 8);
      ctx.lineTo(-9, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    const dashFrac = s.player.dashCd <= 0 ? 1 : 1 - s.player.dashCd / 1.6;
    text(ctx, 'DASH', FIELD.width - 24, 62, 11, dashFrac >= 1 ? PALETTE.player : PALETTE.muted, 'right', 600);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(FIELD.width - 124, 72, 100, 5);
    ctx.fillStyle = PALETTE.player;
    ctx.fillRect(FIELD.width - 124, 72, 100 * dashFrac, 5);
  }

  function draw(s, screen, best, muted) {
    const time = s.time;
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    const ox = (canvas.width - FIELD.width * scale) / 2;
    const oy = (canvas.height - FIELD.height * scale) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05010d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    if (s.shake > 0) {
      const m = s.shake * 10;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }

    drawBackground(time);
    if (screen === SCREEN_TITLE) drawSun(time);

    for (const c of s.cores) if (c.active) drawCore(c, time);
    for (const e of s.enemies) if (e.active) drawEnemy(e, time);
    // Bullets as bright streaks (no shadowBlur: cheap under software rendering).
    ctx.save();
    ctx.strokeStyle = PALETTE.bullet;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const b of s.bullets) {
      if (!b.active) continue;
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.restore();
    // Enemy orbs.
    for (const o of s.orbs) {
      if (!o.active) continue;
      ctx.save();
      ctx.shadowColor = PALETTE.orb;
      ctx.shadowBlur = 12;
      ctx.fillStyle = PALETTE.orb;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // Dash ghosts.
    for (const g of s.trail) {
      if (!g.active) continue;
      ctx.save();
      ctx.globalAlpha = (g.life / 0.25) * 0.5;
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle + Math.PI / 2);
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(14, 14);
      ctx.lineTo(0, 7);
      ctx.lineTo(-14, 14);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    drawPlayer(s.player, time);
    // Particles (additive).
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of s.particles) {
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // Floating score text.
    for (const t of s.texts) {
      if (!t.active) continue;
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      text(ctx, t.text, t.x, t.y, t.size, t.color);
    }
    ctx.globalAlpha = 1;

    // Damage flash.
    if (s.flash > 0) {
      ctx.fillStyle = `rgba(255, 59, 92, ${s.flash * 0.25})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }

    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(s, best);

    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(5, 1, 13, 0.45)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      text(ctx, 'NEON SURGE', FIELD.width / 2, 250, 84, '#ffffff');
      ctx.save();
      ctx.shadowColor = PALETTE.sun;
      ctx.shadowBlur = 34;
      text(ctx, 'NEON SURGE', FIELD.width / 2, 250, 84, '#ff2e88');
      ctx.restore();
      text(ctx, 'OUTRUN THE VOID  •  CHAIN THE COMBO  •  SURVIVE THE SURGE', FIELD.width / 2, 312, 19, PALETTE.text, 'center', 600);
      panel(ctx, FIELD.width / 2 - 330, 360, 660, 132);
      text(ctx, 'WASD / ARROWS — fly      MOUSE — aim      HOLD CLICK — fire', FIELD.width / 2, 392, 18, PALETTE.text, 'center', 600);
      text(ctx, 'SHIFT / SPACE / RIGHT-CLICK — dash      P — pause      M — mute', FIELD.width / 2, 424, 18, PALETTE.text, 'center', 600);
      text(ctx, 'Grab cores to raise your combo. Dash through danger. Don\'t get touched.', FIELD.width / 2, 462, 16, PALETTE.muted, 'center', 500);
      text(ctx, best > 0 ? `BEST ${best}   •   CLICK OR PRESS SPACE TO START` : 'CLICK OR PRESS SPACE TO START', FIELD.width / 2, 540, 20, PALETTE.player);
    } else if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(5, 1, 13, 0.6)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      text(ctx, 'PAUSED', FIELD.width / 2, 330, 56, PALETTE.text);
      text(ctx, 'Press P or Space to resume', FIELD.width / 2, 392, 18, PALETTE.muted, 'center', 500);
    } else if (screen === SCREEN_OVER) {
      ctx.fillStyle = 'rgba(5, 1, 13, 0.62)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      text(ctx, 'GAME OVER', FIELD.width / 2, 240, 64, PALETTE.danger);
      panel(ctx, FIELD.width / 2 - 250, 300, 500, 190);
      text(ctx, `SCORE  ${s.score}`, FIELD.width / 2, 340, 30, PALETTE.text);
      text(ctx, `BEST  ${Math.max(best, s.score)}`, FIELD.width / 2, 378, 18, PALETTE.core, 'center', 600);
      const acc = s.shotsFired > 0 ? Math.round((s.shotsHit / s.shotsFired) * 100) : 0;
      text(ctx, `KILLS ${s.kills}    LEVEL ${s.level}    ACCURACY ${acc}%`, FIELD.width / 2, 416, 16, PALETTE.muted, 'center', 500);
      text(ctx, s.score >= Math.max(best, s.score) && s.score > 0 ? 'NEW BEST!' : 'The void claims another pilot.', FIELD.width / 2, 452, 17, s.score > 0 && s.score >= Math.max(best, s.score) ? PALETTE.core : PALETTE.muted, 'center', 600);
      text(ctx, 'CLICK OR PRESS SPACE TO FLY AGAIN', FIELD.width / 2, 540, 20, PALETTE.player);
    }

    if (muted) text(ctx, 'MUTED (M)', FIELD.width - 24, FIELD.height - 24, 13, PALETTE.muted, 'right', 500);
  }

  return { draw };
}
