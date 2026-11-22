import { TILE } from './config.js';

const intersection = (column, row) => ({ x: (column + 0.5) * TILE, y: (row + 0.5) * TILE });
const pickup = intersection(20, 20);
const delivery = intersection(24, 36);
const rendezvous = intersection(20, 32);
const alarm = intersection(24, 16);
const refuge = intersection(8, 28);

export const MISSIONS = [
  {
    id: 1, name: 'First Delivery', reward: 200,
    story: 'The last ferry leaves in ten. Inez has a parcel of undeveloped film and a harbor pilot willing to carry it. Rex gets one trip to make the handoff.',
    steps: [
      { text: 'Collect the film at the signal box.', target: pickup },
      { text: 'Drive the film to the ferry at Marina Pier.', target: delivery },
    ],
  },
  {
    id: 2, name: 'Tail the Courier', reward: 350,
    story: 'Someone bought the ferry manifest. Inez left a pistol in the signal crew’s lockbox. Outfit yourself there, then tail the courier to find out where the money goes.',
    steps: [
      { text: 'Collect the signal crew’s lockbox pistol.', target: rendezvous },
      { text: 'Find the marked courier and fall in behind the car.', target: rendezvous },
      { text: 'Keep the marked courier in sight for 20 seconds.', target: rendezvous },
    ],
  },
  {
    id: 3, name: 'Lose the Cops', reward: 500,
    story: 'The pilot needs the harbor patrol looking inland. Rex can trip the customs alarm, then disappear while the ferry slips its moorings.',
    steps: [
      { text: 'Reach three stars. Trip the customs alarm at the marker.', target: alarm },
      { text: 'Lose all stars. The old slipway is a place to lay low.', target: refuge },
    ],
  },
];

function setStep(mission, stage) {
  const step = MISSIONS[mission.id - 1].steps[stage];
  mission.stage = stage;
  mission.objective = step.text;
  mission.target = { ...step.target };
}

function clearCourier(mission) {
  if (mission?.courier) {
    mission.courier.isCourier = false;
    mission.courier = null;
  }
}

function markCourier(state) {
  const origin = state.player;
  let best = Infinity;
  let selected = null;
  for (const car of state.cars) {
    if (car === state.car || car.parked) continue;
    // Prefer a car a short drive ahead of the player, even at a busy spawn.
    const cost = Math.abs(Math.hypot(car.x - origin.x, car.y - origin.y) - 145);
    if (cost < best) {
      best = cost;
      selected = car;
    }
  }
  if (selected) {
    selected.isCourier = true;
    state.mission.courier = selected;
    state.mission.target = { x: selected.x, y: selected.y };
  }
}

export function startMission(state, id) {
  const job = MISSIONS.find(entry => entry.id === Number(id));
  if (!job || state.completedMissions?.includes(job.id)) return;
  if (state.mission?.id === job.id && !state.mission.done) return;
  clearCourier(state.mission);
  state.mission = {
    id: job.id, name: job.name, stage: 0, done: false,
    tailTime: 0, lostTime: 0, alarmTripped: false,
  };
  setStep(state.mission, 0);
}

function finish(state, message) {
  const mission = state.mission;
  const job = MISSIONS[mission.id - 1];
  clearCourier(mission);
  mission.done = true;
  mission.objective = message;
  state.completedMissions ??= [];
  if (state.completedMissions.includes(job.id)) return;
  state.completedMissions.push(job.id);
  state.player.money += job.reward;
  state.score += job.reward;
  state.events.push('mission-done');
}

function tailCourier(state, dt) {
  const mission = state.mission;
  if (mission.stage === 0) {
    if (Math.hypot(state.player.x - rendezvous.x, state.player.y - rendezvous.y) > 48) return;
    if (state.player.weapon !== 'pistol') {
      state.player.weapon = 'pistol';
      state.player.ammo = 12;
    }
    state.events.push('pickup');
    setStep(mission, 1);
  }
  if (!mission.courier || !state.cars.includes(mission.courier) || mission.courier === state.car) {
    clearCourier(mission);
    mission.tailTime = 0;
    mission.lostTime = 0;
    setStep(mission, 1);
    markCourier(state);
  }
  const car = mission.courier;
  if (!car) return;
  mission.target = { x: car.x, y: car.y };
  const distance = Math.hypot(car.x - state.player.x, car.y - state.player.y);
  if (mission.stage === 1) {
    if (distance > 170) return;
    setStep(mission, 2);
    mission.target = { x: car.x, y: car.y };
  }
  if (distance <= 280) {
    mission.lostTime = 0;
    mission.tailTime += dt;
    mission.objective = 'Keep the courier in sight • ' + Math.ceil(Math.max(0, 20 - mission.tailTime)) + 's';
    if (mission.tailTime >= 20 - 1e-8) finish(state, 'The manifest buyer is identified. +$350');
  } else {
    // A short blind corner pauses the clock. A broken tail costs its accumulated time.
    mission.lostTime += dt;
    mission.objective = 'Close the gap before the courier gets away!';
    if (mission.lostTime >= 2) {
      mission.tailTime = 0;
      mission.lostTime = 0;
      setStep(mission, 1);
      mission.objective = 'Tail lost. Catch the marked courier and start a fresh 20 seconds.';
      mission.target = { x: car.x, y: car.y };
    }
  }
}

export function updateMission(state, dt) {
  const m = state.mission;
  if (!m?.id || m.done) return;
  if (m.id === 2) return tailCourier(state, dt);
  const atTarget = Math.hypot(state.player.x - m.target.x, state.player.y - m.target.y) <= 48;
  if (m.id === 1 && atTarget) {
    if (m.stage === 0) {
      setStep(m, 1);
      state.events.push('pickup');
    } else if (!state.player.onFoot) {
      finish(state, 'The film made the ferry. +$200');
    }
  }
  if (m.id === 3) {
    if (m.stage === 0 && state.wanted >= 3) {
      setStep(m, 1);
    } else if (m.stage === 0 && atTarget && !m.alarmTripped) {
      state.pendingWanted = (state.pendingWanted || 0) + (3 - state.wanted);
      m.alarmTripped = true;
    } else if (m.stage === 1 && state.wanted === 0) {
      finish(state, 'The ferry cleared the breakwater. +$500');
    }
  }
}
