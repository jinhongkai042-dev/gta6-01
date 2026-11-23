import { CAR_W, PLAYER_R, ROAD_EVERY, TILE, WORLD_PX } from './config.js';
import { isBlocked } from './world.js';

const block = TILE * ROAD_EVERY;
const half = TILE / 2;
const lastRoad = half + Math.floor((WORLD_PX - TILE) / block) * block;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const road = value => clamp(half + block * Math.round((value - half) / block), half, lastRoad);
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function addWanted(state, n) {
  if (!Number.isFinite(n) || n <= 0) return;
  const old = state.wanted;
  state.wanted = clamp(old + Math.ceil(n), 0, 5);
  state.unseenTime = 0;
  const reported = state.car ?? state.player;
  state.lastPoliceReport = { x: reported.x, y: reported.y };
  if (state.wanted > old) (state.events ??= []).push('siren');
}

function unit(x, y, angle, roadblock) {
  return {
    x, y, angle, roadblock, model: 'police', color: '#263e60',
    speed: 0, ramCooldown: 0, down: 0, waypoint: null,
  };
}

function dispatch(state, target) {
  const x = road(target.x);
  const y = road(target.y);
  const gates = [
    { x: half, y, angle: 0 }, { x: WORLD_PX - half, y, angle: Math.PI },
    { x, y: half, angle: Math.PI / 2 }, { x, y: WORLD_PX - half, angle: -Math.PI / 2 },
  ].sort((a, b) => gap(a, target) - gap(b, target));
  const gate = gates[(state.dispatchCount || 0) % gates.length];
  state.dispatchCount = (state.dispatchCount || 0) + 1;
  state.police.push(unit(gate.x, gate.y, gate.angle, false));
}

function blockade(state, target) {
  const angle = target.angle || 0;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const x = road(target.x + dx * block * 1.4);
  const y = road(target.y + dy * block * 1.4);
  if (gap({ x, y }, target) < 100) return;
  state.police.push(unit(x, y, horizontal ? Math.PI / 2 : 0, true));
}

function nextTurn(car, target) {
  const x = road(car.x);
  const y = road(car.y);
  // A shared road allows a direct approach even between junctions.
  if (Math.abs(car.y - y) < 1 && Math.abs(target.y - y) <= half) return { x: target.x, y };
  if (Math.abs(car.x - x) < 1 && Math.abs(target.x - x) <= half) return { x, y: target.y };
  if (Math.abs(car.x - x) > 1 || Math.abs(car.y - y) > 1) return { x, y };
  const tx = road(target.x);
  const ty = road(target.y);
  if (Math.abs(tx - x) >= Math.abs(ty - y) && tx !== x) return { x: x + Math.sign(tx - x) * block, y };
  if (ty !== y) return { x, y: y + Math.sign(ty - y) * block };
  return { x, y };
}

function pursue(car, target, wanted, dt) {
  if (!car.waypoint || gap(car, car.waypoint) < 1) car.waypoint = nextTurn(car, target);
  const distance = gap(car, car.waypoint);
  if (distance < 0.01) {
    car.speed = 0;
    return;
  }
  const step = Math.min(distance, (145 + wanted * 17) * dt);
  car.speed = dt > 0 ? step / dt : 0;
  car.angle = Math.atan2(car.waypoint.y - car.y, car.waypoint.x - car.x);
  car.x += Math.cos(car.angle) * step;
  car.y += Math.sin(car.angle) * step;
}

function canSee(world, car, target, distance) {
  if (distance > 310) return false;
  if (!world) return true;
  for (let d = TILE / 2; d < distance; d += TILE / 2) {
    const ratio = d / distance;
    if (isBlocked(world, car.x + (target.x - car.x) * ratio, car.y + (target.y - car.y) * ratio, 2)) return false;
  }
  return true;
}

export function updatePolice(state, dt) {
  state.policeSeePlayer = false;
  if (!state.wanted) {
    state.police.length = 0;
    state.dispatchDelay = 0;
    state.lastPoliceReport = null;
    return;
  }
  const target = state.car ?? state.player;
  const reported = state.lastPoliceReport ??= { x: target.x, y: target.y };
  state.dispatchDelay = Math.max(0, (state.dispatchDelay || 0) - dt);
  if (!state.dispatchDelay && state.police.filter(car => !car.roadblock).length < state.wanted) {
    dispatch(state, reported);
    state.dispatchDelay = 1.8;
  }
  const barrierIndex = state.police.findIndex(car => car.roadblock);
  if (barrierIndex >= 0 && state.wanted < 3) {
    state.police.splice(barrierIndex, 1);
  } else if (barrierIndex < 0 && state.wanted >= 3) {
    blockade(state, target);
  }
  for (const car of state.police) {
    car.ramCooldown = Math.max(0, (car.ramCooldown || 0) - dt);
    if (car.down > 0) continue;
    if (!car.roadblock) pursue(car, reported, state.wanted, dt);
    const distance = gap(car, target);
    const contact = distance < CAR_W / 2 + (state.car ? CAR_W / 2 : PLAYER_R);
    if (contact || canSee(state.world, car, target, distance)) state.policeSeePlayer = true;
    if (contact && !car.ramCooldown) {
      state.player.health = Math.max(0, state.player.health - (state.car ? 9 : 13));
      if (state.car) state.car.speed *= 0.65;
      car.ramCooldown = 1.6;
      (state.events ??= []).push('crash');
    }
  }
  if (state.policeSeePlayer) {
    reported.x = target.x;
    reported.y = target.y;
  }
}

export function decayWanted(state, dt) {
  if (!state.wanted || state.policeSeePlayer) {
    state.unseenTime = 0;
    return;
  }
  state.unseenTime = (state.unseenTime || 0) + dt;
  const lost = Math.floor((state.unseenTime + 1e-8) / 10);
  if (lost > 0) {
    state.wanted = Math.max(0, state.wanted - lost);
    state.unseenTime = state.wanted ? Math.max(0, state.unseenTime - lost * 10) : 0;
    if (!state.wanted) state.police.length = 0;
  }
}
