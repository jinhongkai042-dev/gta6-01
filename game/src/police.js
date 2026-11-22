import { CAR_H, PLAYER_R, ROAD_EVERY, TILE, WORLD_TILES } from './config.js';
import { isBlocked, isRoad } from './world.js';

const LAST = WORLD_TILES - 1;
const TILE_COUNT = WORLD_TILES * WORLD_TILES;
const clampTile = value => Math.max(0, Math.min(LAST, value));
const point = (x, y) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });
const index = (x, y) => y * WORLD_TILES + x;
const center = key => point(key % WORLD_TILES, Math.floor(key / WORLD_TILES));

function closestRoad(x, y) {
  const col = clampTile(Math.floor(x / TILE));
  const row = clampTile(Math.floor(y / TILE));
  const lastRoad = LAST - LAST % ROAD_EVERY;
  const roadCol = Math.min(lastRoad, Math.round(col / ROAD_EVERY) * ROAD_EVERY);
  const roadRow = Math.min(lastRoad, Math.round(row / ROAD_EVERY) * ROAD_EVERY);
  return Math.abs(x - point(roadCol, row).x) < Math.abs(y - point(col, roadRow).y)
    ? index(roadCol, row) : index(col, roadRow);
}

// Search the actual road cells at junctions so a pursuing unit can round a whole block.
function roadRoute(world, from, to) {
  const previous = new Int16Array(TILE_COUNT).fill(-1);
  const queue = [from];
  previous[from] = from;
  for (let head = 0; head < queue.length && previous[to] === -1; head++) {
    const key = queue[head];
    const col = key % WORLD_TILES;
    const row = Math.floor(key / WORLD_TILES);
    for (const [x, y] of [[col + 1, row], [col - 1, row], [col, row + 1], [col, row - 1]]) {
      if (x < 0 || y < 0 || x > LAST || y > LAST) continue;
      const next = index(x, y);
      if (previous[next] !== -1) continue;
      const pos = point(x, y);
      if (!isRoad(world, pos.x, pos.y)) continue;
      previous[next] = key;
      queue.push(next);
    }
  }
  if (previous[to] === -1) return [];
  const path = [];
  for (let key = to; key !== from; key = previous[key]) path.push(center(key));
  path.push(center(from));
  return path.reverse();
}

function clearLine(world, from, to, radius) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const samples = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 18));
  for (let i = 1; i <= samples; i++) {
    if (isBlocked(world, from.x + dx * i / samples, from.y + dy * i / samples, radius)) return false;
  }
  return true;
}

function cruiser(pos, angle, roadblock, player) {
  return {
    ...pos, angle, speed: 0, color: '#253552', model: 'patrol', isPolice: true,
    roadblock, route: [], destination: -1, ramCooldown: 0,
    lastKnown: { x: player.x, y: player.y }, down: false,
  };
}

function spawnPatrol(state) {
  const p = state.player;
  const lastRoad = LAST - LAST % ROAD_EVERY;
  const nearestStreet = value => Math.max(0, Math.min(lastRoad, Math.round((value / TILE - 0.5) / ROAD_EVERY) * ROAD_EVERY));
  const col = nearestStreet(p.x);
  const row = nearestStreet(p.y);
  const entries = [point(0, row), point(LAST, row), point(col, 0), point(col, LAST)];
  entries.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  const entry = entries[state.dispatchCount % entries.length];
  state.dispatchCount++;
  state.police.push(cruiser(entry, Math.atan2(p.y - entry.y, p.x - entry.x), false, p));
}

function placeRoadblock(state) {
  const p = state.player;
  const heading = p.angle + (p.speed < 0 ? Math.PI : 0);
  const key = closestRoad(p.x + Math.cos(heading) * 330, p.y + Math.sin(heading) * 330);
  const pos = center(key);
  // Wait for another approach if the driver is already against the edge of town.
  if (Math.hypot(pos.x - p.x, pos.y - p.y) < TILE * 2) return;
  const col = key % WORLD_TILES;
  const row = Math.floor(key / WORLD_TILES);
  const across = row % ROAD_EVERY === 0 && (col % ROAD_EVERY !== 0 || Math.abs(Math.cos(heading)) > 0.7);
  state.police.push(cruiser(pos, across ? Math.PI / 2 : 0, true, p));
}

function pursue(state, unit, sees, dt) {
  const target = unit.lastKnown;
  let goal;
  if (sees && clearLine(state.world, unit, target, CAR_H / 2)) {
    goal = target;
    unit.destination = -1;
  } else {
    const destination = closestRoad(target.x, target.y);
    if (unit.destination !== destination) {
      unit.route = roadRoute(state.world, closestRoad(unit.x, unit.y), destination);
      unit.destination = destination;
    }
    while (unit.route.length && Math.hypot(unit.route[0].x - unit.x, unit.route[0].y - unit.y) < 5) {
      unit.route.shift();
    }
    goal = unit.route[0];
  }
  if (!goal) {
    unit.speed = 0;
    return;
  }
  const dx = goal.x - unit.x;
  const dy = goal.y - unit.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) {
    unit.speed = 0;
    return;
  }
  const angle = Math.atan2(dy, dx);
  const turn = Math.atan2(Math.sin(angle - unit.angle), Math.cos(angle - unit.angle));
  unit.angle += Math.max(-5 * dt, Math.min(5 * dt, turn));
  unit.speed = Math.min(unit.speed + 165 * dt, 130 + 14 * state.wanted);
  const travel = Math.min(distance, unit.speed * dt) * Math.max(0, Math.cos(turn));
  const x = unit.x + dx / distance * travel;
  const y = unit.y + dy / distance * travel;
  if (!isBlocked(state.world, x, y, CAR_H / 2)) {
    unit.x = x;
    unit.y = y;
  } else {
    unit.speed = 0;
    unit.destination = -1;
  }
}

export function addWanted(state, n) {
  if (!Number.isFinite(n)) return;
  const previous = state.wanted;
  state.wanted = Math.max(0, Math.min(5, previous + Math.trunc(n)));
  if (n > 0) {
    state.unseenTime = 0;
    if (state.wanted > previous) state.events.push('siren');
  }
}

export function updatePolice(state, dt) {
  state.policeSeesPlayer = false;
  if (state.wanted <= 0) {
    state.police.length = 0;
    state.dispatchCount = 0;
    state.dispatchDelay = 0;
    return;
  }
  state.dispatchCount ??= 0;
  state.dispatchDelay = Math.max(0, (state.dispatchDelay || 0) - dt);
  if (state.wanted < 3) {
    const block = state.police.findIndex(unit => unit.roadblock);
    if (block !== -1) state.police.splice(block, 1);
  }
  const moving = state.police.filter(unit => !unit.roadblock);
  if (moving.length < state.wanted && state.dispatchDelay === 0) {
    spawnPatrol(state);
    state.dispatchDelay = 2;
  } else if (moving.length > state.wanted) {
    const distanceToPlayer = unit => Math.hypot(unit.x - state.player.x, unit.y - state.player.y);
    const farthest = moving.reduce((a, b) => distanceToPlayer(a) > distanceToPlayer(b) ? a : b);
    state.police.splice(state.police.indexOf(farthest), 1);
  }
  if (state.wanted >= 3 && !state.police.some(unit => unit.roadblock)) placeRoadblock(state);

  for (const unit of state.police) {
    if (unit.down) continue;
    unit.ramCooldown = Math.max(0, unit.ramCooldown - dt);
    const distance = Math.hypot(state.player.x - unit.x, state.player.y - unit.y);
    const sees = distance < 275 && clearLine(state.world, unit, state.player, 0);
    if (sees) {
      state.policeSeesPlayer = true;
      unit.lastKnown = { x: state.player.x, y: state.player.y };
    }
    if (!unit.roadblock) pursue(state, unit, sees, dt);
    const contact = (state.player.onFoot ? PLAYER_R : CAR_H) + CAR_H / 2;
    if (distance <= contact && unit.ramCooldown === 0 && state.time >= (state.ramGraceUntil || 0)) {
      state.player.health = Math.max(0, state.player.health - (state.player.onFoot ? 10 : 7));
      if (state.car) {
        state.car.speed *= unit.roadblock ? -0.18 : 0.6;
        state.player.speed = state.car.speed;
      }
      state.ramGraceUntil = state.time + 1.2;
      unit.ramCooldown = 2;
      state.events.push('crash');
    }
  }
}

export function decayWanted(state, dt) {
  if (!state.wanted || state.policeSeesPlayer) {
    state.unseenTime = 0;
    return;
  }
  state.unseenTime = (state.unseenTime || 0) + dt;
  const cooled = Math.floor((state.unseenTime + 1e-8) / 10);
  if (cooled) {
    state.wanted = Math.max(0, state.wanted - cooled);
    state.unseenTime = state.wanted ? Math.max(0, state.unseenTime - cooled * 10) : 0;
    if (!state.wanted) state.police.length = 0;
  }
}
