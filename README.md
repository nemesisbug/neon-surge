# NEON SURGE

A neon synthwave arena survival shooter. You are the last pilot in the void:
fly fast, shoot the swarm, grab cores to chain your combo, and dash through
danger. The swarm never stops — how long can you surf the surge?

## How to play

- **WASD / arrow keys** — fly the ship
- **Mouse** — aim
- **Hold left click** — fire
- **Shift / Space / right-click** — dash (brief invulnerability, 1.6 s cooldown)
- **P / Esc** — pause, **M** — mute

## Rules

- 3 lives. Touching an enemy or an enemy orb costs one life and resets your combo.
- Kills and core pickups build your combo: every 4 chained actions raises the
  score multiplier, up to x8. The combo resets after 3 seconds without a kill
  or pickup.
- Enemies: **chasers** (home in on you), **weavers** (strafe and shoot orbs,
  from level 2), **splitters** (split into two fast minis when destroyed,
  from level 3). A new level every 25 seconds, up to level 10 — spawns get
  faster and denser, and every 18 seconds a **SURGE** wave bursts in from the edges.
- Score is kills x multiplier plus core bonuses. Best score is kept in the
  browser (localStorage). Game over shows score, kills, level and accuracy;
  Space or click flies again.

## Tech

- Plain static files under `game/` (ES modules, no library, no network
  request), canvas 2D with a fixed 1280x720 logical field, fixed 1/60 s
  simulation steps, seeded RNG (mulberry32) so `?seed=N` replays the same game.
- All sound is synthesised with WebAudio (oscillators + filtered noise) —
  no audio files.
- `?shot=start|play|action|end&seed=N` stages a deterministic screenshot
  scene (autopilot plays the real rules forward) and sets `window.__shotReady`.
- Serve locally with `node serve.ts` (http://localhost:8080), hand in with
  `node main.ts` (writes `game/`, `screenshots/` and `dossier.json` to
  `/output`, or `$MAKEFUN_OUTPUT_DIR` outside the grader).

## Licence

MIT — see LICENSE.
