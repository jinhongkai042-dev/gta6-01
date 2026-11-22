const KEY = 'marlin-bay-save-v1';

function amount(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function completed(ids) {
  return [1, 2, 3].filter(id => Array.isArray(ids) && ids.includes(id));
}

export function loadGame() {
  try {
    const data = JSON.parse(globalThis.localStorage.getItem(KEY));
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    return {
      money: amount(data.money),
      completedMissions: completed(data.completedMissions),
      bestScore: amount(data.bestScore),
    };
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    const data = {
      money: amount(state.player.money),
      completedMissions: completed(state.completedMissions),
      bestScore: Math.max(amount(state.bestScore), amount(state.score), loadGame()?.bestScore ?? 0),
    };
    globalThis.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage can disappear between reads and writes in private browsing.
  }
}

export function clearSave() {
  try {
    globalThis.localStorage.removeItem(KEY);
  } catch {
    // An unavailable store has no accessible save to clear.
  }
}
