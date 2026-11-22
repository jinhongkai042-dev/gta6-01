import {
  TILE,
  WORLD_TILES,
  WORLD_PX,
  VIEW_W,
  VIEW_H,
  ROAD_EVERY,
  SEED,
  CITY_NAME,
  PLAYER_NAME,
} from './config.js';
import { render, drawHUD, drawMinimap } from './render.js';
import { hideScreens } from './ui.js';

function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function buildShotWorld() {
  const rng = createRng(SEED);
  const tilesX = WORLD_TILES;
  const tilesY = WORLD_TILES;
  const beachStartTile = tilesY - 3;

  const roads = [];
  for (let ty = 0; ty < tilesY; ty++) {
    const row = new Array(tilesX).fill(0);
    for (let tx = 0; tx < tilesX; tx++) {
      if (ty < beachStartTile && (tx % ROAD_EVERY === 0 || ty % ROAD_EVERY === 0)) {
        row[tx] = 1;
      }
    }
    roads.push(row);
  }

  const buildings = [];
  const palette = [
    '#f2b8a2',
    '#a5dfd2',
    '#f6d58e',
    '#a8cbe8',
    '#e9c7b1',
    '#efe6d5',
    '#f3b7c8',
    '#d9c2e9',
  ];

  // Fill city blocks between grid roads with varied Art Deco footprints
  for (let by = 0; by < beachStartTile; by += ROAD_EVERY) {
    for (let bx = 0; bx < tilesX; bx += ROAD_EVERY) {
      const x0 = (bx + 1) * TILE;
      const y0 = (by + 1) * TILE;
      const blockW = (ROAD_EVERY - 1) * TILE;
      const blockH = (ROAD_EVERY - 1) * TILE;
      if (by + ROAD_EVERY > beachStartTile) continue;

      // Leave a couple of sunny palm plazas open
      const plazaRoll = rng();
      if (plazaRoll < 0.09) continue;

      const splitMode = Math.floor(rng() * 3);
      const pad = 10;
      const gap = 12;

      if (splitMode === 0) {
        // One grand coastal resort / tower
        buildings.push({
          x: x0 + pad,
          y: y0 + pad,
          w: blockW - pad * 2,
          h: blockH - pad * 2,
          color: palette[Math.floor(rng() * palette.length)],
          stories: 3 + Math.floor(rng() * 3),
        });
      } else if (splitMode === 1) {
        // Two side-by-side buildings
        const w1 = Math.floor((blockW - pad * 2 - gap) * (0.45 + rng() * 0.15));
        const w2 = blockW - pad * 2 - gap - w1;
        buildings.push({
          x: x0 + pad,
          y: y0 + pad,
          w: w1,
          h: blockH - pad * 2,
          color: palette[Math.floor(rng() * palette.length)],
          stories: 2 + Math.floor(rng() * 3),
        });
        buildings.push({
          x: x0 + pad + w1 + gap,
          y: y0 + pad,
          w: w2,
          h: blockH - pad * 2,
          color: palette[Math.floor(rng() * palette.length)],
          stories: 1 + Math.floor(rng() * 3),
        });
      } else {
        // Four boutique corner buildings
        const hw = Math.floor((blockW - pad * 2 - gap) * 0.5);
        const hh = Math.floor((blockH - pad * 2 - gap) * 0.5);
        const coords = [
          [x0 + pad, y0 + pad],
          [x0 + pad + hw + gap, y0 + pad],
          [x0 + pad, y0 + pad + hh + gap],
          [x0 + pad + hw + gap, y0 + pad + hh + gap],
        ];
        for (const [cx, cy] of coords) {
          buildings.push({
            x: cx,
            y: cy,
            w: hw,
            h: hh,
            color: palette[Math.floor(rng() * palette.length)],
            stories: 1 + Math.floor(rng() * 3),
          });
        }
      }
    }
  }

  return {
    tileSize: TILE,
    w: WORLD_PX,
    h: WORLD_PX,
    roads,
    buildings,
    spawn: { x: 16 * TILE + 32, y: 32 * TILE + 32 },
  };
}

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawTitleOverlay(ctx, viewW, viewH) {
  ctx.save();

  // Warm atmospheric vignette so city shines through around the title card
  const bgGrad = ctx.createLinearGradient(0, 0, viewW, viewH);
  bgGrad.addColorStop(0, 'rgba(9, 20, 36, 0.72)');
  bgGrad.addColorStop(0.55, 'rgba(12, 24, 42, 0.36)');
  bgGrad.addColorStop(1, 'rgba(255, 118, 84, 0.16)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, viewW, viewH);

  // Center-left hero title card
  const cardW = 620;
  const cardH = 380;
  const cardX = (viewW - cardW) * 0.5;
  const cardY = (viewH - cardH) * 0.5 - 6;

  // Soft shadow
  ctx.fillStyle = 'rgba(5, 12, 22, 0.48)';
  roundRect(ctx, cardX + 8, cardY + 14, cardW, cardH, 20);
  ctx.fill();

  // Glass card body
  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  cardGrad.addColorStop(0, 'rgba(12, 27, 44, 0.90)');
  cardGrad.addColorStop(1, 'rgba(8, 19, 32, 0.94)');
  ctx.fillStyle = cardGrad;
  roundRect(ctx, cardX, cardY, cardW, cardH, 20);
  ctx.fill();

  ctx.strokeStyle = 'rgba(110, 224, 232, 0.42)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  const cx = viewW * 0.5;

  // Eyebrow badge
  const pillW = 248;
  const pillH = 26;
  const pillGrad = ctx.createLinearGradient(cx - pillW * 0.5, 0, cx + pillW * 0.5, 0);
  pillGrad.addColorStop(0, '#5be3d8');
  pillGrad.addColorStop(1, '#ffd166');
  ctx.fillStyle = pillGrad;
  roundRect(ctx, cx - pillW * 0.5, cardY + 28, pillW, pillH, 13);
  ctx.fill();

  ctx.fillStyle = '#091724';
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OPEN-WORLD COASTAL CRIME', cx, cardY + 41.5);

  // Main Title "MARLIN BAY"
  const titleGrad = ctx.createLinearGradient(0, cardY + 66, 0, cardY + 144);
  titleGrad.addColorStop(0, '#fff7cf');
  titleGrad.addColorStop(0.5, '#ffd166');
  titleGrad.addColorStop(1, '#ff7a59');

  ctx.font = '900 72px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.fillText(CITY_NAME.toUpperCase(), cx + 3, cardY + 114);
  ctx.fillStyle = titleGrad;
  ctx.fillText(CITY_NAME.toUpperCase(), cx, cardY + 110);

  // Accent bar under title
  const barGrad = ctx.createLinearGradient(cx - 120, 0, cx + 120, 0);
  barGrad.addColorStop(0, 'rgba(91, 227, 216, 0)');
  barGrad.addColorStop(0.5, '#5be3d8');
  barGrad.addColorStop(1, 'rgba(91, 227, 216, 0)');
  ctx.fillStyle = barGrad;
  ctx.fillRect(cx - 130, cardY + 150, 260, 3);

  // Story line
  ctx.fillStyle = '#d3e8f4';
  ctx.font = '500 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(
    `${PLAYER_NAME} rolled into ${CITY_NAME} with empty pockets and a fast getaway plan.`,
    cx,
    cardY + 178
  );

  // Controls box
  const ctrlW = cardW - 76;
  const ctrlH = 66;
  const ctrlX = cx - ctrlW * 0.5;
  const ctrlY = cardY + 206;
  ctx.fillStyle = 'rgba(6, 15, 26, 0.72)';
  roundRect(ctx, ctrlX, ctrlY, ctrlW, ctrlH, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(110, 224, 232, 0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = '#ffd166';
  ctx.fillText('WASD / ARROWS  Move & Drive     ·     E  Enter / Exit Car     ·     SPACE  Handbrake', cx, ctrlY + 22);
  ctx.fillStyle = '#a8cde0';
  ctx.fillText('F  Attack     ·     M  Missions     ·     P  Pause', cx, ctrlY + 46);

  // Primary CTA Button
  const btnW = 244;
  const btnH = 50;
  const btnX = cx - btnW * 0.5;
  const btnY = cardY + 296;

  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY);
  btnGrad.addColorStop(0, '#ffd166');
  btnGrad.addColorStop(1, '#ff924c');
  ctx.fillStyle = btnGrad;
  roundRect(ctx, btnX, btnY, btnW, btnH, 12);
  ctx.fill();

  ctx.fillStyle = '#101b29';
  ctx.font = '900 17px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('CLICK TO START', cx, btnY + btnH * 0.5 + 1);

  ctx.restore();
}

function drawMissionCompleteOverlay(ctx, viewW, viewH) {
  ctx.save();

  ctx.fillStyle = 'rgba(7, 16, 28, 0.56)';
  ctx.fillRect(0, 0, viewW, viewH);

  const cardW = 540;
  const cardH = 384;
  const cardX = (viewW - cardW) * 0.5;
  const cardY = (viewH - cardH) * 0.5;
  const cx = viewW * 0.5;

  // Drop shadow
  ctx.fillStyle = 'rgba(4, 10, 20, 0.54)';
  roundRect(ctx, cardX + 8, cardY + 14, cardW, cardH, 20);
  ctx.fill();

  // Card
  const grad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  grad.addColorStop(0, 'rgba(13, 30, 48, 0.94)');
  grad.addColorStop(1, 'rgba(8, 20, 34, 0.96)');
  ctx.fillStyle = grad;
  roundRect(ctx, cardX, cardY, cardW, cardH, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(94, 242, 168, 0.48)';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Eyebrow badge
  const pillW = 200;
  const pillGrad = ctx.createLinearGradient(cx - 100, 0, cx + 100, 0);
  pillGrad.addColorStop(0, '#4ce09e');
  pillGrad.addColorStop(1, '#ffd166');
  ctx.fillStyle = pillGrad;
  roundRect(ctx, cx - pillW * 0.5, cardY + 26, pillW, 26, 13);
  ctx.fill();

  ctx.fillStyle = '#072219';
  ctx.font = '900 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MISSION COMPLETE', cx, cardY + 39.5);

  // Mission title
  ctx.fillStyle = '#fff6dc';
  ctx.font = '900 40px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('FIRST DELIVERY', cx, cardY + 90);

  // Summary line
  ctx.fillStyle = '#c4dfed';
  ctx.font = '500 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(`Package dropped off at Marina Pier. Clean getaway, ${PLAYER_NAME}!`, cx, cardY + 126);

  // Reward highlight box
  const rewW = 240;
  const rewH = 54;
  ctx.fillStyle = 'rgba(46, 204, 134, 0.16)';
  roundRect(ctx, cx - rewW * 0.5, cardY + 152, rewW, rewH, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(94, 242, 168, 0.52)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#5ef2a8';
  ctx.font = '900 30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('+$200 REWARD', cx, cardY + 180);

  // Stats row
  const stats = [
    { label: 'TOTAL CASH', value: '$850', color: '#5ef2a8' },
    { label: 'SCORE', value: '2,150', color: '#ffffff' },
    { label: 'HEAT', value: 'CLEAR', color: '#5be3d8' },
  ];
  const boxW = 144;
  const boxH = 62;
  const gap = 14;
  const rowX = cx - (boxW * 3 + gap * 2) * 0.5;
  const rowY = cardY + 224;

  for (let i = 0; i < stats.length; i++) {
    const bx = rowX + i * (boxW + gap);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    roundRect(ctx, bx, rowY, boxW, boxH, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(130, 214, 232, 0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#8db3c9';
    ctx.font = '700 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(stats[i].label, bx + boxW * 0.5, rowY + 20);

    ctx.fillStyle = stats[i].color;
    ctx.font = '900 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(stats[i].value, bx + boxW * 0.5, rowY + 44);
  }

  // Continue CTA
  const btnW = 228;
  const btnH = 48;
  const btnX = cx - btnW * 0.5;
  const btnY = cardY + 308;
  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY);
  btnGrad.addColorStop(0, '#ffd166');
  btnGrad.addColorStop(1, '#ff9b54');
  ctx.fillStyle = btnGrad;
  roundRect(ctx, btnX, btnY, btnW, btnH, 12);
  ctx.fill();

  ctx.fillStyle = '#101b29';
  ctx.font = '900 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('CONTINUE', cx, btnY + btnH * 0.5 + 1);

  ctx.restore();
}

function buildStartScene(world) {
  // Show Ocean Boulevard + pastel downtown + palm beach at dawn
  const camX = 11 * TILE;
  const camY = 29 * TILE - 18;

  const cars = [
    { x: 12 * TILE + 18, y: 36 * TILE + 20, angle: 0, speed: 120, color: '#ef476f', model: 'sports' },
    { x: 18 * TILE + 12, y: 36 * TILE + 44, angle: Math.PI, speed: 110, color: '#2ec4b6', model: 'convertible' },
    { x: 24 * TILE + 30, y: 36 * TILE + 20, angle: 0, speed: 95, color: '#ffb703', model: 'sedan' },
    { x: 16 * TILE + 44, y: 33 * TILE + 40, angle: Math.PI * 0.5, speed: 90, color: '#3a86ff', model: 'coupe' },
    { x: 20 * TILE + 20, y: 31 * TILE + 10, angle: -Math.PI * 0.5, speed: 105, color: '#f4f7fa', model: 'suv' },
    { x: 14 * TILE + 50, y: 32 * TILE + 20, angle: 0, speed: 85, color: '#fb8500', model: 'sedan' },
    { x: 26 * TILE + 10, y: 32 * TILE + 44, angle: Math.PI, speed: 95, color: '#06d6a0', model: 'convertible' },
  ];

  const police = [
    { x: 20 * TILE + 44, y: 36 * TILE + 20, angle: 0, speed: 115, model: 'police', siren: true },
  ];

  const peds = [
    { x: 13 * TILE + 40, y: 37 * TILE + 12, angle: 0.2, speed: 30, color: '#ff6b6b' },
    { x: 15 * TILE + 18, y: 37 * TILE + 14, angle: Math.PI, speed: 25, color: '#4ecdc4' },
    { x: 19 * TILE + 10, y: 37 * TILE + 12, angle: 0.1, speed: 28, color: '#ffd166' },
    { x: 23 * TILE + 24, y: 37 * TILE + 14, angle: -2.8, speed: 22, color: '#ffffff' },
    { x: 16 * TILE - 5, y: 34 * TILE + 24, angle: Math.PI * 0.5, speed: 24, color: '#b388eb' },
    { x: 21 * TILE + 5, y: 33 * TILE + 40, angle: -Math.PI * 0.5, speed: 20, color: '#7ae582' },
    { x: 25 * TILE + 20, y: 37 * TILE + 44, angle: 1.4, speed: 12, color: '#f78c6b' },
  ];

  const state = {
    time: 4.2,
    lighting: 'dawn',
    world,
    player: { x: 16 * TILE + 32, y: 36 * TILE + 32, angle: 0, speed: 0, onFoot: true, health: 100, money: 0 },
    car: null,
    cars,
    peds,
    police,
    wanted: 0,
    mission: null,
    score: 0,
    gameOver: false,
    paused: false,
  };

  return { state, camera: { x: camX, y: camY } };
}

function buildPlayScene(world) {
  // Player tearing down Ocean Blvd in a cherry-red sports car with police chase, traffic, beach & mission target!
  const playerCar = {
    x: 18 * TILE + 18,
    y: 32 * TILE + 24,
    angle: -0.18,
    speed: 242,
    color: '#ef476f',
    model: 'sports',
  };

  const camX = Math.round(playerCar.x - VIEW_W * 0.45);
  const camY = Math.round(playerCar.y - VIEW_H * 0.42);

  const cars = [
    playerCar,
    { x: 21 * TILE + 30, y: 32 * TILE + 44, angle: Math.PI, speed: 120, color: '#2ec4b6', model: 'convertible' },
    { x: 24 * TILE + 40, y: 32 * TILE + 20, angle: 0, speed: 110, color: '#ffb703', model: 'sedan' },
    { x: 20 * TILE + 20, y: 29 * TILE + 20, angle: -Math.PI * 0.5, speed: 105, color: '#3a86ff', model: 'coupe' },
    { x: 20 * TILE + 44, y: 34 * TILE + 26, angle: Math.PI * 0.5, speed: 100, color: '#fb8500', model: 'suv' },
    { x: 16 * TILE + 44, y: 30 * TILE + 12, angle: Math.PI * 0.5, speed: 95, color: '#f4f7fa', model: 'sedan' },
    { x: 14 * TILE + 20, y: 36 * TILE + 20, angle: 0, speed: 130, color: '#06d6a0', model: 'convertible' },
    { x: 22 * TILE + 15, y: 36 * TILE + 44, angle: Math.PI, speed: 115, color: '#9b5de5', model: 'coupe' },
    { x: 26 * TILE + 12, y: 36 * TILE + 20, angle: 0, speed: 95, color: '#ffd166', model: 'sedan' },
  ];

  const police = [
    { x: 15 * TILE + 38, y: 32 * TILE + 28, angle: -0.04, speed: 230, model: 'police', siren: true },
    { x: 16 * TILE + 22, y: 34 * TILE + 18, angle: -Math.PI * 0.48, speed: 215, model: 'police', siren: true },
    { x: 24 * TILE + 42, y: 28 * TILE + 30, angle: Math.PI * 0.5, speed: 190, model: 'police', siren: true },
  ];

  const peds = [
    { x: 17 * TILE + 18, y: 32 * TILE - 5, angle: 0.15, speed: 28, color: '#ffd166' },
    { x: 19 * TILE + 14, y: 33 * TILE + 5, angle: -2.9, speed: 34, color: '#4ecdc4' },
    { x: 21 * TILE + 22, y: 32 * TILE - 5, angle: 0.1, speed: 26, color: '#ff6b6b' },
    { x: 22 * TILE + 40, y: 33 * TILE + 5, angle: Math.PI, speed: 30, color: '#ffffff' },
    { x: 16 * TILE - 5, y: 33 * TILE + 30, angle: Math.PI * 0.5, speed: 24, color: '#b388eb' },
    { x: 19 * TILE + 40, y: 37 * TILE + 12, angle: 0.15, speed: 25, color: '#7ae582' },
    { x: 23 * TILE + 10, y: 37 * TILE + 14, angle: Math.PI - 0.1, speed: 24, color: '#f78c6b' },
    { x: 15 * TILE + 24, y: 37 * TILE + 12, angle: 0.2, speed: 20, color: '#5aa9e6' },
    { x: 25 * TILE + 32, y: 33 * TILE + 5, angle: -0.2, speed: 22, color: '#ffd166' },
  ];

  const skids = [
    { x1: playerCar.x - 56, y1: playerCar.y + 12, x2: playerCar.x - 16, y2: playerCar.y + 8 },
    { x1: playerCar.x - 52, y1: playerCar.y - 4, x2: playerCar.x - 12, y2: playerCar.y - 8 },
  ];

  const state = {
    time: 12.6,
    lighting: 'day',
    world,
    player: {
      x: playerCar.x,
      y: playerCar.y,
      angle: playerCar.angle,
      speed: playerCar.speed,
      onFoot: false,
      health: 86,
      money: 650,
      weapon: 'pistol',
    },
    car: playerCar,
    cars,
    peds,
    police,
    skids,
    wanted: 2,
    mission: {
      id: 'delivery',
      name: 'First Delivery',
      stage: 1,
      objective: 'Deliver the package to the Marina Pier drop-off',
      target: { x: 24 * TILE + 32, y: 36 * TILE + 32 },
      done: false,
    },
    score: 1420,
    gameOver: false,
    paused: false,
  };

  return { state, camera: { x: camX, y: camY } };
}

function buildEndScene(world) {
  // Golden-hour sunset arrival at the Marina Pier drop-off with mission complete overlay
  const playerCar = {
    x: 22 * TILE + 32,
    y: 36 * TILE + 32,
    angle: 0.22,
    speed: 0,
    color: '#ef476f',
    model: 'sports',
  };

  const camX = Math.round(playerCar.x - VIEW_W * 0.5);
  const camY = Math.round(playerCar.y - VIEW_H * 0.62);

  const cars = [
    playerCar,
    { x: 18 * TILE + 20, y: 36 * TILE + 20, angle: 0, speed: 85, color: '#2ec4b6', model: 'convertible' },
    { x: 26 * TILE + 30, y: 36 * TILE + 44, angle: Math.PI, speed: 95, color: '#ffb703', model: 'sedan' },
    { x: 20 * TILE + 44, y: 33 * TILE + 20, angle: Math.PI * 0.5, speed: 90, color: '#3a86ff', model: 'coupe' },
    { x: 24 * TILE + 20, y: 32 * TILE + 20, angle: 0, speed: 100, color: '#f4f7fa', model: 'suv' },
  ];

  const peds = [
    { x: 21 * TILE + 40, y: 37 * TILE + 15, angle: 0.2, speed: 18, color: '#ffd166' },
    { x: 23 * TILE + 18, y: 37 * TILE + 14, angle: 2.9, speed: 16, color: '#4ecdc4' },
    { x: 24 * TILE + 14, y: 37 * TILE + 16, angle: -2.6, speed: 20, color: '#ff6b6b' },
    { x: 19 * TILE + 28, y: 37 * TILE + 16, angle: 0.4, speed: 22, color: '#ffffff' },
  ];

  const state = {
    time: 24.8,
    lighting: 'dusk',
    world,
    player: {
      x: playerCar.x + 28,
      y: playerCar.y + 16,
      angle: -0.4,
      speed: 0,
      onFoot: true,
      health: 92,
      money: 850,
      weapon: 'pistol',
    },
    car: null,
    cars,
    peds,
    police: [],
    wanted: 0,
    mission: {
      id: 'delivery',
      name: 'First Delivery',
      stage: 2,
      objective: 'Delivery complete at Marina Pier',
      target: { x: 22 * TILE + 32, y: 36 * TILE + 32 },
      done: true,
    },
    score: 2150,
    gameOver: false,
    paused: false,
  };

  return { state, camera: { x: camX, y: camY } };
}

export function renderShot(ctx, state, shot) {
  if (!ctx) return;

  // Hide any active DOM overlay so canvas screenshots never double-render UI
  hideScreens();

  const viewW = ctx.canvas?.width || VIEW_W;
  const viewH = ctx.canvas?.height || VIEW_H;
  const world = buildShotWorld();
  const kind = String(shot || 'play').toLowerCase();

  if (kind === 'start') {
    const { state: shotState, camera } = buildStartScene(world);
    render(ctx, shotState, camera);
    drawTitleOverlay(ctx, viewW, viewH);
  } else if (kind === 'end') {
    const { state: shotState, camera } = buildEndScene(world);
    render(ctx, shotState, camera);
    drawHUD(ctx, shotState);
    drawMinimap(ctx, shotState);
    drawMissionCompleteOverlay(ctx, viewW, viewH);
  } else {
    const { state: shotState, camera } = buildPlayScene(world);
    render(ctx, shotState, camera);
    drawHUD(ctx, shotState);
    drawMinimap(ctx, shotState);
  }

  if (typeof window !== 'undefined') {
    window.__shotReady = true;
  }
}
