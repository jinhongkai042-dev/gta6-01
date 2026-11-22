import { CITY_NAME, PLAYER_NAME } from './config.js';

const STYLE_ID = 'marlin-bay-ui-styles';

function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .mb-backdrop {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 28px;
      background: radial-gradient(circle at 50% 42%, rgba(10, 26, 44, 0.54) 0%, rgba(6, 14, 24, 0.80) 100%);
      backdrop-filter: blur(4px);
    }

    .mb-backdrop.mb-title-backdrop {
      background: linear-gradient(125deg, rgba(14, 24, 42, 0.72) 0%, rgba(18, 30, 52, 0.42) 55%, rgba(255, 118, 87, 0.22) 100%);
      backdrop-filter: blur(2px);
    }

    .mb-card {
      width: 560px;
      max-width: 92%;
      padding: 34px 38px 30px;
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(12, 26, 42, 0.92) 0%, rgba(9, 20, 34, 0.95) 100%);
      border: 1.5px solid rgba(110, 224, 232, 0.32);
      box-shadow: 0 28px 70px rgba(0, 0, 0, 0.58), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      color: #eef6fa;
      text-align: center;
    }

    .mb-card.mb-wide {
      width: 680px;
    }

    .mb-eyebrow {
      display: inline-block;
      margin-bottom: 10px;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #091724;
      background: linear-gradient(90deg, #5be3d8 0%, #ffd166 100%);
    }

    .mb-eyebrow.mb-danger {
      color: #fff;
      background: linear-gradient(90deg, #ff5f6d 0%, #ff8e53 100%);
    }

    .mb-eyebrow.mb-success {
      color: #072219;
      background: linear-gradient(90deg, #4ce09e 0%, #ffd166 100%);
    }

    .mb-title {
      font-size: 58px;
      font-weight: 900;
      line-height: 1.02;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      background: linear-gradient(180deg, #fff4c2 0%, #ffd166 48%, #ff7a59 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      filter: drop-shadow(0 4px 14px rgba(255, 122, 89, 0.30));
      margin-bottom: 10px;
    }

    .mb-heading {
      font-size: 36px;
      font-weight: 900;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #fff6dc;
      margin-bottom: 8px;
    }

    .mb-subtitle {
      font-size: 15px;
      line-height: 1.5;
      color: #c7dfec;
      margin: 0 auto 22px;
      max-width: 480px;
    }

    .mb-reward {
      display: inline-block;
      margin: 4px 0 20px;
      padding: 10px 24px;
      border-radius: 10px;
      font-size: 28px;
      font-weight: 900;
      letter-spacing: 0.04em;
      color: #5ef2a8;
      background: rgba(34, 197, 122, 0.14);
      border: 1.5px solid rgba(94, 242, 168, 0.42);
    }

    .mb-stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }

    .mb-stat {
      padding: 12px 14px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(154, 214, 232, 0.15);
    }

    .mb-stat-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #8db3c9;
      margin-bottom: 4px;
    }

    .mb-stat-value {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
    }

    .mb-stat-value.mb-cash {
      color: #5ef2a8;
    }

    .mb-controls {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 14px;
      text-align: left;
      padding: 14px 16px;
      margin-bottom: 24px;
      border-radius: 10px;
      background: rgba(7, 17, 29, 0.65);
      border: 1px solid rgba(120, 216, 230, 0.16);
      font-size: 13px;
      color: #c5dde9;
    }

    .mb-controls b {
      color: #ffd166;
      font-weight: 700;
    }

    .mb-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }

    .mb-btn {
      appearance: none;
      border: none;
      cursor: pointer;
      padding: 13px 30px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease;
    }

    .mb-btn:hover {
      transform: translateY(-1px);
      filter: brightness(1.06);
    }

    .mb-btn:active {
      transform: translateY(1px);
    }

    .mb-btn-primary {
      color: #101926;
      background: linear-gradient(90deg, #ffd166 0%, #ff9b54 100%);
      box-shadow: 0 10px 24px rgba(255, 155, 84, 0.34);
    }

    .mb-btn-secondary {
      color: #dff4fb;
      background: rgba(255, 255, 255, 0.09);
      border: 1px solid rgba(142, 216, 232, 0.32);
    }

    .mb-mission-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 20px;
      text-align: left;
    }

    .mb-mission-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 13px 16px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(132, 216, 232, 0.22);
      cursor: pointer;
      color: #eef6fa;
      text-align: left;
      width: 100%;
    }

    .mb-mission-item:hover {
      background: rgba(91, 227, 216, 0.12);
      border-color: rgba(91, 227, 216, 0.55);
    }

    .mb-mission-name {
      font-size: 15px;
      font-weight: 800;
      color: #fff6dc;
      margin-bottom: 3px;
    }

    .mb-mission-desc {
      font-size: 12px;
      color: #a8c7d8;
    }

    .mb-mission-pay {
      font-size: 15px;
      font-weight: 900;
      color: #5ef2a8;
      white-space: nowrap;
    }
  `;
  document.head.appendChild(style);
}

function getOverlayRoot() {
  if (typeof document === 'undefined') return null;
  let root = document.getElementById('ui-overlay');
  if (!root) {
    const stage = document.getElementById('stage') || document.getElementById('game')?.parentElement || document.body;
    root = document.createElement('div');
    root.id = 'ui-overlay';
    root.style.position = 'absolute';
    root.style.inset = '0';
    root.style.zIndex = '10';
    stage.appendChild(root);
  }
  return root;
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(amount) {
  const n = Math.round(Number(amount) || 0);
  return `$${n.toLocaleString('en-US')}`;
}

function emitAction(screen, action, payload = null) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('marlinbay:ui', { detail: { screen, action, payload } }));
    window.dispatchEvent(new CustomEvent(`marlinbay:${action}`, { detail: { screen, payload } }));
  } catch {
    // Ignore environments without CustomEvent
  }
}

function bindButton(root, selector, callback, screen, action, autoHide = true) {
  const el = root.querySelector(selector);
  if (!el) return;
  el.addEventListener('click', (event) => {
    event.stopPropagation();
    if (autoHide) hideScreens();
    if (typeof callback === 'function') {
      callback();
    }
    emitAction(screen, action);
  });
}

export function hideScreens() {
  if (typeof document === 'undefined') return;
  const root = document.getElementById('ui-overlay');
  if (!root) return;
  root.classList.remove('is-visible');
  root.innerHTML = '';
}

export function showScreen(name, data = {}) {
  if (typeof document === 'undefined') return;
  ensureStyles();
  const root = getOverlayRoot();
  if (!root) return;

  const info = data && typeof data === 'object' ? data : {};
  const screenName = String(name || 'title').toLowerCase();

  if (screenName === 'title') {
    const title = info.title || CITY_NAME;
    const story =
      info.story ||
      `${PLAYER_NAME} rolled into ${CITY_NAME} with empty pockets, sunburnt nerves, and a fast getaway plan.`;
    const hasSave = Boolean(info.hasSave || info.onContinue);

    root.innerHTML = `
      <div class="mb-backdrop mb-title-backdrop" data-screen="title">
        <div class="mb-card mb-wide">
          <div class="mb-eyebrow">Coastal Open-World Crime</div>
          <h1 class="mb-title">${escapeHtml(title)}</h1>
          <p class="mb-subtitle">${escapeHtml(story)}</p>
          <div class="mb-controls">
            <div><b>WASD / Arrows</b> — Move &amp; Drive</div>
            <div><b>E</b> — Steal / Exit Car</div>
            <div><b>Space</b> — Handbrake Drift</div>
            <div><b>F</b> — Attack</div>
            <div><b>M</b> — Missions</div>
            <div><b>P</b> — Pause</div>
          </div>
          <div class="mb-actions">
            <button type="button" class="mb-btn mb-btn-primary" data-action="start">
              ${escapeHtml(info.startLabel || 'Click to Start')}
            </button>
            ${
              hasSave
                ? `<button type="button" class="mb-btn mb-btn-secondary" data-action="continue">Continue Save</button>`
                : ''
            }
          </div>
        </div>
      </div>
    `;

    const startCb = info.onStart || info.start || info.onPlay || info.onClick;
    bindButton(root, '[data-action="start"]', startCb, 'title', 'start', true);
    if (hasSave) {
      bindButton(root, '[data-action="continue"]', info.onContinue || startCb, 'title', 'continue', true);
    }
  } else if (screenName === 'pause') {
    const objective = info.objective || info.mission?.objective || 'Cruise the bay or press M to pick a job.';
    root.innerHTML = `
      <div class="mb-backdrop" data-screen="pause">
        <div class="mb-card">
          <div class="mb-eyebrow">Game Paused</div>
          <h2 class="mb-heading">${escapeHtml(CITY_NAME)}</h2>
          <p class="mb-subtitle">${escapeHtml(objective)}</p>
          <div class="mb-controls">
            <div><b>WASD / Arrows</b> — Move &amp; Drive</div>
            <div><b>E</b> — Enter / Exit Car</div>
            <div><b>Space</b> — Handbrake</div>
            <div><b>F</b> — Attack</div>
            <div><b>M</b> — Missions</div>
            <div><b>P</b> — Resume</div>
          </div>
          <div class="mb-actions">
            <button type="button" class="mb-btn mb-btn-primary" data-action="resume">Resume</button>
            <button type="button" class="mb-btn mb-btn-secondary" data-action="restart">Restart</button>
          </div>
        </div>
      </div>
    `;

    const resumeCb = info.onResume || info.resume || info.onContinue || info.onClose;
    const restartCb = info.onRestart || info.restart;
    bindButton(root, '[data-action="resume"]', resumeCb, 'pause', 'resume', true);
    bindButton(root, '[data-action="restart"]', restartCb, 'pause', 'restart', true);
  } else if (screenName === 'gameover') {
    const score = Math.round(Number(info.score) || 0);
    const money = Number(info.money) || 0;
    const subtitle = info.reason || info.message || `${PLAYER_NAME} was taken down on the streets of ${CITY_NAME}.`;

    root.innerHTML = `
      <div class="mb-backdrop" data-screen="gameover">
        <div class="mb-card">
          <div class="mb-eyebrow mb-danger">Busted / Wasted</div>
          <h2 class="mb-heading">Game Over</h2>
          <p class="mb-subtitle">${escapeHtml(subtitle)}</p>
          <div class="mb-stats">
            <div class="mb-stat">
              <div class="mb-stat-label">Final Score</div>
              <div class="mb-stat-value">${score.toLocaleString('en-US')}</div>
            </div>
            <div class="mb-stat">
              <div class="mb-stat-label">Cash Earned</div>
              <div class="mb-stat-value mb-cash">${escapeHtml(formatMoney(money))}</div>
            </div>
          </div>
          <div class="mb-actions">
            <button type="button" class="mb-btn mb-btn-primary" data-action="restart">
              ${escapeHtml(info.restartLabel || 'Restart')}
            </button>
          </div>
        </div>
      </div>
    `;

    const restartCb = info.onRestart || info.restart || info.onRetry || info.onStart || info.onClick;
    bindButton(root, '[data-action="restart"]', restartCb, 'gameover', 'restart', true);
  } else if (screenName === 'mission') {
    const missionName = info.name || info.mission?.name || 'Job Complete';
    const reward = Number(info.reward ?? info.mission?.reward ?? 200) || 0;
    const money = info.money;
    const score = info.score;
    const summary =
      info.summary ||
      info.message ||
      `Clean work, ${PLAYER_NAME}. Your payout has been wired to your stash.`;

    const statsHtml =
      money !== undefined || score !== undefined
        ? `
          <div class="mb-stats">
            <div class="mb-stat">
              <div class="mb-stat-label">Total Cash</div>
              <div class="mb-stat-value mb-cash">${escapeHtml(formatMoney(money ?? reward))}</div>
            </div>
            <div class="mb-stat">
              <div class="mb-stat-label">Score</div>
              <div class="mb-stat-value">${Math.round(Number(score) || 0).toLocaleString('en-US')}</div>
            </div>
          </div>
        `
        : '';

    root.innerHTML = `
      <div class="mb-backdrop" data-screen="mission">
        <div class="mb-card">
          <div class="mb-eyebrow mb-success">Mission Complete</div>
          <h2 class="mb-heading">${escapeHtml(missionName)}</h2>
          <p class="mb-subtitle">${escapeHtml(summary)}</p>
          <div class="mb-reward">+${escapeHtml(formatMoney(reward))}</div>
          ${statsHtml}
          <div class="mb-actions">
            <button type="button" class="mb-btn mb-btn-primary" data-action="continue">
              ${escapeHtml(info.continueLabel || 'Continue')}
            </button>
          </div>
        </div>
      </div>
    `;

    const continueCb = info.onContinue || info.onNext || info.onClose || info.onResume || info.onClick;
    bindButton(root, '[data-action="continue"]', continueCb, 'mission', 'continue', true);
  } else if (screenName === 'missions') {
    const list = Array.isArray(info.missions) ? info.missions : [];
    const itemsHtml = list
      .map((m, idx) => {
        const id = m.id ?? idx;
        const done = Boolean(m.done || m.completed);
        const reward = Number(m.reward ?? 0);
        return `
          <button type="button" class="mb-mission-item" data-mission-idx="${idx}" data-mission-id="${escapeHtml(id)}">
            <div>
              <div class="mb-mission-name">${escapeHtml(m.name || `Mission ${idx + 1}`)}${done ? ' (Completed)' : ''}</div>
              <div class="mb-mission-desc">${escapeHtml(m.description || m.objective || 'Take on a new contract in Marlin Bay.')}</div>
            </div>
            <div class="mb-mission-pay">+${escapeHtml(formatMoney(reward))}</div>
          </button>
        `;
      })
      .join('');

    root.innerHTML = `
      <div class="mb-backdrop" data-screen="missions">
        <div class="mb-card mb-wide">
          <div class="mb-eyebrow">Contracts</div>
          <h2 class="mb-heading">Missions</h2>
          <p class="mb-subtitle">Choose a job across ${escapeHtml(CITY_NAME)}.</p>
          <div class="mb-mission-list">
            ${itemsHtml || '<p class="mb-subtitle">No contracts available right now.</p>'}
          </div>
          <div class="mb-actions">
            <button type="button" class="mb-btn mb-btn-secondary" data-action="close">Close</button>
          </div>
        </div>
      </div>
    `;

    const selectCb = info.onSelect || info.onStartMission;
    root.querySelectorAll('[data-mission-idx]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const idx = Number(btn.getAttribute('data-mission-idx'));
        const item = list[idx];
        hideScreens();
        if (typeof selectCb === 'function') {
          selectCb(item?.id ?? idx, item);
        }
        emitAction('missions', 'select', item);
      });
    });

    const closeCb = info.onClose || info.onResume;
    bindButton(root, '[data-action="close"]', closeCb, 'missions', 'close', true);
  } else {
    root.innerHTML = `
      <div class="mb-backdrop" data-screen="${escapeHtml(screenName)}">
        <div class="mb-card">
          <h2 class="mb-heading">${escapeHtml(info.title || CITY_NAME)}</h2>
          <p class="mb-subtitle">${escapeHtml(info.message || '')}</p>
          <div class="mb-actions">
            <button type="button" class="mb-btn mb-btn-primary" data-action="close">Continue</button>
          </div>
        </div>
      </div>
    `;
    bindButton(root, '[data-action="close"]', info.onClose || info.onClick, screenName, 'close', true);
  }

  root.classList.add('is-visible');
}
