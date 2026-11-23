import { TILE } from './config.js';

const intersection = (column, row) => ({ x: (column + 0.5) * TILE, y: (row + 0.5) * TILE });
const fishMarket = intersection(16, 20);
const ferry = intersection(24, 12);
const dispatch = intersection(20, 16);
const customs = intersection(28, 16);
const slipway = intersection(12, 28);

export const MISSIONS = [
  {
    id: 1, name: 'First Delivery', reward: 200,
    story: 'The fish auction closed an hour ago. Nessa has one parcel left on the ice and a ferry captain who already pulled the gangway.',
    steps: [
      { text: 'Collect Nessa’s blue parcel at the fish market.', target: fishMarket },
      { text: 'Drive the parcel to the night ferry.', target: ferry },
    ],
  },
  {
    id: 2, name: 'Tail the Courier', reward: 350,
    story: 'A dispatch rider sold Rex’s name twice. Nessa wants the address of the second buyer. The courier will lead you there.',
    steps: [
      { text: 'Meet Nessa’s contact beside the marked courier car. Collect the pistol.', target: dispatch },
      { text: 'Keep the courier in sight for 20 uninterrupted seconds.', target: dispatch },
    ],
  },
  {
    id: 3, name: 'Lose the Cops', reward: 500,
    story: 'The ferry is carrying half the market’s wages. Rex promised the captain that every blue light in Marlin Bay would be looking inland.',
    steps: [
      { text: 'Draw three wanted stars. Crossing the customs alarm will do it.', target: customs },
      { text: 'Break contact and shed every star. The old slipway is a possible escape route.', target: slipway },
    ],
  },
];

function setStep(mission, definition, index) {
  const { text, target } = definition.steps[index];
  Object.assign(mission, { stage: index, objective: text, target: { ...target } });
}

function unmark(mission) {
  if (mission?.courier) {
    mission.courier.courier = false;
    mission.courier.isCourier = false;
    mission.courier.marked = false;
    mission.courier = null;
  }
}

function trackCourier(state) {
  const mission = state.mission;
  let courier = mission.courier;
  if (!courier || !state.cars.includes(courier) || courier === state.car) {
    unmark(mission);
    const distance = car => Math.hypot(car.x - state.player.x, car.y - state.player.y);
    courier = state.cars.reduce((best, car) => {
      if (car === state.car || car.parked || car.occupiedByPlayer) return best;
      return !best || distance(car) < distance(best) ? car : best;
    }, null);
    mission.followTime = 0;
    if (!courier) return null;
    mission.courier = courier;
    courier.courier = true;
    courier.isCourier = true;
    courier.marked = true;
  }
  mission.target = { x: courier.x, y: courier.y };
  return courier;
}

export function startMission(state, id) {
  const definition = MISSIONS.find(item => item.id === Number(id));
  if (!definition || state.completedMissions?.includes(definition.id)) return false;
  if (state.mission?.id === definition.id && !state.mission.done) return true;
  unmark(state.mission);
  state.mission = {
    id: definition.id, name: definition.name, story: definition.story,
    reward: definition.reward, done: false, followTime: 0,
  };
  setStep(state.mission, definition, 0);
  if (definition.id === 2) trackCourier(state);
  return true;
}

function finish(state, definition) {
  const mission = state.mission;
  mission.done = true;
  mission.objective = 'Job complete. Open missions (M) for the dispatch board.';
  unmark(mission);
  state.completedMissions ??= [];
  if (state.completedMissions.includes(definition.id)) return;
  state.completedMissions.push(definition.id);
  state.player.money += definition.reward;
  state.score += definition.reward;
  (state.events ??= []).push('mission-done');
}

export function updateMission(state, dt) {
  const mission = state.mission;
  if (!mission || mission.done) return;
  const definition = MISSIONS.find(item => item.id === mission.id);
  if (!definition) return;
  const player = state.car ?? state.player;
  const distance = () => Math.hypot(player.x - mission.target.x, player.y - mission.target.y);
  switch (mission.id) {
    case 1:
      if (distance() > 56) return;
      if (mission.stage === 0) {
        setStep(mission, definition, 1);
        (state.events ??= []).push('pickup');
      } else if (state.car || !state.player.onFoot) {
        finish(state, definition);
      }
      break;
    case 2: {
      if (!trackCourier(state)) return;
      const gap = distance();
      if (mission.stage === 0 && gap <= 160) {
        setStep(mission, definition, 1);
        mission.target = { x: mission.courier.x, y: mission.courier.y };
        if (state.player.weapon !== 'pistol') {
          state.player.weapon = 'pistol';
          state.player.ammo = 12;
        }
        (state.events ??= []).push('pickup');
      } else if (mission.stage === 1) {
        mission.followTime = gap <= 300 ? Math.min(20, mission.followTime + dt) : 0;
        mission.objective = gap <= 300
          ? `Stay with the courier · ${Math.floor(mission.followTime)} / 20 s`
          : 'Courier lost. Rejoin the marked car to restart the 20-second tail.';
        if (mission.followTime >= 20 - 1e-8) finish(state, definition);
      }
      break;
    }
    case 3:
      if (mission.stage === 0) {
        if (state.wanted >= 3) setStep(mission, definition, 1);
        else if (distance() <= 48) state.pendingWanted = Math.max(state.pendingWanted || 0, 3 - state.wanted);
      } else if (state.wanted === 0) {
        finish(state, definition);
      }
      break;
  }
}
