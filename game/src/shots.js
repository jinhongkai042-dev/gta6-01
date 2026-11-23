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
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function laneY(roadRowTile, eastbound) {
  return roadRowTile * TILE + (eastbound ? 46 : 18);
}

function laneX(roadColTile, northbound) {
  return roadColTile * TILE + (northbound ? 46 : 18);
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

function buildSeededWorld(existingWorld) {
  if (existingWorld && Array.isArray(existingWorld.buildings) && existingWorld.buildings.length > 0) {
    return existingWorld;
  }
  const rng = createRng(SEED);
  const buildings = [];
  const palette = ['#f08070', '#5ec9b5', '#f3c15f', '#f4ead6', '#f28cab', '#6eb8ea', '#f4a578', '#82d4aa', '#baa2dc', '#edf2f4'];

  for (let br = 0; br < 36; br += ROAD_EVERY) {
    for (let bc = 0; bc < WORLD_TILES - 1; bc += ROAD_EVERY) {
      const bx0 = (bc + 1) * TILE + 10;
      const by0 = (br + 1) * TILE + 10;
      const bw = (ROAD_EVERY - 1) * TILE - 20;
      const bh = (ROAD_EVERY - 1) * TILE - 20;
      const roll = rng();
      if (roll < 0.14) continue; // coastal park plaza
      const pickColor = () => palette[Math.floor(rng() * palette.length)];
      if (roll < 0.58) {
        if (rng() > 0.5) {
          const h1 = Math.floor(bh * (0.44 + rng() * 0.14));
          buildings.push({ x: bx0, y: by0, w: bw, h: h1 - 6, color: pickColor() });
          buildings.push({ x: bx0, y: by0 + h1 + 6, w: bw, h: bh - h1 - 6, color: pickColor() });
        } else {
          const w1 = Math.floor(bw * (0.44 + rng() * 0.14));
          buildings.push({ x: bx0, y: by0, w: w1 - 6, h: bh, color: pickColor() });
          buildings.push({ x: bx0 + w1 + 6, y: by0, w: bw - w1 - 6, h: bh, color: pickColor() });
        }
      } else {
        buildings.push({ x: bx0 + 4, y: by0 + 4, w: bw - 8, h: bh - 8, color: pickColor() });
      }
    }
  }

  return {
    tileSize: TILE,
    w: WORLD_PX,
    h: WORLD_PX,
    roads: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36],
    buildings,
    spawn: { x: 1024 + 32, y: 2048 + 46 },
  };
}

function buildAmbientPeds(seedOffset) {
  const rng = createRng(SEED + seedOffset);
  const shirts = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#ffffff', '#ff9f1c', '#a06cd5', '#2ec4b6', '#ff8fab'];
  const peds = [];

  // Strollers along Ocean Drive boardwalk & golden sand beach
  for (let i = 0; i < 20; i++) {
    const x = 660 + i * 72 + (rng() - 0.5) * 28;
    const onSand = i % 3 === 0;
    const y = onSand ? 2412 + rng() * 44 : 2376 + (rng() - 0.5) * 10;
    peds.push({
      x,
      y,
      angle: rng() > 0.5 ? 0.08 : Math.PI - 0.08,
      speed: onSand ? 0 : 28,
      color: shirts[i % shirts.length],
    });
  }

  // Sidewalk pedestrians along horizontal avenues 28, 32, 36
  for (const row of [28, 32, 36]) {
    for (let i = 0; i < 10; i++) {
      const colBlock = 1 + (i % 8) * 4;
      const x = colBlock * TILE + 24 + rng() * 140;
      const y = row * TILE + (i % 2 === 0 ? -7 : TILE + 7);
      peds.push({
        x,
        y,
        angle: i % 2 === 0 ? 0 : Math.PI,
        speed: 32,
        color: shirts[(i + row) % shirts.length],
      });
    }
  }
  return peds;
}

function buildStartScene(baseState) {
  const world = buildSeededWorld(baseState?.world);
  const cars = [
    { x: 960, y: laneY(36, true), angle: 0, speed: 120, color: '#ff6b6b', model: 'convertible' },
    { x: 1210, y: laneY(36, true), angle: 0, speed: 135, color: '#ffd166', model: 'taxi' },
    { x: 1470, y: laneY(36, false), angle: Math.PI, speed: 130, color: '#2ec4b6', model: 'coupe' },
    { x: 1710, y: laneY(36, false), angle: Math.PI, speed: 115, color: '#f1faee', model: 'sedan' },
    { x: 1110, y: laneY(32, true), angle: 0, speed: 145, color: '#3a86ff', model: 'sport' },
    { x: 1420, y: laneY(32, false), angle: Math.PI, speed: 125, color: '#f77f00', model: 'coupe' },
    { x: 1650, y: laneY(32, true), angle: 0, speed: 110, color: '#f15bb5', model: 'convertible' },
    { x: laneX(16, true), y: 2170, angle: -Math.PI / 2, speed: 105, color: '#9b5de5', model: 'sedan' },
    { x: laneX(20, false), y: 1960, angle: Math.PI / 2, speed: 120, color: '#00b4d8', model: 'coupe' },
    { x: laneX(24, true), y: 2210, angle: -Math.PI / 2, speed: 115, color: '#ffd166', model: 'taxi' },
  ];

  const police = [
    { x: laneX(24, false), y: 1980, angle: Math.PI / 2, speed: 95 },
  ];

  const state = {
    time: 4.2,
    world,
    player: { x: 1320, y: 2376, angle: 0, speed: 0, onFoot: true, health: 100, money: 0, weapon: 'fists' },
    car: null,
    cars,
    peds: buildAmbientPeds(11),
    police,
    wanted: 0,
    mission: null,
    score: 0,
    gameOver: false,
    paused: false,
  };

  // Frame Ocean Drive, coastal hotels, pier, and turquoise surf
  const camera = { x: 740, y: 1852 };
  return { state, camera };
}

function buildPlayScene(baseState) {
  const world = buildSeededWorld(baseState?.world);

  // Rex tearing eastbound down Marlin Boulevard (row 32) in a blazing crimson GT
  const playerCar = {
    x: 1310,
    y: laneY(32, true),
    angle: 0.04,
    speed: 300,
    color: '#e63946',
    model: 'Marlin GT',
  };

  const courierCar = {
    x: 1610,
    y: laneY(32, true),
    angle: 0,
    speed: 255,
    color: '#ffd166',
    model: 'sport',
    isCourier: true,
  };

  const cars = [
    courierCar,
    { x: 1465, y: laneY(32, false), angle: Math.PI, speed: 150, color: '#00b4d8', model: 'coupe' },
    { x: 1120, y: laneY(32, false), angle: Math.PI, speed: 145, color: '#f1faee', model: 'sedan' },
    { x: 970, y: laneY(32, true), angle: 0, speed: 130, color: '#2ec4b6', model: 'convertible' },
    { x: 1190, y: laneY(36, true), angle: 0, speed: 135, color: '#f77f00', model: 'coupe' },
    { x: 1490, y: laneY(36, false), angle: Math.PI, speed: 120, color: '#f15bb5', model: 'convertible' },
    { x: 1680, y: laneY(36, true), angle: 0, speed: 140, color: '#ffd166', model: 'taxi' },
    { x: 1080, y: laneY(28, true), angle: 0, speed: 135, color: '#9b5de5', model: 'sedan' },
    { x: 1540, y: laneY(28, false), angle: Math.PI, speed: 140, color: '#3a86ff', model: 'sport' },
    { x: laneX(16, false), y: 2175, angle: Math.PI / 2, speed: 115, color: '#ff6b6b', model: 'coupe' },
    { x: laneX(20, true), y: 2210, angle: -Math.PI / 2, speed: 125, color: '#ffd166', model: 'taxi' },
    { x: laneX(24, true), y: 1930, angle: -Math.PI / 2, speed: 130, color: '#2ec4b6', model: 'sedan' },
  ];

  // Two Marlin Bay PD cruisers actively chasing with sirens flashing
  const police = [
    { x: 1148, y: laneY(32, true) - 3, angle: 0.03, speed: 295 },
    { x: laneX(20, false), y: 1968, angle: Math.PI / 2 - 0.12, speed: 240 },
    { x: 960, y: laneY(36, true), angle: 0, speed: 210 },
  ];

  const state = {
    time: 12.42,
    world,
    player: {
      x: playerCar.x,
      y: playerCar.y,
      angle: playerCar.angle,
      speed: playerCar.speed,
      onFoot: false,
      health: 86,
      money: 1450,
      weapon: 'pistol',
    },
    car: playerCar,
    cars,
    peds: buildAmbientPeds(29),
    police,
    wanted: 3,
    mission: {
      id: 2,
      name: 'Tail the Courier',
      stage: 1,
      objective: 'Keep the gold courier car in sight — 14s remaining',
      target: { x: courierCar.x, y: courierCar.y },
      done: false,
    },
    score: 1850,
    gameOver: false,
    paused: false,
  };

  // Show action-packed downtown boulevard + oceanfront beach strip in the lower frame
  const camera = { x: 740, y: 1790 };
  return { state, camera };
}

function buildEndScene(baseState) {
  const world = buildSeededWorld(baseState?.world);

  const playerCar = {
    x: 1410,
    y: laneY(36, true),
    angle: 0.14,
    speed: 0,
    color: '#e63946',
    model: 'Marlin GT',
  };

  const cars = [
    { x: 1090, y: laneY(36, false), angle: Math.PI, speed: 120, color: '#2ec4b6', model: 'convertible' },
    { x: 1650, y: laneY(36, true), angle: 0, speed: 110, color: '#ffd166', model: 'taxi' },
    { x: 1240, y: laneY(32, true), angle: 0, speed: 130, color: '#3a86ff', model: 'coupe' },
    { x: 1520, y: laneY(32, false), angle: Math.PI, speed: 125, color: '#f77f00', model: 'sedan' },
    { x: laneX(20, true), y: 2180, angle: -Math.PI / 2, speed: 115, color: '#f15bb5', model: 'convertible' },
  ];

  const state = {
    time: 24.6,
    world,
    player: {
      x: playerCar.x,
      y: playerCar.y,
      angle: playerCar.angle,
      speed: 0,
      onFoot: false,
      health: 94,
      money: 2150,
      weapon: 'pistol',
    },
    car: playerCar,
    cars,
    peds: buildAmbientPeds(53),
    police: [],
    wanted: 0,
    mission: {
      id: 3,
      name: 'Lose the Cops',
      stage: 2,
      objective: 'Heat cleared',
      target: { x: 1410, y: 2350 },
      done: true,
    },
    score: 3400,
    gameOver: false,
    paused: false,
  };

  const camera = { x: 820, y: 1852 };
  return { state, camera };
}

function drawDawnOverlay(ctx, viewW, viewH) {
  ctx.save();

  // Warm coastal dawn sky glaze (peach-gold from top-right, cool violet-teal shadow bottom-left)
  const dawn = ctx.createLinearGradient(viewW * 0.85, 0, viewW * 0.15, viewH);
  dawn.addColorStop(0, 'rgba(255, 166, 98, 0.36)');
  dawn.addColorStop(0.45, 'rgba(255, 118, 128, 0.16)');
  dawn.addColorStop(1, 'rgba(11, 32, 56, 0.42)');
  ctx.fillStyle = dawn;
  ctx.fillRect(0, 0, viewW, viewH);

  // Soft vignette framing center title card
  const vig = ctx.createRadialGradient(viewW * 0.5, viewH * 0.46, 180, viewW * 0.5, viewH * 0.5, viewW * 0.68);
  vig.addColorStop(0, 'rgba(8, 22, 38, 0.08)');
  vig.addColorStop(1, 'rgba(5, 15, 28, 0.64)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, viewW, viewH);

  // Center frosted title card
  const cw = 640;
  const ch = 368;
  const cx = (viewW - cw) * 0.5;
  const cy = (viewH - ch) * 0.5 - 10;

  ctx.fillStyle = 'rgba(9, 22, 38, 0.84)';
  roundRectPath(ctx, cx, cy, cw, ch, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.48)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Top sunset accent bar
  const barGrad = ctx.createLinearGradient(cx, 0, cx + cw, 0);
  barGrad.addColorStop(0, '#36d6cf');
  barGrad.addColorStop(0.5, '#ffd166');
  barGrad.addColorStop(1, '#ff6b6b');
  ctx.fillStyle = barGrad;
  roundRectPath(ctx, cx + 2, cy + 2, cw - 4, 5, 3);
  ctx.fill();

  // Kicker pill
  const kw = 248;
  ctx.fillStyle = 'rgba(54, 214, 207, 0.16)';
  roundRectPath(ctx, viewW * 0.5 - kw * 0.5, cy + 26, kw, 26, 13);
  ctx.fill();
  ctx.strokeStyle = 'rgba(54, 214, 207, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = '#8af5ee';
  ctx.font = '800 11px "Avenir Next", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('COASTAL OPEN-WORLD CRIME', viewW * 0.5, cy + 39);

  // Hero MARLIN BAY title
  const titleGrad = ctx.createLinearGradient(0, cy + 68, 0, cy + 144);
  titleGrad.addColorStop(0, '#fff7dc');
  titleGrad.addColorStop(0.5, '#ffd166');
  titleGrad.addColorStop(1, '#ff7854');

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.48)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = titleGrad;
  ctx.font = '900 72px "Avenir Next", "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(CITY_NAME.toUpperCase(), viewW * 0.5, cy + 66);
  ctx.restore();

  // One-line story hook
  ctx.fillStyle = '#d3e6f0';
  ctx.font = '500 16px "Avenir Next", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `${PLAYER_NAME} hit the sunlit strip with empty pockets — run jobs, outrun the heat, own the bay.`,
    viewW * 0.5,
    cy + 158
  );

  // Compact controls bar inside title card
  const ctrlW = 556;
  const ctrlX = viewW * 0.5 - ctrlW * 0.5;
  const ctrlY = cy + 194;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  roundRectPath(ctx, ctrlX, ctrlY, ctrlW, 46, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#eaf6fb';
  ctx.font = '700 13px "Avenir Next", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    'WASD Drive   ·   E Enter/Exit Car   ·   F Attack   ·   Space Drift   ·   P Pause   ·   M Missions',
    viewW * 0.5,
    ctrlY + 23
  );

  // Glowing CLICK TO START button
  const btnW = 264;
  const btnH = 54;
  const btnX = viewW * 0.5 - btnW * 0.5;
  const btnY = cy + 266;
  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY + btnH);
  btnGrad.addColorStop(0, '#ff7a59');
  btnGrad.addColorStop(1, '#ffc14d');

  ctx.save();
  ctx.shadowColor = 'rgba(255, 130, 85, 0.45)';
  ctx.shadowBlur = 22;
  ctx.fillStyle = btnGrad;
  roundRectPath(ctx, btnX, btnY, btnW, btnH, 12);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#0e1928';
  ctx.font = '900 18px "Avenir Next", system-ui, sans-serif';
  ctx.fillText('▶  CLICK TO START', viewW * 0.5, btnY + btnH * 0.5 + 1);

  ctx.restore();
}

function drawMissionCompleteOverlay(ctx, state, viewW, viewH) {
  ctx.save();

  // Golden hour warm finish wash + soft focus vignette
  const wash = ctx.createLinearGradient(0, 0, viewW, viewH);
  wash.addColorStop(0, 'rgba(255, 198, 92, 0.16)');
  wash.addColorStop(1, 'rgba(8, 22, 38, 0.56)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, viewW, viewH);

  // Celebratory card
  const cw = 580;
  const ch = 392;
  const cx = (viewW - cw) * 0.5;
  const cy = (viewH - ch) * 0.5;

  ctx.fillStyle = 'rgba(9, 23, 38, 0.9)';
  roundRectPath(ctx, cx, cy, cw, ch, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(46, 230, 138, 0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Top emerald-gold bar
  const barGrad = ctx.createLinearGradient(cx, 0, cx + cw, 0);
  barGrad.addColorStop(0, '#2ee68a');
  barGrad.addColorStop(0.5, '#ffd166');
  barGrad.addColorStop(1, '#36d6cf');
  ctx.fillStyle = barGrad;
  roundRectPath(ctx, cx + 2, cy + 2, cw - 4, 5, 3);
  ctx.fill();

  // Kicker badge
  ctx.fillStyle = 'rgba(255, 209, 102, 0.16)';
  roundRectPath(ctx, viewW * 0.5 - 92, cy + 26, 184, 26, 13);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.5)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = '#ffe082';
  ctx.font = '800 11px "Avenir Next", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('JOB CLEARED · MARLIN BAY', viewW * 0.5, cy + 39);

  // Headline
  const hGrad = ctx.createLinearGradient(0, cy + 66, 0, cy + 120);
  hGrad.addColorStop(0, '#f3fff8');
  hGrad.addColorStop(0.5, '#6df5b2');
  hGrad.addColorStop(1, '#2ec4b6');
  ctx.fillStyle = hGrad;
  ctx.font = '900 46px "Avenir Next", system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText('MISSION COMPLETE', viewW * 0.5, cy + 68);

  // Mission subtitle
  ctx.fillStyle = '#d3e7f2';
  ctx.font = '700 18px "Avenir Next", system-ui, sans-serif';
  ctx.fillText(`"${state.mission?.name || 'Lose the Cops'}" — Heat Escaped Cleanly`, viewW * 0.5, cy + 126);

  // Big gleaming reward pill
  const rw = 216;
  const rh = 52;
  ctx.fillStyle = 'rgba(46, 230, 138, 0.16)';
  roundRectPath(ctx, viewW * 0.5 - rw * 0.5, cy + 164, rw, rh, 26);
  ctx.fill();
  ctx.strokeStyle = 'rgba(46, 230, 138, 0.6)';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.fillStyle = '#5ef5ab';
  ctx.font = '900 32px "Avenir Next", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('+$500', viewW * 0.5, cy + 190);

  // 3 Stat Tiles
  const stats = [
    ['BANK', '$' + (state.player?.money ?? 2150).toLocaleString('en-US'), '#4ef0a3'],
    ['SCORE', (state.score ?? 3400).toLocaleString('en-US'), '#ffd166'],
    ['HEAT', 'CLEARED', '#79e6e0'],
  ];
  const tileW = 152;
  const tileH = 62;
  const gap = 16;
  const rowX = viewW * 0.5 - (tileW * 3 + gap * 2) * 0.5;
  const rowY = cy + 234;

  for (let i = 0; i < stats.length; i++) {
    const tx = rowX + i * (tileW + gap);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    roundRectPath(ctx, tx, rowY, tileW, tileH, 11);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#8eb3c7';
    ctx.font = '700 10px "Avenir Next", system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(stats[i][0], tx + tileW * 0.5, rowY + 11);

    ctx.fillStyle = stats[i][2];
    ctx.font = '900 22px "Avenir Next", system-ui, sans-serif';
    ctx.fillText(stats[i][1], tx + tileW * 0.5, rowY + 28);
  }

  // Continue CTA button
  const btnW = 224;
  const btnH = 48;
  const btnX = viewW * 0.5 - btnW * 0.5;
  const btnY = cy + 318;
  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY + btnH);
  btnGrad.addColorStop(0, '#2ee68a');
  btnGrad.addColorStop(1, '#36d6cf');
  ctx.fillStyle = btnGrad;
  roundRectPath(ctx, btnX, btnY, btnW, btnH, 11);
  ctx.fill();

  ctx.fillStyle = '#072126';
  ctx.font = '900 16px "Avenir Next", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('CONTINUE', viewW * 0.5, btnY + btnH * 0.5 + 1);

  ctx.restore();
}

export function renderShot(ctx, state, shot) {
  if (!ctx) return;
  const viewW = ctx.canvas?.width || VIEW_W;
  const viewH = ctx.canvas?.height || VIEW_H;

  // Ensure DOM overlays do not collide with deterministic canvas screenshot rendering
  hideScreens();

  const key = String(shot || 'play').toLowerCase();

  if (key === 'start') {
    const { state: s, camera } = buildStartScene(state);
    render(ctx, s, camera);
    drawDawnOverlay(ctx, viewW, viewH);
  } else if (key === 'end') {
    const { state: s, camera } = buildEndScene(state);
    render(ctx, s, camera);
    drawHUD(ctx, s);
    drawMinimap(ctx, s);
    drawMissionCompleteOverlay(ctx, s, viewW, viewH);
  } else {
    const { state: s, camera } = buildPlayScene(state);
    render(ctx, s, camera);
    drawHUD(ctx, s);
    drawMinimap(ctx, s);
  }

  if (typeof window !== 'undefined') {
    window.__shotReady = true;
  }
}
