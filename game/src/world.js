import { ROAD_EVERY, SEED, TILE, WORLD_PX, WORLD_TILES } from './config.js';

const roofColors = ['#ab8872', '#728997', '#bd907f', '#74968c', '#9291a6', '#b5a485', '#8499a6'];
const roadPointSeeds = new WeakMap();

function generator(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function fillBlock(buildings, left, top, right, bottom, random) {
  // The continuous strip between the asphalt and each lot is the sidewalk.
  const pavement = 28;
  const plots = [{ x: left + pavement, y: top + pavement,
    w: right - left - pavement * 2, h: bottom - top - pavement * 2 }];
  const lotCount = 1 + Math.floor(random() * 4);
  while (plots.length < lotCount) {
    plots.sort((a, b) => b.w * b.h - a.w * a.h);
    const a = plots[0];
    const splitX = a.w === a.h ? random() < 0.5 : a.w > a.h;
    const length = splitX ? a.w : a.h;
    const alley = 8 + Math.floor(random() * 6);
    const cut = Math.floor((length - alley) * (0.42 + random() * 0.16));
    const b = { ...a };
    if (splitX) {
      a.w = cut;
      b.x += cut + alley;
      b.w = length - cut - alley;
    } else {
      a.h = cut;
      b.y += cut + alley;
      b.h = length - cut - alley;
    }
    plots.push(b);
  }
  for (const plot of plots) {
    plot.w -= Math.floor(random() * 6);
    plot.h -= Math.floor(random() * 6);
    plot.color = roofColors[Math.floor(random() * roofColors.length)];
    buildings.push(plot);
  }
}

export function buildWorld() {
  const random = generator(SEED);
  const roads = Array.from({ length: WORLD_TILES }, (_, row) =>
    Array.from({ length: WORLD_TILES }, (_, col) => row % ROAD_EVERY === 0 || col % ROAD_EVERY === 0));
  const buildings = [];
  for (let row = 0; row < WORLD_TILES; row += ROAD_EVERY) {
    for (let col = 0; col < WORLD_TILES; col += ROAD_EVERY) {
      fillBlock(buildings, (col + 1) * TILE, (row + 1) * TILE,
        Math.min(col + ROAD_EVERY, WORLD_TILES) * TILE,
        Math.min(row + ROAD_EVERY, WORLD_TILES) * TILE, random);
    }
  }
  const centerLine = Math.floor(WORLD_TILES / (2 * ROAD_EVERY)) * ROAD_EVERY;
  const spawn = { x: (centerLine - 1) * TILE, y: (centerLine + 0.5) * TILE, angle: 0 };
  return { tileSize: TILE, w: WORLD_PX, h: WORLD_PX, roads, buildings, spawn };
}

export function isRoad(world, x, y) {
  if (!(x >= 0 && y >= 0 && x < world.w && y < world.h)) return false;
  return world.roads[Math.floor(y / world.tileSize)][Math.floor(x / world.tileSize)];
}

export function isBlocked(world, x, y, r = 0) {
  if (x - r < 0 || y - r < 0 || x + r > world.w || y + r > world.h ||
      x >= world.w || y >= world.h) return true;
  for (const b of world.buildings) {
    if (x + r < b.x || x - r > b.x + b.w || y + r < b.y || y - r > b.y + b.h) continue;
    const dx = Math.max(b.x - x, 0, x - b.x - b.w);
    const dy = Math.max(b.y - y, 0, y - b.y - b.h);
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

export function randomRoadPoint(world) {
  let random = roadPointSeeds.get(world);
  if (!random) {
    random = generator(SEED ^ 0x6578af);
    roadPointSeeds.set(world, random);
  }
  const horizontal = random() < 0.5;
  const span = horizontal ? world.w : world.h;
  const crossSpan = horizontal ? world.h : world.w;
  const step = world.tileSize * ROAD_EVERY;
  const positive = random() < 0.5;
  const line = Math.floor(random() * Math.ceil(crossSpan / step)) * step + world.tileSize / 2;
  const lane = (positive ? 1 : -1) * world.tileSize / 5;
  const along = world.tileSize / 2 + random() * (span - world.tileSize);
  return horizontal
    ? { x: along, y: line + lane, angle: positive ? 0 : Math.PI }
    : { x: line - lane, y: along, angle: positive ? Math.PI / 2 : -Math.PI / 2 };
}
