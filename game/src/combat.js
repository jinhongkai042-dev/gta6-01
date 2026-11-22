import { CAR_H, PLAYER_R } from './config.js';
import { isBlocked } from './world.js';

function knockDown(state, target) {
  target.down = true;
  target.downTimer = 3;
  target.speed = 0;
  state.effects ??= [];
  state.effects.push({ x: target.x, y: target.y, r: 5, alpha: 0.8, color: '#ffe6a1', life: 0.2 });
}

export function attack(state) {
  const player = state.player;
  if (!player.onFoot || state.paused || state.gameOver || state.attackCooldown > 0) return;
  if (player.weapon === 'pistol') {
    state.attackCooldown = 0.25;
    if (!(player.ammo > 0)) {
      state.events.push('click');
      return;
    }
    player.ammo--;
    const dx = Math.cos(player.angle);
    const dy = Math.sin(player.angle);
    state.bullets ??= [];
    state.bullets.push({
      x: player.x, y: player.y, angle: player.angle,
      vx: dx * 680, vy: dy * 680, life: 0.62,
    });
    state.pendingWanted = (state.pendingWanted || 0) + 1;
    state.events.push('shoot');
    return;
  }
  state.attackCooldown = 0.35;
  let nearest = null;
  let range = 40;
  for (const target of [...state.peds, ...state.police]) {
    if (target.down) continue;
    const distance = Math.hypot(target.x - player.x, target.y - player.y);
    if (distance <= range) {
      nearest = target;
      range = distance;
    }
  }
  if (nearest) {
    player.angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
    knockDown(state, nearest);
    if (state.police.includes(nearest)) state.pendingWanted = (state.pendingWanted || 0) + 1;
  }
}

function advanceBullet(state, bullet, dt, targets) {
  const elapsed = Math.min(dt, bullet.life);
  // Short swept increments catch contact even on slow frames and across narrow walls.
  const steps = Math.max(1, Math.ceil(elapsed * 680 / 6));
  for (let i = 0; i < steps; i++) {
    bullet.x += bullet.vx * elapsed / steps;
    bullet.y += bullet.vy * elapsed / steps;
    if (isBlocked(state.world, bullet.x, bullet.y, 1)) return false;
    const hit = targets.find(target => !target.down &&
      Math.hypot(target.x - bullet.x, target.y - bullet.y) <= (target.isPolice ? CAR_H / 2 + 4 : PLAYER_R));
    if (hit) {
      knockDown(state, hit);
      return false;
    }
  }
  bullet.life -= elapsed;
  return bullet.life > 0;
}

export function updateCombat(state, dt) {
  state.attackCooldown = Math.max(0, (state.attackCooldown || 0) - dt);
  const targets = [...state.peds, ...state.police];
  for (const target of targets) {
    if (!(target.downTimer > 0)) continue;
    target.downTimer = Math.max(0, target.downTimer - dt);
    if (target.downTimer === 0) target.down = false;
  }
  if (state.bullets?.length) {
    state.bullets = state.bullets.filter(bullet => advanceBullet(state, bullet, dt, targets));
  }
  if (state.effects?.length) {
    for (const flash of state.effects) {
      flash.life -= dt;
      flash.r += 40 * dt;
      flash.alpha = Math.max(0, flash.life * 4);
    }
    state.effects = state.effects.filter(flash => flash.life > 0);
  }
}
