const key = 'marlin-bay-save-v1';

function nonnegative(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function completed(ids) {
  return Array.isArray(ids) ? [...new Set(ids.filter(id => [1, 2, 3].includes(id)))] : [];
}

export function loadGame() {
  try {
    const value = JSON.parse(globalThis.localStorage.getItem(key));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return {
      money: nonnegative(value.money),
      completedMissions: completed(value.completedMissions),
      bestScore: nonnegative(value.bestScore),
    };
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    const previous = loadGame();
    globalThis.localStorage.setItem(key, JSON.stringify({
      money: nonnegative(state.player.money),
      completedMissions: completed(state.completedMissions),
      bestScore: Math.max(nonnegative(state.score), nonnegative(state.bestScore), previous?.bestScore ?? 0),
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    globalThis.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
