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

const BUILDING_PALETTE = [
  { roof: '#f08070', wall: '#c75d4f', trim: '#ffd0c7', style: 'terrace' },
  { roof: '#5ec9b5', wall: '#3c9c8b', trim: '#c7f5ec', style: 'pool' },
  { roof: '#f3c15f', wall: '#c79538', trim: '#ffebb8', style: 'hvac' },
  { roof: '#f4ead6', wall: '#c9bba0', trim: '#ffffff', style: 'skylight' },
  { roof: '#f28cab', wall: '#c76181', trim: '#ffd6e2', style: 'pool' },
  { roof: '#6eb8ea', wall: '#478cbd', trim: '#cceaff', style: 'helipad' },
  { roof: '#f4a578', wall: '#c97b50', trim: '#ffe0cc', style: 'terracotta' },
  { roof: '#82d4aa', wall: '#55a67d', trim: '#d5f7e6', style: 'terrace' },
  { roof: '#baa2dc', wall: '#8f77b3', trim: '#e7dcfa', style: 'skylight' },
  { roof: '#edf2f4', wall: '#bcc8ce', trim: '#ffffff', style: 'hvac' },
];

const CAR_COLORS = [
  '#e63946',
  '#f77f00',
  '#00b4d8',
  '#ffd166',
  '#2ec4b6',
  '#9b5de5',
  '#ff6b6b',
  '#f1faee',
  '#3a86ff',
  '#f15bb5',
];

const PED_SHIRTS = [
  '#ff6b6b',
  '#4ecdc4',
  '#ffe66d',
  '#ffffff',
  '#ff9f1c',
  '#a06cd5',
  '#2ec4b6',
  '#ff8fab',
  '#48cae4',
  '#90be6d',
];

const PED_SKINS = ['#f5d0b5', '#e4b38f', '#c98e68', '#9c6644', '#7a4b2e'];
const PED_HAIR = ['#1d1e22', '#4a3222', '#8c5a32', '#d4a657', '#2c221e', '#e63946'];

const UMBRELLA_COLORS = [
  ['#ff6b6b', '#fff8f0'],
  ['#2ec4b6', '#ffffff'],
  ['#ffd166', '#fffef7'],
  ['#3a86ff', '#f0f7ff'],
  ['#f15bb5', '#fff0f7'],
];

const BEACH_TILE_Y = 37; // Tile 36 is oceanfront avenue (2304..2368), 37..39 is beach & surf

function hash2d(x, y, salt = SEED) {
  let h = (Math.imul(Math.floor(x) ^ salt, 374761393) + Math.imul(Math.floor(y), 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function getWorldMetrics(world) {
  const ts = world?.tileSize || TILE;
  let wPx = WORLD_PX;
  let hPx = WORLD_PX;
  if (world?.w) wPx = world.w <= 128 ? world.w * ts : world.w;
  if (world?.h) hPx = world.h <= 128 ? world.h * ts : world.h;
  const tilesX = Math.max(8, Math.round(wPx / ts));
  const tilesY = Math.max(8, Math.round(hPx / ts));
  return { ts, wPx, hPx, tilesX, tilesY };
}

function getRoadLines(metrics, world) {
  const vCols = new Set();
  const hRows = new Set();

  for (let c = 0; c < metrics.tilesX; c += ROAD_EVERY) {
    vCols.add(c);
  }
  for (let r = 0; r < metrics.tilesY; r += ROAD_EVERY) {
    if (r <= BEACH_TILE_Y - 1) hRows.add(r);
  }

  // Also absorb explicit numeric road lists if supplied
  if (Array.isArray(world?.roads)) {
    for (const item of world.roads) {
      if (typeof item === 'number') {
        vCols.add(item);
        hRows.add(item);
      } else if (item && typeof item === 'object' && 'x' in item && 'y' in item && 'w' in item && 'h' in item) {
        if (item.w > item.h * 2) hRows.add(Math.round(item.y / metrics.ts));
        if (item.h > item.w * 2) vCols.add(Math.round(item.x / metrics.ts));
      }
    }
  }

  return {
    vCols: Array.from(vCols).sort((a, b) => a - b),
    hRows: Array.from(hRows).sort((a, b) => a - b),
  };
}

let cachedFallbackBuildings = null;
function getBuildings(world, metrics) {
  if (Array.isArray(world?.buildings) && world.buildings.length > 0) {
    return world.buildings;
  }
  if (cachedFallbackBuildings) return cachedFallbackBuildings;

  const list = [];
  const ts = metrics.ts;
  for (let br = 0; br < BEACH_TILE_Y - 1; br += ROAD_EVERY) {
    for (let bc = 0; bc < metrics.tilesX - 1; bc += ROAD_EVERY) {
      const bx0 = (bc + 1) * ts + 10;
      const by0 = (br + 1) * ts + 10;
      const bw = (ROAD_EVERY - 1) * ts - 20;
      const bh = (ROAD_EVERY - 1) * ts - 20;
      const r = hash2d(bc, br, SEED + 77);
      // Leave a couple of lush coastal parks
      if (r < 0.14) continue;
      if (r < 0.56) {
        // Two split buildings in block
        const splitH = hash2d(bc, br, SEED + 19) > 0.5;
        if (splitH) {
          const h1 = Math.floor(bh * (0.44 + hash2d(bc, br, 31) * 0.14));
          list.push({ x: bx0, y: by0, w: bw, h: h1 - 6 });
          list.push({ x: bx0, y: by0 + h1 + 6, w: bw, h: bh - h1 - 6 });
        } else {
          const w1 = Math.floor(bw * (0.44 + hash2d(bc, br, 37) * 0.14));
          list.push({ x: bx0, y: by0, w: w1 - 6, h: bh });
          list.push({ x: bx0 + w1 + 6, y: by0, w: bw - w1 - 6, h: bh });
        }
      } else {
        // Single landmark building with plaza inset
        list.push({ x: bx0 + 4, y: by0 + 4, w: bw - 8, h: bh - 8 });
      }
    }
  }
  cachedFallbackBuildings = list;
  return list;
}

function pointHitsBuildings(x, y, pad, buildings) {
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (
      x >= b.x - pad &&
      x <= b.x + b.w + pad &&
      y >= b.y - pad &&
      y <= b.y + b.h + pad
    ) {
      return true;
    }
  }
  return false;
}

function getCamera(state, camera, metrics, viewW, viewH) {
  if (camera && Number.isFinite(camera.x) && Number.isFinite(camera.y)) {
    return camera;
  }
  const focus = state?.car && !state?.player?.onFoot ? state.car : state?.player;
  const fx = focus?.x ?? metrics.wPx * 0.5;
  const fy = focus?.y ?? metrics.hPx * 0.5;
  return {
    x: clamp(fx - viewW * 0.5, -120, metrics.wPx - viewW + 120),
    y: clamp(fy - viewH * 0.5, -120, metrics.hPx - viewH + 160),
  };
}

function getDistrictName(x, y) {
  if (y >= 2260) return 'MARLIN BEACH';
  if (y >= 1760) return x < 1280 ? 'PALM PROMENADE' : 'OCEAN MARINA';
  if (x < 960) return y < 960 ? 'CORAL HEIGHTS' : 'SUNSET STRIP';
  if (x > 1680) return y < 960 ? 'BAYVIEW ESTATES' : 'HARBOR DISTRICT';
  return 'DOWNTOWN MARLIN';
}

function drawOceanAndBeach(ctx, metrics, cam, viewW, viewH, time, buildings) {
  const ts = metrics.ts;
  const beachTop = Math.min(metrics.hPx - ts * 3, BEACH_TILE_Y * ts);
  const boardwalkH = 26;
  const sandTop = beachTop + boardwalkH;
  const shoreY = metrics.hPx - 70;

  // Deep ocean backdrop everywhere outside city bounds
  ctx.fillStyle = '#0f86a1';
  ctx.fillRect(cam.x - 40, cam.y - 40, viewW + 80, viewH + 80);

  // Subtle turquoise water shimmer bands outside city
  ctx.fillStyle = 'rgba(72, 214, 224, 0.18)';
  const waveShift = Math.sin(time * 1.1) * 18;
  for (let wy = Math.floor((cam.y - 60) / 56) * 56; wy < cam.y + viewH + 60; wy += 56) {
    if (wy > beachTop || wy < 0) {
      ctx.fillRect(cam.x - 40, wy + waveShift * 0.25, viewW + 80, 12);
    }
  }

  // City ground base (warm coastal sand-concrete)
  ctx.fillStyle = '#dcd4c4';
  ctx.fillRect(0, 0, metrics.wPx, beachTop);

  // Coastal park turf patches in select interior blocks
  for (let br = 0; br < BEACH_TILE_Y - 1; br += ROAD_EVERY) {
    for (let bc = 0; bc < metrics.tilesX - 1; bc += ROAD_EVERY) {
      const x0 = (bc + 1) * ts;
      const y0 = (br + 1) * ts;
      const bw = (ROAD_EVERY - 1) * ts;
      const bh = (ROAD_EVERY - 1) * ts;
      if (x0 + bw < cam.x - 64 || x0 > cam.x + viewW + 64 || y0 + bh < cam.y - 64 || y0 > cam.y + viewH + 64) {
        continue;
      }
      const h = hash2d(bc, br, SEED + 77);
      if (h < 0.24) {
        // Lush park square
        ctx.fillStyle = '#6cc070';
        ctx.fillRect(x0 + 8, y0 + 8, bw - 16, bh - 16);
        ctx.fillStyle = '#5ab060';
        ctx.fillRect(x0 + 18, y0 + 18, bw - 36, bh - 36);
        // Cross paths
        ctx.fillStyle = '#e5dccb';
        ctx.fillRect(x0 + bw * 0.5 - 8, y0 + 8, 16, bh - 16);
        ctx.fillRect(x0 + 8, y0 + bh * 0.5 - 8, bw - 16, 16);
        // Central fountain
        const fx = x0 + bw * 0.5;
        const fy = y0 + bh * 0.5;
        ctx.fillStyle = '#f2ede1';
        ctx.beginPath();
        ctx.arc(fx, fy, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#38c6d9';
        ctx.beginPath();
        ctx.arc(fx, fy, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath();
        ctx.arc(fx, fy, 4 + Math.sin(time * 4 + bc) * 1.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Warm courtyard paving grid
        ctx.fillStyle = '#e6dfd0';
        ctx.fillRect(x0 + 2, y0 + 2, bw - 4, bh - 4);
      }
    }
  }

  // Only render south beach strip if visible
  if (cam.y + viewH >= beachTop - 40) {
    // Timber boardwalk promenade
    ctx.fillStyle = '#c89b68';
    ctx.fillRect(0, beachTop, metrics.wPx, boardwalkH);
    ctx.fillStyle = '#b48654';
    ctx.fillRect(0, beachTop + boardwalkH - 3, metrics.wPx, 3);
    ctx.strokeStyle = 'rgba(92, 60, 28, 0.22)';
    ctx.lineWidth = 1;
    const xStart = Math.max(0, Math.floor(cam.x / 12) * 12);
    const xEnd = Math.min(metrics.wPx, cam.x + viewW + 12);
    ctx.beginPath();
    for (let px = xStart; px <= xEnd; px += 12) {
      ctx.moveTo(px, beachTop);
      ctx.lineTo(px, sandTop);
    }
    ctx.stroke();

    // Warm golden sand beach
    const sandGrad = ctx.createLinearGradient(0, sandTop, 0, shoreY + 14);
    sandGrad.addColorStop(0, '#f5dca8');
    sandGrad.addColorStop(0.72, '#edd092');
    sandGrad.addColorStop(1, '#dfc080');
    ctx.fillStyle = sandGrad;
    ctx.fillRect(0, sandTop, metrics.wPx, shoreY - sandTop + 16);

    // Gentle shallow turquoise ocean gradient below shoreline
    const seaGrad = ctx.createLinearGradient(0, shoreY - 4, 0, metrics.hPx + 180);
    seaGrad.addColorStop(0, '#5ce0e0');
    seaGrad.addColorStop(0.28, '#20b3c4');
    seaGrad.addColorStop(0.75, '#0e85a1');
    seaGrad.addColorStop(1, '#085d78');
    ctx.fillStyle = seaGrad;
    ctx.fillRect(-100, shoreY, metrics.wPx + 200, metrics.hPx - shoreY + 260);

    // Animated wavy surf foam along shoreline
    const sway = Math.sin(time * 1.8) * 4;
    ctx.beginPath();
    ctx.moveTo(xStart - 20, shoreY + 30);
    for (let sx = xStart - 20; sx <= xEnd + 40; sx += 36) {
      const wy = shoreY + Math.sin(sx * 0.014 + time * 1.5) * 4.5 + sway * 0.4;
      ctx.lineTo(sx, wy);
    }
    ctx.lineTo(xEnd + 40, shoreY + 30);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.fill();

    // Secondary crest wave further out
    ctx.strokeStyle = 'rgba(235, 255, 255, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let sx = xStart; sx <= xEnd; sx += 44) {
      const wy = shoreY + 26 + Math.sin(sx * 0.018 - time * 1.2) * 3.5;
      ctx.moveTo(sx, wy);
      ctx.lineTo(sx + 22, wy + 1);
    }
    ctx.stroke();

    // Wooden marina pier at x ≈ 1560
    const pierX = 1528;
    if (pierX + 80 >= cam.x && pierX - 40 <= cam.x + viewW) {
      ctx.fillStyle = 'rgba(8, 45, 62, 0.28)';
      ctx.fillRect(pierX + 6, sandTop + 6, 46, 174);
      ctx.fillStyle = '#b98856';
      ctx.fillRect(pierX, sandTop, 46, 174);
      ctx.strokeStyle = 'rgba(72, 46, 22, 0.35)';
      ctx.lineWidth = 1;
      for (let py = sandTop + 6; py < sandTop + 174; py += 8) {
        ctx.beginPath();
        ctx.moveTo(pierX, py);
        ctx.lineTo(pierX + 46, py);
        ctx.stroke();
      }
      // Small white speedboat moored beside pier
      const boatY = shoreY + 42 + Math.sin(time * 2.1) * 2;
      ctx.save();
      ctx.translate(pierX + 66, boatY);
      ctx.fillStyle = 'rgba(6, 40, 56, 0.3)';
      ctx.beginPath();
      ctx.ellipse(3, 4, 24, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.quadraticCurveTo(10, -10, -22, -8);
      ctx.lineTo(-22, 8);
      ctx.quadraticCurveTo(10, 10, 24, 0);
      ctx.fill();
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(-14, -5, 18, 10);
      ctx.fillStyle = '#1d3557';
      ctx.fillRect(2, -4, 6, 8);
      ctx.restore();
    }

    // Colorful beach umbrellas & towels on the sand
    for (let ux = 84; ux < metrics.wPx - 64; ux += 112) {
      if (ux < cam.x - 40 || ux > cam.x + viewW + 40) continue;
      if (Math.abs(ux - pierX - 23) < 62) continue;
      const uy = sandTop + 34 + (hash2d(ux, 11) * 28);
      if (pointHitsBuildings(ux, uy, 22, buildings)) continue;

      const pair = UMBRELLA_COLORS[Math.floor(hash2d(ux, 29) * UMBRELLA_COLORS.length)];
      // Beach towel beside umbrella
      ctx.save();
      ctx.translate(ux + 16, uy + 10);
      ctx.rotate((hash2d(ux, 43) - 0.5) * 0.25);
      ctx.fillStyle = pair[0];
      ctx.fillRect(-8, -13, 16, 26);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillRect(-8, -5, 16, 4);
      ctx.fillRect(-8, 4, 16, 4);
      ctx.restore();

      // Umbrella shadow
      ctx.fillStyle = 'rgba(92, 68, 36, 0.22)';
      ctx.beginPath();
      ctx.arc(ux + 6, uy + 7, 15, 0, Math.PI * 2);
      ctx.fill();

      // Umbrella canopy (8 alternating wedges)
      const slices = 8;
      for (let s = 0; s < slices; s++) {
        const a0 = (s / slices) * Math.PI * 2;
        const a1 = ((s + 1) / slices) * Math.PI * 2;
        ctx.fillStyle = s % 2 === 0 ? pair[0] : pair[1];
        ctx.beginPath();
        ctx.moveTo(ux, uy);
        ctx.arc(ux, uy, 15, a0, a1);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ux, uy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawRoads(ctx, metrics, roadLines, cam, viewW, viewH) {
  const ts = metrics.ts;
  const maxRoadY = Math.min(metrics.hPx, (BEACH_TILE_Y) * ts);
  const { vCols, hRows } = roadLines;

  // Sidewalk collars along roads
  const swPad = 10;
  ctx.fillStyle = '#ebe4d6';
  for (const c of vCols) {
    const rx = c * ts;
    if (rx + ts + swPad < cam.x || rx - swPad > cam.x + viewW) continue;
    ctx.fillRect(rx - swPad, 0, ts + swPad * 2, maxRoadY);
  }
  for (const r of hRows) {
    const ry = r * ts;
    if (ry + ts + swPad < cam.y || ry - swPad > cam.y + viewH) continue;
    ctx.fillRect(0, ry - swPad, metrics.wPx, ts + swPad * 2);
  }

  // Curb outlines
  ctx.fillStyle = '#c5bdb0';
  for (const c of vCols) {
    const rx = c * ts;
    if (rx + ts + 3 < cam.x || rx - 3 > cam.x + viewW) continue;
    ctx.fillRect(rx - 2, 0, ts + 4, maxRoadY);
  }
  for (const r of hRows) {
    const ry = r * ts;
    if (ry + ts + 3 < cam.y || ry - 3 > cam.y + viewH) continue;
    ctx.fillRect(0, ry - 2, metrics.wPx, ts + 4);
  }

  // Dark coastal asphalt surface
  ctx.fillStyle = '#333b47';
  for (const c of vCols) {
    const rx = c * ts;
    if (rx + ts < cam.x || rx > cam.x + viewW) continue;
    ctx.fillRect(rx, 0, ts, maxRoadY);
  }
  for (const r of hRows) {
    const ry = r * ts;
    if (ry + ts < cam.y || ry > cam.y + viewH) continue;
    ctx.fillRect(0, ry, metrics.wPx, ts);
  }

  // Subtle shoulder edge markings
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1.5;
  for (const c of vCols) {
    const rx = c * ts;
    if (rx + ts < cam.x || rx > cam.x + viewW) continue;
    ctx.beginPath();
    ctx.moveTo(rx + 4, Math.max(0, cam.y));
    ctx.lineTo(rx + 4, Math.min(maxRoadY, cam.y + viewH));
    ctx.moveTo(rx + ts - 4, Math.max(0, cam.y));
    ctx.lineTo(rx + ts - 4, Math.min(maxRoadY, cam.y + viewH));
    ctx.stroke();
  }
  for (const r of hRows) {
    const ry = r * ts;
    if (ry + ts < cam.y || ry > cam.y + viewH) continue;
    ctx.beginPath();
    ctx.moveTo(Math.max(0, cam.x), ry + 4);
    ctx.lineTo(Math.min(metrics.wPx, cam.x + viewW), ry + 4);
    ctx.moveTo(Math.max(0, cam.x), ry + ts - 4);
    ctx.lineTo(Math.min(metrics.wPx, cam.x + viewW), ry + ts - 4);
    ctx.stroke();
  }

  // Crisp amber-yellow dashed center lines (broken cleanly at intersections)
  ctx.save();
  ctx.strokeStyle = '#f6c945';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([14, 12]);

  for (const c of vCols) {
    const cx = c * ts + ts * 0.5;
    if (cx < cam.x - 10 || cx > cam.x + viewW + 10) continue;
    for (let i = 0; i < hRows.length; i++) {
      const y1 = hRows[i] * ts + ts + 10;
      const y2 = i + 1 < hRows.length ? hRows[i + 1] * ts - 10 : maxRoadY - 6;
      if (y2 <= y1 || y2 < cam.y || y1 > cam.y + viewH) continue;
      ctx.beginPath();
      ctx.moveTo(cx, y1);
      ctx.lineTo(cx, y2);
      ctx.stroke();
    }
  }

  for (const r of hRows) {
    const cy = r * ts + ts * 0.5;
    if (cy < cam.y - 10 || cy > cam.y + viewH + 10) continue;
    for (let i = 0; i < vCols.length; i++) {
      const x1 = vCols[i] * ts + ts + 10;
      const x2 = i + 1 < vCols.length ? vCols[i + 1] * ts - 10 : metrics.wPx - 6;
      if (x2 <= x1 || x2 < cam.x || x1 > cam.x + viewW) continue;
      ctx.beginPath();
      ctx.moveTo(x1, cy);
      ctx.lineTo(x2, cy);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Crisp intersection crosswalks
  ctx.fillStyle = 'rgba(244, 246, 248, 0.72)';
  for (const c of vCols) {
    const rx = c * ts;
    if (rx + ts + 16 < cam.x || rx - 16 > cam.x + viewW) continue;
    for (const r of hRows) {
      const ry = r * ts;
      if (ry + ts + 16 < cam.y || ry - 16 > cam.y + viewH) continue;
      // Intersection asphalt square (cleanly masks shoulder lines)
      ctx.fillStyle = '#333b47';
      ctx.fillRect(rx + 2, ry + 2, ts - 4, ts - 4);

      ctx.fillStyle = 'rgba(245, 247, 250, 0.72)';
      // Horizontal crosswalks (north & south of intersection)
      for (let s = 8; s <= ts - 12; s += 10) {
        if (ry > 0) ctx.fillRect(rx + s, ry - 7, 5, 6);
        if (ry + ts < maxRoadY) ctx.fillRect(rx + s, ry + ts + 1, 5, 6);
      }
      // Vertical crosswalks (west & east of intersection)
      for (let s = 8; s <= ts - 12; s += 10) {
        if (rx > 0) ctx.fillRect(rx - 7, ry + s, 6, 5);
        if (rx + ts < metrics.wPx) ctx.fillRect(rx + ts + 1, ry + s, 6, 5);
      }
    }
  }
}

function drawBuildings(ctx, buildings, cam, viewW, viewH) {
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (
      b.x + b.w + 30 < cam.x ||
      b.x - 20 > cam.x + viewW ||
      b.y + b.h + 30 < cam.y ||
      b.y - 20 > cam.y + viewH
    ) {
      continue;
    }

    const h = hash2d(b.x, b.y, SEED + 101);
    const pal = BUILDING_PALETTE[Math.floor(h * BUILDING_PALETTE.length)];
    const roofColor = b.color || pal.roof;
    const wallColor = b.wallColor || pal.wall;
    const heightTier = 1 + Math.floor(hash2d(b.x + b.w, b.y + b.h, SEED + 17) * 3); // 1..3
    const shadowDx = 7 + heightTier * 4;
    const shadowDy = 8 + heightTier * 4.5;
    const wallDepth = 4 + heightTier * 2.5;

    // Soft cast shadow
    ctx.fillStyle = 'rgba(15, 25, 42, 0.24)';
    roundRectPath(ctx, b.x + shadowDx, b.y + shadowDy, b.w, b.h, 4);
    ctx.fill();

    // Extruded south/east facade wall for crisp top-down 2.5D depth
    ctx.fillStyle = wallColor;
    roundRectPath(ctx, b.x, b.y, b.w, b.h, 3);
    ctx.fill();

    // Sunlit top roof footprint (slightly shifted up-left inside wall bounds)
    const rx = b.x;
    const ry = b.y;
    const rw = Math.max(8, b.w - wallDepth);
    const rh = Math.max(8, b.h - wallDepth);
    ctx.fillStyle = roofColor;
    roundRectPath(ctx, rx, ry, rw, rh, 3);
    ctx.fill();

    // Crisp parapet highlight
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 2;
    ctx.strokeRect(rx + 2, ry + 2, rw - 4, rh - 4);

    // Recessed inner roof deck
    if (rw > 28 && rh > 28) {
      const pad = 7;
      ctx.fillStyle = 'rgba(20, 32, 48, 0.1)';
      ctx.fillRect(rx + pad, ry + pad, rw - pad * 2, rh - pad * 2);

      const style = pal.style;
      const cx = rx + rw * 0.5;
      const cy = ry + rh * 0.5;

      if (style === 'pool' && rw >= 58 && rh >= 48) {
        // Resort rooftop pool
        const pw = Math.min(rw - 26, 46);
        const ph = Math.min(rh - 24, 26);
        ctx.fillStyle = '#eef4f7';
        ctx.fillRect(cx - pw * 0.5 - 3, cy - ph * 0.5 - 3, pw + 6, ph + 6);
        ctx.fillStyle = '#29c7d9';
        ctx.fillRect(cx - pw * 0.5, cy - ph * 0.5, pw, ph);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(cx - pw * 0.5 + 3, cy - ph * 0.5 + 3, pw * 0.45, 4);
      } else if (style === 'helipad' && rw >= 66 && rh >= 66) {
        // Downtown tower helipad
        const rad = Math.min(rw, rh) * 0.28;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffd166';
        ctx.font = `800 ${Math.round(rad * 1.1)}px 'Avenir Next', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('H', cx, cy + 1);
      } else if (style === 'skylight' && rw >= 44 && rh >= 44) {
        const sw = Math.min(rw - 24, 38);
        const sh = Math.min(rh - 24, 24);
        ctx.fillStyle = '#2c536e';
        ctx.fillRect(cx - sw * 0.5, cy - sh * 0.5, sw, sh);
        ctx.strokeStyle = '#9be2f5';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx - sw * 0.5, cy - sh * 0.5, sw, sh);
        ctx.beginPath();
        ctx.moveTo(cx, cy - sh * 0.5);
        ctx.lineTo(cx, cy + sh * 0.5);
        ctx.moveTo(cx - sw * 0.5, cy);
        ctx.lineTo(cx + sw * 0.5, cy);
        ctx.stroke();
      } else if (style === 'terracotta' && rw >= 40 && rh >= 40) {
        // Coastal villa hipped ridge
        ctx.strokeStyle = 'rgba(255, 240, 220, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rx + pad, ry + pad);
        ctx.lineTo(cx, cy);
        ctx.lineTo(rx + rw - pad, ry + pad);
        ctx.moveTo(rx + pad, ry + rh - pad);
        ctx.lineTo(cx, cy);
        ctx.lineTo(rx + rw - pad, ry + rh - pad);
        ctx.stroke();
      } else {
        // Rooftop HVAC & mechanical box
        const ux = rx + pad + 5;
        const uy = ry + pad + 5;
        ctx.fillStyle = '#cfd8df';
        ctx.fillRect(ux, uy, 16, 14);
        ctx.fillStyle = '#536270';
        ctx.beginPath();
        ctx.arc(ux + 8, uy + 7, 4.5, 0, Math.PI * 2);
        ctx.fill();
        if (rw > 72) {
          ctx.fillStyle = '#b9c6d0';
          ctx.fillRect(ux + 22, uy + 2, 12, 10);
        }
      }
    }

    // Subtle striped boutique awning on south street edge of selected buildings
    if (b.w >= 54 && hash2d(b.x, b.y, SEED + 223) > 0.62) {
      const awW = Math.min(b.w - 14, 38);
      const awX = b.x + (b.w - awW) * 0.5;
      const awY = b.y + b.h;
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(awX, awY, awW, 5);
      ctx.fillStyle = '#ffffff';
      for (let sx = awX + 4; sx < awX + awW - 2; sx += 8) {
        ctx.fillRect(sx, awY, 4, 5);
      }
    }
  }
}

function drawPalmTree(ctx, x, y, scale, seed, time) {
  const sway = Math.sin(time * 1.45 + seed * 6.28) * 0.06;
  const fronds = 8;
  const r = 19 * scale;

  // Soft ground shadow
  ctx.save();
  ctx.translate(x + 9 * scale, y + 10 * scale);
  ctx.rotate(seed * 6.28 + sway * 0.6);
  ctx.fillStyle = 'rgba(14, 28, 36, 0.22)';
  for (let i = 0; i < fronds; i++) {
    ctx.rotate((Math.PI * 2) / fronds);
    ctx.beginPath();
    ctx.ellipse(r * 0.55, 0, r * 0.58, r * 0.19, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Slight trunk lean
  ctx.strokeStyle = '#8b6542';
  ctx.lineWidth = 4 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 3);
  ctx.lineTo(x, y);
  ctx.stroke();

  // Layered lush palm fronds
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(seed * 6.28 + sway);
  for (let i = 0; i < fronds; i++) {
    ctx.rotate((Math.PI * 2) / fronds);
    ctx.fillStyle = i % 2 === 0 ? '#2b9c54' : '#43be68';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(r * 0.52, -r * 0.26, r, -r * 0.03);
    ctx.quadraticCurveTo(r * 0.52, r * 0.24, 0, 0);
    ctx.fill();

    // Sunlit center rib
    ctx.strokeStyle = '#8ee38b';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(r * 0.82, 0);
    ctx.stroke();
  }

  // Crown coconuts
  ctx.fillStyle = '#5c3c22';
  ctx.beginPath();
  ctx.arc(2.2, 1.5, 2.3 * scale, 0, Math.PI * 2);
  ctx.arc(-2.1, 1.2, 2.1 * scale, 0, Math.PI * 2);
  ctx.arc(0, -2.2, 2.2 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPalmTrees(ctx, metrics, roadLines, buildings, cam, viewW, viewH, time) {
  const ts = metrics.ts;
  const beachTop = Math.min(metrics.hPx - ts * 3, BEACH_TILE_Y * ts);

  // Boulevard palms along horizontal avenues (sidewalk corners)
  for (const r of roadLines.hRows) {
    const yNorth = r * ts - 9;
    const ySouth = r * ts + ts + 9;
    for (let x = ts + 48; x < metrics.wPx - 48; x += ts * 2) {
      if (x < cam.x - 40 || x > cam.x + viewW + 40) continue;
      // Avoid vertical roads
      const tileX = Math.floor(x / ts);
      if (tileX % ROAD_EVERY === 0) continue;

      if (yNorth >= cam.y - 40 && yNorth <= cam.y + viewH + 40 && yNorth > 16) {
        if (hash2d(x, yNorth, 51) > 0.35 && !pointHitsBuildings(x, yNorth, 6, buildings)) {
          drawPalmTree(ctx, x, yNorth, 0.82 + hash2d(x, yNorth, 52) * 0.24, hash2d(x, yNorth, 53), time);
        }
      }
      if (ySouth >= cam.y - 40 && ySouth <= cam.y + viewH + 40 && ySouth < beachTop - 6) {
        if (hash2d(x, ySouth, 61) > 0.42 && !pointHitsBuildings(x, ySouth, 6, buildings)) {
          drawPalmTree(ctx, x, ySouth, 0.82 + hash2d(x, ySouth, 62) * 0.24, hash2d(x, ySouth, 63), time);
        }
      }
    }
  }

  // Iconic Ocean Drive & Beachfront palm row
  if (cam.y + viewH >= beachTop - 50) {
    for (let px = 42; px < metrics.wPx - 32; px += 76) {
      if (px < cam.x - 45 || px > cam.x + viewW + 45) continue;
      const py = beachTop + 12 + (hash2d(px, 99) - 0.5) * 14;
      if (!pointHitsBuildings(px, py, 10, buildings)) {
        drawPalmTree(ctx, px, py, 0.98 + hash2d(px, 100) * 0.28, hash2d(px, 101), time);
      }
    }
  }
}

function drawVehicle(ctx, car, opts) {
  const { isPolice = false, isPlayerCar = false, time = 0 } = opts || {};
  const w = car.w || CAR_W;
  const h = car.h || CAR_H;
  const hw = w * 0.5;
  const hh = h * 0.5;
  const color = isPolice
    ? '#171c26'
    : car.color || CAR_COLORS[Math.abs(Math.floor((car.x + car.y) * 0.17)) % CAR_COLORS.length];
  const model = (car.model || '').toLowerCase();
  const isConvertible = !isPolice && (model.includes('conv') || model.includes('roadster'));
  const isTaxi = !isPolice && model.includes('taxi');
  const isSport = !isPolice && (isPlayerCar || model.includes('sport') || model.includes('gt') || model.includes('coupe'));
  const isCourier = Boolean(car.isCourier || car.isTarget);

  ctx.save();
  ctx.translate(car.x, car.y);

  // Subtle player / courier beacon ring under car
  if (isPlayerCar) {
    ctx.strokeStyle = 'rgba(54, 214, 207, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, hw + 7, hh + 7, car.angle || 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (isCourier) {
    const pulse = 0.65 + 0.35 * Math.sin(time * 7);
    ctx.strokeStyle = `rgba(255, 209, 102, ${pulse})`;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, hw + 9, hh + 9, car.angle || 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.rotate(car.angle || 0);

  // Ground drop shadow
  ctx.fillStyle = 'rgba(10, 18, 30, 0.34)';
  roundRectPath(ctx, -hw + 3, -hh + 4, w, h, 6);
  ctx.fill();

  // Four rubber tires
  ctx.fillStyle = '#181c22';
  const tw = 9;
  const th = 4;
  ctx.fillRect(hw - 13, -hh - 1.5, tw, th);
  ctx.fillRect(hw - 13, hh - 2.5, tw, th);
  ctx.fillRect(-hw + 5, -hh - 1.5, tw, th);
  ctx.fillRect(-hw + 5, hh - 2.5, tw, th);

  // Main chassis body
  ctx.fillStyle = color;
  roundRectPath(ctx, -hw, -hh, w, h, 6);
  ctx.fill();

  // Police white midsection doors + roof
  if (isPolice) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-hw * 0.42, -hh + 1, w * 0.46, h - 2);
    // Front black push bar
    ctx.fillStyle = '#0e1117';
    ctx.fillRect(hw - 1, -hh + 4, 3, h - 8);
  }

  // Subtle chassis outline & sheen
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.lineWidth = 1.2;
  roundRectPath(ctx, -hw, -hh, w, h, 6);
  ctx.stroke();

  // Sport racing stripe
  if (isSport) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(-hw + 3, -2.5, w - 6, 5);
  }

  // Front windshield (angle=0 faces +X / right)
  ctx.fillStyle = '#1b3554';
  ctx.beginPath();
  ctx.moveTo(hw * 0.34, -hh + 3);
  ctx.lineTo(hw * 0.62, -hh + 4.5);
  ctx.lineTo(hw * 0.62, hh - 4.5);
  ctx.lineTo(hw * 0.34, hh - 3);
  ctx.closePath();
  ctx.fill();

  // Windshield glass glint
  ctx.strokeStyle = 'rgba(182, 236, 255, 0.68)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(hw * 0.43, -hh + 5);
  ctx.lineTo(hw * 0.55, -2);
  ctx.stroke();

  // Rear window
  ctx.fillStyle = '#1b3554';
  ctx.beginPath();
  ctx.moveTo(-hw * 0.68, -hh + 4.5);
  ctx.lineTo(-hw * 0.44, -hh + 3.5);
  ctx.lineTo(-hw * 0.44, hh - 3.5);
  ctx.lineTo(-hw * 0.68, hh - 4.5);
  ctx.closePath();
  ctx.fill();

  // Roof or Convertible interior
  if (isConvertible) {
    ctx.fillStyle = '#8f3d2e';
    roundRectPath(ctx, -hw * 0.42, -hh + 3.5, w * 0.36, h - 7, 3);
    ctx.fill();
    ctx.fillStyle = '#f2d0a7';
    ctx.beginPath();
    ctx.arc(2, -3.5, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = isPolice ? '#ffffff' : 'rgba(255, 255, 255, 0.2)';
    roundRectPath(ctx, -hw * 0.44, -hh + 3.5, w * 0.39, h - 7, 3);
    ctx.fill();
  }

  // Taxi roof sign
  if (isTaxi) {
    ctx.fillStyle = '#141821';
    ctx.fillRect(-4, -5, 8, 10);
    ctx.fillStyle = '#ffe66d';
    ctx.fillRect(-3, -4, 6, 8);
  }

  // Side mirrors (instant front-direction cue)
  ctx.fillStyle = isPolice ? '#171c26' : color;
  ctx.fillRect(hw * 0.28, -hh - 2.2, 4, 2.5);
  ctx.fillRect(hw * 0.28, hh - 0.3, 4, 2.5);

  // Headlights (front = +X)
  ctx.fillStyle = '#fff6c4';
  ctx.fillRect(hw - 2.5, -hh + 2.5, 2.5, 4.5);
  ctx.fillRect(hw - 2.5, hh - 7, 2.5, 4.5);

  // Soft headlight beams when moving fast
  if (Math.abs(car.speed || 0) > 120 || isPlayerCar) {
    const beamGrad = ctx.createLinearGradient(hw, 0, hw + 44, 0);
    beamGrad.addColorStop(0, 'rgba(255, 248, 200, 0.28)');
    beamGrad.addColorStop(1, 'rgba(255, 248, 200, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(hw, -hh + 3);
    ctx.lineTo(hw + 44, -hh - 7);
    ctx.lineTo(hw + 44, hh + 7);
    ctx.lineTo(hw, hh - 3);
    ctx.closePath();
    ctx.fill();
  }

  // Taillights (rear = -X)
  ctx.fillStyle = '#ff3b4e';
  ctx.fillRect(-hw, -hh + 2.5, 2.4, 4.5);
  ctx.fillRect(-hw, hh - 7, 2.4, 4.5);

  // Police flashing red/blue lightbar + luminous halos
  if (isPolice) {
    const phase = Math.floor(time * 9) % 2 === 0;
    const redBright = phase ? 1 : 0.35;
    const blueBright = phase ? 0.35 : 1;

    // Lightbar housing
    ctx.fillStyle = '#11161f';
    ctx.fillRect(-3.5, -hh + 3.5, 7, h - 7);

    // Red lamp (top/left) & Blue lamp (bottom/right)
    ctx.fillStyle = phase ? '#ff2a4b' : '#801526';
    ctx.fillRect(-2.5, -hh + 4.5, 5, (h - 10) * 0.48);
    ctx.fillStyle = !phase ? '#2494ff' : '#12467a';
    ctx.fillRect(-2.5, 0.5, 5, (h - 10) * 0.48);

    // Radiant lightbar glow halos
    const rGrad = ctx.createRadialGradient(0, -hh * 0.45, 1, 0, -hh * 0.45, 24);
    rGrad.addColorStop(0, `rgba(255, 42, 75, ${0.72 * redBright})`);
    rGrad.addColorStop(1, 'rgba(255, 42, 75, 0)');
    ctx.fillStyle = rGrad;
    ctx.beginPath();
    ctx.arc(0, -hh * 0.45, 24, 0, Math.PI * 2);
    ctx.fill();

    const bGrad = ctx.createRadialGradient(0, hh * 0.45, 1, 0, hh * 0.45, 24);
    bGrad.addColorStop(0, `rgba(36, 148, 255, ${0.72 * blueBright})`);
    bGrad.addColorStop(1, 'rgba(36, 148, 255, 0)');
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.arc(0, hh * 0.45, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawPed(ctx, ped, index, time) {
  const dead = ped.alive === false || ped.dead === true || (typeof ped.health === 'number' && ped.health <= 0);
  const angle = ped.angle || 0;
  const speed = Math.abs(ped.speed || 0);
  const stride = speed > 4 && !dead ? Math.sin(time * 9 + index * 1.7) * 3.2 : 0;

  const shirt = ped.color || ped.shirt || PED_SHIRTS[index % PED_SHIRTS.length];
  const skin = PED_SKINS[(index * 3) % PED_SKINS.length];
  const hair = PED_HAIR[(index * 5) % PED_HAIR.length];

  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.rotate(angle);
  if (dead) ctx.globalAlpha = 0.55;

  // Ground shadow
  ctx.fillStyle = 'rgba(12, 20, 34, 0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 7.5, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Stepping shoes
  ctx.fillStyle = '#242933';
  ctx.beginPath();
  ctx.ellipse(stride, -4, 3.2, 2, 0, 0, Math.PI * 2);
  ctx.ellipse(-stride, 4, 3.2, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shoulders / torso
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.ellipse(0, 0, 5.5, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Swinging hands
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(2 - stride * 0.6, -8.5, 2.2, 0, Math.PI * 2);
  ctx.arc(2 + stride * 0.6, 8.5, 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Head + hair
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(1.2, 0, 4.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(-0.3, 0, 4.3, Math.PI * 0.48, Math.PI * 1.52);
  ctx.fill();

  ctx.restore();
}

function drawPlayerOnFoot(ctx, player, time) {
  const angle = player.angle || 0;
  const speed = Math.abs(player.speed || 0);
  const stride = speed > 5 ? Math.sin(time * 11) * 4 : 0;
  const r = PLAYER_R;

  ctx.save();
  ctx.translate(player.x, player.y);

  // Crisp player locator ring
  const pulse = 0.7 + 0.3 * Math.sin(time * 5);
  ctx.strokeStyle = `rgba(54, 214, 207, ${pulse})`;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.rotate(angle);

  // Drop shadow
  ctx.fillStyle = 'rgba(10, 18, 30, 0.3)';
  ctx.beginPath();
  ctx.ellipse(3, 4, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Boots
  ctx.fillStyle = '#1b202a';
  ctx.beginPath();
  ctx.ellipse(stride, -5, 4.2, 2.6, 0, 0, Math.PI * 2);
  ctx.ellipse(-stride, 5, 4.2, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rex's signature coastal coral jacket over white tee
  ctx.fillStyle = '#ff6b4a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 7.5, 11.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, -4, 6.5, 8);
  ctx.strokeStyle = '#16202e';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 7.5, 11.5, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Arms / weapon forward
  ctx.fillStyle = '#e7b996';
  ctx.beginPath();
  ctx.arc(5 - stride * 0.5, -10.5, 3, 0, Math.PI * 2);
  ctx.arc(7 + stride * 0.4, 9.5, 3, 0, Math.PI * 2);
  ctx.fill();

  if (player.weapon && String(player.weapon).toLowerCase() !== 'fists') {
    ctx.fillStyle = '#252c38';
    ctx.fillRect(7, 5, 11, 3.2);
  }

  // Head & styled dark hair + sunglasses
  ctx.fillStyle = '#e7b996';
  ctx.beginPath();
  ctx.arc(1.5, 0, 6.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1e222b';
  ctx.beginPath();
  ctx.arc(-0.5, 0, 5.9, Math.PI * 0.45, Math.PI * 1.55);
  ctx.fill();

  // Sunglasses visor on front
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(5.2, -4, 2.4, 8);

  ctx.restore();
}

function drawMissionMarker(ctx, mission, cam, viewW, viewH, time) {
  if (!mission || mission.done || !mission.target) return;
  const tx = mission.target.x;
  const ty = mission.target.y;
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;

  const pulse = (time * 1.3) % 1;
  const onScreen =
    tx >= cam.x - 40 && tx <= cam.x + viewW + 40 && ty >= cam.y - 40 && ty <= cam.y + viewH + 40;

  if (onScreen) {
    ctx.save();
    ctx.translate(tx, ty);

    // Expanding pulse ring
    ctx.strokeStyle = `rgba(255, 209, 102, ${1 - pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 18 + pulse * 30, 0, Math.PI * 2);
    ctx.stroke();

    // Inner glowing pad
    const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, 26);
    grad.addColorStop(0, 'rgba(255, 224, 115, 0.55)');
    grad.addColorStop(0.6, 'rgba(255, 122, 89, 0.25)');
    grad.addColorStop(1, 'rgba(255, 122, 89, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();

    // Bouncing downward marker chevron
    const bob = Math.sin(time * 5.5) * 5;
    ctx.translate(0, -28 + bob);
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = '#141e2e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(-9, -4);
    ctx.lineTo(9, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}

function drawOffscreenTargetPointer(ctx, state, cam, viewW, viewH) {
  const target = state?.mission && !state.mission.done ? state.mission.target : null;
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return;

  const sx = target.x - cam.x;
  const sy = target.y - cam.y;
  const pad = 42;
  if (sx >= pad && sx <= viewW - pad && sy >= pad && sy <= viewH - pad) return;

  const cx = viewW * 0.5;
  const cy = viewH * 0.5;
  const ang = Math.atan2(sy - cy, sx - cx);
  const edgeX = clamp(sx, pad, viewW - pad);
  const edgeY = clamp(sy, 86, viewH - pad);

  const distM = Math.round(Math.hypot(target.x - (cam.x + cx), target.y - (cam.y + cy)) / 8);

  ctx.save();
  ctx.translate(edgeX, edgeY);
  ctx.fillStyle = 'rgba(11, 24, 38, 0.85)';
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.rotate(ang);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(11, 0);
  ctx.lineTo(-6, -6);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.font = '700 10px "Avenir Next", system-ui, sans-serif';
  ctx.fillStyle = '#fff5d6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`${distM}m`, 0, 21);
  ctx.restore();
}

function drawCombatEffects(ctx, state) {
  const bullets = state?.bullets || state?.projectiles;
  if (Array.isArray(bullets)) {
    ctx.save();
    ctx.strokeStyle = '#fff2a6';
    ctx.lineWidth = 2.5;
    for (const b of bullets) {
      if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
      const vx = b.vx ?? Math.cos(b.angle || 0) * 14;
      const vy = b.vy ?? Math.sin(b.angle || 0) * 14;
      const len = Math.hypot(vx, vy) || 1;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - (vx / len) * 14, b.y - (vy / len) * 14);
      ctx.stroke();
    }
    ctx.restore();
  }

  const effects = state?.effects || state?.particles;
  if (Array.isArray(effects)) {
    for (const ef of effects) {
      if (!Number.isFinite(ef.x) || !Number.isFinite(ef.y)) continue;
      ctx.save();
      ctx.globalAlpha = clamp(ef.alpha ?? 0.8, 0, 1);
      ctx.fillStyle = ef.color || '#ffb703';
      ctx.beginPath();
      ctx.arc(ef.x, ef.y, ef.r || ef.radius || 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

export function render(ctx, state, camera) {
  if (!ctx) return;
  const viewW = ctx.canvas?.width || VIEW_W;
  const viewH = ctx.canvas?.height || VIEW_H;
  const time = state?.time || 0;
  const world = state?.world;
  const metrics = getWorldMetrics(world);
  const cam = getCamera(state, camera, metrics, viewW, viewH);
  const roadLines = getRoadLines(metrics, world);
  const buildings = getBuildings(world, metrics);

  ctx.save();
  ctx.clearRect(0, 0, viewW, viewH);
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));

  // 1. Ocean, city ground, parks, and southern beach strip
  drawOceanAndBeach(ctx, metrics, cam, viewW, viewH, time, buildings);

  // 2. Road grid, curbs, dashed centerlines, crosswalks
  drawRoads(ctx, metrics, roadLines, cam, viewW, viewH);

  // 3. Mission world beacon on the ground
  drawMissionMarker(ctx, state?.mission, cam, viewW, viewH, time);

  // 4. Pedestrians
  const peds = Array.isArray(state?.peds) ? state.peds : [];
  for (let i = 0; i < peds.length; i++) {
    const p = peds[i];
    if (!p || p.x < cam.x - 40 || p.x > cam.x + viewW + 40 || p.y < cam.y - 40 || p.y > cam.y + viewH + 40) {
      continue;
    }
    drawPed(ctx, p, i, time);
  }

  // 5. Traffic & parked cars (avoid duplicating player's car or police cars)
  const playerCar = state?.car && !state?.player?.onFoot ? state.car : null;
  const policeList = Array.isArray(state?.police) ? state.police : [];
  const policeSet = new Set(policeList);
  const cars = Array.isArray(state?.cars) ? state.cars : [];

  for (let i = 0; i < cars.length; i++) {
    const c = cars[i];
    if (!c || c === playerCar || policeSet.has(c)) continue;
    if (c.x < cam.x - 70 || c.x > cam.x + viewW + 70 || c.y < cam.y - 70 || c.y > cam.y + viewH + 70) {
      continue;
    }
    drawVehicle(ctx, c, { isPolice: Boolean(c.isPolice), isPlayerCar: false, time });
  }

  // 6. Player (either driving car or on foot)
  if (playerCar) {
    drawVehicle(ctx, playerCar, { isPolice: false, isPlayerCar: true, time });
  } else if (state?.player) {
    drawPlayerOnFoot(ctx, state.player, time);
  }

  // 7. Police units
  for (let i = 0; i < policeList.length; i++) {
    const cop = policeList[i];
    if (!cop) continue;
    if (cop.x < cam.x - 80 || cop.x > cam.x + viewW + 80 || cop.y < cam.y - 80 || cop.y > cam.y + viewH + 80) {
      continue;
    }
    if (cop.onFoot) {
      drawPed(ctx, { ...cop, color: '#1b3b6f' }, i + 40, time);
    } else {
      drawVehicle(ctx, cop, { isPolice: true, isPlayerCar: false, time });
    }
  }

  // 8. Combat tracers / effects
  drawCombatEffects(ctx, state);

  // 9. Buildings & roofs (drawn over ground/sidewalks for crisp architectural depth)
  drawBuildings(ctx, buildings, cam, viewW, viewH);

  // 10. Palm tree canopies swaying overhead
  drawPalmTrees(ctx, metrics, roadLines, buildings, cam, viewW, viewH, time);

  ctx.restore();

  // Screen-space offscreen mission directional indicator
  drawOffscreenTargetPointer(ctx, state, cam, viewW, viewH);
}

function drawStar(ctx, cx, cy, outerR, innerR, filled, glowColor) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = -Math.PI * 0.5 + (i * Math.PI) / 5;
    const sx = cx + Math.cos(a) * r;
    const sy = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.closePath();

  if (filled) {
    if (glowColor) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 10;
    }
    ctx.fillStyle = '#ffd166';
    ctx.fill();
    ctx.strokeStyle = '#ff8811';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHUD(ctx, state) {
  if (!ctx || !state) return;
  const viewW = ctx.canvas?.width || VIEW_W;
  const viewH = ctx.canvas?.height || VIEW_H;
  const time = state.time || 0;
  const player = state.player || {};
  const health = clamp(Math.round(player.health ?? 100), 0, 100);
  const money = Math.round(player.money ?? 0);
  const wanted = clamp(Math.round(state.wanted ?? 0), 0, 5);
  const score = Math.round(state.score ?? 0);
  const driving = Boolean(state.car && !player.onFoot);

  ctx.save();

  // --- 1. TOP-LEFT STATUS CARD (Cash, Health, Wanted Stars) ---
  const cardX = 18;
  const cardY = 16;
  const cardW = 248;
  const cardH = 112;

  ctx.fillStyle = 'rgba(9, 21, 35, 0.82)';
  roundRectPath(ctx, cardX, cardY, cardW, cardH, 12);
  ctx.fill();
  ctx.strokeStyle = wanted >= 3
    ? (Math.floor(time * 6) % 2 === 0 ? 'rgba(255, 68, 96, 0.72)' : 'rgba(56, 152, 255, 0.72)')
    : 'rgba(114, 224, 232, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Player badge + Money
  ctx.fillStyle = '#36d6cf';
  ctx.font = '800 11px "Avenir Next", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(PLAYER_NAME.toUpperCase(), cardX + 14, cardY + 12);

  ctx.fillStyle = '#4ef0a3';
  ctx.font = '900 24px "Avenir Next", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('$' + money.toLocaleString('en-US'), cardX + cardW - 14, cardY + 8);

  // Health Bar
  const hbX = cardX + 14;
  const hbY = cardY + 43;
  const hbW = cardW - 28;
  const hbH = 14;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  roundRectPath(ctx, hbX, hbY, hbW, hbH, 7);
  ctx.fill();

  const hpFrac = health / 100;
  const hpGrad = ctx.createLinearGradient(hbX, 0, hbX + hbW, 0);
  if (hpFrac > 0.5) {
    hpGrad.addColorStop(0, '#2ee68a');
    hpGrad.addColorStop(1, '#36d6cf');
  } else if (hpFrac > 0.25) {
    hpGrad.addColorStop(0, '#ffb703');
    hpGrad.addColorStop(1, '#fb8500');
  } else {
    hpGrad.addColorStop(0, '#ff4d6d');
    hpGrad.addColorStop(1, '#e63946');
  }
  if (hpFrac > 0) {
    ctx.fillStyle = hpGrad;
    roundRectPath(ctx, hbX, hbY, Math.max(10, hbW * hpFrac), hbH, 7);
    ctx.fill();
  }

  ctx.fillStyle = '#091523';
  ctx.font = '800 10px "Avenir Next", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`HP ${health}`, hbX + 7, hbY + hbH * 0.5 + 0.5);

  // Wanted Stars (0..5)
  const starY = cardY + 80;
  const sirenGlow = wanted > 0
    ? (Math.floor(time * 7) % 2 === 0 ? 'rgba(255, 70, 90, 0.9)' : 'rgba(54, 156, 255, 0.9)')
    : null;
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, cardX + 26 + i * 25, starY, 9.5, 4.4, i < wanted, sirenGlow);
  }

  // Weapon / Mode badge
  const modeLabel = driving
    ? 'DRIVING'
    : (player.weapon ? String(player.weapon).toUpperCase() : 'ON FOOT');
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  roundRectPath(ctx, cardX + cardW - 86, starY - 10, 72, 20, 6);
  ctx.fill();
  ctx.fillStyle = '#d4eaf5';
  ctx.font = '700 10px "Avenir Next", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(modeLabel.slice(0, 9), cardX + cardW - 50, starY + 0.5);

  // --- 2. TOP-CENTER MISSION BANNER ---
  const m = state.mission;
  const bannerW = 470;
  const bannerH = m && !m.done ? 58 : 40;
  const bannerX = (viewW - bannerW) * 0.5;
  const bannerY = 16;

  ctx.fillStyle = 'rgba(9, 21, 35, 0.82)';
  roundRectPath(ctx, bannerX, bannerY, bannerW, bannerH, 12);
  ctx.fill();
  ctx.strokeStyle = m && !m.done ? 'rgba(255, 209, 102, 0.45)' : 'rgba(114, 224, 232, 0.22)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  if (m && !m.done) {
    ctx.fillStyle = '#ffd166';
    ctx.font = '800 11px "Avenir Next", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const header = m.name ? `MISSION · ${String(m.name).toUpperCase()}` : 'ACTIVE MISSION';
    ctx.fillText(header, viewW * 0.5, bannerY + 9);

    ctx.fillStyle = '#f4f9fc';
    ctx.font = '600 15px "Avenir Next", system-ui, sans-serif';
    ctx.fillText(m.objective || 'Follow the golden marker on your radar.', viewW * 0.5, bannerY + 27);
  } else {
    ctx.fillStyle = '#9fd3e6';
    ctx.font = '700 13px "Avenir Next", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`FREE ROAM · ${CITY_NAME.toUpperCase()} — Press [M] for Missions`, viewW * 0.5, bannerY + bannerH * 0.5);
  }

  // --- 3. BOTTOM-LEFT DISTRICT & SCORE PILL ---
  const focus = driving ? state.car : player;
  const district = getDistrictName(focus?.x ?? 1280, focus?.y ?? 1280);
  const pillW = 240;
  const pillH = 38;
  const pillX = 18;
  const pillY = viewH - pillH - 16;

  ctx.fillStyle = 'rgba(9, 21, 35, 0.78)';
  roundRectPath(ctx, pillX, pillY, pillW, pillH, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#ffd166';
  ctx.font = '800 11px "Avenir Next", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(district, pillX + 12, pillY + pillH * 0.5);

  ctx.fillStyle = '#d8eef8';
  ctx.font = '700 12px "Avenir Next", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`SCORE ${score.toLocaleString('en-US')}`, pillX + pillW - 12, pillY + pillH * 0.5);

  // --- 4. BOTTOM-RIGHT SPEEDOMETER (when driving) ---
  if (driving && state.car) {
    const rawSpeed = Math.abs(state.car.speed ?? player.speed ?? 0);
    // Convert px/s to readable arcade MPH (e.g. 300 px/s ≈ 72 MPH)
    const mph = Math.round(rawSpeed * 0.24);
    const speedFrac = clamp(mph / 120, 0, 1);

    const spW = 184;
    const spH = 88;
    const spX = viewW - spW - 18;
    const spY = viewH - spH - 16;

    ctx.fillStyle = 'rgba(9, 21, 35, 0.84)';
    roundRectPath(ctx, spX, spY, spW, spH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(54, 214, 207, 0.34)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Semicircular gauge on left of widget
    const gx = spX + 48;
    const gy = spY + 56;
    const gr = 30;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(gx, gy, gr, Math.PI * 0.85, Math.PI * 2.15);
    ctx.stroke();

    const arcEnd = Math.PI * 0.85 + speedFrac * (Math.PI * 1.3);
    ctx.strokeStyle = speedFrac > 0.72 ? '#ff5964' : speedFrac > 0.42 ? '#ffd166' : '#36d6cf';
    ctx.beginPath();
    ctx.arc(gx, gy, gr, Math.PI * 0.85, arcEnd);
    ctx.stroke();

    // Digital MPH readout
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 28px "Avenir Next", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(String(mph), spX + spW - 14, spY + 12);

    ctx.fillStyle = '#79e6e0';
    ctx.font = '800 11px "Avenir Next", system-ui, sans-serif';
    ctx.fillText('MPH', spX + spW - 14, spY + 44);

    const carModel = (state.car.model || 'COASTAL GT').toUpperCase();
    ctx.fillStyle = '#9ec1d3';
    ctx.font = '700 10px "Avenir Next", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${carModel.slice(0, 14)} · [E] EXIT`, spX + spW * 0.5, spY + 69);
  }

  ctx.restore();
}

export function drawMinimap(ctx, state) {
  if (!ctx || !state) return;
  const viewW = ctx.canvas?.width || VIEW_W;
  const time = state.time || 0;
  const world = state.world;
  const metrics = getWorldMetrics(world);
  const roadLines = getRoadLines(metrics, world);
  const buildings = getBuildings(world, metrics);

  const mapW = 204;
  const mapH = 160;
  const mapX = viewW - mapW - 18;
  const mapY = 16;

  const focus = state.car && !state.player?.onFoot ? state.car : state.player || { x: metrics.wPx * 0.5, y: metrics.hPx * 0.5 };

  // Radar zoom shows ~1900x1500 world px around player, clamped inside world bounds
  const scale = 0.095;
  const visW = mapW / scale;
  const visH = mapH / scale;
  const originX = clamp((focus.x || 0) - visW * 0.5, 0, Math.max(0, metrics.wPx - visW));
  const originY = clamp((focus.y || 0) - visH * 0.5, 0, Math.max(0, metrics.hPx - visH));

  const toMX = (wx) => mapX + (wx - originX) * scale;
  const toMY = (wy) => mapY + (wy - originY) * scale;

  ctx.save();

  // Outer shadow & frame
  ctx.fillStyle = 'rgba(7, 17, 29, 0.88)';
  roundRectPath(ctx, mapX - 3, mapY - 3, mapW + 6, mapH + 6, 13);
  ctx.fill();

  // Clip interior of minimap
  roundRectPath(ctx, mapX, mapY, mapW, mapH, 10);
  ctx.save();
  ctx.clip();

  // City ground fill
  ctx.fillStyle = '#203447';
  ctx.fillRect(mapX, mapY, mapW, mapH);

  // Beach & ocean strip on south edge
  const beachY = toMY(BEACH_TILE_Y * metrics.ts);
  const shoreY = toMY(metrics.hPx - 70);
  if (beachY < mapY + mapH) {
    ctx.fillStyle = '#c8ae74';
    ctx.fillRect(mapX, beachY, mapW, Math.max(0, shoreY - beachY));
    ctx.fillStyle = '#148da8';
    ctx.fillRect(mapX, shoreY, mapW, mapY + mapH - shoreY + 4);
  }

  // Building footprints
  ctx.fillStyle = 'rgba(130, 165, 190, 0.34)';
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const bx = toMX(b.x);
    const by = toMY(b.y);
    const bw = b.w * scale;
    const bh = b.h * scale;
    if (bx + bw < mapX || bx > mapX + mapW || by + bh < mapY || by > mapY + mapH) continue;
    ctx.fillRect(bx, by, Math.max(1.5, bw), Math.max(1.5, bh));
  }

  // Road grid
  const ts = metrics.ts;
  const roadPx = Math.max(3, ts * scale);
  const maxRoadMY = toMY(BEACH_TILE_Y * ts);
  ctx.fillStyle = '#53687e';
  for (const c of roadLines.vCols) {
    const rx = toMX(c * ts);
    if (rx + roadPx < mapX || rx > mapX + mapW) continue;
    ctx.fillRect(rx, mapY, roadPx, Math.max(0, maxRoadMY - mapY));
  }
  for (const r of roadLines.hRows) {
    const ry = toMY(r * ts);
    if (ry + roadPx < mapY || ry > mapY + mapH) continue;
    ctx.fillRect(mapX, ry, mapW, roadPx);
  }

  // Ambient traffic cars (subtle pips)
  if (Array.isArray(state.cars)) {
    ctx.fillStyle = 'rgba(220, 238, 250, 0.45)';
    for (let i = 0; i < state.cars.length; i++) {
      const c = state.cars[i];
      if (!c) continue;
      const cx = toMX(c.x);
      const cy = toMY(c.y);
      if (cx < mapX || cx > mapX + mapW || cy < mapY || cy > mapY + mapH) continue;
      ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    }
  }

  // Police flashing red/blue dots
  if (Array.isArray(state.police)) {
    const flashRed = Math.floor(time * 8) % 2 === 0;
    for (let i = 0; i < state.police.length; i++) {
      const cop = state.police[i];
      if (!cop) continue;
      const px = toMX(cop.x);
      const py = toMY(cop.y);
      if (px < mapX - 4 || px > mapX + mapW + 4 || py < mapY - 4 || py > mapY + mapH + 4) continue;
      ctx.fillStyle = (i % 2 === 0 ? flashRed : !flashRed) ? '#ff3355' : '#2ea0ff';
      ctx.beginPath();
      ctx.arc(px, py, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Mission target marker (clamped to minimap border if outside zoom window)
  const target = state.mission && !state.mission.done ? state.mission.target : null;
  if (target && Number.isFinite(target.x) && Number.isFinite(target.y)) {
    const tx = clamp(toMX(target.x), mapX + 8, mapX + mapW - 8);
    const ty = clamp(toMY(target.y), mapY + 8, mapY + mapH - 8);
    const ring = 5 + ((time * 10) % 6);
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.78)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(tx, ty, ring, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(tx, ty, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0e1726';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Player directional arrow
  const plX = toMX(focus.x || 0);
  const plY = toMY(focus.y || 0);
  const plAng = focus.angle ?? state.player?.angle ?? 0;
  ctx.save();
  ctx.translate(plX, plY);
  ctx.rotate(plAng);
  ctx.fillStyle = '#36d6cf';
  ctx.strokeStyle = '#071421';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-5.5, -5);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-5.5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.restore(); // end clip

  // Crisp glass border
  roundRectPath(ctx, mapX, mapY, mapW, mapH, 10);
  ctx.strokeStyle = 'rgba(114, 224, 232, 0.45)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Compass 'N' badge at top center of minimap
  ctx.fillStyle = '#0a1829';
  ctx.strokeStyle = 'rgba(114, 224, 232, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(mapX + mapW * 0.5, mapY, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.font = '800 10px "Avenir Next", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', mapX + mapW * 0.5, mapY + 0.5);

  ctx.restore();
}
