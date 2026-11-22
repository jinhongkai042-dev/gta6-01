let context;
let output;
let engine;
let engineGain;
let noiseBuffer;

export function initAudio() {
  try {
    if (!context) {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) return;
      context = new Audio();
      output = context.createGain();
      output.gain.value = 0.24;
      output.connect(context.destination);
      engine = context.createOscillator();
      engineGain = context.createGain();
      engine.type = 'triangle';
      engine.frequency.value = 44;
      engineGain.gain.value = 0;
      engine.connect(engineGain);
      engineGain.connect(output);
      engine.start();
    }
    if (context.state !== 'running') context.resume().catch(() => {});
  } catch {
    // Browsers can block audio while the game is embedded.
  }
}

function envelope(source, start, duration, volume) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  source.connect(gain);
  gain.connect(output);
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };
  source.start(start);
  source.stop(start + duration + 0.01);
}

function tone(type, from, to, start, duration, volume) {
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  envelope(osc, start, duration, volume);
}

function noise(start, duration, volume) {
  if (!noiseBuffer) {
    noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.35), context.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  source.buffer = noiseBuffer;
  envelope(source, start, duration, volume);
}

export function sfx(name) {
  if (!output || context.state !== 'running') return;
  const now = context.currentTime;
  switch (name) {
    case 'pickup':
      tone('sine', 480, 620, now, 0.09, 0.4);
      tone('sine', 740, 860, now + 0.07, 0.16, 0.38);
      break;
    case 'crash':
      noise(now, 0.22, 0.6);
      tone('triangle', 120, 36, now, 0.22, 0.5);
      break;
    case 'siren':
      tone('triangle', 440, 770, now, 0.32, 0.36);
      tone('triangle', 770, 420, now + 0.31, 0.37, 0.36);
      break;
    case 'shoot':
      noise(now, 0.095, 0.8);
      tone('triangle', 180, 48, now, 0.13, 0.55);
      break;
    case 'click':
      tone('square', 250, 135, now, 0.035, 0.14);
      break;
    case 'mission':
      [330, 415, 494, 660].forEach((hz, i) =>
        tone('sine', hz, hz, now + i * 0.095, i === 3 ? 0.45 : 0.17, 0.46));
      break;
  }
}

export function setEngine(on, speed = 0) {
  if (!engineGain || !engine) return;
  const load = Math.min(1, Math.abs(speed) / 300);
  const now = context.currentTime;
  engineGain.gain.setTargetAtTime(on ? 0.13 + load * 0.12 : 0, now, 0.055);
  engine.frequency.setTargetAtTime(42 + load * 84, now, 0.08);
}
