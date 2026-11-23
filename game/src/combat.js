import { CAR_H, PLAYER_R, TILE } from './config.js';
import { isBlocked } from './world.js';

function fallen(actor) {
  return actor.down > 0 || actor.knockedDown > 0;
}

function closestTarget(state, distanceToHit) {
  let closest = null;
  let best = Infinity;
  for (const crowd of [state.peds, state.police]) {
    for (const actor of crowd) {
      if (fallen(actor)) continue;
      const distance = distanceToHit(actor, crowd === state.police ? CAR_H : PLAYER_R);
      if (distance < best) {
        best = distance;
        closest = actor;
      }
    }
  }
  return closest;
}

function knockDown(actor) {
  if (!actor) return;
  actor.down = 3;
  actor.knockedDown = 3;
  actor.fallPosition = { x: actor.x, y: actor.y, progress: actor.progress };
  actor.speed = 0;
}

function fire(state) {
  const player = state.player;
  player.ammo ??= 12;
  if (player.ammo <= 0) {
    (state.events ??= []).push('click');
    return;
  }
  player.ammo--;
  state.pendingWanted = (state.pendingWanted || 0) + 1;
  (state.events ??= []).push('shoot');
  const dx = Math.cos(player.angle);
  const dy = Math.sin(player.angle);
  let range = 6 * TILE;
  if (state.world) {
    for (let d = 8; d < range; d += 8) {
      if (isBlocked(state.world, player.x + d * dx, player.y + d * dy, 1)) {
        range = d;
        break;
      }
    }
  }
  const target = closestTarget(state, (actor, radius) => {
    const x = actor.x - player.x;
    const y = actor.y - player.y;
    const along = x * dx + y * dy;
    const across = Math.abs(x * dy - y * dx);
    return along >= 0 && along <= range && across <= radius ? along : Infinity;
  });
  knockDown(target);
  const length = target ? (target.x - player.x) * dx + (target.y - player.y) * dy : range;
  (state.bullets ??= []).push({
    x: player.x, y: player.y, angle: player.angle,
    vx: dx * length / 0.14, vy: dy * length / 0.14, life: 0.14,
  });
}

export function attack(state) {
  const player = state.player;
  if (state.paused || state.gameOver || !player.onFoot || player.health <= 0 || player.attackCooldown > 0) return;
  player.attackCooldown = player.weapon === 'pistol' ? 0.28 : 0.38;
  if (player.weapon === 'pistol') {
    fire(state);
    return;
  }
  const target = closestTarget(state, actor => {
    const distance = Math.hypot(actor.x - player.x, actor.y - player.y);
    return distance <= 40 ? distance : Infinity;
  });
  if (!target) return;
  player.angle = Math.atan2(target.y - player.y, target.x - player.x);
  knockDown(target);
  if (state.police.includes(target)) state.pendingWanted = (state.pendingWanted || 0) + 1;
  (state.events ??= []).push('click');
}

export function updateCombat(state, dt) {
  state.player.attackCooldown = Math.max(0, (state.player.attackCooldown || 0) - dt);
  for (const crowd of [state.peds, state.police]) {
    for (const actor of crowd) {
      if (actor.knockedDown > 0) {
        if (actor.fallPosition) {
          actor.x = actor.fallPosition.x;
          actor.y = actor.fallPosition.y;
          if (Number.isFinite(actor.fallPosition.progress)) actor.progress = actor.fallPosition.progress;
          actor.speed = 0;
        }
        actor.knockedDown = Math.max(0, actor.knockedDown - dt);
        actor.down = actor.knockedDown;
        if (!actor.down) delete actor.fallPosition;
      }
    }
  }
  if (state.bullets?.length) {
    for (const bullet of state.bullets) {
      const travel = Math.min(dt, bullet.life);
      bullet.x += bullet.vx * travel;
      bullet.y += bullet.vy * travel;
      bullet.life -= dt;
    }
    state.bullets = state.bullets.filter(bullet => bullet.life > 0);
  }
}
