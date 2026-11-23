import { TILE, ROAD_EVERY, SEED } from './config.js';

const GRID = TILE * ROAD_EVERY;
const LANE = TILE / 4;
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
const COLORS = ['#e36355', '#41aba0', '#e7b14e', '#698cb3', '#f3e0ba', '#986d9f', '#475768'];
const MODELS = ['coupe', 'sedan', 'taxi', 'van'];
const SHIRTS = ['#ed805f', '#41bcaa', '#f0c45d', '#9e8ad4', '#e0ece6', '#689ec1'];
const SIDE = GRID - TILE - 22;
const streams = new WeakMap();

function randomStream(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function randomFor(world) {
  if (!streams.has(world)) streams.set(world, randomStream(SEED ^ 0x397e));
  return streams.get(world);
}

function shuffle(list, random) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function laneTarget(world, col, row, dir) {
  const c = col + DX[dir];
  const r = row + DY[dir];
  const cx = c * GRID + TILE / 2;
  const cy = r * GRID + TILE / 2;
  if (c < 0 || r < 0 || cx >= world.w || cy >= world.h) return null;
  return { col: c, row: r, dir, x: cx - DY[dir] * LANE, y: cy + DX[dir] * LANE };
}

function key(p) {
  return p.x + ',' + p.y;
}

function parkedCar(x, y, angle, color, model) {
  return { x, y, angle, speed: 0, color, model, parked: true, driven: false, waypoint: null };
}

export function spawnTraffic(world, n = 48) {
  const count = Math.max(0, Math.floor(n));
  if (!count) return [];
  const start = world.spawn;
  const starter = parkedCar(start.x + 37, start.y + 23, 0, COLORS[0], 'coupe');
  const cars = [starter];
  const random = randomFor(world);
  const lanes = [];
  for (let row = 0; row * GRID < world.h; row++) {
    for (let col = 0; col * GRID < world.w; col++) {
      for (let dir = 0; dir < 4; dir++) {
        const p = laneTarget(world, col, row, dir);
        if (p) lanes.push(p);
      }
    }
  }
  shuffle(lanes, random);
  // Guarantee some cross traffic on the first screen even at low density.
  const near = lanes.findIndex(p => p.dir === 1 && Math.abs(p.x - start.x) < GRID &&
    p.y > start.y && p.y - start.y <= GRID);
  if (near >= 0) [lanes[0], lanes[near]] = [lanes[near], lanes[0]];
  for (const p of lanes) {
    if (cars.length >= count) break;
    const dir = p.dir;
    const distance = GRID * (0.27 + random() * 0.46);
    const x = p.x - DX[dir] * distance;
    const y = p.y - DY[dir] * distance;
    if (Math.hypot(x - starter.x, y - starter.y) < 70) continue;
    const model = MODELS[Math.floor(random() * MODELS.length)];
    const color = model === 'taxi' ? '#efb94d' : COLORS[Math.floor(random() * COLORS.length)];
    const angle = dir * Math.PI / 2;
    if (cars.length % 6 === 5) {
      cars.push(parkedCar(x - DY[dir] * 7, y + DX[dir] * 7, angle, color, model));
    } else {
      const cruise = 64 + Math.floor(random() * 45);
      cars.push({ x, y, angle, color, model, speed: cruise, cruise,
        parked: false, driven: true, waypoint: p, junctionExit: null });
    }
  }
  return cars;
}

function reserveNext(world, car, reserved, random) {
  const at = car.waypoint;
  const firstTurn = random() < 0.5 ? 1 : 3;
  const choices = [0, firstTurn, 4 - firstTurn];
  if (random() < 0.48) [choices[0], choices[1]] = [choices[1], choices[0]];
  choices.push(2);
  for (const turn of choices) {
    const dir = (at.dir + turn) % 4;
    const next = laneTarget(world, at.col, at.row, dir);
    if (!next || reserved.has(key(next))) continue;
    reserved.delete(key(at));
    reserved.add(key(next));
    car.waypoint = next;
    // Settle into the new lane before leaving the intersection.
    car.junctionExit = {
      x: next.x - DX[dir] * (GRID - TILE / 2),
      y: next.y - DY[dir] * (GRID - TILE / 2),
    };
    return true;
  }
  return false;
}

export function updateTraffic(state, dt) {
  const elapsed = Math.min(Math.max(dt, 0), 0.25);
  if (!elapsed) return;
  const active = state.cars.filter(c => c.driven && !c.parked && c !== state.car && c.waypoint);
  const reserved = new Set(active.map(c => key(c.waypoint)));
  const random = randomFor(state.world);
  for (const car of active) {
    let budget = car.cruise * elapsed;
    car.speed = car.cruise;
    while (budget > 0) {
      const target = car.junctionExit ?? car.waypoint;
      const dx = target.x - car.x;
      const dy = target.y - car.y;
      const distance = Math.hypot(dx, dy);
      const travel = Math.min(distance, budget);
      if (distance > 0) {
        const heading = Math.atan2(dy, dx);
        const turn = Math.atan2(Math.sin(heading - car.angle), Math.cos(heading - car.angle));
        car.angle += Math.sign(turn) * Math.min(Math.abs(turn), 6 * travel / car.cruise);
        car.x += dx * travel / distance;
        car.y += dy * travel / distance;
      }
      budget -= travel;
      if (travel < distance) break;
      car.x = target.x;
      car.y = target.y;
      if (car.junctionExit) car.junctionExit = null;
      else if (!reserveNext(state.world, car, reserved, random)) {
        car.speed = 0;
        break;
      }
    }
  }
}

// Each pedestrian follows the middle of a block's 22 px wide sidewalk.
function placePed(p) {
  const edge = Math.floor(p.progress / SIDE);
  const offset = p.progress - edge * SIDE;
  const left = p.blockX + TILE + 11;
  const top = p.blockY + TILE + 11;
  p.x = left + [offset, SIDE, SIDE - offset, 0][edge];
  p.y = top + [0, offset, SIDE, SIDE - offset][edge];
  p.angle = ((edge + (p.direction < 0 ? 2 : 0)) % 4) * Math.PI / 2;
}

export function spawnPeds(world, n = 80) {
  const random = randomFor(world);
  const peds = [];
  for (let i = 0; i < Math.floor(n); i++) {
    const blockX = i === 0 ? Math.floor(world.spawn.x / GRID) * GRID :
      Math.floor(random() * Math.ceil(world.w / GRID)) * GRID;
    const blockY = i === 0 ? Math.floor(world.spawn.y / GRID) * GRID :
      Math.floor(random() * Math.ceil(world.h / GRID)) * GRID;
    const pace = 28 + Math.floor(random() * 23);
    const p = { blockX, blockY, progress: i === 0 ? 85 : random() * SIDE * 4,
      direction: random() < 0.5 ? 1 : -1, pace, speed: pace, panic: 0, fleeing: false,
      color: SHIRTS[Math.floor(random() * SHIRTS.length)] };
    placePed(p);
    peds.push(p);
  }
  return peds;
}

export function updatePeds(state, dt) {
  const elapsed = Math.min(Math.max(dt, 0), 0.25);
  const car = state.car;
  for (const p of state.peds) {
    if (!Number.isFinite(p.progress)) continue;
    if (car && Math.hypot(p.x - car.x, p.y - car.y) < 104) {
      if (!p.fleeing) {
        const toward = Math.cos(p.angle) * (car.x - p.x) + Math.sin(p.angle) * (car.y - p.y);
        if (toward > 0) p.direction *= -1;
      }
      p.panic = 1.4;
    } else {
      p.panic = Math.max(0, p.panic - elapsed);
    }
    p.fleeing = p.panic > 0;
    p.speed = p.fleeing ? p.pace * 2.8 : p.pace;
    p.progress = (p.progress + p.direction * p.speed * elapsed + 4 * SIDE) % (4 * SIDE);
    placePed(p);
  }
}
