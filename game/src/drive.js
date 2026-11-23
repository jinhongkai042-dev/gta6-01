import { CAR_H, CAR_W, KEYS, PLAYER_R } from './config.js';
import { isBlocked, isRoad } from './world.js';

const WALK = 132;
const RUN = 208;
const TOP_SPEED = 350;
const REVERSE_SPEED = 105;
const EDGE_RADIUS = CAR_H / 2;
const AXLE = (CAR_W - CAR_H) / 2;

function held(input, action, codes = KEYS[action]) {
  if (!input) return false;
  if (input[action] === true) return true;
  const keys = typeof input.has === 'function' ? input :
    (input.keys ?? input.held ?? (typeof input.down === 'boolean' ? input : input.down) ?? input);
  return codes.some(code => {
    if (typeof keys === 'function') return keys.call(input, code);
    if (keys instanceof Map) return !!keys.get(code);
    if (keys.has) return keys.has(code);
    return !!keys[code] || !!input[code];
  });
}

function approach(value, target, step) {
  return value + Math.sign(target - value) * Math.min(Math.abs(target - value), step);
}

function carFits(world, x, y, angle) {
  const dx = AXLE * Math.cos(angle);
  const dy = AXLE * Math.sin(angle);
  return !isBlocked(world, x + dx, y + dy, EDGE_RADIUS) &&
    !isBlocked(world, x - dx, y - dy, EDGE_RADIUS) &&
    !isBlocked(world, x, y, EDGE_RADIUS);
}

function syncDriver(player, car) {
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.speed = car.speed;
  player.onFoot = false;
}

export function tryEnterCar(state) {
  if (state.car) return false;
  let nearest = null;
  let range = 60;
  for (const car of state.cars) {
    const distance = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (distance <= range) {
      nearest = car;
      range = distance;
    }
  }
  if (!nearest) return false;
  if (nearest.driven ?? (nearest.parked === false || Math.abs(nearest.speed) > 0)) {
    state.pendingWanted = 1;
  }
  state.cars.splice(state.cars.indexOf(nearest), 1);
  nearest.driven = false;
  nearest.parked = false;
  nearest.waypoint = null;
  state.car = nearest;
  syncDriver(state.player, nearest);
  return true;
}

export function exitCar(state) {
  const car = state.car;
  if (!car) return false;
  // Try both doors first. Bumpers and diagonals cover parking by a wall.
  const lateral = EDGE_RADIUS + PLAYER_R + 3;
  const axial = CAR_W / 2 + PLAYER_R + 3;
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  for (const [f, s] of [[0, -lateral], [0, lateral], [-axial, 0], [axial, 0],
    [-axial, -lateral], [-axial, lateral], [axial, -lateral], [axial, lateral]]) {
    const x = car.x + cos * f - sin * s;
    const y = car.y + sin * f + cos * s;
    if (isBlocked(state.world, x, y, PLAYER_R)) continue;
    if (state.cars.some(other => Math.hypot(other.x - x, other.y - y) < EDGE_RADIUS + PLAYER_R)) continue;
    Object.assign(state.player, { x, y, speed: 0, angle: car.angle, onFoot: true });
    car.speed = 0;
    car.driven = false;
    car.parked = true;
    if (!state.cars.includes(car)) state.cars.push(car);
    state.car = null;
    return true;
  }
  return false;
}

function walk(state, dx, dy, running, dt) {
  const p = state.player;
  const mag = Math.hypot(dx, dy);
  p.speed = mag ? (running ? RUN : WALK) : 0;
  if (!mag) return;
  p.angle = Math.atan2(dy, dx);
  const step = p.speed * dt / mag;
  if (!isBlocked(state.world, p.x + dx * step, p.y, PLAYER_R)) p.x += dx * step;
  if (!isBlocked(state.world, p.x, p.y + dy * step, PLAYER_R)) p.y += dy * step;
}

function drive(state, steer, pedal, handbrake, dt) {
  const car = state.car;
  const onRoad = isRoad(state.world, car.x, car.y);
  const limit = onRoad ? TOP_SPEED : 116;
  const target = pedal < 0 ? -Math.min(REVERSE_SPEED, limit) : pedal * limit;
  let force = pedal ? 210 : 54;
  if (pedal && pedal * car.speed < 0) force = 410;
  if (!onRoad && Math.abs(car.speed) > limit) force = 440;
  car.speed = approach(car.speed, handbrake ? 0 : target, (handbrake ? 590 : force) * dt);

  const grip = Math.min(1, Math.abs(car.speed) / 95);
  const turn = steer * Math.sign(car.speed) * grip * (handbrake ? 3.4 : 2.45) * dt;
  let angle = car.angle + turn;
  if (!carFits(state.world, car.x, car.y, angle)) angle = car.angle;
  const x = car.x + Math.cos(angle) * car.speed * dt;
  const y = car.y + Math.sin(angle) * car.speed * dt;
  car.angle = Math.atan2(Math.sin(angle), Math.cos(angle));
  if (carFits(state.world, x, y, angle)) {
    car.x = x;
    car.y = y;
  } else {
    car.speed = 0;
  }
}

export function updatePlayer(state, input, dt) {
  const dx = Number(held(input, 'right')) - Number(held(input, 'left'));
  const dy = Number(held(input, 'down')) - Number(held(input, 'up'));
  const brake = held(input, 'brake');
  const run = held(input, 'run', ['ShiftLeft', 'ShiftRight', 'Shift']);
  const elapsed = Math.min(Math.max(dt, 0), 0.25);
  const steps = Math.ceil(elapsed * 60);
  for (let i = 0; i < steps; i++) {
    if (state.car) drive(state, dx, -dy, brake, elapsed / steps);
    else walk(state, dx, dy, run, elapsed / steps);
  }
  if (state.car) syncDriver(state.player, state.car);
}
