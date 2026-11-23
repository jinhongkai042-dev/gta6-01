let context;
let master;
let noise;
let engine;

export function initAudio() {
  try {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) return;
    if (!context || context.state === 'closed') {
      context = new Audio();
      master = context.createGain();
      master.gain.value = 0.32;
      master.connect(context.destination);
      noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.24), context.sampleRate);
      const channel = noise.getChannelData(0);
      for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
      engine = null;
    }
    if (context.state !== 'running') context.resume().catch(() => {});
  } catch {
    context = null;
  }
}

function envelope(source, when, duration, volume) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.001, when);
  gain.gain.exponentialRampToValueAtTime(volume, when + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
  source.connect(gain);
  gain.connect(master);
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };
  source.start(when);
  source.stop(when + duration + 0.01);
}

function note(type, from, to, when, duration, volume) {
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, when);
  osc.frequency.exponentialRampToValueAtTime(to, when + duration);
  envelope(osc, when, duration, volume);
}

function burst(when, duration, volume) {
  const source = context.createBufferSource();
  source.buffer = noise;
  envelope(source, when, duration, volume);
}

export function sfx(name) {
  if (context?.state !== 'running') return;
  const t = context.currentTime;
  switch (name) {
    case 'pickup':
      note('sine', 620, 750, t, 0.09, 0.24);
      note('sine', 940, 1120, t + 0.09, 0.13, 0.19);
      break;
    case 'crash':
      burst(t, 0.21, 0.45);
      note('triangle', 110, 39, t, 0.23, 0.5);
      break;
    case 'siren':
      note('triangle', 475, 850, t, 0.27, 0.16);
      note('triangle', 850, 475, t + 0.26, 0.29, 0.16);
      break;
    case 'shoot':
      burst(t, 0.085, 0.42);
      note('triangle', 140, 48, t, 0.1, 0.35);
      break;
    case 'click':
      note('square', 340, 180, t, 0.035, 0.1);
      break;
    case 'mission':
      [392, 494, 587, 784].forEach((hz, i) => note('sine', hz, hz, t + i * 0.105, 0.22, 0.27));
      break;
  }
}

export function setEngine(on, speed = 0) {
  if (!context) return;
  const t = context.currentTime;
  if (!on || context.state !== 'running') {
    if (engine) {
      const { osc, gain } = engine;
      gain.gain.setTargetAtTime(0.001, t, 0.02);
      osc.stop(t + 0.1);
      engine = null;
    }
    return;
  }
  if (!engine) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'triangle';
    gain.gain.value = 0.001;
    osc.connect(gain);
    gain.connect(master);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    osc.start();
    engine = { osc, gain };
  }
  const throttle = Math.min(1, Math.abs(speed) / 350);
  engine.osc.frequency.setTargetAtTime(38 + 85 * throttle, t, 0.06);
  engine.gain.gain.setTargetAtTime(0.11 + 0.08 * throttle, t, 0.05);
}
