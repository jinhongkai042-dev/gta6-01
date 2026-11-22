import { CITY_NAME, KEYS, PLAYER_NAME, VIEW_H, VIEW_W, WORLD_PX } from './config.js';
import { buildWorld } from './world.js';
import { updatePlayer, tryEnterCar, exitCar } from './drive.js';
import { spawnTraffic, spawnPeds, updateTraffic, updatePeds } from './traffic.js';
import { MISSIONS, startMission, updateMission } from './missions.js';
import { addWanted, decayWanted, updatePolice } from './police.js';
import { attack, updateCombat } from './combat.js';
import { loadGame, saveGame } from './save.js';
import { initAudio, setEngine, sfx } from './audio.js';
import { render, drawHUD, drawMinimap } from './render.js';
import { hideScreens, showScreen } from './ui.js';
import { renderShot } from './shots.js';

const canvas = document.querySelector('canvas');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');
const keys = new Set();
const pressed = new Set();

function createState(saved) {
  const world = buildWorld();
  const completedMissions = saved?.completedMissions ?? [];
  const armed = completedMissions.includes(2);
  const state = {
    city: CITY_NAME, time: 0, world,
    player: {
      ...world.spawn, name: PLAYER_NAME, angle: world.spawn.angle ?? 0, speed: 0,
      onFoot: true, health: 100, money: saved?.money ?? 0,
      weapon: armed ? 'pistol' : 'fists', ammo: armed ? 12 : 0,
    },
    car: null, cars: spawnTraffic(world, 40), peds: spawnPeds(world, 55),
    police: [], wanted: 0, pendingWanted: 0, events: [], bullets: [],
    mission: {
      id: 0, name: 'Free roam', stage: 0, done: true,
      target: { x: world.spawn.x, y: world.spawn.y }, objective: 'All jobs complete. Explore Marlin Bay.',
    },
    completedMissions,
    score: MISSIONS.reduce((sum, job) => sum + (completedMissions.includes(job.id) ? job.reward : 0), 0),
    bestScore: saved?.bestScore ?? 0, gameOver: false, paused: false,
  };
  const next = MISSIONS.find(job => !completedMissions.includes(job.id));
  if (next) startMission(state, next.id);
  return state;
}

const shot = new URLSearchParams(location.search).get('shot');
const shotMode = ['start', 'play', 'end'].includes(shot);
let state = createState(shotMode ? null : loadGame());
let screen = null;
let previousFrame;

function draw() {
  const camera = {
    x: Math.max(0, Math.min(WORLD_PX - VIEW_W, state.player.x - VIEW_W / 2)),
    y: Math.max(0, Math.min(WORLD_PX - VIEW_H, state.player.y - VIEW_H / 2)),
  };
  render(ctx, state, camera);
  drawMinimap(ctx, state);
  drawHUD(ctx, state);
}

function saveProgress() {
  state.bestScore = Math.max(state.bestScore, state.score);
  saveGame(state);
}

function leaveMenu() {
  screen = null;
  state.paused = false;
  keys.clear();
  pressed.clear();
  previousFrame = undefined;
  hideScreens();
}

function restart() {
  state = createState(loadGame());
  leaveMenu();
}

function chooseMission(id) {
  if (state.completedMissions.includes(Number(id))) {
    openMenu('missions');
    return;
  }
  startMission(state, id);
  leaveMenu();
}

function nextJob() {
  const next = MISSIONS.find(entry => !state.completedMissions.includes(entry.id));
  if (next) startMission(state, next.id);
  leaveMenu();
}

function openMenu(name) {
  screen = name;
  state.paused = true;
  keys.clear();
  pressed.clear();
  setEngine(false);
  const job = MISSIONS.find(entry => entry.id === state.mission.id);
  const data = {
    mission: state.mission, score: state.score, money: state.player.money,
    onResume: leaveMenu, onRestart: restart,
  };
  if (name === 'title') {
    data.onStart = leaveMenu;
    data.story = job?.story ?? state.mission.objective;
    data.startLabel = state.completedMissions.length ? 'Return to Marlin Bay' : 'Start driving';
  } else if (name === 'missions') {
    data.missions = MISSIONS.map(entry => ({
      ...entry, description: entry.story, done: state.completedMissions.includes(entry.id),
    }));
    data.onSelect = chooseMission;
  } else if (name === 'mission') {
    data.summary = state.mission.objective;
    data.reward = job.reward;
    data.onContinue = nextJob;
    data.continueLabel = state.completedMissions.length === MISSIONS.length ? 'Free roam' : 'Next job';
  }
  showScreen(name, data);
}

function applyWanted() {
  if (state.pendingWanted) {
    addWanted(state, state.pendingWanted);
    state.pendingWanted = 0;
  }
}

function flushEvents() {
  for (const event of state.events) {
    if (event === 'mission-done') {
      sfx('mission');
      saveProgress();
      openMenu('mission');
    } else {
      sfx(event);
    }
  }
  state.events.length = 0;
}

function tick(dt) {
  state.time += dt;
  if (KEYS.enter.some(code => pressed.has(code))) {
    const changed = state.player.onFoot ? tryEnterCar(state) : exitCar(state);
    if (changed) sfx('click');
  }
  updatePlayer(state, keys, dt);
  updateTraffic(state, dt);
  updatePeds(state, dt);
  applyWanted();
  updateMission(state, dt);
  applyWanted();
  updatePolice(state, dt);
  decayWanted(state, dt);
  if (KEYS.attack.some(code => pressed.has(code))) attack(state);
  updateCombat(state, dt);
  applyWanted();
  pressed.clear();
  flushEvents();
  if (state.player.health <= 0) {
    state.gameOver = true;
    saveProgress();
    openMenu('gameover');
  }
  setEngine(!state.paused && !state.player.onFoot, state.player.speed);
}

function frame(now) {
  const dt = previousFrame === undefined ? 0 : Math.min(0.05, Math.max(0, (now - previousFrame) / 1000));
  previousFrame = now;
  if (!state.paused && dt > 0) tick(dt);
  if (!state.paused) draw();
  requestAnimationFrame(frame);
}

const mapped = new Set([...Object.values(KEYS).flat(), 'ShiftLeft', 'ShiftRight', 'Enter', 'Escape', 'Digit1', 'Digit2', 'Digit3']);

function keyDown(event) {
  const { code } = event;
  if (!mapped.has(code) || event.altKey || event.ctrlKey || event.metaKey) return;
  if (!event.repeat) initAudio();
  // Native keyboard activation of a focused menu button goes through its click handler.
  if (screen && (code === 'Enter' || code === 'Space') && event.target.closest?.('button')) return;
  event.preventDefault();
  if (event.repeat) return;
  if (screen) {
    if (screen === 'gameover' && code === 'Enter') restart();
    else if (screen === 'title' && (code === 'Enter' || code === 'Space')) leaveMenu();
    else if (screen === 'pause' && (KEYS.pause.includes(code) || code === 'Escape' || code === 'Enter')) leaveMenu();
    else if (screen === 'missions') {
      if (/^Digit[123]$/.test(code)) chooseMission(Number(code.slice(-1)));
      else if (KEYS.missions.includes(code) || code === 'Escape') leaveMenu();
    } else if (screen === 'mission' && code === 'Enter') nextJob();
    else if (screen === 'mission' && KEYS.missions.includes(code)) openMenu('missions');
    return;
  }
  if (KEYS.pause.includes(code) || code === 'Escape') openMenu('pause');
  else if (KEYS.missions.includes(code)) openMenu('missions');
  else {
    keys.add(code);
    pressed.add(code);
  }
}

if (shotMode) {
  hideScreens();
  renderShot(ctx, state, shot);
} else {
  draw();
  openMenu('title');
  window.addEventListener('pointerdown', initAudio, { capture: true });
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => {
    if (!screen) openMenu('pause');
  });
  window.addEventListener('pagehide', saveProgress);
  requestAnimationFrame(frame);
}
