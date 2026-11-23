import { CITY_NAME, KEYS, PLAYER_NAME, VIEW_H, VIEW_W, WORLD_PX } from './config.js';
import { buildWorld } from './world.js';
import { exitCar, tryEnterCar, updatePlayer } from './drive.js';
import { spawnPeds, spawnTraffic, updatePeds, updateTraffic } from './traffic.js';
import { MISSIONS, startMission, updateMission } from './missions.js';
import { addWanted, decayWanted, updatePolice } from './police.js';
import { attack, updateCombat } from './combat.js';
import { loadGame, saveGame } from './save.js';
import { initAudio, setEngine, sfx } from './audio.js';
import { drawHUD, drawMinimap, render } from './render.js';
import { hideScreens, showScreen } from './ui.js';
import { renderShot } from './shots.js';

const canvas = document.querySelector('canvas');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');

function newShift(saved) {
  const world = buildWorld();
  const completedMissions = saved?.completedMissions.slice() ?? [];
  const armed = completedMissions.includes(2);
  const state = {
    time: 0, world,
    player: {
      ...world.spawn, angle: world.spawn.angle ?? 0, speed: 0, onFoot: true, health: 100,
      money: saved?.money ?? 0, weapon: armed ? 'pistol' : 'fists', ammo: armed ? 12 : 0,
    },
    car: null, cars: spawnTraffic(world, 40), peds: spawnPeds(world, 56),
    police: [], wanted: 0, pendingWanted: 0, events: [], bullets: [],
    completedMissions, bestScore: saved?.bestScore ?? 0,
    score: MISSIONS.reduce((sum, job) => sum + (completedMissions.includes(job.id) ? job.reward : 0), 0),
    gameOver: false, paused: false,
    mission: {
      id: 0, name: 'Off duty', stage: 0, done: true,
      objective: 'All three jobs are paid. Explore Marlin Bay.', target: { ...world.spawn },
    },
  };
  const next = MISSIONS.find(job => !completedMissions.includes(job.id));
  if (next) startMission(state, next.id);
  return state;
}

function play() {
  const saved = loadGame();
  let state = newShift(saved);
  let screen = 'title';
  let previousFrame;
  const held = new Set();
  const presses = new Set();
  const keyMap = new Map(Object.entries(KEYS).flatMap(([action, codes]) => codes.map(code => [code, action])));

  function resetInput() {
    held.clear();
    presses.clear();
  }

  function modal(name, data) {
    screen = name;
    state.paused = true;
    resetInput();
    setEngine(false);
    showScreen(name === 'dispatch' ? 'mission' : name, data);
  }

  function resume() {
    initAudio();
    sfx('click');
    screen = null;
    state.paused = false;
    resetInput();
    previousFrame = undefined;
    hideScreens();
  }

  function restart(checkpoint) {
    state = newShift(checkpoint);
    resume();
    saveGame(state);
  }

  function pause() {
    modal('pause', {
      ...state, missionName: state.mission.name, objective: state.mission.objective,
      money: state.player.money, onResume: resume, onRestart: () => restart(loadGame()),
    });
  }

  function dispatch(id = state.mission.id) {
    const jobs = MISSIONS.filter(job => !state.completedMissions.includes(job.id));
    if (!jobs.length) {
      receipt();
      return;
    }
    const job = jobs.find(job => job.id === id) ?? jobs[0];
    const active = job.id === state.mission.id && !state.mission.done;
    const objective = active ? state.mission.objective : job.steps[0].text;
    modal('dispatch', {
      mode: 'briefing', name: job.name, heading: job.name, reward: job.reward,
      message: `${job.story} ${objective}`, money: state.player.money, score: state.score,
      buttonLabel: active ? 'Back to the job' : 'Take this job',
      onContinue() { startMission(state, job.id); resume(); },
      onNextMission: jobs.length > 1 ? () => dispatch(jobs[(jobs.indexOf(job) + 1) % jobs.length].id) : undefined,
    });
    // The dispatch board shares the frontend's mission card and action buttons.
    const card = document.querySelector('.mb-card--mission');
    if (card) {
      const heading = card.querySelector('h2');
      const kicker = card.querySelector('.mb-kicker');
      const fee = card.querySelector('.mb-reward');
      if (heading) heading.textContent = job.name;
      if (kicker) kicker.textContent = active ? 'Current assignment' : 'Dispatch board';
      if (fee) fee.textContent = `Contract fee · $${job.reward}`;
    }
  }

  function receipt() {
    const job = MISSIONS.find(item => item.id === state.mission.id);
    const next = MISSIONS.find(item => !state.completedMissions.includes(item.id));
    modal('mission', {
      name: job?.name ?? 'Marlin Bay', reward: job?.reward ?? state.player.money,
      money: state.player.money, score: state.score,
      message: next ? `${job.name} is paid. Dispatch has another job for Rex.`
        : `All three jobs are paid. Rex has earned $${state.player.money} and the rest of the night off.`,
      buttonLabel: next ? 'Back to the city' : 'Free roam',
      onContinue: resume,
      onNextMission: next ? () => { startMission(state, next.id); resume(); } : undefined,
    });
  }

  function gameOver() {
    state.gameOver = true;
    saveGame(state);
    modal('gameover', {
      ...state, busted: true, heading: 'End of the shift',
      message: 'Dispatch kept the receipts. Start a new shift with your paid jobs and cash.',
      money: state.player.money, missionsDone: state.completedMissions.length,
      onRestart: () => restart(loadGame()),
    });
  }

  function applyHeat() {
    if (!state.pendingWanted) return;
    addWanted(state, state.pendingWanted);
    state.pendingWanted = 0;
  }

  function tick(dt) {
    state.time += dt;
    const input = { keys: held };
    for (const [action, codes] of Object.entries(KEYS)) input[action] = codes.some(code => held.has(code));
    if (presses.has('enter')) {
      if (state.car) exitCar(state);
      else tryEnterCar(state);
    }
    updatePlayer(state, input, dt);
    updateTraffic(state, dt);
    updatePeds(state, dt);
    updateMission(state, dt);
    applyHeat();
    updatePolice(state, dt);
    decayWanted(state, dt);
    if (presses.has('attack')) attack(state);
    updateCombat(state, dt);
    presses.clear();
    applyHeat();
    let paid = false;
    for (const event of state.events.splice(0)) {
      if (event === 'mission-done') {
        paid = true;
        state.bestScore = Math.max(state.score, state.bestScore);
        saveGame(state);
        sfx('mission');
      } else {
        sfx(event);
      }
    }
    setEngine(!!state.car, state.car?.speed ?? 0);
    if (state.player.health <= 0 || state.gameOver) gameOver();
    else if (paid) receipt();
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - (previousFrame ?? now)) / 1000);
    previousFrame = now;
    if (!state.paused && !state.gameOver) tick(dt);
    const target = state.car ?? state.player;
    const camera = {
      x: Math.max(0, Math.min(WORLD_PX - VIEW_W, target.x - VIEW_W / 2)),
      y: Math.max(0, Math.min(WORLD_PX - VIEW_H, target.y - VIEW_H / 2)),
    };
    render(ctx, state, camera);
    drawHUD(ctx, state);
    drawMinimap(ctx, state);
    requestAnimationFrame(frame);
  }

  window.addEventListener('keydown', event => {
    const action = keyMap.get(event.code);
    if (!action && event.code !== 'Enter') return;
    // Let the browser activate the focused menu button with Space or Enter.
    if (screen && event.target?.closest?.('button') && ['Space', 'Enter'].includes(event.code)) return;
    event.preventDefault();
    if (event.repeat) return;
    initAudio();
    if (screen === 'title' && event.code === 'Enter') restart(loadGame());
    else if (action === 'pause' && screen === 'pause') resume();
    else if (action === 'missions' && ['mission', 'dispatch'].includes(screen)) resume();
    else if (!screen) {
      if (action === 'pause') pause();
      else if (action === 'missions') dispatch();
      else if (action) {
        held.add(event.code);
        presses.add(action);
      }
    }
  });
  window.addEventListener('keyup', event => held.delete(event.code));
  window.addEventListener('blur', () => {
    resetInput();
    if (!screen) pause();
  });
  window.addEventListener('pagehide', () => {
    if (screen !== 'title') saveGame(state);
    setEngine(false);
  });
  modal('title', {
    title: CITY_NAME, story: `${PLAYER_NAME} drives for hire. Tonight the fish market, a double-dealing courier and the night ferry all need his wheels.`,
    hasSave: !!saved, buttonLabel: saved ? 'New shift' : 'Start shift',
    onStart: () => restart(null), onContinue: saved ? () => restart(loadGame()) : undefined,
  });
  requestAnimationFrame(frame);
}

const shot = new URLSearchParams(location.search).get('shot');
if (['start', 'play', 'end'].includes(shot)) {
  renderShot(ctx, newShift(null), shot);
} else {
  play();
}
