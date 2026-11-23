import { TILE, ROAD_EVERY, SEED, CAR_W, CAR_H } from './config.js';
import { isRoad } from './world.js';

const GRID = TILE * ROAD_EVERY;
const LANE = TILE / 4;
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
const COLORS = ['#e36355', '#41aba0', '#e7b14e', '#698cb3', '#f3e0ba', '#986d9f', '#475768'];
const MODELS = ['coupe', 'sedan', 'taxi', 'van'];
const SHIRTS = ['#ed805f', '#41bcaa', '#f0c45d', '#9e8ad4', '#e0ece6', '#689ec1'];
const SIDE = GRID - TILE - 22;
const streams = new WeakMap();
const passes = new WeakMap();
const yielding = new WeakMap();
const GAP = CAR_W + 5;
const BRAKE = 190;

// Odd interior streets have two lanes going the same way. Keep the perimeter
// two-way so every route has a legal exit at the edge of the map.
function oneWay(world, col, row, dir) {
  const vertical = dir % 2;
  const line = vertical ? col : row;
  const span = vertical ? world.w : world.h;
  if (line % 2 === 0 || (line + 1) * GRID >= span) return -1;
  return vertical + (line % 4 === 1 ? 0 : 2);
}

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
  const allowed = oneWay(world, col, row, dir);
  if (allowed >= 0 && dir !== allowed) return null;
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
    if (cars.length % 6 === 5 && oneWay(world, p.col, p.row, dir) === dir) {
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
    if (!next || (reserved.has(key(next)) && oneWay(world, next.col, next.row, dir) < 0)) continue;
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

function forwardSpeed(vehicle, fx, fy) {
  return (vehicle.speed || 0) * (Math.cos(vehicle.angle) * fx + Math.sin(vehicle.angle) * fy);
}

// Check the physical lane AND cars already merging into it. Positions are
// measured along the street and to the right of its normal running lane.
function laneClear(car, vehicles, offset, speed) {
  const { x, y, dir } = car.waypoint;
  const fx = DX[dir], fy = DY[dir];
  for (const other of vehicles) {
    if (other === car) continue;
    const along = (other.x - car.x) * fx + (other.y - car.y) * fy;
    const closing = speed - forwardSpeed(other, fx, fy);
    if (Math.abs(along) > GAP + Math.max(0, along >= 0 ? closing : -closing) * 0.65) continue;
    const side = (other.y - y) * fx - (other.x - x) * fy;
    const cross = Math.abs(Math.sin(other.angle) * fx - Math.cos(other.angle) * fy);
    if (Math.abs(side - offset) < CAR_H + 2 + cross * CAR_W / 2) return false;
    const intent = passes.get(other);
    if (intent && other.waypoint?.dir === dir) {
      const targetSide = (other.waypoint.y - y) * fx - (other.waypoint.x - x) * fy + intent.offset;
      if (Math.abs(targetSide - offset) < CAR_H) return false;
    }
  }
  return true;
}

function pedestrianGap(state, car, fx, fy) {
  const peds = state.peds ?? [];
  let stop = yielding.get(car);
  if (stop && (!peds.includes(stop.ped) || !isRoad(state.world, stop.ped.x, stop.ped.y))) {
    yielding.delete(car);
    stop = null;
  }
  // Remember the crossing point until the pedestrian reaches the far curb.
  let gap = stop ? (stop.x - car.x) * stop.fx + (stop.y - car.y) * stop.fy - CAR_W / 2 - 7 : Infinity;
  const look = CAR_W / 2 + 14 + car.speed * car.speed / (2 * BRAKE);
  for (const ped of peds) {
    const dx = ped.x - car.x, dy = ped.y - car.y;
    const ahead = dx * fx + dy * fy;
    if (ahead < 0 || ahead > look || ahead - CAR_W / 2 - 7 >= gap) continue;
    const side = dy * fx - dx * fy;
    const lateral = (ped.speed || 0) * (Math.sin(ped.angle || 0) * fx - Math.cos(ped.angle || 0) * fy);
    if (Math.abs(side) > CAR_H / 2 + 6 &&
        (side * lateral >= 0 || Math.abs(side) > CAR_H / 2 + 6 + Math.abs(lateral) * 0.65)) continue;
    if (!isRoad(state.world, ped.x, ped.y)) continue;
    yielding.set(car, { ped, x: ped.x, y: ped.y, fx, fy });
    gap = ahead - CAR_W / 2 - 7;
  }
  return Math.max(0, gap);
}

function driveTrafficCar(state, car, vehicles, reserved, random, step) {
  const at = car.waypoint;
  const target = car.junctionExit ?? at;
  const dx = target.x - car.x, dy = target.y - car.y;
  const distance = Math.hypot(dx, dy);
  const fx = car.junctionExit && distance ? dx / distance : DX[at.dir];
  const fy = car.junctionExit && distance ? dy / distance : DY[at.dir];
  const remaining = Math.max(0, dx * fx + dy * fy);
  const side = dx * fy - dy * fx;
  let leader = null, nearest = Infinity, room = Infinity;
  for (const other of vehicles) {
    if (other === car) continue;
    const ox = other.x - car.x, oy = other.y - car.y;
    const ahead = ox * fx + oy * fy;
    if (ahead <= 0 || ahead > GRID) continue;
    const cross = Math.abs(Math.sin(other.angle) * fx - Math.cos(other.angle) * fy);
    if (Math.abs(oy * fx - ox * fy) >= CAR_H + 2 + cross * CAR_W / 2) continue;
    room = Math.min(room, ahead - GAP);
    if (ahead < nearest) { leader = other; nearest = ahead; }
  }

  const pedRoom = pedestrianGap(state, car, fx, fy);
  let pass = passes.get(car);
  const passSpeed = car.cruise + 32;
  if (!pass && !car.junctionExit && pedRoom === Infinity && leader && nearest < 96 &&
      remaining > nearest + GAP && remaining < GRID - TILE / 2 &&
      car.cruise > forwardSpeed(leader, fx, fy) + 6 && forwardSpeed(leader, fx, fy) >= -1 &&
      oneWay(state.world, at.col, at.row, at.dir) === at.dir &&
      laneClear(car, vehicles, -2 * LANE, passSpeed)) {
    pass = { leader, offset: -2 * LANE };
    passes.set(car, pass);
  }
  if (pass && pass.offset && Math.abs(side - pass.offset) < 0.01) {
    const gained = (car.x - pass.leader.x) * fx + (car.y - pass.leader.y) * fy;
    if ((gained >= GAP || remaining <= TILE / 2) && laneClear(car, vehicles, 0, car.cruise)) {
      pass.offset = 0;
    }
  }

  const desired = pass?.offset ? passSpeed : car.cruise;
  const clearance = Math.max(0, Math.min(room, pedRoom));
  const speed = Math.min(desired, car.speed + 90 * step, Math.sqrt(2 * BRAKE * clearance));
  const travel = Math.min(remaining, speed * step, clearance);
  let shift = 0;
  if (pass && pedRoom === Infinity && laneClear(car, vehicles, pass.offset, desired)) {
    const delta = pass.offset - side;
    shift = Math.sign(delta) * Math.min(Math.abs(delta), 54 * step);
  }
  car.speed = travel / step;
  car.x += fx * travel - fy * shift;
  car.y += fy * travel + fx * shift;
  if (travel > 0) {
    const heading = Math.atan2(fy, fx);
    const turn = Math.atan2(Math.sin(heading - car.angle), Math.cos(heading - car.angle));
    car.angle += Math.sign(turn) * Math.min(Math.abs(turn), 6 * step);
  }
  if (pass && pass.offset === 0 && Math.abs(side + shift) < 0.01) passes.delete(car);
  if (travel >= remaining && !passes.has(car)) {
    car.x = target.x;
    car.y = target.y;
    if (car.junctionExit) car.junctionExit = null;
    else if (!reserveNext(state.world, car, reserved, random)) car.speed = 0;
  }
}

export function updateTraffic(state, dt) {
  const elapsed = Math.min(Math.max(dt, 0), 0.25);
  if (!elapsed) return;
  const active = state.cars.filter(c => c.driven && !c.parked && c !== state.car && c.waypoint);
  const vehicles = [...new Set([...state.cars, ...(state.police ?? [])])];
  if (state.car && !vehicles.includes(state.car)) vehicles.push(state.car);
  const reserved = new Set(active.map(c => key(c.waypoint)));
  const random = randomFor(state.world);
  const steps = Math.ceil(elapsed / 0.05);
  for (let i = 0; i < steps; i++) {
    for (const car of active) driveTrafficCar(state, car, vehicles, reserved, random, elapsed / steps);
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
    const stride = p.speed * elapsed;
    if (!p.crossing) {
      const edge = Math.floor(p.progress / SIDE);
      const middle = (edge + 0.5) * SIDE;
      const toMiddle = (middle - p.progress) * p.direction;
      if (toMiddle > 0 && toMiddle <= stride) {
        const dir = (edge + 3) % 4;
        const blockX = p.blockX + DX[dir] * GRID, blockY = p.blockY + DY[dir] * GRID;
        if (blockX >= 0 && blockY >= 0 && blockX + GRID <= state.world.w &&
            blockY + GRID <= state.world.h && randomFor(state.world)() < 0.35) {
          p.progress = middle;
          placePed(p);
          p.crossing = { dir, blockX, blockY, progress: ((edge + 2) % 4 + 0.5) * SIDE,
            remaining: GRID - SIDE + toMiddle };
        }
      }
      if (!p.crossing) {
        p.progress = (p.progress + p.direction * stride + 4 * SIDE) % (4 * SIDE);
        placePed(p);
        continue;
      }
      p.crossing.remaining -= toMiddle;
      p.x -= DX[p.crossing.dir] * toMiddle;
      p.y -= DY[p.crossing.dir] * toMiddle;
    }
    const cross = p.crossing;
    const walk = Math.min(stride, cross.remaining);
    p.x += DX[cross.dir] * walk;
    p.y += DY[cross.dir] * walk;
    p.angle = cross.dir * Math.PI / 2;
    cross.remaining -= walk;
    if (cross.remaining === 0) {
      p.blockX = cross.blockX;
      p.blockY = cross.blockY;
      p.progress = cross.progress + p.direction * (stride - walk);
      delete p.crossing;
      placePed(p);
    }
  }
}
