import { CITY_NAME, PLAYER_NAME } from './config.js';

const STYLE_ID = 'marlin-bay-ui-styles';
let activeScreen = null;

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .mb-screen {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 28px;
      pointer-events: auto;
      background: radial-gradient(circle at 50% 35%, rgba(9, 29, 46, 0.52), rgba(5, 14, 24, 0.8));
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      font-family: 'Avenir Next', 'Segoe UI', 'Helvetica Neue', system-ui, -apple-system, sans-serif;
      color: #f4f9fc;
      animation: mbFadeIn 180ms ease-out;
    }

    @keyframes mbFadeIn {
      from { opacity: 0; transform: scale(0.985); }
      to { opacity: 1; transform: scale(1); }
    }

    .mb-card {
      position: relative;
      width: min(560px, 92%);
      padding: 32px 36px 30px;
      border-radius: 18px;
      background: linear-gradient(160deg, rgba(12, 30, 48, 0.94), rgba(8, 20, 34, 0.96));
      border: 1px solid rgba(114, 224, 232, 0.32);
      box-shadow:
        0 26px 70px rgba(0, 0, 0, 0.58),
        inset 0 1px 0 rgba(255, 255, 255, 0.14);
      text-align: center;
      overflow: hidden;
    }

    .mb-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #36d6cf, #ffd166, #ff6b6b);
    }

    .mb-card--gameover::before {
      background: linear-gradient(90deg, #ff4d6d, #ff8f5e, #ffd166);
    }

    .mb-card--mission::before {
      background: linear-gradient(90deg, #2ee68a, #ffd166, #36d6cf);
    }

    .mb-kicker {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      background: rgba(54, 214, 207, 0.15);
      border: 1px solid rgba(54, 214, 207, 0.36);
      color: #79f2ea;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    .mb-kicker--gold {
      background: rgba(255, 209, 102, 0.16);
      border-color: rgba(255, 209, 102, 0.45);
      color: #ffd97d;
    }

    .mb-kicker--danger {
      background: rgba(255, 77, 109, 0.18);
      border-color: rgba(255, 77, 109, 0.45);
      color: #ff8fa3;
    }

    .mb-title {
      margin: 0;
      font-size: 48px;
      line-height: 1.04;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: linear-gradient(180deg, #fff6da 0%, #ffd166 52%, #ff7a59 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      text-shadow: 0 6px 24px rgba(255, 122, 89, 0.22);
    }

    .mb-title--compact {
      font-size: 38px;
    }

    .mb-title--danger {
      background: linear-gradient(180deg, #ffe0e6 0%, #ff6b81 55%, #e63946 100%);
      -webkit-background-clip: text;
      background-clip: text;
    }

    .mb-title--success {
      background: linear-gradient(180deg, #f3fff8 0%, #7ef5b5 50%, #2ec4b6 100%);
      -webkit-background-clip: text;
      background-clip: text;
    }

    .mb-story {
      margin: 14px auto 20px;
      max-width: 460px;
      color: #c7dde8;
      font-size: 15px;
      line-height: 1.5;
    }

    .mb-controls {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 14px;
      padding: 14px 16px;
      margin: 0 0 24px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.09);
      text-align: left;
      font-size: 13px;
      color: #d5e6ef;
    }

    .mb-ctrl-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .mb-key {
      min-width: 54px;
      padding: 3px 7px;
      border-radius: 6px;
      text-align: center;
      background: rgba(54, 214, 207, 0.14);
      border: 1px solid rgba(54, 214, 207, 0.3);
      color: #ffffff;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      font-weight: 700;
    }

    .mb-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 10px;
      margin: 18px 0 24px;
    }

    .mb-stat {
      padding: 12px 10px;
      border-radius: 11px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .mb-stat-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #8fb4c7;
      margin-bottom: 4px;
    }

    .mb-stat-value {
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
    }

    .mb-stat-value--money {
      color: #4ef0a3;
    }

    .mb-stat-value--gold {
      color: #ffd166;
    }

    .mb-reward {
      display: inline-block;
      margin: 12px 0 6px;
      padding: 8px 22px;
      border-radius: 999px;
      background: rgba(46, 230, 138, 0.15);
      border: 1px solid rgba(46, 230, 138, 0.45);
      color: #5ef5ab;
      font-size: 26px;
      font-weight: 900;
      letter-spacing: 0.04em;
    }

    .mb-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-top: 6px;
    }

    .mb-btn {
      appearance: none;
      border: none;
      cursor: pointer;
      padding: 13px 30px;
      border-radius: 10px;
      font-family: inherit;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      transition: transform 120ms ease, filter 120ms ease, box-shadow 120ms ease;
    }

    .mb-btn:hover {
      transform: translateY(-1px);
      filter: brightness(1.07);
    }

    .mb-btn:active {
      transform: translateY(1px);
    }

    .mb-btn--primary {
      background: linear-gradient(135deg, #ff7a59, #ffb347);
      color: #131c29;
      box-shadow: 0 10px 26px rgba(255, 122, 89, 0.36);
    }

    .mb-btn--success {
      background: linear-gradient(135deg, #2ee68a, #36d6cf);
      color: #082026;
      box-shadow: 0 10px 26px rgba(46, 230, 138, 0.32);
    }

    .mb-btn--secondary {
      background: rgba(255, 255, 255, 0.1);
      color: #eaf5fa;
      border: 1px solid rgba(255, 255, 255, 0.22);
    }
  `;
  document.head.appendChild(style);
}

function getContainer() {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById('ui-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ui-overlay';
    el.style.position = 'fixed';
    el.style.inset = '0';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '100';
    document.body.appendChild(el);
  }
  return el;
}

function formatMoney(n) {
  const num = Number.isFinite(Number(n)) ? Math.round(Number(n)) : 0;
  return '$' + num.toLocaleString('en-US');
}

function formatNum(n) {
  const num = Number.isFinite(Number(n)) ? Math.round(Number(n)) : 0;
  return num.toLocaleString('en-US');
}

function pickCallback(data, names) {
  if (typeof data === 'function') return data;
  if (!data || typeof data !== 'object') return null;
  for (const key of names) {
    if (typeof data[key] === 'function') return data[key];
  }
  return null;
}

function triggerAction(screenName, action, data, callbackKeys) {
  const cb = pickCallback(data, callbackKeys);
  hideScreens();
  if (cb) {
    cb(action);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('ui:action', { detail: { screen: screenName, action } })
    );
    window.dispatchEvent(
      new CustomEvent('marlinbay:ui', { detail: { screen: screenName, action } })
    );
  }
}

function makeButton(label, variant, action, screenName, data, callbackKeys) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `mb-btn mb-btn--${variant}`;
  btn.dataset.action = action;
  btn.id = `btn-${action}`;
  btn.textContent = label;
  btn.addEventListener('click', () => {
    triggerAction(screenName, action, data, callbackKeys);
  });
  return btn;
}

function buildTitleScreen(data) {
  const card = document.createElement('div');
  card.className = 'mb-card';

  const kicker = document.createElement('div');
  kicker.className = 'mb-kicker';
  kicker.textContent = 'Coastal Open-World Crime';

  const title = document.createElement('h1');
  title.className = 'mb-title';
  title.textContent = data?.title || CITY_NAME;

  const story = document.createElement('p');
  story.className = 'mb-story';
  story.textContent =
    data?.story ||
    `${PLAYER_NAME} hit the boardwalk of ${CITY_NAME} with zero cash and fast hands — run coastal jobs, outrun the heat, and claim the strip.`;

  const controls = document.createElement('div');
  controls.className = 'mb-controls';
  const rows = [
    ['WASD', 'Move & Drive'],
    ['E', 'Enter / Exit Car'],
    ['F', 'Attack'],
    ['Space', 'Handbrake'],
    ['P', 'Pause'],
    ['M', 'Missions'],
  ];
  for (const [key, desc] of rows) {
    const row = document.createElement('div');
    row.className = 'mb-ctrl-row';
    const k = document.createElement('span');
    k.className = 'mb-key';
    k.textContent = key;
    const d = document.createElement('span');
    d.textContent = desc;
    row.append(k, d);
    controls.appendChild(row);
  }

  const actions = document.createElement('div');
  actions.className = 'mb-actions';
  actions.appendChild(
    makeButton(
      data?.buttonLabel || 'Click to Start',
      'primary',
      'start',
      'title',
      data,
      ['onStart', 'onPlay', 'start', 'onClick', 'callback']
    )
  );

  if (data?.hasSave || typeof data?.onContinue === 'function') {
    actions.appendChild(
      makeButton('Continue Save', 'secondary', 'continue', 'title', data, [
        'onContinue',
        'onLoad',
        'onResume',
      ])
    );
  }

  card.append(kicker, title, story, controls, actions);
  return card;
}

function buildPauseScreen(data) {
  const card = document.createElement('div');
  card.className = 'mb-card';

  const kicker = document.createElement('div');
  kicker.className = 'mb-kicker';
  kicker.textContent = CITY_NAME;

  const title = document.createElement('h2');
  title.className = 'mb-title mb-title--compact';
  title.textContent = 'Paused';

  const story = document.createElement('p');
  story.className = 'mb-story';
  story.textContent =
    data?.objective ||
    data?.missionName ||
    'Catch your breath before diving back into the streets.';

  const stats = document.createElement('div');
  stats.className = 'mb-stats';
  const moneyVal = data?.money ?? data?.player?.money;
  const scoreVal = data?.score;
  const wantedVal = data?.wanted;
  if (moneyVal !== undefined || scoreVal !== undefined || wantedVal !== undefined) {
    const entries = [
      ['Cash', formatMoney(moneyVal ?? 0), 'mb-stat-value--money'],
      ['Score', formatNum(scoreVal ?? 0), 'mb-stat-value--gold'],
      ['Wanted', `${Math.max(0, Math.min(5, Math.round(wantedVal ?? 0)))} / 5`, ''],
    ];
    for (const [label, value, mod] of entries) {
      const box = document.createElement('div');
      box.className = 'mb-stat';
      const l = document.createElement('div');
      l.className = 'mb-stat-label';
      l.textContent = label;
      const v = document.createElement('div');
      v.className = `mb-stat-value ${mod}`.trim();
      v.textContent = value;
      box.append(l, v);
      stats.appendChild(box);
    }
  }

  const actions = document.createElement('div');
  actions.className = 'mb-actions';
  actions.appendChild(
    makeButton('Resume', 'primary', 'resume', 'pause', data, [
      'onResume',
      'onContinue',
      'resume',
      'onClose',
      'onClick',
      'callback',
    ])
  );
  actions.appendChild(
    makeButton('Restart', 'secondary', 'restart', 'pause', data, [
      'onRestart',
      'onRetry',
      'restart',
    ])
  );

  card.append(kicker, title, story);
  if (stats.childElementCount > 0) card.appendChild(stats);
  card.appendChild(actions);
  return card;
}

function buildGameOverScreen(data) {
  const card = document.createElement('div');
  card.className = 'mb-card mb-card--gameover';

  const kicker = document.createElement('div');
  kicker.className = 'mb-kicker mb-kicker--danger';
  kicker.textContent = 'Game Over';

  const title = document.createElement('h2');
  title.className = 'mb-title mb-title--compact mb-title--danger';
  const busted = data?.reason === 'busted' || data?.busted === true;
  title.textContent = data?.heading || (busted ? 'Busted' : 'Wasted');

  const story = document.createElement('p');
  story.className = 'mb-story';
  story.textContent =
    data?.message ||
    (busted
      ? 'Marlin Bay PD boxed you in. Shake the dust off and run it back.'
      : `${PLAYER_NAME} went down on the strip. Get back out there and settle the score.`);

  const stats = document.createElement('div');
  stats.className = 'mb-stats';
  const score = data?.score ?? 0;
  const money = data?.money ?? data?.player?.money ?? 0;
  const items = [
    ['Final Score', formatNum(score), 'mb-stat-value--gold'],
    ['Cash', formatMoney(money), 'mb-stat-value--money'],
  ];
  if (data?.missionsDone !== undefined) {
    items.push(['Missions', String(data.missionsDone), '']);
  }
  for (const [label, value, mod] of items) {
    const box = document.createElement('div');
    box.className = 'mb-stat';
    const l = document.createElement('div');
    l.className = 'mb-stat-label';
    l.textContent = label;
    const v = document.createElement('div');
    v.className = `mb-stat-value ${mod}`.trim();
    v.textContent = value;
    box.append(l, v);
    stats.appendChild(box);
  }

  const actions = document.createElement('div');
  actions.className = 'mb-actions';
  actions.appendChild(
    makeButton('Restart', 'primary', 'restart', 'gameover', data, [
      'onRestart',
      'onRetry',
      'restart',
      'onStart',
      'onClick',
      'callback',
    ])
  );

  card.append(kicker, title, story, stats, actions);
  return card;
}

function buildMissionScreen(data) {
  const card = document.createElement('div');
  card.className = 'mb-card mb-card--mission';

  const kicker = document.createElement('div');
  kicker.className = 'mb-kicker mb-kicker--gold';
  kicker.textContent = 'Job Cleared';

  const title = document.createElement('h2');
  title.className = 'mb-title mb-title--compact mb-title--success';
  title.textContent = 'Mission Complete';

  const missionName = data?.name || data?.mission?.name || 'Coastal Contract';
  const story = document.createElement('p');
  story.className = 'mb-story';
  story.textContent = data?.message || `"${missionName}" wrapped up cleanly in ${CITY_NAME}.`;

  const rewardAmt = data?.reward ?? data?.payout ?? data?.mission?.reward ?? 200;
  const reward = document.createElement('div');
  reward.className = 'mb-reward';
  reward.textContent = `+${formatMoney(rewardAmt)}`;

  const stats = document.createElement('div');
  stats.className = 'mb-stats';
  const money = data?.money ?? data?.player?.money;
  const score = data?.score;
  const entries = [];
  if (money !== undefined) entries.push(['Bank', formatMoney(money), 'mb-stat-value--money']);
  if (score !== undefined) entries.push(['Score', formatNum(score), 'mb-stat-value--gold']);
  for (const [label, value, mod] of entries) {
    const box = document.createElement('div');
    box.className = 'mb-stat';
    const l = document.createElement('div');
    l.className = 'mb-stat-label';
    l.textContent = label;
    const v = document.createElement('div');
    v.className = `mb-stat-value ${mod}`.trim();
    v.textContent = value;
    box.append(l, v);
    stats.appendChild(box);
  }

  const actions = document.createElement('div');
  actions.className = 'mb-actions';
  actions.appendChild(
    makeButton(
      data?.buttonLabel || 'Continue',
      'success',
      'continue',
      'mission',
      data,
      ['onContinue', 'onNext', 'onResume', 'onClose', 'onClick', 'callback']
    )
  );
  if (typeof data?.onNextMission === 'function') {
    actions.appendChild(
      makeButton('Next Mission', 'secondary', 'next', 'mission', data, ['onNextMission'])
    );
  }

  card.append(kicker, title, story, reward);
  if (stats.childElementCount > 0) card.appendChild(stats);
  card.appendChild(actions);
  return card;
}

export function showScreen(name, data = {}) {
  const container = getContainer();
  if (!container) return;
  ensureStyles();
  container.innerHTML = '';

  const screen = document.createElement('div');
  screen.className = `mb-screen mb-screen--${name}`;
  screen.dataset.screen = name;

  let card;
  switch (name) {
    case 'title':
      card = buildTitleScreen(data);
      break;
    case 'pause':
      card = buildPauseScreen(data);
      break;
    case 'gameover':
      card = buildGameOverScreen(data);
      break;
    case 'mission':
      card = buildMissionScreen(data);
      break;
    default:
      card = buildPauseScreen(data);
      break;
  }

  screen.appendChild(card);
  container.appendChild(screen);
  activeScreen = name;
}

export function hideScreens() {
  const container = getContainer();
  if (container) {
    container.innerHTML = '';
  }
  activeScreen = null;
}

export function getActiveScreen() {
  return activeScreen;
}
