import { TILE, WORLD_TILES, WORLD_PX, ROAD_EVERY, SEED } from './config.js';

const GRID = ROAD_EVERY * TILE;
const ROOFS = ['#b78976', '#71918e', '#ceaa83', '#9b818d', '#8897a5', '#bc9a8f'];
const roadRandom = new WeakMap();

function generator(seed) {
  let bits = seed >>> 0;
  return () => {
    bits = (Math.imul(1664525, bits) + 1013904223) >>> 0;
    return bits / 4294967296;
  };
}

export function buildWorld() {
  const random = generator(SEED);
  const world = {
    tileSize: TILE, w: WORLD_PX, h: WORLD_PX, roads: [], sidewalks: [], buildings: [],
    spawn: { x: Math.floor(WORLD_TILES / (2 * ROAD_EVERY)) * GRID + TILE * 1.5,
             y: Math.floor(WORLD_TILES / (2 * ROAD_EVERY)) * GRID + TILE / 2, angle: 0 },
  };
  roadRandom.set(world, generator(SEED ^ 0xa901));
  for (let line = 0; line < WORLD_PX; line += GRID) {
    world.roads.push({ x: line, y: 0, w: TILE, h: WORLD_PX });
    world.roads.push({ x: 0, y: line, w: WORLD_PX, h: TILE });
  }

  function building(x, y, w, h) {
    const inset = Math.floor(random() * 6);
    world.buildings.push({
      x: x + inset, y, w: w - 2 * inset, h,
      color: ROOFS[Math.floor(random() * ROOFS.length)],
    });
  }

  // Each block has a continuous pavement ring. Lanes between separate
  // footprints make some blocks passable on foot from curb to curb.
  const side = GRID - TILE;
  const pavement = 22;
  for (let y = TILE; y < WORLD_PX; y += GRID) {
    for (let x = TILE; x < WORLD_PX; x += GRID) {
      world.sidewalks.push(
        { x, y, w: side, h: pavement },
        { x, y: y + side - pavement, w: side, h: pavement },
        { x, y: y + pavement, w: pavement, h: side - 2 * pavement },
        { x: x + side - pavement, y: y + pavement, w: pavement, h: side - 2 * pavement },
      );
      const left = x + pavement;
      const top = y + pavement;
      const width = side - 2 * pavement;
      const layout = Math.floor(random() * 4);
      const alley = 32;
      const cut = Math.floor(width * (0.32 + 0.18 * random()));
      const rest = width - cut - alley;
      if (layout === 0) {
        building(left, top, width, width);
      } else if (layout === 1) {
        building(left, top, width, cut);
        building(left, top + cut + alley, width, rest);
      } else {
        building(left, top, cut, width);
        if (layout === 2) {
          building(left + cut + alley, top, rest, width);
        } else {
          building(left + cut + alley, top, rest, rest);
          building(left + cut + alley, top + rest + alley, rest, cut);
        }
      }
    }
  }
  return world;
}

export function isRoad(world, x, y) {
  if (x < 0 || y < 0 || x >= world.w || y >= world.h) return false;
  return Math.floor(x / TILE) % ROAD_EVERY === 0 || Math.floor(y / TILE) % ROAD_EVERY === 0;
}

export function isBlocked(world, x, y, r = 0) {
  if (x < r || y < r || x + r >= world.w || y + r >= world.h) return true;
  return world.buildings.some(b => {
    const dx = Math.max(b.x - x, 0, x - b.x - b.w);
    const dy = Math.max(b.y - y, 0, y - b.y - b.h);
    return dx * dx + dy * dy <= r * r;
  });
}

export function randomRoadPoint(world) {
  let random = roadRandom.get(world);
  if (!random) {
    random = generator(SEED ^ 0xa901);
    roadRandom.set(world, random);
  }
  const dir = Math.floor(random() * 4);
  const horizontal = dir % 2 === 0;
  const across = horizontal ? world.h : world.w;
  const along = horizontal ? world.w : world.h;
  const center = Math.floor(random() * Math.ceil(across / GRID)) * GRID + TILE / 2;
  const lane = center + (dir < 2 ? 1 : -1) * (horizontal ? 1 : -1) * TILE / 4;
  const position = TILE / 2 + random() * (along - TILE);
  return { x: horizontal ? position : lane, y: horizontal ? lane : position, angle: dir * Math.PI / 2 };
}
