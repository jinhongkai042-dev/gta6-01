import {
  TILE,
  WORLD_TILES,
  WORLD_PX,
  VIEW_W,
  VIEW_H,
  ROAD_EVERY,
  PLAYER_R,
  CAR_W,
  CAR_H,
  SEED,
  CITY_NAME,
  PLAYER_NAME,
} from './config.js';

const worldCache = new WeakMap();

const BUILDING_PALETTE = [
  { base: '#f2b8a2', roof: '#fce2d5', trim: '#fff7f2', awning: '#ff6b6b' }, // coral deco
  { base: '#a5dfd2', roof: '#d7f4ec', trim: '#f2fffc', awning: '#1f9d97' }, // seafoam mint
  { base: '#f6d58e', roof: '#fdf0c9', trim: '#fffaf0', awning: '#e8833a' }, // butter sandstone
  { base: '#a8cbe8', roof: '#d8ebf9', trim: '#f3f9ff', awning: '#2a6f97' }, // coastal sky
  { base: '#e9c7b1', roof: '#f7e5d8', trim: '#fff9f5', awning: '#d95d39' }, // warm terracotta
  { base: '#d9c2e9', roof: '#efe3f7', trim: '#faf5ff', awning: '#7c5cbf' }, // twilight lilac
  { base: '#efe6d5', roof: '#faf6ee', trim: '#ffffff', awning: '#2ec4b6' }, // limestone cream
  { base: '#f3b7c8', roof: '#fce0e8', trim: '#fff5f8', awning: '#e04f7b' }, // flamingo pink
];

const CAR_COLORS = [
  '#ef476f',
  '#2ec4b6',
  '#ffb703',
  '#3a86ff',
  '#fb8500',
  '#06d6a0',
  '#f4f7fa',
  '#9b5de5',
  '#e63946',
];

const PED_SHIRTS = [
  '#ff6b6b',
  '#4ecdc4',
  '#ffd166',
  '#5aa9e6',
  '#f78c6b',
  '#b388eb',
  '#7ae582',
  '#ffffff',
];

const SKIN_TONES = ['#f5cba7', '#e5b08a', '#c68642', '#8d5524', '#f1c27d'];
const HAIR_TONES = ['#241b15', '#4a3123', '#8c5a2b', '#d9a441', '#1a1a22'];

function hash2(a, b, seed = SEED) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function getWorldMeta(world) {
  if (world && typeof world === 'object' && worldCache.has(world)) {
    return worldCache.get(world);
  }

  const tileSize = world?.tileSize || TILE;
  const rawW = world?.w ?? WORLD_PX;
  const rawH = world?.h ?? WORLD_PX;
  const worldPxW = rawW <= 200 ? rawW * tileSize : rawW;
  const worldPxH = rawH <= 200 ? rawH * tileSize : rawH;
  const tilesX = Math.max(4, Math.round(worldPxW / tileSize));
  const tilesY = Math.max(4, Math.round(worldPxH / tileSize));
  const beachStartTile = Math.max(tilesY - 3, Math.floor(tilesY * 0.92));
  const beachStartY = beachStartTile * tileSize;

  // Normalize road mask
  const roadMask = new Uint8Array(tilesX * tilesY);
  let roadCount = 0;

  const markTile = (tx, ty) => {
    if (tx >= 0 && ty >= 0 && tx < tilesX && ty < tilesY) {
      if (!roadMask[ty * tilesX + tx]) {
        roadMask[ty * tilesX + tx] = 1;
        roadCount++;
      }
    }
  };

  const roads = world?.roads;
  if (roads) {
    if (Array.isArray(roads) && roads.length > 0) {
      if (Array.isArray(roads[0])) {
        for (let ty = 0; ty < Math.min(tilesY, roads.length); ty++) {
          const row = roads[ty];
          for (let tx = 0; tx < Math.min(tilesX, row.length); tx++) {
            if (row[tx]) markTile(tx, ty);
          }
        }
      } else if (typeof roads[0] === 'string') {
        for (const key of roads) {
          const parts = key.split(',').map(Number);
          if (parts.length >= 2) markTile(parts[0], parts[1]);
        }
      } else if (typeof roads[0] === 'object') {
        let maxCoord = 0;
        for (const r of roads) {
          maxCoord = Math.max(maxCoord, r.x || 0, r.y || 0, r.tx || 0, r.ty || 0, r.w || 0, r.h || 0);
        }
        const inPixels = maxCoord > Math.max(tilesX, tilesY) + 2;
        for (const r of roads) {
          if (r.w !== undefined && r.h !== undefined) {
            const x0 = inPixels ? Math.floor(r.x / tileSize) : Math.floor(r.x);
            const y0 = inPixels ? Math.floor(r.y / tileSize) : Math.floor(r.y);
            const x1 = inPixels ? Math.ceil((r.x + r.w) / tileSize) : Math.ceil(r.x + r.w);
            const y1 = inPixels ? Math.ceil((r.y + r.h) / tileSize) : Math.ceil(r.y + r.h);
            for (let ty = y0; ty < y1; ty++) {
              for (let tx = x0; tx < x1; tx++) markTile(tx, ty);
            }
          } else {
            const tx = r.tx ?? (inPixels ? Math.floor((r.x || 0) / tileSize) : Math.floor(r.x || 0));
            const ty = r.ty ?? (inPixels ? Math.floor((r.y || 0) / tileSize) : Math.floor(r.y || 0));
            markTile(tx, ty);
          }
        }
      }
    } else if (roads instanceof Set) {
      for (const key of roads) {
        if (typeof key === 'string') {
          const [tx, ty] = key.split(',').map(Number);
          markTile(tx, ty);
        }
      }
    } else if (typeof roads === 'object') {
      const rows = roads.rows || roads.horizontal || roads.h || [];
      const cols = roads.cols || roads.vertical || roads.v || [];
      for (const row of rows) {
        const ty = row > tilesY ? Math.floor(row / tileSize) : row;
        for (let tx = 0; tx < tilesX; tx++) markTile(tx, ty);
      }
      for (const col of cols) {
        const tx = col > tilesX ? Math.floor(col / tileSize) : col;
        for (let ty = 0; ty < tilesY; ty++) markTile(tx, ty);
      }
    }
  }

  if (roadCount === 0) {
    for (let ty = 0; ty < beachStartTile; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        if (tx % ROAD_EVERY === 0 || ty % ROAD_EVERY === 0) {
          markTile(tx, ty);
        }
      }
    }
  }

  // Normalize buildings
  const rawBuildings = Array.isArray(world?.buildings) ? world.buildings : [];
  let maxB = 0;
  for (const b of rawBuildings) {
    maxB = Math.max(maxB, b.x || 0, b.y || 0, b.w || 0, b.h || 0);
  }
  const bInTiles = rawBuildings.length > 0 && maxB <= Math.max(tilesX, tilesY) + 1;

  const buildings = rawBuildings.map((b, idx) => {
    const scale = bInTiles ? tileSize : 1;
    const x = (b.x || 0) * scale;
    const y = (b.y || 0) * scale;
    const w = Math.max(24, (b.w || tileSize) * scale);
    const h = Math.max(24, (b.h || tileSize) * scale);
    const seedVal = hash2(Math.round(x), Math.round(y), SEED + idx * 17);
    const pal = BUILDING_PALETTE[Math.floor(seedVal * BUILDING_PALETTE.length)];
    const stories = b.stories || b.floors || (1 + Math.floor(hash2(idx, 31, SEED) * 4));
    const hasPool = w >= 92 && h >= 92 && hash2(idx, 97, SEED) > 0.72;
    const hasHelipad = w >= 120 && h >= 120 && stories >= 4 && hash2(idx, 149, SEED) > 0.78;
    const hasSkylight = !hasPool && !hasHelipad && w >= 64 && h >= 64 && hash2(idx, 211, SEED) > 0.55;
    return {
      x,
      y,
      w,
      h,
      base: b.color || pal.base,
      roof: b.roofColor || pal.roof,
      trim: pal.trim,
      awning: b.awningColor || pal.awning,
      stories,
      hasPool,
      hasHelipad,
      hasSkylight,
      seed: seedVal,
    };
  });

  // Deterministic palm trees on beach, promenade, and open sidewalk corners
  const palms = [];
  const overlapsBuilding = (px, py, pad) => {
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (px >= b.x - pad && px <= b.x + b.w + pad && py >= b.y - pad && py <= b.y + b.h + pad) {
        return true;
      }
    }
    return false;
  };

  // Beachfront promenade & sand palms
  for (let tx = 0; tx < tilesX; tx++) {
    const px = tx * tileSize + tileSize * (0.35 + hash2(tx, 701, SEED) * 0.35);
    if (tx % 2 === 0) {
      const pyProm = beachStartY + 18;
      if (!overlapsBuilding(px, pyProm, 12)) {
        palms.push({
          x: px,
          y: pyProm,
          r: 20 + hash2(tx, 709, SEED) * 7,
          phase: hash2(tx, 719, SEED) * Math.PI * 2,
          fronds: 7,
        });
      }
    }
    if (hash2(tx, 733, SEED) > 0.48) {
      const pySand = beachStartY + tileSize * (0.75 + hash2(tx, 743, SEED) * 0.45);
      if (!overlapsBuilding(px + 12, pySand, 14)) {
        palms.push({
          x: px + 12,
          y: pySand,
          r: 18 + hash2(tx, 751, SEED) * 8,
          phase: hash2(tx, 757, SEED) * Math.PI * 2,
          fronds: 6,
        });
      }
    }
  }

  // City sidewalk & courtyard palms
  for (let ty = 1; ty < beachStartTile; ty++) {
    for (let tx = 1; tx < tilesX - 1; tx++) {
      if (roadMask[ty * tilesX + tx]) continue;
      const nearRoad =
        roadMask[ty * tilesX + (tx - 1)] ||
        roadMask[ty * tilesX + (tx + 1)] ||
        roadMask[(ty - 1) * tilesX + tx] ||
        roadMask[(ty + 1) * tilesX + tx];
      if (!nearRoad) continue;
      if (hash2(tx, ty, SEED + 409) < 0.72) continue;
      const px = tx * tileSize + 14 + hash2(tx, ty, SEED + 419) * (tileSize - 28);
      const py = ty * tileSize + 14 + hash2(tx, ty, SEED + 431) * (tileSize - 28);
      if (!overlapsBuilding(px, py, 14)) {
        palms.push({
          x: px,
          y: py,
          r: 16 + hash2(tx, ty, SEED + 439) * 6,
          phase: hash2(tx, ty, SEED + 443) * Math.PI * 2,
          fronds: 6,
        });
      }
    }
  }

  // Beach props (umbrellas, towels)
  const beachProps = [];
  for (let tx = 1; tx < tilesX - 1; tx++) {
    if (hash2(tx, 881, SEED) > 0.42) {
      const ux = tx * tileSize + 18 + hash2(tx, 883, SEED) * 28;
      const uy = beachStartY + tileSize * (0.9 + hash2(tx, 887, SEED) * 0.45);
      const colors = ['#ff595e', '#1982c4', '#ffca3a', '#2ec4b6', '#ff924c', '#c77dff'];
      beachProps.push({
        x: ux,
        y: uy,
        r: 13 + hash2(tx, 907, SEED) * 4,
        color: colors[tx % colors.length],
        angle: hash2(tx, 911, SEED) * Math.PI,
      });
    }
  }

  const meta = {
    tileSize,
    worldPxW,
    worldPxH,
    tilesX,
    tilesY,
    beachStartTile,
    beachStartY,
    roadMask,
    buildings,
    palms,
    beachProps,
  };

  if (world && typeof world === 'object') {
    worldCache.set(world, meta);
  }
  return meta;
}

function isRoadTile(meta, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= meta.tilesX || ty >= meta.tilesY) return false;
  return meta.roadMask[ty * meta.tilesX + tx] === 1;
}

function drawBeachAndOcean(ctx, meta, camX, camY, viewW, viewH, time) {
  const beachY = meta.beachStartY;
  const maxVisibleY = camY + viewH;
  if (maxVisibleY < beachY - 8) return;

  const left = Math.max(0, camX - 64);
  const right = Math.min(meta.worldPxW, camX + viewW + 64);
  const width = Math.max(0, right - left);
  if (width <= 0) return;

  // Boardwalk promenade strip
  const promenadeH = 26;
  ctx.fillStyle = '#e5dcc8';
  ctx.fillRect(left, beachY, width, promenadeH);
  ctx.fillStyle = '#cbbda3';
  ctx.fillRect(left, beachY + promenadeH - 3, width, 3);

  ctx.strokeStyle = 'rgba(130, 114, 88, 0.28)';
  ctx.lineWidth = 1;
  const startBoard = Math.floor(left / 16) * 16;
  ctx.beginPath();
  for (let x = startBoard; x <= right; x += 16) {
    ctx.moveTo(x, beachY + 2);
    ctx.lineTo(x, beachY + promenadeH - 3);
  }
  ctx.stroke();

  // Golden beach sand
  const sandY = beachY + promenadeH;
  const surfY = meta.worldPxH - meta.tileSize * 1.15;
  const sandGrad = ctx.createLinearGradient(0, sandY, 0, surfY + 26);
  sandGrad.addColorStop(0, '#f7e1a0');
  sandGrad.addColorStop(0.75, '#eed18a');
  sandGrad.addColorStop(1, '#d8b76e');
  ctx.fillStyle = sandGrad;
  ctx.fillRect(left, sandY, width, Math.max(40, surfY - sandY + 34));

  // Ocean gradient
  const oceanTop = surfY;
  const oceanBottom = Math.max(meta.worldPxH + 160, camY + viewH + 40);
  const oceanGrad = ctx.createLinearGradient(0, oceanTop, 0, oceanTop + 160);
  oceanGrad.addColorStop(0, '#5ce1e6');
  oceanGrad.addColorStop(0.28, '#28b7c9');
  oceanGrad.addColorStop(0.68, '#1782ab');
  oceanGrad.addColorStop(1, '#0e5c82');
  ctx.fillStyle = oceanGrad;

  ctx.beginPath();
  ctx.moveTo(left, oceanBottom);
  const step = 20;
  for (let x = left; x <= right + step; x += step) {
    const wave = Math.sin(x * 0.02 + time * 1.9) * 5 + Math.cos(x * 0.045 - time * 1.3) * 2.5;
    ctx.lineTo(x, oceanTop + wave);
  }
  ctx.lineTo(right + step, oceanBottom);
  ctx.closePath();
  ctx.fill();

  // White surf foam ribbon
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let x = left; x <= right + step; x += step) {
    const wave = Math.sin(x * 0.02 + time * 1.9) * 5 + Math.cos(x * 0.045 - time * 1.3) * 2.5;
    if (x === left) ctx.moveTo(x, oceanTop + wave);
    else ctx.lineTo(x, oceanTop + wave);
  }
  ctx.stroke();

  // Secondary offshore wave ripples
  ctx.strokeStyle = 'rgba(220, 252, 255, 0.34)';
  ctx.lineWidth = 2;
  for (let band = 0; band < 3; band++) {
    const by = oceanTop + 26 + band * 26;
    ctx.beginPath();
    for (let x = Math.floor(left / 90) * 90; x <= right; x += 90) {
      const shift = Math.sin(time * 1.5 + band * 1.7 + x * 0.01) * 8;
      ctx.moveTo(x + shift, by);
      ctx.quadraticCurveTo(x + 22 + shift, by - 4, x + 44 + shift, by);
    }
    ctx.stroke();
  }

  // Wooden marina pier near center-east beach
  const pierX = Math.floor(meta.tilesX * 0.56) * meta.tileSize;
  if (pierX + 44 >= camX && pierX - 20 <= camX + viewW) {
    const pierW = 40;
    const pierH = meta.tileSize * 2.05;
    ctx.fillStyle = 'rgba(10, 32, 48, 0.25)';
    ctx.fillRect(pierX + 6, sandY + 12, pierW, pierH);
    ctx.fillStyle = '#b98b5b';
    ctx.fillRect(pierX, sandY + 4, pierW, pierH);
    ctx.strokeStyle = '#8b6239';
    ctx.lineWidth = 1.5;
    for (let py = sandY + 10; py < sandY + pierH; py += 9) {
      ctx.beginPath();
      ctx.moveTo(pierX, py);
      ctx.lineTo(pierX + pierW, py);
      ctx.stroke();
    }
    ctx.fillStyle = '#6f4b28';
    for (let py = sandY + 16; py < sandY + pierH; py += 34) {
      ctx.fillRect(pierX - 2, py, 5, 5);
      ctx.fillRect(pierX + pierW - 3, py, 5, 5);
    }
  }

  // Beach umbrellas & towels
  for (let i = 0; i < meta.beachProps.length; i++) {
    const p = meta.beachProps[i];
    if (p.x < camX - 30 || p.x > camX + viewW + 30 || p.y < camY - 30 || p.y > camY + viewH + 30) {
      continue;
    }
    // Towel
    ctx.save();
    ctx.translate(p.x + 12, p.y + 8);
    ctx.rotate(p.angle * 0.3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-10, -5, 20, 10);
    ctx.fillStyle = p.color;
    ctx.fillRect(-10, -2, 20, 4);
    ctx.restore();

    // Umbrella shadow
    ctx.fillStyle = 'rgba(85, 65, 30, 0.24)';
    ctx.beginPath();
    ctx.arc(p.x + 5, p.y + 6, p.r, 0, Math.PI * 2);
    ctx.fill();

    // Umbrella canopy
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();

    // Alternating white wedges
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let w = 0; w < 3; w++) {
      const a0 = p.angle + (w * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.arc(p.x, p.y, p.r, a0, a0 + Math.PI / 3);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#fff5d6';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRoadsAndSidewalks(ctx, meta, camX, camY, viewW, viewH) {
  const ts = meta.tileSize;
  const startTX = Math.max(0, Math.floor(camX / ts) - 1);
  const endTX = Math.min(meta.tilesX - 1, Math.ceil((camX + viewW) / ts) + 1);
  const startTY = Math.max(0, Math.floor(camY / ts) - 1);
  const endTY = Math.min(meta.tilesY - 1, Math.ceil((camY + viewH) / ts) + 1);

  // Sidewalks and urban turf blocks
  for (let ty = startTY; ty <= endTY; ty++) {
    if (ty >= meta.beachStartTile) continue;
    const py = ty * ts;
    for (let tx = startTX; tx <= endTX; tx++) {
      if (isRoadTile(meta, tx, ty)) continue;
      const px = tx * ts;
      const blockX = Math.floor(tx / ROAD_EVERY);
      const blockY = Math.floor(ty / ROAD_EVERY);
      const isParkBlock = (blockX + blockY) % 5 === 2 && hash2(blockX, blockY, SEED + 99) > 0.55;

      // Sidewalk base
      ctx.fillStyle = '#dfd8c7';
      ctx.fillRect(px, py, ts, ts);

      // Subtle concrete tile seam
      ctx.strokeStyle = 'rgba(130, 122, 106, 0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);

      // Inner courtyard lawn
      if (isParkBlock) {
        ctx.fillStyle = '#7ec472';
        ctx.fillRect(px + 6, py + 6, ts - 12, ts - 12);
      } else {
        ctx.fillStyle = '#d3ccb8';
        ctx.fillRect(px + 5, py + 5, ts - 10, ts - 10);
      }
    }
  }

  // Road asphalt & markings
  for (let ty = startTY; ty <= endTY; ty++) {
    const py = ty * ts;
    for (let tx = startTX; tx <= endTX; tx++) {
      if (!isRoadTile(meta, tx, ty)) continue;
      const px = tx * ts;

      const n = isRoadTile(meta, tx, ty - 1);
      const s = isRoadTile(meta, tx, ty + 1);
      const w = isRoadTile(meta, tx - 1, ty);
      const e = isRoadTile(meta, tx + 1, ty);
      const isIntersection = (n || s) && (e || w);

      // Asphalt surface
      ctx.fillStyle = isIntersection ? '#3c4452' : '#333b48';
      ctx.fillRect(px, py, ts, ts);

      // Road shoulder curbs where adjacent to non-road
      ctx.fillStyle = '#c4bca9';
      if (!n) ctx.fillRect(px, py, ts, 3);
      if (!s) ctx.fillRect(px, py + ts - 3, ts, 3);
      if (!w) ctx.fillRect(px, py, 3, ts);
      if (!e) ctx.fillRect(px + ts - 3, py, 3, ts);

      // Edge paint lines
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      if (!n) ctx.fillRect(px, py + 5, ts, 1.5);
      if (!s) ctx.fillRect(px, py + ts - 6.5, ts, 1.5);
      if (!w) ctx.fillRect(px + 5, py, 1.5, ts);
      if (!e) ctx.fillRect(px + ts - 6.5, py, 1.5, ts);

      if (isIntersection) {
        // Crosswalk zebra stripes on incoming edges
        ctx.fillStyle = 'rgba(244, 246, 248, 0.72)';
        const stripeCount = 5;
        const gap = (ts - 16) / stripeCount;
        if (n) {
          for (let i = 0; i < stripeCount; i++) {
            ctx.fillRect(px + 10 + i * gap, py + 2, gap * 0.55, 8);
          }
        }
        if (s) {
          for (let i = 0; i < stripeCount; i++) {
            ctx.fillRect(px + 10 + i * gap, py + ts - 10, gap * 0.55, 8);
          }
        }
        if (w) {
          for (let i = 0; i < stripeCount; i++) {
            ctx.fillRect(px + 2, py + 10 + i * gap, 8, gap * 0.55);
          }
        }
        if (e) {
          for (let i = 0; i < stripeCount; i++) {
            ctx.fillRect(px + ts - 10, py + 10 + i * gap, 8, gap * 0.55);
          }
        }
      } else if (e || w) {
        // Horizontal dashed yellow center line
        ctx.fillStyle = '#f3c74d';
        ctx.fillRect(px + 8, py + ts * 0.5 - 1.5, 18, 3);
        ctx.fillRect(px + 38, py + ts * 0.5 - 1.5, 18, 3);
      } else if (n || s) {
        // Vertical dashed yellow center line
        ctx.fillStyle = '#f3c74d';
        ctx.fillRect(px + ts * 0.5 - 1.5, py + 8, 3, 18);
        ctx.fillRect(px + ts * 0.5 - 1.5, py + 38, 3, 18);
      }
    }
  }
}

function drawBuildings(ctx, meta, camX, camY, viewW, viewH) {
  const pad = 48;
  const visible = [];
  for (let i = 0; i < meta.buildings.length; i++) {
    const b = meta.buildings[i];
    if (
      b.x + b.w < camX - pad ||
      b.x > camX + viewW + pad ||
      b.y + b.h < camY - pad ||
      b.y > camY + viewH + pad
    ) {
      continue;
    }
    visible.push(b);
  }

  // Soft shadows first
  ctx.fillStyle = 'rgba(14, 24, 40, 0.23)';
  for (let i = 0; i < visible.length; i++) {
    const b = visible[i];
    const sx = 7 + b.stories * 2.2;
    const sy = 9 + b.stories * 2.4;
    roundRectPath(ctx, b.x + sx, b.y + sy, b.w, b.h, 5);
    ctx.fill();
  }

  // Building volumes & architectural roofs
  for (let i = 0; i < visible.length; i++) {
    const b = visible[i];
    const inset = Math.min(9, Math.max(5, Math.min(b.w, b.h) * 0.1));

    // Outer wall / facade
    ctx.fillStyle = b.base;
    roundRectPath(ctx, b.x, b.y, b.w, b.h, 4);
    ctx.fill();

    // Subtle sunlit top-left edge & shaded bottom-right edge
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(b.x + 2, b.y + b.h - 2);
    ctx.lineTo(b.x + 2, b.y + 2);
    ctx.lineTo(b.x + b.w - 2, b.y + 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(25, 35, 52, 0.24)';
    ctx.beginPath();
    ctx.moveTo(b.x + b.w - 1, b.y + 2);
    ctx.lineTo(b.x + b.w - 1, b.y + b.h - 1);
    ctx.lineTo(b.x + 2, b.y + b.h - 1);
    ctx.stroke();

    // Parapet trim
    ctx.fillStyle = b.trim;
    roundRectPath(ctx, b.x + 3, b.y + 3, b.w - 6, b.h - 6, 3);
    ctx.fill();

    // Roof deck
    ctx.fillStyle = b.roof;
    roundRectPath(ctx, b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2, 2);
    ctx.fill();

    // Roof details
    const rx = b.x + inset;
    const ry = b.y + inset;
    const rw = b.w - inset * 2;
    const rh = b.h - inset * 2;

    if (b.hasPool && rw > 54 && rh > 54) {
      const pw = Math.min(48, rw * 0.52);
      const ph = Math.min(28, rh * 0.42);
      const px = rx + (rw - pw) * 0.5;
      const py = ry + (rh - ph) * 0.5;
      ctx.fillStyle = '#e8f6f8';
      roundRectPath(ctx, px - 3, py - 3, pw + 6, ph + 6, 4);
      ctx.fill();
      ctx.fillStyle = '#38d3dc';
      roundRectPath(ctx, px, py, pw, ph, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(px + 4, py + 4, pw - 8, 4);
    } else if (b.hasHelipad && rw > 68 && rh > 68) {
      const cx = rx + rw * 0.5;
      const cy = ry + rh * 0.5;
      const rad = Math.min(rw, rh) * 0.3;
      ctx.fillStyle = '#536070';
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, rad - 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd166';
      ctx.font = `900 ${Math.round(rad * 0.9)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', cx, cy + 1);
    } else if (b.hasSkylight && rw > 36 && rh > 36) {
      const sw = Math.min(34, rw * 0.48);
      const sh = Math.min(22, rh * 0.4);
      const sx = rx + (rw - sw) * 0.5;
      const sy = ry + (rh - sh) * 0.5;
      ctx.fillStyle = '#79b8d9';
      ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeStyle = '#eef8fc';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.beginPath();
      ctx.moveTo(sx + sw * 0.5, sy);
      ctx.lineTo(sx + sw * 0.5, sy + sh);
      ctx.stroke();
    } else if (rw > 28 && rh > 28) {
      // Rooftop AC units / penthouse box
      ctx.fillStyle = 'rgba(84, 98, 118, 0.25)';
      ctx.fillRect(rx + 6, ry + 6, 12, 10);
      ctx.fillStyle = '#c8d2dc';
      ctx.fillRect(rx + 5, ry + 5, 11, 9);
      ctx.fillStyle = '#7e8e9e';
      ctx.beginPath();
      ctx.arc(rx + 10.5, ry + 9.5, 3, 0, Math.PI * 2);
      ctx.fill();

      if (rw > 60) {
        ctx.fillStyle = '#c8d2dc';
        ctx.fillRect(rx + 20, ry + 5, 10, 9);
      }
    }

    // Coastal striped awning on south facade of storefronts
    if (b.w >= 54 && b.seed > 0.38) {
      const awW = Math.min(36, b.w * 0.45);
      const awX = b.x + (b.w - awW) * 0.5;
      const awY = b.y + b.h;
      ctx.fillStyle = b.awning;
      ctx.fillRect(awX, awY, awW, 6);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      for (let x = awX + 4; x < awX + awW - 3; x += 8) {
        ctx.fillRect(x, awY, 3, 6);
      }
    }
  }
}

function drawMissionBeacon(ctx, mission, time) {
  if (!mission || mission.done || !mission.target) return;
  const { x, y } = mission.target;
  if (typeof x !== 'number' || typeof y !== 'number') return;

  const pulse = (Math.sin(time * 4.5) + 1) * 0.5;
  const outerR = 26 + pulse * 10;

  ctx.save();
  ctx.translate(x, y);

  // Soft golden aura
  const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, outerR + 14);
  grad.addColorStop(0, 'rgba(255, 214, 70, 0.52)');
  grad.addColorStop(0.65, 'rgba(255, 122, 89, 0.24)');
  grad.addColorStop(1, 'rgba(255, 122, 89, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, outerR + 14, 0, Math.PI * 2);
  ctx.fill();

  // Pulsing outer ring
  ctx.strokeStyle = 'rgba(255, 214, 70, 0.92)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, outerR, 0, Math.PI * 2);
  ctx.stroke();

  // Rotating dashed inner ring
  ctx.save();
  ctx.rotate(time * 1.4);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 6]);
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Center diamond marker
  const bob = Math.sin(time * 5.2) * 3;
  ctx.fillStyle = '#ffd166';
  ctx.strokeStyle = '#132030';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -11 + bob);
  ctx.lineTo(8, bob);
  ctx.lineTo(0, 11 + bob);
  ctx.lineTo(-8, bob);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawCar(ctx, car, opts) {
  const { isPolice, isPlayerCar, time, lighting, wanted, index } = opts;
  const len = car.w || car.length || CAR_W;
  const wid = car.h || car.width || CAR_H;
  const angle = car.angle || 0;
  const model = String(car.model || (isPolice ? 'police' : '')).toLowerCase();
  const bodyColor = isPolice
    ? '#18202c'
    : car.color || CAR_COLORS[index % CAR_COLORS.length];

  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(angle);

  // Subtle player highlight glow
  if (isPlayerCar) {
    ctx.strokeStyle = 'rgba(91, 227, 216, 0.65)';
    ctx.lineWidth = 2;
    roundRectPath(ctx, -len * 0.5 - 5, -wid * 0.5 - 5, len + 10, wid + 10, 8);
    ctx.stroke();
  }

  // Courier mission target ring
  if (car.isCourier || car.isTarget || car.role === 'courier') {
    const pulse = (Math.sin(time * 6) + 1) * 0.5;
    ctx.strokeStyle = `rgba(255, 209, 102, ${0.65 + pulse * 0.35})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, len * 0.72 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Headlight beams at dawn / dusk or police pursuit
  if (lighting === 'dawn' || lighting === 'dusk' || isPolice) {
    const beamLen = isPolice ? 62 : 52;
    const beamGrad = ctx.createLinearGradient(len * 0.5, 0, len * 0.5 + beamLen, 0);
    beamGrad.addColorStop(0, 'rgba(255, 247, 198, 0.34)');
    beamGrad.addColorStop(1, 'rgba(255, 247, 198, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(len * 0.48, -wid * 0.36);
    ctx.lineTo(len * 0.48 + beamLen, -wid * 0.85);
    ctx.lineTo(len * 0.48 + beamLen, wid * 0.85);
    ctx.lineTo(len * 0.48, wid * 0.36);
    ctx.closePath();
    ctx.fill();
  }

  // Drop shadow
  ctx.save();
  ctx.translate(3, 4);
  ctx.fillStyle = 'rgba(10, 18, 30, 0.34)';
  roundRectPath(ctx, -len * 0.5, -wid * 0.5, len, wid, 6);
  ctx.fill();
  ctx.restore();

  // Tires
  ctx.fillStyle = '#151921';
  const wx = len * 0.28;
  const wy = wid * 0.48;
  ctx.fillRect(wx - 4, -wy - 1.5, 8, 3);
  ctx.fillRect(wx - 4, wy - 1.5, 8, 3);
  ctx.fillRect(-wx - 4, -wy - 1.5, 8, 3);
  ctx.fillRect(-wx - 4, wy - 1.5, 8, 3);

  // Main chassis
  ctx.fillStyle = bodyColor;
  roundRectPath(ctx, -len * 0.5, -wid * 0.5, len, wid, 6);
  ctx.fill();

  // Police white center livery
  if (isPolice) {
    ctx.fillStyle = '#f5f8fc';
    ctx.fillRect(-len * 0.18, -wid * 0.48, len * 0.38, wid * 0.96);
    // Front push bumper
    ctx.fillStyle = '#475569';
    ctx.fillRect(len * 0.47, -wid * 0.38, 3.5, wid * 0.76);
  }

  // Sports racing stripes
  if (!isPolice && (model === 'sports' || model === 'coupe' || isPlayerCar)) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(-len * 0.46, -2.5, len * 0.92, 1.8);
    ctx.fillRect(-len * 0.46, 0.7, len * 0.92, 1.8);
  }

  // Windshield (front = +x) & rear window (-x)
  ctx.fillStyle = '#1c334a';
  roundRectPath(ctx, len * 0.08, -wid * 0.38, len * 0.2, wid * 0.76, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(182, 232, 255, 0.38)';
  ctx.fillRect(len * 0.17, -wid * 0.32, 3, wid * 0.64);

  if (model === 'convertible') {
    // Open cabin interior
    ctx.fillStyle = '#c89b6e';
    roundRectPath(ctx, -len * 0.22, -wid * 0.34, len * 0.28, wid * 0.68, 3);
    ctx.fill();
    ctx.fillStyle = '#7f5539';
    ctx.fillRect(-len * 0.16, -wid * 0.28, 6, wid * 0.22);
    ctx.fillRect(-len * 0.16, wid * 0.06, 6, wid * 0.22);
  } else {
    // Rear window
    ctx.fillStyle = '#1c334a';
    roundRectPath(ctx, -len * 0.34, -wid * 0.34, len * 0.13, wid * 0.68, 2.5);
    ctx.fill();

    // Roof panel
    ctx.fillStyle = isPolice ? '#ffffff' : 'rgba(255, 255, 255, 0.22)';
    roundRectPath(ctx, -len * 0.2, -wid * 0.35, len * 0.27, wid * 0.7, 3);
    ctx.fill();
  }

  // Crisp body outline
  ctx.strokeStyle = 'rgba(12, 22, 34, 0.45)';
  ctx.lineWidth = 1.2;
  roundRectPath(ctx, -len * 0.5, -wid * 0.5, len, wid, 6);
  ctx.stroke();

  // Headlights (+x)
  ctx.fillStyle = '#fff9d6';
  ctx.fillRect(len * 0.45, -wid * 0.38, 3, 4.5);
  ctx.fillRect(len * 0.45, wid * 0.38 - 4.5, 3, 4.5);

  // Taillights (-x)
  const braking = (car.speed || 0) < -4 || Boolean(car.braking);
  ctx.fillStyle = braking ? '#ff2a4b' : '#d62839';
  ctx.fillRect(-len * 0.5, -wid * 0.38, 2.5, 4.5);
  ctx.fillRect(-len * 0.5, wid * 0.38 - 4.5, 2.5, 4.5);

  // Police flashing red/blue light bar
  if (isPolice) {
    const sirenOn = car.siren !== false && (wanted > 0 || car.siren === true || Math.abs(car.speed || 0) > 10);
    const phase = Math.floor(time * 9 + index) % 2;

    // Lightbar housing
    ctx.fillStyle = '#222b38';
    roundRectPath(ctx, -4, -wid * 0.34, 7, wid * 0.68, 2);
    ctx.fill();

    const redBright = !sirenOn || phase === 0;
    const blueBright = !sirenOn || phase === 1;

    ctx.fillStyle = redBright ? '#ff2d46' : '#781d2a';
    ctx.fillRect(-3, -wid * 0.3, 5, wid * 0.27);
    ctx.fillStyle = blueBright ? '#22a6ff' : '#184266';
    ctx.fillRect(-3, wid * 0.03, 5, wid * 0.27);

    if (sirenOn) {
      const gx = -0.5;
      const gy = phase === 0 ? -wid * 0.22 : wid * 0.22;
      const glowColor = phase === 0 ? 'rgba(255, 45, 70, 0.55)' : 'rgba(34, 166, 255, 0.55)';
      const halo = ctx.createRadialGradient(gx, gy, 1, gx, gy, 24);
      halo.addColorStop(0, glowColor);
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(gx, gy, 24, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawPed(ctx, ped, index, time) {
  if (ped.dead || ped.alive === false || (typeof ped.health === 'number' && ped.health <= 0)) {
    return;
  }
  const angle = ped.angle || 0;
  const moving = Math.abs(ped.speed || 0) > 4;
  const stride = moving ? Math.sin(time * 10 + index * 1.7) * 3 : 0;
  const shirt = ped.color || ped.shirtColor || PED_SHIRTS[index % PED_SHIRTS.length];
  const skin = ped.skinColor || SKIN_TONES[index % SKIN_TONES.length];
  const hair = ped.hairColor || HAIR_TONES[index % HAIR_TONES.length];

  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.rotate(angle);

  // Soft ground shadow
  ctx.fillStyle = 'rgba(12, 20, 32, 0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 8, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Swinging arms
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(2 + stride, -7, 2.5, 0, Math.PI * 2);
  ctx.arc(2 - stride, 7, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Torso / shoulders
  ctx.fillStyle = shirt;
  ctx.strokeStyle = 'rgba(15, 24, 36, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6.2, 8.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(1.5, 0, 4.6, 0, Math.PI * 2);
  ctx.fill();

  // Hair cap on back of head (so facing direction is obvious)
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(0.5, 0, 4.4, Math.PI * 0.55, Math.PI * 1.45);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawPlayerOnFoot(ctx, player, time) {
  const angle = player.angle || 0;
  const r = PLAYER_R || 14;
  const stride = Math.abs(player.speed || 0) > 6 ? Math.sin(time * 12) * 3.5 : 0;

  ctx.save();
  ctx.translate(player.x, player.y);

  // Subtle player locator ring
  ctx.strokeStyle = 'rgba(91, 227, 216, 0.78)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.rotate(angle);

  // Soft shadow
  ctx.fillStyle = 'rgba(10, 18, 30, 0.30)';
  ctx.beginPath();
  ctx.ellipse(2.5, 3.5, 9, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Arms
  ctx.fillStyle = '#e8b48e';
  ctx.beginPath();
  ctx.arc(3 + stride, -9, 3.1, 0, Math.PI * 2);
  ctx.arc(4 - stride, 9, 3.1, 0, Math.PI * 2);
  ctx.fill();

  // Coastal jacket shoulders
  ctx.fillStyle = '#18b8b0';
  ctx.strokeStyle = '#0d2232';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 7.8, 10.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // White tee front stripe
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(1, -3.5, 5.5, 7);

  // Head
  ctx.fillStyle = '#e8b48e';
  ctx.beginPath();
  ctx.arc(2, 0, 5.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(15, 24, 36, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Hair
  ctx.fillStyle = '#241a16';
  ctx.beginPath();
  ctx.arc(0.8, 0, 5.4, Math.PI * 0.55, Math.PI * 1.45);
  ctx.closePath();
  ctx.fill();

  // Sunglasses facing forward
  ctx.fillStyle = '#121821';
  ctx.fillRect(5.2, -3.5, 2.2, 7);

  ctx.restore();
}

function drawPalmTrees(ctx, meta, camX, camY, viewW, viewH, time) {
  const pad = 44;
  for (let i = 0; i < meta.palms.length; i++) {
    const palm = meta.palms[i];
    if (
      palm.x < camX - pad ||
      palm.x > camX + viewW + pad ||
      palm.y < camY - pad ||
      palm.y > camY + viewH + pad
    ) {
      continue;
    }

    const sway = Math.sin(time * 1.6 + palm.phase) * 0.06;

    // Soft frond shadow on ground
    ctx.fillStyle = 'rgba(14, 28, 38, 0.19)';
    ctx.beginPath();
    ctx.arc(palm.x + 11, palm.y + 13, palm.r * 0.92, 0, Math.PI * 2);
    ctx.fill();

    // Trunk hint
    ctx.strokeStyle = '#9c7853';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(palm.x + 3, palm.y + 4);
    ctx.lineTo(palm.x, palm.y);
    ctx.stroke();

    // Fronds
    ctx.save();
    ctx.translate(palm.x, palm.y);
    ctx.rotate(palm.phase + sway);
    const count = palm.fronds || 6;
    for (let f = 0; f < count; f++) {
      const a = (f * Math.PI * 2) / count;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = f % 2 === 0 ? '#2f9e59' : '#45bf6c';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(palm.r * 0.52, -palm.r * 0.28, palm.r, 0);
      ctx.quadraticCurveTo(palm.r * 0.52, palm.r * 0.24, 0, 0);
      ctx.fill();
      ctx.restore();
    }

    // Center crown
    ctx.fillStyle = '#6f4e37';
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawCombatEffects(ctx, state) {
  const projectiles = state?.bullets || state?.projectiles || [];
  for (let i = 0; i < projectiles.length; i++) {
    const b = projectiles[i];
    const angle = b.angle ?? Math.atan2(b.vy || 0, b.vx || 1);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(angle);
    ctx.strokeStyle = '#fff199';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(4, 0);
    ctx.stroke();
    ctx.restore();
  }

  const effects = state?.effects || state?.particles || [];
  for (let i = 0; i < effects.length; i++) {
    const e = effects[i];
    ctx.save();
    ctx.globalAlpha = clamp(e.alpha ?? 0.85, 0, 1);
    ctx.fillStyle = e.color || '#ffb703';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r || e.radius || 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const skids = state?.skids || [];
  if (skids.length > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(22, 26, 34, 0.34)';
    ctx.lineWidth = 3;
    for (let i = 0; i < skids.length; i++) {
      const s = skids[i];
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawOffscreenTargetIndicator(ctx, state, camX, camY, viewW, viewH) {
  const mission = state?.mission;
  if (!mission || mission.done || !mission.target) return;
  const tx = mission.target.x;
  const ty = mission.target.y;
  if (typeof tx !== 'number' || typeof ty !== 'number') return;

  const sx = tx - camX;
  const sy = ty - camY;
  const pad = 42;
  if (sx >= pad && sx <= viewW - pad && sy >= pad && sy <= viewH - pad) return;

  const cx = viewW * 0.5;
  const cy = viewH * 0.5;
  const angle = Math.atan2(sy - cy, sx - cx);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const halfW = viewW * 0.5 - pad;
  const halfH = viewH * 0.5 - pad;
  const scale = Math.min(
    Math.abs(dx) > 0.001 ? halfW / Math.abs(dx) : Infinity,
    Math.abs(dy) > 0.001 ? halfH / Math.abs(dy) : Infinity
  );
  const ix = cx + dx * scale;
  const iy = cy + dy * scale;

  const origin = state?.car || state?.player || { x: camX + cx, y: camY + cy };
  const distM = Math.round(Math.hypot(tx - origin.x, ty - origin.y) / 4);

  ctx.save();
  ctx.translate(ix, iy);

  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = '#ffd166';
  ctx.strokeStyle = '#0f1d2e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(13, 0);
  ctx.lineTo(-9, -8);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-9, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = 'rgba(10, 22, 36, 0.84)';
  roundRectPath(ctx, -22, 13, 44, 17, 5);
  ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.font = '700 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${distM}m`, 0, 21.5);
  ctx.restore();
}

function drawLightingOverlay(ctx, lighting, viewW, viewH) {
  if (!lighting || lighting === 'day') return;
  ctx.save();
  if (lighting === 'dawn') {
    const grad = ctx.createLinearGradient(0, 0, viewW, viewH);
    grad.addColorStop(0, 'rgba(255, 148, 96, 0.20)');
    grad.addColorStop(0.55, 'rgba(255, 206, 132, 0.10)');
    grad.addColorStop(1, 'rgba(42, 72, 128, 0.18)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, viewH);
  } else if (lighting === 'dusk') {
    const grad = ctx.createLinearGradient(0, 0, viewW, viewH);
    grad.addColorStop(0, 'rgba(255, 108, 92, 0.18)');
    grad.addColorStop(0.5, 'rgba(102, 54, 128, 0.14)');
    grad.addColorStop(1, 'rgba(16, 30, 62, 0.28)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, viewH);
  }
  ctx.restore();
}

export function render(ctx, state, camera) {
  if (!ctx) return;
  const viewW = ctx.canvas?.width || VIEW_W;
  const viewH = ctx.canvas?.height || VIEW_H;
  const safeState = state || {};
  const meta = getWorldMeta(safeState.world);
  const time = Number(safeState.time) || 0;

  const focus = (!safeState.player?.onFoot && safeState.car) ? safeState.car : (safeState.player || { x: meta.worldPxW * 0.5, y: meta.worldPxH * 0.5 });
  const camX = typeof camera?.x === 'number'
    ? camera.x
    : clamp((focus.x || 0) - viewW * 0.5, 0, Math.max(0, meta.worldPxW - viewW));
  const camY = typeof camera?.y === 'number'
    ? camera.y
    : clamp((focus.y || 0) - viewH * 0.5, 0, Math.max(0, meta.worldPxH - viewH));

  // Clear background with deep ocean tone
  ctx.fillStyle = '#1477a1';
  ctx.fillRect(0, 0, viewW, viewH);

  ctx.save();
  ctx.translate(-Math.round(camX), -Math.round(camY));

  // 1. Roads & sidewalks
  drawRoadsAndSidewalks(ctx, meta, camX, camY, viewW, viewH);

  // 2. Beach strip & ocean on south edge
  drawBeachAndOcean(ctx, meta, camX, camY, viewW, viewH, time);

  // 3. Skid marks / ground decals & mission beacon
  drawMissionBeacon(ctx, safeState.mission, time);

  // 4. Buildings with soft shadows and coastal roofs
  drawBuildings(ctx, meta, camX, camY, viewW, viewH);

  // 5. Deduplicated vehicles (traffic, police, player car)
  const drawnCars = new Set();
  const policeList = Array.isArray(safeState.police) ? safeState.police : [];
  const policeSet = new Set(policeList);
  const carsList = Array.isArray(safeState.cars) ? safeState.cars : [];
  const activeCar = (!safeState.player?.onFoot && safeState.car) ? safeState.car : null;
  const wanted = Number(safeState.wanted) || 0;
  const lighting = safeState.lighting || safeState.timeOfDay || 'day';

  const drawVehicleIfVisible = (car, idx, forcePolice = false) => {
    if (!car || drawnCars.has(car)) return;
    drawnCars.add(car);
    if (
      car.x < camX - 80 ||
      car.x > camX + viewW + 80 ||
      car.y < camY - 80 ||
      car.y > camY + viewH + 80
    ) {
      return;
    }
    const isPolice =
      forcePolice ||
      policeSet.has(car) ||
      Boolean(car.isPolice) ||
      car.type === 'police' ||
      car.model === 'police';
    drawCar(ctx, car, {
      isPolice,
      isPlayerCar: car === activeCar,
      time,
      lighting,
      wanted,
      index: idx,
    });
  };

  for (let i = 0; i < carsList.length; i++) {
    drawVehicleIfVisible(carsList[i], i, false);
  }
  for (let i = 0; i < policeList.length; i++) {
    drawVehicleIfVisible(policeList[i], i + 100, true);
  }
  if (activeCar) {
    drawVehicleIfVisible(activeCar, 999, false);
  }

  // 6. Pedestrians
  const peds = Array.isArray(safeState.peds) ? safeState.peds : [];
  for (let i = 0; i < peds.length; i++) {
    const ped = peds[i];
    if (!ped) continue;
    if (ped.x < camX - 30 || ped.x > camX + viewW + 30 || ped.y < camY - 30 || ped.y > camY + viewH + 30) {
      continue;
    }
    drawPed(ctx, ped, i, time);
  }

  // 7. Player on foot
  if (safeState.player && (safeState.player.onFoot || !safeState.car)) {
    drawPlayerOnFoot(ctx, safeState.player, time);
  }

  // 8. Combat tracers & effects
  drawCombatEffects(ctx, safeState);

  // 9. Palm tree canopy layer (for natural top-down depth)
  drawPalmTrees(ctx, meta, camX, camY, viewW, viewH, time);

  ctx.restore();

  // 10. Optional dawn/dusk lighting wash
  drawLightingOverlay(ctx, lighting, viewW, viewH);

  // 11. Off-screen mission target directional pointer
  drawOffscreenTargetIndicator(ctx, safeState, camX, camY, viewW, viewH);
}

function drawStar(ctx, cx, cy, outerR, innerR) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = -Math.PI * 0.5 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function drawHUD(ctx, state) {
  if (!ctx) return;
  const viewW = ctx.canvas?.width || VIEW_W;
  const viewH = ctx.canvas?.height || VIEW_H;
  const safeState = state || {};
  const player = safeState.player || { health: 100, money: 0, onFoot: true, speed: 0 };
  const health = clamp(Number(player.health ?? 100), 0, 100);
  const money = Math.round(Number(player.money ?? 0));
  const score = Math.round(Number(safeState.score ?? 0));
  const wanted = clamp(Math.round(Number(safeState.wanted ?? 0)), 0, 5);
  const time = Number(safeState.time) || 0;
  const driving = !player.onFoot && Boolean(safeState.car);

  ctx.save();
  ctx.textBaseline = 'middle';

  // --- TOP-LEFT: Player Health, Money, Score ---
  const cardX = 18;
  const cardY = 16;
  const cardW = 264;
  const cardH = 82;

  ctx.fillStyle = 'rgba(10, 22, 36, 0.80)';
  roundRectPath(ctx, cardX, cardY, cardW, cardH, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(110, 224, 232, 0.30)';
  ctx.lineWidth = 1.25;
  ctx.stroke();

  // Name & Mode tag
  ctx.fillStyle = '#8ecae6';
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText((PLAYER_NAME || 'REX').toUpperCase(), cardX + 14, cardY + 18);

  ctx.fillStyle = driving ? '#ffd166' : '#5be3d8';
  ctx.textAlign = 'right';
  ctx.fillText(driving ? 'IN VEHICLE' : 'ON FOOT', cardX + cardW - 14, cardY + 18);

  // Health bar
  const barX = cardX + 14;
  const barY = cardY + 30;
  const barW = cardW - 70;
  const barH = 14;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  roundRectPath(ctx, barX, barY, barW, barH, 7);
  ctx.fill();

  const fillW = Math.max(0, (barW * health) / 100);
  if (fillW > 0) {
    const hpColor = health > 55 ? '#4ce09e' : health > 25 ? '#ffd166' : '#ff595e';
    ctx.fillStyle = hpColor;
    roundRectPath(ctx, barX, barY, fillW, barH, 7);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(health)} HP`, cardX + cardW - 14, barY + barH * 0.5 + 0.5);

  // Money & Score row
  ctx.fillStyle = '#5ef2a8';
  ctx.font = '900 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${money.toLocaleString('en-US')}`, cardX + 14, cardY + 63);

  ctx.fillStyle = '#b9d6e6';
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`SCORE ${score.toLocaleString('en-US')}`, cardX + cardW - 14, cardY + 64);

  // --- TOP-CENTER: Wanted Stars (0..5) ---
  const starBoxW = 192;
  const starBoxH = 40;
  const starBoxX = (viewW - starBoxW) * 0.5;
  const starBoxY = 16;

  ctx.fillStyle = 'rgba(10, 22, 36, 0.78)';
  roundRectPath(ctx, starBoxX, starBoxY, starBoxW, starBoxH, 20);
  ctx.fill();

  const flashPhase = Math.floor(time * 6) % 2;
  ctx.strokeStyle =
    wanted > 0
      ? flashPhase === 0
        ? 'rgba(255, 70, 90, 0.85)'
        : 'rgba(56, 176, 255, 0.85)'
      : 'rgba(110, 224, 232, 0.25)';
  ctx.lineWidth = wanted > 0 ? 1.8 : 1.2;
  ctx.stroke();

  for (let i = 0; i < 5; i++) {
    const sx = starBoxX + 30 + i * 33;
    const sy = starBoxY + starBoxH * 0.5;
    const active = i < wanted;
    drawStar(ctx, sx, sy, 11.5, 5.2);
    if (active) {
      ctx.fillStyle = '#ffd166';
      ctx.fill();
      ctx.strokeStyle = '#ff7a59';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(190, 220, 236, 0.26)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // --- BOTTOM-LEFT: Current Mission Objective ---
  const mission = safeState.mission;
  const objX = 18;
  const objW = 420;
  const objH = 70;
  const objY = viewH - objH - 18;

  ctx.fillStyle = 'rgba(10, 22, 36, 0.82)';
  roundRectPath(ctx, objX, objY, objW, objH, 12);
  ctx.fill();
  ctx.strokeStyle = mission && !mission.done ? 'rgba(255, 209, 102, 0.52)' : 'rgba(110, 224, 232, 0.26)';
  ctx.lineWidth = 1.3;
  ctx.stroke();

  // Accent left bar
  ctx.fillStyle = mission && !mission.done ? '#ffd166' : '#5be3d8';
  roundRectPath(ctx, objX + 6, objY + 10, 4, objH - 20, 2);
  ctx.fill();

  const missionTitle = mission && !mission.done
    ? `MISSION · ${(mission.name || 'ACTIVE JOB').toUpperCase()}`
    : 'FREE ROAM · MARLIN BAY';
  const missionText = mission && !mission.done
    ? mission.objective || 'Follow the gold marker on your minimap.'
    : 'Press M to choose a mission, or press E to grab a ride.';

  ctx.fillStyle = mission && !mission.done ? '#ffd166' : '#5be3d8';
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(missionTitle, objX + 20, objY + 23);

  ctx.fillStyle = '#eef6fa';
  ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const clipped = missionText.length > 52 ? `${missionText.slice(0, 49)}...` : missionText;
  ctx.fillText(clipped, objX + 20, objY + 46);

  // --- BOTTOM-RIGHT: Speedometer when driving (or subtle action hint on foot) ---
  if (driving) {
    const rawSpeed = Math.abs(Number(safeState.car?.speed ?? player.speed ?? 0));
    const mph = Math.round(rawSpeed * 0.28);
    const maxMph = 120;
    const ratio = clamp(mph / maxMph, 0, 1);

    const spW = 166;
    const spH = 84;
    const spX = viewW - spW - 18;
    const spY = viewH - spH - 18;

    ctx.fillStyle = 'rgba(10, 22, 36, 0.82)';
    roundRectPath(ctx, spX, spY, spW, spH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110, 224, 232, 0.32)';
    ctx.lineWidth = 1.25;
    ctx.stroke();

    // Gauge arc
    const gx = spX + spW * 0.5;
    const gy = spY + 62;
    const gr = 44;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.arc(gx, gy, gr, Math.PI, Math.PI * 2);
    ctx.stroke();

    const gaugeColor = ratio > 0.78 ? '#ff595e' : ratio > 0.48 ? '#ffd166' : '#5be3d8';
    ctx.strokeStyle = gaugeColor;
    ctx.beginPath();
    ctx.arc(gx, gy, gr, Math.PI, Math.PI + Math.PI * ratio);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(mph), gx, spY + 50);

    ctx.fillStyle = '#8ecae6';
    ctx.font = '800 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('MPH', gx, spY + 70);
  } else {
    const hintW = 210;
    const hintH = 38;
    const hintX = viewW - hintW - 18;
    const hintY = viewH - hintH - 18;

    ctx.fillStyle = 'rgba(10, 22, 36, 0.74)';
    roundRectPath(ctx, hintX, hintY, hintW, hintH, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110, 224, 232, 0.24)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#cfe6f2';
    ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('[E] Enter Car   [F] Attack', hintX + hintW * 0.5, hintY + hintH * 0.5 + 0.5);
  }

  ctx.restore();
}

export function drawMinimap(ctx, state) {
  if (!ctx) return;
  const viewW = ctx.canvas?.width || VIEW_W;
  const safeState = state || {};
  const meta = getWorldMeta(safeState.world);
  const time = Number(safeState.time) || 0;

  const mapW = 200;
  const mapH = 160;
  const mapX = viewW - mapW - 18;
  const mapY = 16;

  ctx.save();

  // Outer panel shadow & frame
  ctx.fillStyle = 'rgba(8, 18, 30, 0.88)';
  roundRectPath(ctx, mapX - 4, mapY - 4, mapW + 8, mapH + 22, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(110, 224, 232, 0.42)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Clip map viewport
  ctx.save();
  roundRectPath(ctx, mapX, mapY, mapW, mapH, 8);
  ctx.clip();

  // Map land base
  ctx.fillStyle = '#1b3449';
  ctx.fillRect(mapX, mapY, mapW, mapH);

  const sx = mapW / meta.worldPxW;
  const sy = mapH / meta.worldPxH;
  const tileW = meta.tileSize * sx;
  const tileH = meta.tileSize * sy;

  // Beach & ocean on south edge of minimap
  const beachMapY = mapY + meta.beachStartY * sy;
  ctx.fillStyle = '#d9be7a';
  ctx.fillRect(mapX, beachMapY, mapW, (meta.worldPxH - meta.beachStartY) * sy * 0.48);
  ctx.fillStyle = '#1ca0be';
  ctx.fillRect(
    mapX,
    beachMapY + (meta.worldPxH - meta.beachStartY) * sy * 0.48,
    mapW,
    mapH - (beachMapY - mapY)
  );

  // Buildings footprint tint
  ctx.fillStyle = 'rgba(130, 178, 200, 0.25)';
  for (let i = 0; i < meta.buildings.length; i++) {
    const b = meta.buildings[i];
    ctx.fillRect(mapX + b.x * sx, mapY + b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
  }

  // Road grid
  ctx.fillStyle = '#7c96aa';
  for (let ty = 0; ty < meta.tilesY; ty++) {
    for (let tx = 0; tx < meta.tilesX; tx++) {
      if (meta.roadMask[ty * meta.tilesX + tx]) {
        ctx.fillRect(mapX + tx * tileW, mapY + ty * tileH, tileW + 0.6, tileH + 0.6);
      }
    }
  }

  // Traffic cars (subtle dots)
  const cars = Array.isArray(safeState.cars) ? safeState.cars : [];
  ctx.fillStyle = 'rgba(220, 238, 248, 0.45)';
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i];
    if (!c) continue;
    ctx.fillRect(mapX + c.x * sx - 1, mapY + c.y * sy - 1, 2.2, 2.2);
  }

  // Police dots (flashing red/blue)
  const police = Array.isArray(safeState.police) ? safeState.police : [];
  const pPhase = Math.floor(time * 8) % 2;
  for (let i = 0; i < police.length; i++) {
    const p = police[i];
    if (!p) continue;
    const px = mapX + p.x * sx;
    const py = mapY + p.y * sy;
    ctx.fillStyle = (i + pPhase) % 2 === 0 ? '#ff3b5c' : '#38b6ff';
    ctx.beginPath();
    ctx.arc(px, py, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Mission target marker
  const target = safeState.mission && !safeState.mission.done ? safeState.mission.target : null;
  if (target && typeof target.x === 'number' && typeof target.y === 'number') {
    const mx = mapX + target.x * sx;
    const my = mapY + target.y * sy;
    const pulse = (Math.sin(time * 5) + 1) * 0.5;

    ctx.strokeStyle = 'rgba(255, 209, 102, 0.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(mx, my, 5.5 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(mx, my, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0d1b2a';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Player arrow
  const actor = (!safeState.player?.onFoot && safeState.car) ? safeState.car : safeState.player;
  if (actor && typeof actor.x === 'number' && typeof actor.y === 'number') {
    const px = mapX + actor.x * sx;
    const py = mapY + actor.y * sy;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(actor.angle || 0);
    ctx.fillStyle = '#5be3d8';
    ctx.strokeStyle = '#08131f';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(7.5, 0);
    ctx.lineTo(-5.5, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-5.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Compass badge
  ctx.fillStyle = 'rgba(8, 18, 30, 0.76)';
  roundRectPath(ctx, mapX + mapW - 22, mapY + 6, 16, 16, 4);
  ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.font = '800 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', mapX + mapW - 14, mapY + 14.5);

  ctx.restore(); // end clip

  // Footer strip under minimap
  ctx.fillStyle = '#9ac4d9';
  ctx.font = '800 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText((CITY_NAME || 'MARLIN BAY').toUpperCase(), mapX + 4, mapY + mapH + 10);

  ctx.fillStyle = '#5be3d8';
  ctx.textAlign = 'right';
  ctx.fillText('GPS LIVE', mapX + mapW - 4, mapY + mapH + 10);

  ctx.restore();
}
