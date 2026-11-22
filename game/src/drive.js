import { CAR_H, CAR_W, KEYS, PLAYER_R } from './config.js';
import { isBlocked, isRoad } from './world.js';

const WALK = 132;
const RUN = 214;
const TOP_SPEED = 352;
const REVERSE = 116;
const CURB_SPEED = 148;
const ENTER_RANGE = 60;
const BODY_RADIUS = CAR_H / 2;
const AXLE = CAR_W / 2 - BODY_RADIUS;

function held(input, action, codes) {
  if (!input) return false;
  const keys = input.keys && typeof input.keys !== 'function' ? input.keys : input;
  if (input[action] === true) return true;
  return codes.some(code => keys instanceof Set ? keys.has(code) : Boolean(keys[code]));
}

function approach(value, target, amount) {
  return value + Math.sign(target - value) * Math.min(Math.abs(target - value), amount);
}

function walk(state, dx, dy, speed, dt) {
  const p = state.player;
  const length = Math.hypot(dx, dy);
  p.speed = 0;
  if (!length) return;
  p.angle = Math.atan2(dy, dx);
  const x = p.x;
  const y = p.y;
  const distance = speed * dt / length;
  if (!isBlocked(state.world, x + dx * distance, y, PLAYER_R)) p.x += dx * distance;
  if (!isBlocked(state.world, p.x, y + dy * distance, PLAYER_R)) p.y += dy * distance;
  p.speed = Math.hypot(p.x - x, p.y - y) / dt;
}

function fits(world, x, y, angle) {
  const dx = Math.cos(angle) * AXLE;
  const dy = Math.sin(angle) * AXLE;
  return !isBlocked(world, x + dx, y + dy, BODY_RADIUS) &&
    !isBlocked(world, x - dx, y - dy, BODY_RADIUS) &&
    !isBlocked(world, x, y, BODY_RADIUS);
}

function syncDriver(player, car) {
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.speed = car.speed;
}

function drive(state, throttle, steer, handbrake, dt) {
  const car = state.car;
  const paved = isRoad(state.world, car.x, car.y);
  const max = paved ? TOP_SPEED : CURB_SPEED;
  if (handbrake) {
    car.speed = approach(car.speed, 0, 520 * dt);
  } else if (throttle) {
    const changingDirection = car.speed * throttle < 0;
    const target = throttle > 0 ? max : -REVERSE;
    const rate = changingDirection ? 410 : throttle > 0 ? 206 : 148;
    car.speed = approach(car.speed, target, rate * dt);
  } else {
    car.speed = approach(car.speed, 0, (paved ? 50 : 130) * dt);
  }
  if (!paved && car.speed > max) car.speed = approach(car.speed, max, 290 * dt);

  // Reverse steering follows the rearward motion. A stopped car cannot pivot.
  const grip = Math.min(1, Math.abs(car.speed) / 80);
  const turnRate = (handbrake ? 3.15 : 2.4) / (1 + Math.abs(car.speed) / 520);
  const angle = car.angle + Math.sign(car.speed) * steer * turnRate * grip * dt;
  if (fits(state.world, car.x, car.y, angle)) car.angle = Math.atan2(Math.sin(angle), Math.cos(angle));
  const x = car.x + Math.cos(car.angle) * car.speed * dt;
  const y = car.y + Math.sin(car.angle) * car.speed * dt;
  if (fits(state.world, x, y, car.angle)) {
    car.x = x;
    car.y = y;
  } else {
    if (Math.abs(car.speed) >= 90) state.events?.push('crash');
    car.speed = 0;
  }
  syncDriver(state.player, car);
}

export function updatePlayer(state, input, dt) {
  if (!(dt > 0) || !Number.isFinite(dt)) return;
  const horizontal = Number(held(input, 'right', KEYS.right)) - Number(held(input, 'left', KEYS.left));
  const vertical = Number(held(input, 'down', KEYS.down)) - Number(held(input, 'up', KEYS.up));
  const sprint = held(input, 'run', ['ShiftLeft', 'ShiftRight', 'Shift']);
  const handbrake = held(input, 'brake', KEYS.brake);
  // Cap catch-up after suspension. Small physics steps keep walls solid at top speed.
  const elapsed = Math.min(dt, 0.25);
  const steps = Math.ceil(elapsed * 60);
  for (let i = 0; i < steps; i++) {
    if (state.car && !state.player.onFoot) drive(state, -vertical, horizontal, handbrake, elapsed / steps);
    else walk(state, horizontal, vertical, sprint ? RUN : WALK, elapsed / steps);
  }
}

export function tryEnterCar(state) {
  const p = state.player;
  if (state.car || !p.onFoot) return false;
  let best = -1;
  let distance = ENTER_RANGE;
  for (let i = 0; i < state.cars.length; i++) {
    const car = state.cars[i];
    const d = Math.hypot(p.x - car.x, p.y - car.y);
    if (d <= distance) {
      best = i;
      distance = d;
    }
  }
  if (best < 0) return false;
  const [car] = state.cars.splice(best, 1);
  if (car.parked === false || car.driven || (!car.parked && car.speed)) state.pendingWanted = 1;
  car.parked = false;
  car.driven = true;
  car.route = null;
  car.waypoint = null;
  state.car = car;
  p.onFoot = false;
  syncDriver(p, car);
  return true;
}

export function exitCar(state) {
  const car = state.car;
  if (!car) return false;
  // Try both doors first, then the bumpers and corners if a wall covers a door.
  const side = CAR_H / 2 + PLAYER_R + 3;
  const end = CAR_W / 2 + PLAYER_R + 3;
  const offsets = [[0, -side], [0, side], [-end, 0], [end, 0],
    [-end, -side], [-end, side], [end, -side], [end, side]];
  const c = Math.cos(car.angle);
  const s = Math.sin(car.angle);
  for (const [forward, lateral] of offsets) {
    const x = car.x + c * forward - s * lateral;
    const y = car.y + s * forward + c * lateral;
    if (isBlocked(state.world, x, y, PLAYER_R)) continue;
    Object.assign(state.player, { x, y, angle: car.angle, speed: 0, onFoot: true });
    Object.assign(car, { parked: true, driven: false, route: null, speed: 0 });
    if (!state.cars.includes(car)) state.cars.push(car);
    state.car = null;
    return true;
  }
  return false;
}
