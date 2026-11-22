import { ROAD_EVERY, SEED, TILE } from './config.js';

const STEP = TILE * ROAD_EVERY;
const LANE = TILE / 5;
const STOP = TILE / 2 + 10;
const CURB = TILE / 2 + 4;
const networks = new WeakMap();
const colors = ['#e8ae39', '#4da9ae', '#df6552', '#9c99c9', '#e9dbb9', '#4b788e', '#9daf78'];
const models = ['sedan', 'coupe', 'taxi', 'wagon'];
const shirts = ['#e9ae6b', '#a9d9db', '#ec8295', '#a8b582', '#968bc3', '#d8d4be'];

function generator(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function shuffle(items, random) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function network(world) {
  if (networks.has(world)) return networks.get(world);
  const cols = Math.ceil(world.w / STEP);
  const rows = Math.ceil(world.h / STEP);
  const nodes = Array.from({ length: cols * rows }, (_, i) => ({
    x: i % cols * STEP + TILE / 2, y: Math.floor(i / cols) * STEP + TILE / 2, out: []
  }));
  const edges = [];
  function connect(from, to) {
    const a = nodes[from];
    const b = nodes[to];
    const dx = (b.x - a.x) / STEP;
    const dy = (b.y - a.y) / STEP;
    const id = edges.length;
    edges.push({ id, from, to, dx, dy,
      start: { x: a.x + dx * STOP - dy * LANE, y: a.y + dy * STOP + dx * LANE },
      end: { x: b.x - dx * STOP - dy * LANE, y: b.y - dy * STOP + dx * LANE } });
    a.out.push(id);
  }
  for (let id = 0; id < nodes.length; id++) {
    if (id % cols + 1 < cols) {
      connect(id, id + 1);
      connect(id + 1, id);
    }
    if (id + cols < nodes.length) {
      connect(id, id + cols);
      connect(id + cols, id);
    }
  }
  const net = { nodes, edges, random: generator(SEED ^ 0x987d11) };
  networks.set(world, net);
  return net;
}

function makeCar(id, x, y, angle, parked, random) {
  const model = models[Math.floor(random() * models.length)];
  const color = model === 'taxi' ? '#e8b743' : colors[Math.floor(random() * colors.length)];
  const cruise = 64 + Math.floor(random() * 42);
  return { id: 'car-' + id, x, y, angle, speed: parked ? 0 : cruise, color, model,
    parked, driven: !parked, cruise, route: null, waypoint: null };
}

export function spawnTraffic(world, n = 40) {
  const { nodes, edges } = network(world);
  const random = generator(SEED ^ 0xc4a12);
  const deck = shuffle(edges.slice(), random);
  const curbs = deck.filter(e => {
    const a = nodes[e.from];
    return a.x - e.dy * CURB >= 0 && a.y + e.dx * CURB >= 0;
  });
  const count = Math.min(Math.max(0, Math.floor(n)), edges.length + curbs.length);
  if (!count) return [];
  const parkedCount = Math.max(1, Math.round(count / 5), count - edges.length);
  const movingCount = count - parkedCount;
  const spawn = world.spawn;
  const cars = [makeCar(0, spawn.x + 30, spawn.y + CURB, 0, true, random)];
  // Reserve the starter's curb space even when the requested fleet fills the city.
  const starterEdge = edges.find(e => e.dx === 1 && nodes[e.from].y === spawn.y &&
    nodes[e.from].x <= spawn.x && spawn.x < nodes[e.to].x);
  const near = deck.filter(e => Math.abs(e.start.x - spawn.x) < 440 && Math.abs(e.start.y - spawn.y) < 260);
  const priority = new Set(near.slice(0, Math.ceil(movingCount / 5)));
  const ordered = [...priority, ...deck.filter(e => !priority.has(e))];
  for (const e of ordered.slice(0, movingCount)) {
    const distance = (0.12 + random() * 0.76) * (STEP - 2 * STOP);
    let x = e.start.x + e.dx * distance;
    let y = e.start.y + e.dy * distance;
    if (Math.hypot(x - spawn.x, y - spawn.y) < 60) {
      const point = Math.hypot(e.start.x - spawn.x, e.start.y - spawn.y) > 60 ? e.start : e.end;
      x = point.x;
      y = point.y;
    }
    const car = makeCar(cars.length, x, y, Math.atan2(e.dy, e.dx), false, random);
    car.route = { edge: e.id, crossing: false };
    car.waypoint = e.end;
    cars.push(car);
  }
  for (const e of curbs) {
    if (cars.length >= count) break;
    if (e === starterEdge) continue;
    const a = nodes[e.from];
    const distance = STEP * (0.36 + random() * 0.28);
    cars.push(makeCar(cars.length, a.x + e.dx * distance - e.dy * CURB,
      a.y + e.dy * distance + e.dx * CURB, Math.atan2(e.dy, e.dx), true, random));
  }
  return cars;
}

function nextEdge(net, edge, occupied) {
  const available = net.nodes[edge.to].out.filter(id => !occupied.has(id));
  const forward = available.filter(id => net.edges[id].to !== edge.from);
  // Prefer through traffic or a turn. A U-turn also clears an otherwise occupied junction.
  const choices = forward.length ? forward : available;
  const straight = forward.find(id => net.edges[id].dx === edge.dx && net.edges[id].dy === edge.dy);
  if (straight !== undefined && net.random() < 0.45) return net.edges[straight];
  return net.edges[choices[Math.floor(net.random() * choices.length)]];
}

export function updateTraffic(state, dt) {
  if (!(dt > 0) || !Number.isFinite(dt)) return;
  const net = network(state.world);
  const moving = state.cars.filter(c => c !== state.car && !c.parked && net.edges[c.route?.edge]);
  const occupied = new Set(moving.map(c => c.route.edge));
  const crossing = new Set(moving.filter(c => c.route.crossing).map(c => net.edges[c.route.edge].from));
  for (const car of moving) {
    let remaining = Math.min(0.25, dt);
    let edge = net.edges[car.route.edge];
    while (remaining > 0) {
      const target = car.route.crossing ? edge.start : edge.end;
      car.waypoint = target;
      const dx = target.x - car.x;
      const dy = target.y - car.y;
      const distance = Math.hypot(dx, dy);
      const speed = car.cruise * (car.route.crossing ? 0.73 : 1);
      if (distance > 0.00001) {
        const travel = Math.min(distance, remaining * speed);
        car.angle = Math.atan2(dy, dx);
        car.speed = speed;
        car.x += dx * travel / distance;
        car.y += dy * travel / distance;
        if (travel < distance) break;
        remaining -= travel / speed;
      }
      car.x = target.x;
      car.y = target.y;
      if (car.route.crossing) {
        crossing.delete(edge.from);
        car.route.crossing = false;
        car.waypoint = edge.end;
      } else {
        const next = crossing.has(edge.to) ? null : nextEdge(net, edge, occupied);
        if (!next) {
          car.speed = 0;
          break;
        }
        occupied.delete(edge.id);
        occupied.add(next.id);
        crossing.add(edge.to);
        edge = next;
        car.route.edge = edge.id;
        car.route.crossing = true;
        car.waypoint = edge.start;
      }
    }
  }
}

// Measure a pedestrian's progress clockwise around one continuous block sidewalk.
function sidewalkPoint(path, progress) {
  const side = path.side;
  const phase = ((progress % (4 * side)) + 4 * side) % (4 * side);
  const edge = Math.floor(phase / side);
  const d = phase - edge * side;
  switch (edge) {
    case 0: return { x: path.x + d, y: path.y, angle: 0 };
    case 1: return { x: path.x + side, y: path.y + d, angle: Math.PI / 2 };
    case 2: return { x: path.x + side - d, y: path.y + side, angle: Math.PI };
    default: return { x: path.x, y: path.y + side - d, angle: -Math.PI / 2 };
  }
}

export function spawnPeds(world, n = 72) {
  const random = generator(SEED ^ 0x32b159);
  const blocks = [];
  for (let y = TILE; y + STEP - TILE < world.h; y += STEP) {
    for (let x = TILE; x + STEP - TILE < world.w; x += STEP) blocks.push({ x, y });
  }
  shuffle(blocks, random);
  const near = blocks.filter(b => Math.abs(b.x + (STEP - TILE) / 2 - world.spawn.x) < 460 &&
    Math.abs(b.y + (STEP - TILE) / 2 - world.spawn.y) < 300);
  const count = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  const peds = [];
  for (let i = 0; i < count && blocks.length; i++) {
    const block = i < Math.min(near.length, Math.ceil(count / 6)) ? near[i] : blocks[i % blocks.length];
    const inset = 11 + random() * 7;
    const path = { x: block.x + inset, y: block.y + inset, side: STEP - TILE - 2 * inset };
    const progress = random() * 4 * path.side;
    const direction = random() < 0.5 ? -1 : 1;
    const point = sidewalkPoint(path, progress);
    const pace = 23 + random() * 19;
    peds.push({ ...point, angle: point.angle + (direction < 0 ? Math.PI : 0), id: 'ped-' + i,
      color: shirts[Math.floor(random() * shirts.length)], speed: pace, pace, path, progress,
      direction, fleeTime: 0, fleeing: false });
  }
  return peds;
}

export function updatePeds(state, dt) {
  if (!(dt > 0) || !Number.isFinite(dt)) return;
  const elapsed = Math.min(dt, 0.25);
  const car = state.car;
  for (const ped of state.peds) {
    if (!ped.path || ped.down || ped.dead) continue;
    if (car && Math.hypot(ped.x - car.x, ped.y - car.y) < 110) {
      const a = sidewalkPoint(ped.path, ped.progress + 26);
      const b = sidewalkPoint(ped.path, ped.progress - 26);
      const plus = Math.hypot(a.x - car.x, a.y - car.y);
      const minus = Math.hypot(b.x - car.x, b.y - car.y);
      if (Math.abs(plus - minus) > 3) ped.direction = plus > minus ? 1 : -1;
      ped.fleeTime = 1.3;
    } else {
      ped.fleeTime = Math.max(0, ped.fleeTime - elapsed);
    }
    ped.fleeing = ped.fleeTime > 0;
    ped.speed = ped.fleeing ? ped.pace + 88 : ped.pace;
    const perimeter = 4 * ped.path.side;
    ped.progress = (ped.progress + ped.speed * ped.direction * elapsed + perimeter) % perimeter;
    const point = sidewalkPoint(ped.path, ped.progress);
    ped.x = point.x;
    ped.y = point.y;
    ped.angle = point.angle + (ped.direction < 0 ? Math.PI : 0);
  }
}
