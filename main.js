const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const hud = {
  score: document.getElementById("score"),
  lives: document.getElementById("lives"),
  level: document.getElementById("level"),
  overdriveFill: document.getElementById("overdriveFill"),
  message: document.getElementById("message"),
  combo: document.getElementById("combo"),
  overlay: document.getElementById("overlay"),
  startButton: document.getElementById("startButton"),
};

const overlayTitle = hud.overlay.querySelector("h2");
const overlayBody = hud.overlay.querySelector("p");
const defaultOverlayTitle = overlayTitle.textContent;
const defaultOverlayBody = overlayBody.textContent;

const TAU = Math.PI * 2;
const brickTypes = {
  basic: { hp: 1, score: 100, color: "#55efff" },
  armor: { hp: 2, score: 220, color: "#ffb347" },
  explosive: { hp: 1, score: 180, color: "#ff4f9f" },
  pulse: { hp: 1, score: 150, color: "#cbff65" },
  core: { hp: 4, score: 1200, color: "#a892ff" },
};

const lateWaveProfiles = {
  7: {
    name: "Vortex Gate",
    cols: 11,
    rows: 6,
    driftChance: 0.62,
    driftAmplitudeBoost: 1.08,
    driftSpeedBoost: 0.96,
    sweepSpeedBoost: 1.08,
    sweepRows: (row) => row % 2 === 1,
    speedScale: 1.08,
    layout: ({ row, col, cols, rows }) => {
      const centerCol = Math.floor(cols / 2);
      const centerRow = Math.floor(rows / 2);
      const border = row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
      const gate = row === centerRow && Math.abs(col - centerCol) <= 2;
      const ring = Math.abs(row - centerRow) + Math.abs(col - centerCol) === 2;
      return border || gate || ring;
    },
    pickType: ({ row, col, cols, rows }) => {
      const centerCol = Math.floor(cols / 2);
      const centerRow = Math.floor(rows / 2);
      if (row === centerRow && col === centerCol) return "core";
      if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) return "armor";
      if (row === 1 || row === rows - 2) return Math.abs(col - centerCol) <= 2 ? "pulse" : "explosive";
      if (Math.abs(col - centerCol) === 2) return "explosive";
      if (Math.abs(row - centerRow) === 1 && Math.abs(col - centerCol) <= 1) return "pulse";
      return null;
    },
  },
  8: {
    name: "Mirror Bastion",
    cols: 11,
    rows: 7,
    driftChance: 0.7,
    driftAmplitudeBoost: 1.1,
    driftSpeedBoost: 1.02,
    sweepSpeedBoost: 1.12,
    sweepRows: (row) => row % 2 === 0,
    speedScale: 1.14,
    layout: ({ row, col, cols, rows }) => {
      const centerCol = Math.floor(cols / 2);
      const midRow = Math.floor(rows / 2);
      const wingDepth = row <= midRow ? row + 1 : rows - row;
      const leftWing = col <= centerCol - 1 && col >= centerCol - wingDepth - 2;
      const rightWing = col >= centerCol + 1 && col <= centerCol + wingDepth + 2;
      const spine = col === centerCol && row !== 2 && row !== rows - 3;
      const bridge = row === midRow && Math.abs(col - centerCol) <= 1;
      return leftWing || rightWing || spine || bridge;
    },
    pickType: ({ row, col, cols, rows }) => {
      const centerCol = Math.floor(cols / 2);
      const midRow = Math.floor(rows / 2);
      if (row === midRow && col === centerCol) return "core";
      if (col === centerCol) return row % 2 === 0 ? "pulse" : "armor";
      if (row === midRow && Math.abs(col - centerCol) <= 1) return "explosive";
      if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) return "armor";
      if (Math.abs(col - centerCol) === 1) return "pulse";
      if ((row + col) % 2 === 0) return "explosive";
      return null;
    },
  },
  9: {
    name: "Skybridge",
    cols: 10,
    rows: 7,
    driftChance: 0.76,
    driftAmplitudeBoost: 1.16,
    driftSpeedBoost: 1.05,
    sweepSpeedBoost: 1.18,
    sweepRows: () => true,
    speedScale: 1.18,
    layout: ({ row, col, cols, rows }) => {
      const centerCol = Math.floor(cols / 2);
      const bridgeRow = Math.floor(rows / 2);
      const railRows = [1, rows - 2];
      const supportCols = [1, centerCol, cols - 2];
      const bridge = row === bridgeRow;
      const rail = railRows.includes(row) && Math.abs(col - centerCol) <= 3;
      const support = supportCols.includes(col) && row <= bridgeRow + 1;
      const deckPockets = row % 2 === 0 && Math.abs(col - centerCol) <= 2;
      return bridge || rail || support || deckPockets;
    },
    pickType: ({ row, col, cols, rows }) => {
      const centerCol = Math.floor(cols / 2);
      const bridgeRow = Math.floor(rows / 2);
      if (row === bridgeRow && col === centerCol) return "core";
      if (col === centerCol) return "pulse";
      if (row === bridgeRow) return (col + row) % 2 === 0 ? "explosive" : "pulse";
      if (row === 1 || row === rows - 2) return "armor";
      if (col === 1 || col === cols - 2) return "armor";
      if (Math.abs(col - centerCol) <= 1) return "pulse";
      if ((row + col) % 2 === 0) return "basic";
      return null;
    },
  },
  10: {
    name: "Shatter Crown",
    cols: 11,
    rows: 7,
    driftChance: 0.68,
    driftAmplitudeBoost: 1.2,
    driftSpeedBoost: 1.06,
    sweepSpeedBoost: 1.24,
    sweepRows: (row) => row === 1 || row === 3 || row === 5,
    speedScale: 1.24,
    layout: ({ row, col, cols, rows }) => {
      const centerCol = Math.floor(cols / 2);
      const centerRow = Math.floor(rows / 2);
      const cornerFortress =
        (row < 2 && (col < 3 || col > cols - 4)) ||
        (row > rows - 3 && (col < 3 || col > cols - 4));
      const crown = Math.abs(row - centerRow) + Math.abs(col - centerCol) <= 3;
      const crownSpine = col === centerCol && row >= 1 && row <= rows - 2;
      return cornerFortress || crown || crownSpine;
    },
    pickType: ({ row, col, cols, rows }) => {
      const centerCol = Math.floor(cols / 2);
      const centerRow = Math.floor(rows / 2);
      const edge = row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
      if (row === centerRow && col === centerCol) return "core";
      if (edge) return "armor";
      if (Math.abs(row - centerRow) + Math.abs(col - centerCol) <= 2) return "explosive";
      if (col === centerCol || row === centerRow) return "pulse";
      if ((row + col) % 2 === 0) return "armor";
      return null;
    },
  },
  11: {
    name: "Bloom Engine",
    cols: 11,
    rows: 7,
    driftChance: 0.85,
    driftAmplitudeBoost: 1.28,
    driftSpeedBoost: 1.1,
    sweepSpeedBoost: 1.3,
    sweepRows: (row) => row % 2 === 1,
    speedScale: 1.32,
    layout: ({ row, col, cols, rows }) => {
      const centerCol = Math.floor(cols / 2);
      const centerRow = Math.floor(rows / 2);
      const cross = row === centerRow || col === centerCol;
      const bloom = Math.abs(row - centerRow) + Math.abs(col - centerCol) <= 3;
      const petals = Math.abs(row - centerRow) === Math.abs(col - centerCol) && row !== centerRow;
      return cross || bloom || petals;
    },
    pickType: ({ row, col, cols, rows }) => {
      const centerCol = Math.floor(cols / 2);
      const centerRow = Math.floor(rows / 2);
      if (row === centerRow && col === centerCol) return "core";
      if (row === centerRow || col === centerCol) return (row + col) % 2 === 0 ? "pulse" : "basic";
      if (Math.abs(row - centerRow) + Math.abs(col - centerCol) <= 2) return "explosive";
      if (Math.abs(row - centerRow) === Math.abs(col - centerCol)) return "armor";
      if ((row + col) % 2 === 0) return "pulse";
      return null;
    },
  },
};

const state = {
  width: 1280,
  height: 720,
  running: false,
  gameOver: false,
  score: 0,
  lives: 3,
  level: 1,
  combo: 1,
  comboTimer: 0,
  overdrive: 0,
  overdriveTimer: 0,
  pendingWaveTimer: 0,
  clock: 0,
  scenePulse: 0,
  shake: 0,
  flash: 0,
  timeScale: 1,
  slowTimer: 0,
  hitStopTimer: 0,
  finaleMode: false,
  finaleTriggered: false,
  powerupBanner: null,
  message: "Stabilizing arena...",
  messageTimer: 0,
  pointerX: 0,
  inputMode: "keyboard",
  pointerActive: false,
  particles: [],
  floatingTexts: [],
  pickups: [],
  hazards: [],
  rowOffsets: [],
  rowVelocities: [],
  stars: [],
  lastTs: 0,
  audioReady: false,
  keyboard: { left: false, right: false },
  paddle: {
    x: 0,
    y: 0,
    vx: 0,
    width: 112,
    height: 18,
    speed: 1100,
    acceleration: 6200,
    brake: 5600,
    baseWidth: 112,
    glow: 0,
    shieldTimer: 0,
    multiballTimer: 0,
    plasmaTimer: 0,
  },
  balls: [],
  bricks: [],
  arena: {
    marginX: 76,
    top: 92,
    bottom: 46,
  },
};

function getLateWaveProfile(level) {
  return lateWaveProfiles[level] || null;
}

function pickDefaultBrickType(level, row, col, cols, roll) {
  let type = "basic";
  if (roll > 0.9) type = "pulse";
  else if (roll > 0.79) type = "explosive";
  else if (roll > 0.64 || row === 0) type = "armor";
  if (level % 3 === 0 && row === 1 && col === Math.floor(cols / 2)) {
    type = "core";
  }
  return type;
}

function pickWaveBrickType(level, row, col, cols, rows, roll, profile) {
  if (profile?.pickType) {
    const picked = profile.pickType({ level, row, col, cols, rows, roll });
    if (picked) return picked;
  }
  return pickDefaultBrickType(level, row, col, cols, roll);
}

function pulseScene(amount = 0.18) {
  state.scenePulse = Math.min(1.6, state.scenePulse + amount);
}

class Synth {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicSource = null;
    this.musicGain = null;
    this.musicBuffers = {};
    this.musicLevel = 0;
    this.musicGen = 0;
  }

  ensure() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.38;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.045;
      this.musicBus.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  beep({ frequency = 440, duration = 0.12, type = "sine", gain = 0.3, slide = 1 }) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, frequency * slide),
      now + duration,
    );
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  noise({ duration = 0.14, gain = 0.12, highpass = 800 }) {
    if (!this.ctx) return;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = highpass;
    const amp = this.ctx.createGain();
    const now = this.ctx.currentTime;
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(this.master);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  impact(intensity = 1) {
    const base = 280 + Math.random() * 120;
    this.beep({ frequency: base, duration: 0.06, type: "triangle", gain: 0.07 * intensity, slide: 1.22 });
    this.beep({ frequency: base * 1.56, duration: 0.04, type: "sine", gain: 0.028 * intensity, slide: 0.92 });
    this.noise({ duration: 0.03 + intensity * 0.02, gain: 0.012 * intensity, highpass: 1100 });
  }

  brick(type) {
    const map = {
      basic: [320, 0.1, "triangle"],
      armor: [180, 0.16, "square"],
      explosive: [230, 0.2, "sawtooth"],
      pulse: [480, 0.1, "triangle"],
      core: [130, 0.24, "sawtooth"],
    };
    const [frequency, duration, wave] = map[type];
    const accents = {
      basic: [frequency * 1.18, 0.05, "sine", 0.045],
      armor: [frequency * 0.72, 0.08, "square", 0.04],
      explosive: [frequency * 1.55, 0.08, "triangle", 0.058],
      pulse: [frequency * 1.72, 0.06, "sine", 0.05],
      core: [frequency * 2.1, 0.12, "triangle", 0.08],
    };
    const [accentFreq, accentDur, accentWave, accentGain] = accents[type];
    this.beep({ frequency, duration, type: wave, gain: 0.11, slide: type === "pulse" ? 1.82 : 0.74 });
    this.beep({
      frequency: accentFreq,
      duration: accentDur,
      type: accentWave,
      gain: accentGain,
      slide: type === "armor" ? 0.94 : 1.16,
    });
    if (type === "armor") {
      this.beep({ frequency: frequency * 2.2, duration: 0.04, type: "sine", gain: 0.025, slide: 0.96 });
    } else if (type === "pulse") {
      this.beep({ frequency: frequency * 2.0, duration: 0.05, type: "triangle", gain: 0.03, slide: 0.98 });
    } else if (type === "explosive" || type === "core") {
      this.noise({ duration: 0.12 + Math.random() * 0.06, gain: 0.06 + (type === "core" ? 0.04 : 0.02) });
      this.beep({ frequency: frequency * 0.52, duration: 0.08, type: "sine", gain: 0.032, slide: 0.9 });
    }
  }

  pickup(kind) {
    const tones = {
      widen: [510, 0.18],
      multiball: [660, 0.18],
      slow: [420, 0.24],
      shield: [560, 0.18],
      plasma: [740, 0.2],
      life: [820, 0.22],
    };
    const [frequency, duration] = tones[kind] || [520, 0.16];
    this.beep({ frequency, duration, type: "triangle", gain: 0.12, slide: 1.6 });
    this.beep({ frequency: frequency * 1.5, duration: duration * 0.8, type: "sine", gain: 0.06, slide: 0.9 });
    if (kind === "life") {
      this.beep({ frequency: frequency * 2, duration: duration * 0.6, type: "triangle", gain: 0.04, slide: 1.08 });
    }
  }

  loss() {
    this.beep({ frequency: 180, duration: 0.3, type: "sawtooth", gain: 0.12, slide: 0.44 });
    this.beep({ frequency: 110, duration: 0.22, type: "sine", gain: 0.04, slide: 0.72 });
    this.noise({ duration: 0.2, gain: 0.08, highpass: 500 });
  }

  launch() {
    this.beep({ frequency: 380, duration: 0.08, type: "square", gain: 0.08, slide: 1.68 });
    this.beep({ frequency: 720, duration: 0.06, type: "triangle", gain: 0.035, slide: 0.9 });
    this.noise({ duration: 0.035, gain: 0.01, highpass: 1500 });
  }

  overdrive() {
    this.beep({ frequency: 280, duration: 0.15, type: "sawtooth", gain: 0.12, slide: 1.92 });
    this.beep({ frequency: 560, duration: 0.22, type: "triangle", gain: 0.09, slide: 1.16 });
    this.beep({ frequency: 840, duration: 0.18, type: "sine", gain: 0.04, slide: 0.94 });
    this.noise({ duration: 0.08, gain: 0.025, highpass: 1000 });
  }

  hazard() {
    this.beep({ frequency: 210, duration: 0.1, type: "square", gain: 0.08, slide: 0.78 });
    this.beep({ frequency: 420, duration: 0.06, type: "triangle", gain: 0.035, slide: 0.94 });
  }

  waveRise(level, label) {
    const base = 156 + level * 5;
    this.beep({ frequency: base, duration: 0.18, type: "sawtooth", gain: 0.055, slide: 0.7 });
    this.beep({ frequency: base * 1.88, duration: 0.16, type: "triangle", gain: 0.045, slide: 1.18 });
    this.beep({ frequency: base * 2.66, duration: 0.08, type: "sine", gain: 0.022, slide: 0.96 });
    if (label) {
      this.beep({ frequency: 620, duration: 0.1, type: "sine", gain: 0.03, slide: 0.98 });
    }
  }

  combo(combo) {
    const base = 360 + Math.min(260, combo * 14);
    this.beep({ frequency: base, duration: 0.08, type: "triangle", gain: 0.07, slide: 1.42 });
    if (combo % 3 === 0) {
      this.beep({ frequency: base * 1.5, duration: 0.11, type: "sine", gain: 0.045, slide: 0.88 });
      this.noise({ duration: 0.03, gain: 0.01, highpass: 1600 });
    }
  }

  finale() {
    this.beep({ frequency: 240, duration: 0.14, type: "sawtooth", gain: 0.11, slide: 1.72 });
    this.beep({ frequency: 480, duration: 0.22, type: "triangle", gain: 0.08, slide: 1.16 });
    this.beep({ frequency: 96, duration: 0.3, type: "sine", gain: 0.035, slide: 0.88 });
    this.noise({ duration: 0.1, gain: 0.035, highpass: 900 });
  }

  waveClear() {
    this.beep({ frequency: 520, duration: 0.08, type: "triangle", gain: 0.08, slide: 1.18 });
    this.beep({ frequency: 780, duration: 0.12, type: "sine", gain: 0.05, slide: 0.95 });
  }

  paddleHit(power = 1) {
    const base = 360 + power * 42;
    this.beep({ frequency: base, duration: 0.06, type: "triangle", gain: 0.08, slide: 1.16 });
    this.beep({ frequency: base * 1.95, duration: 0.04, type: "sine", gain: 0.028, slide: 0.92 });
  }

  async loadMusic(level) {
    if (!this.ctx || this.musicBuffers[level]) return this.musicBuffers[level];
    try {
      const res = await fetch(`assets/Level_${level}.mp3`);
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      this.musicBuffers[level] = await this.ctx.decodeAudioData(arrayBuf);
      return this.musicBuffers[level];
    } catch {
      return null;
    }
  }

  async playMusic(level) {
    if (!this.ctx) return;
    if (this.musicLevel === level && this.musicSource) return;
    if (this.musicSource) {
      try { this.musicSource.stop(); } catch {}
      this.musicSource = null;
      this.musicGain = null;
    }
    const gen = ++this.musicGen;
    const buffer = await this.loadMusic(level);
    if (!buffer || gen !== this.musicGen) { if (gen === this.musicGen) this.musicLevel = 0; return; }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 0.5);
    source.connect(gain);
    gain.connect(this.musicBus);
    source.start();
    this.musicSource = source;
    this.musicGain = gain;
    this.musicLevel = level;
  }

  stopMusic() {
    this.musicGen++;
    if (!this.ctx || !this.musicSource) { this.musicLevel = 0; return; }
    try { this.musicSource.stop(); } catch {}
    this.musicSource = null;
    this.musicGain = null;
    this.musicLevel = 0;
  }
}

const synth = new Synth();

function clampBallAngle(ball) {
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed === 0) return;
  const minVy = speed * 0.36;
  if (Math.abs(ball.vy) < minVy) {
    ball.vy = (ball.vy < 0 ? -1 : 1) * minVy;
    ball.vx = (ball.vx < 0 ? -1 : 1) * Math.sqrt(Math.max(0, speed * speed - ball.vy * ball.vy));
  }
}

function circleIntersectsRect(circleX, circleY, radius, rectX, rectY, rectWidth, rectHeight) {
  const closestX = Math.max(rectX, Math.min(circleX, rectX + rectWidth));
  const closestY = Math.max(rectY, Math.min(circleY, rectY + rectHeight));
  const dx = circleX - closestX;
  const dy = circleY - closestY;
  return dx * dx + dy * dy <= radius * radius;
}

function moveToward(current, target, maxDelta) {
  if (current < target) return Math.min(target, current + maxDelta);
  if (current > target) return Math.max(target, current - maxDelta);
  return target;
}

const GAME_W = 1280;
const GAME_H = 720;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = GAME_W * dpr;
  canvas.height = GAME_H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.width = GAME_W;
  state.height = GAME_H;
  const bounds = canvas.parentElement.getBoundingClientRect();
  const scale = Math.min(bounds.width / GAME_W, bounds.height / GAME_H);
  canvas.style.width = `${Math.round(GAME_W * scale)}px`;
  canvas.style.height = `${Math.round(GAME_H * scale)}px`;
  if (!state.stars.length) {
    state.stars = Array.from({ length: 70 }, () => ({
      x: Math.random() * GAME_W,
      y: Math.random() * GAME_H,
      r: Math.random() * 2.2 + 0.3,
      speed: Math.random() * 24 + 12,
      alpha: Math.random() * 0.7 + 0.2,
    }));
  }
  positionPaddle();
}

function positionPaddle() {
  state.paddle.y = state.height - 64;
  state.paddle.vx = 0;
  if (!state.paddle.x) {
    state.paddle.x = state.width / 2 - state.paddle.width / 2;
  }
  state.pointerX = state.paddle.x + state.paddle.width / 2;
  const ball = state.balls[0];
  if (ball?.stuck) {
    ball.x = state.paddle.x + state.paddle.width / 2;
    ball.y = state.paddle.y - ball.radius - 10;
  }
}

function resetBall() {
  state.balls = [{
    x: state.paddle.x + state.paddle.width / 2,
    y: state.paddle.y - 20,
    vx: 320,
    vy: -(Math.min(760, 520 + state.level * 14)),
    radius: 10,
    stuck: true,
    trail: [],
    energy: 0,
  }];
}

function resetRun(fullReset = false) {
  if (state.pendingWaveTimer) {
    clearTimeout(state.pendingWaveTimer);
    state.pendingWaveTimer = 0;
  }
  state.running = false;
  state.gameOver = false;
  if (fullReset) {
    synth.stopMusic();
    state.score = 0;
    state.lives = 3;
    state.level = 1;
    state.combo = 1;
    state.overdrive = 0;
    state.comboTimer = 0;
    state.overdriveTimer = 0;
    state.hazards = [];
    state.pickups = [];
    state.particles = [];
    state.floatingTexts = [];
    state.paddle.width = state.paddle.baseWidth;
    state.powerupBanner = null;
    state.rowOffsets = [];
    state.rowVelocities = [];
    state.paddle.shieldTimer = 0;
    state.paddle.multiballTimer = 0;
    state.paddle.plasmaTimer = 0;
    state.finaleMode = false;
    state.finaleTriggered = false;
    state.clock = 0;
  }
  state.shake = 0;
  state.flash = 0;
  state.slowTimer = 0;
  state.timeScale = 1;
  buildLevel(state.level);
  positionPaddle();
  resetBall();
  syncHud();
}

function buildLevel(level) {
  const profile = getLateWaveProfile(level);
  state.finaleMode = false;
  state.finaleTriggered = false;
  state.bricks = [];
  const cols = profile?.cols ?? Math.min(7 + level, 11);
  const rows = profile?.rows ?? Math.min(4 + Math.floor(level / 2), 7);
  const gap = 10;
  const marginX = state.arena.marginX;
  const top = state.arena.top;
  const usableWidth = state.width - marginX * 2;
  const brickWidth = Math.max(62, (usableWidth - gap * (cols - 1)) / cols);
  const brickHeight = 28;
  const patterns = ["waves", "spire", "rings"];
  const pattern = profile ? "late-game" : patterns[(level - 1) % patterns.length];
  const waveLabel = profile?.name || null;
  const driftChance = profile?.driftChance ?? 0.55;
  const driftAmplitudeBoost = profile?.driftAmplitudeBoost ?? 1;
  const driftSpeedBoost = profile?.driftSpeedBoost ?? 1;
  const sweepSpeedBoost = profile?.sweepSpeedBoost ?? 1;
  const speedScale = profile?.speedScale ?? 1 + Math.max(0, level - 6) * 0.14;
  const sweepRows = profile?.sweepRows || ((row) => row % 2 === 1);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      let active = true;
      if (profile) {
        active = profile.layout({ level, row, col, cols, rows });
      } else if (pattern === "waves") {
        active = (row + col) % 2 === 0 || row < 2;
      } else if (pattern === "spire") {
        const center = (cols - 1) / 2;
        active = Math.abs(col - center) <= row * 0.75 + 1;
      } else {
        const dx = col - (cols - 1) / 2;
        const dy = row - (rows - 1) / 2;
        const dist = Math.round(Math.sqrt(dx * dx + dy * dy));
        active = dist % 2 === 0 || row === 0;
      }
      if (!active) continue;

      const roll = Math.random();
      const type = pickWaveBrickType(level, row, col, cols, rows, roll, profile);

      const bx = marginX + col * (brickWidth + gap);
      const def = brickTypes[type];
      state.bricks.push({
        x: bx,
        y: top + row * (brickHeight + gap),
        width: brickWidth,
        height: brickHeight,
        type,
        hp: def.hp + Math.max(0, Math.floor((level - 1) / 4) - (type === "basic" ? 0 : 1)),
        pulse: Math.random() * TAU,
        hitGlow: 0,
        alive: true,
        row,
        baseX: bx,
        moveType: "none",
        driftPhase: 0,
        driftSpeed: 0,
        driftAmplitude: 0,
      });
    }
  }

  // Movement type progression:
  // L1=none, L2=drift, L3=sweep, L4=sentinel, L5=drift+sweep, L6+=all
  const hasDrift    = profile ? true : level === 2 || level >= 5;
  const hasSweep    = profile ? true : level === 3 || level >= 5;
  const hasSentinel = profile ? true : level === 4 || level >= 6;

  // Initialise per-row sweep state
  state.rowOffsets   = Array(rows).fill(0);
  state.rowVelocities = Array(rows).fill(0);
  if (hasSweep) {
    for (let r = 0; r < rows; r += 1) {
      if (!sweepRows(r, rows)) continue;
      const base = (52 + Math.random() * 68) * speedScale * sweepSpeedBoost;
      state.rowVelocities[r] = (Math.random() > 0.5 ? 1 : -1) * base;
    }
  }

  // Assign movement to each brick
  for (const brick of state.bricks) {
    const rowSweeps = hasSweep && sweepRows(brick.row, rows);
    if (hasSentinel && brick.type === "armor") {
      brick.moveType = "sentinel";
      brick.driftPhase = Math.random() * TAU;
      brick.driftSpeed = (0.42 + Math.random() * 0.28) * speedScale * driftSpeedBoost;
      brick.driftAmplitude = 62 + Math.random() * 58;
    } else if (rowSweeps) {
      brick.moveType = "sweep";
    } else if (hasDrift && (brick.type === "basic" || brick.type === "pulse") && Math.random() < driftChance) {
      brick.moveType = "drift";
      brick.driftPhase = Math.random() * TAU;
      brick.driftSpeed = (0.5 + Math.random() * 0.9) * speedScale * driftSpeedBoost;
      brick.driftAmplitude = (26 + Math.random() * 54) * driftAmplitudeBoost;
    }
  }

  setMessage(
    waveLabel ? `Wave ${level} — ${waveLabel} entering the arena` : `Wave ${level} entering the arena`,
    2.4,
  );
  pulseScene(profile ? 0.9 : 0.6);
  if (state.audioReady) {
    synth.waveRise(level, waveLabel);
    synth.playMusic(level);
  }
}

function jumpToLevel(level) {
  if (!state.audioReady) { synth.ensure(); state.audioReady = true; }
  resetRun(true);
  synth.stopMusic();
  state.level = level;
  buildLevel(level);
  positionPaddle();
  resetBall();
  syncHud();
  hud.overlay.classList.remove("visible");
  const profile = getLateWaveProfile(level);
  setMessage(profile ? `DEV — Wave ${level} · ${profile.name}` : `DEV — Wave ${level}`, 2.5);
}

function startGame() {
  synth.ensure();
  state.audioReady = true;

  overlayTitle.textContent = defaultOverlayTitle;
  overlayBody.textContent = defaultOverlayBody;
  hud.startButton.textContent = "Start Siege";
  hud.overlay.classList.remove("visible");
  resetRun(true);
}

function launchBall() {
  const anchored = state.balls.some((ball) => ball.stuck);
  if (!anchored) return;
  for (const ball of state.balls) {
    if (ball.stuck) {
      ball.stuck = false;
      const offset = ((ball.x - (state.paddle.x + state.paddle.width / 2)) / state.paddle.width) * 180;
      ball.vx += offset;
      ball.vy = -Math.abs(ball.vy);
    }
  }
  state.running = true;
  synth.launch();
  pulseScene(0.12);
}

function activateOverdrive() {
  state.overdrive = 100;
  state.overdriveTimer = 10;
  state.paddle.plasmaTimer = Math.max(state.paddle.plasmaTimer, 10);
  state.flash = 0.7;
  state.shake = Math.max(state.shake, 16);
  pulseScene(0.95);
  addFloatingText(state.width / 2, state.height * 0.56, "OVERDRIVE", "#ffd166", 1.6);
  setMessage("Overdrive engaged: plasma ball cuts through the grid", 2.6);
  synth.overdrive();
}

function setMessage(text, duration = 1.8) {
  state.message = text;
  state.messageTimer = duration;
  hud.message.textContent = text;
}

function addFloatingText(x, y, text, color = "#ffffff", size = 1) {
  state.floatingTexts.push({ x, y, text, color, age: 0, life: 1.1, size });
}

function awardScore(points, x, y) {
  const total = Math.round(points * state.combo * (state.overdriveTimer > 0 ? 1.4 : 1));
  state.score += total;
  state.overdrive = Math.min(100, state.overdrive + total * 0.01);
  addFloatingText(x, y, `+${total}`, "#f5f4ef", 1);
  if (state.combo > 1 && (state.combo % 4 === 0 || total >= 500)) {
    synth.combo(state.combo);
  }
  if (state.overdrive >= 100 && state.overdriveTimer <= 0) {
    activateOverdrive();
  }
}

function spawnParticles(x, y, color, count = 14, speed = 260) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * TAU;
    const force = Math.random() * speed;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * force,
      vy: Math.sin(angle) * force,
      life: Math.random() * 0.6 + 0.25,
      age: 0,
      color,
      size: Math.random() * 4 + 2,
    });
  }
}

function dropPickup(x, y) {
  const kinds = ["widen", "multiball", "slow", "shield", "plasma", "life"];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  state.pickups.push({
    x,
    y,
    vy: 140,
    radius: 13,
    kind,
    pulse: Math.random() * TAU,
  });
}

function createExtraBall(source) {
  const speed = Math.min(900, Math.hypot(source.vx, source.vy) + 40);
  const angle = -Math.PI / 2 + (Math.random() * 1.1 - 0.55);
  state.balls.push({
    x: source.x,
    y: source.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 9,
    stuck: false,
    trail: [],
    energy: 0,
  });
}

function applyPickup(kind) {
  if (kind === "widen") {
    state.paddle.width = Math.min(state.paddle.baseWidth * 1.75, state.paddle.width + 48);
    setMessage("Fusion bat expanded", 1.8);
  } else if (kind === "multiball") {
    const source = state.balls[0];
    if (source) {
      createExtraBall(source);
      createExtraBall(source);
    }
    state.paddle.multiballTimer = 10;
    setMessage("Drone split active: multiball online", 1.8);
  } else if (kind === "slow") {
    state.slowTimer = 7;
    setMessage("Time rift opened: enemy motion slowed", 1.8);
  } else if (kind === "shield") {
    state.paddle.shieldTimer = 12;
    setMessage("Reflective shield deployed", 1.8);
  } else if (kind === "plasma") {
    state.paddle.plasmaTimer = Math.max(state.paddle.plasmaTimer, 8);
    setMessage("Plasma lane charged", 1.8);
  } else if (kind === "life") {
    state.lives += 1;
    setMessage("Extra interceptor granted", 1.8);
  }
  const bannerDefs = {
    widen:     { name: "FUSION BAT",      desc: "Paddle width expanded",        color: "#75f0ff", letter: "W" },
    multiball: { name: "DRONE SPLIT",     desc: "Two extra balls deployed",      color: "#ff5fcf", letter: "M" },
    slow:      { name: "TIME RIFT",       desc: "Enemy motion slowed",           color: "#cbff65", letter: "S" },
    shield:    { name: "REFLEC SHIELD",   desc: "Next hit absorbed",             color: "#9ee5ff", letter: "B" },
    plasma:    { name: "PLASMA LANE",     desc: "Ball pierces bricks (x2 dmg)",  color: "#ffd166", letter: "P" },
    life:      { name: "EXTRA LIFE",      desc: "+1 interceptor granted",        color: "#ff7a45", letter: "+" },
  };
  const bd = bannerDefs[kind];
  if (bd) state.powerupBanner = { ...bd, timer: 2.4, maxTimer: 2.4 };

  pulseScene(0.22);
  spawnParticles(state.paddle.x + state.paddle.width / 2, state.paddle.y, "#ffd166", 18, 300);
  synth.pickup(kind);
}

function loseLife() {
  if (state.paddle.shieldTimer > 0) {
    state.paddle.shieldTimer = 0;
    state.running = false;
    state.hazards = [];
    state.flash = 0.5;
    state.shake = 14;
    setMessage("Shield spent: hull integrity preserved", 2);
    synth.hazard();
    resetBall();
    return;
  }

  state.lives -= 1;
  state.combo = 1;
  state.comboTimer = 0;
  state.overdrive = Math.max(0, state.overdrive - 35);
  state.running = false;
  state.flash = 0.75;
  state.shake = 24;
  pulseScene(0.32);
  spawnParticles(state.width / 2, state.height - 60, "#ff7a45", 26, 340);
  synth.loss();

  if (state.lives <= 0) {
    state.gameOver = true;
    hud.overlay.classList.add("visible");
    hud.startButton.textContent = "Restart Siege";
    overlayTitle.textContent = "Arena lost";
    overlayBody.textContent =
      `Final score ${state.score}. Reboot the platform and push deeper into the siege grid.`;
  } else {
    setMessage("Interceptor destroyed. Reposition and relaunch.", 2.4);
    resetBall();
  }
}

function destroyBrick(brick, ball) {
  brick.alive = false;
  state.combo += 1;
  state.comboTimer = 2.8;
  state.flash = Math.min(0.5, state.flash + (brick.type === "core" ? 0.28 : 0.08));
  state.shake = Math.max(state.shake, brick.type === "core" ? 18 : brick.type === "explosive" ? 12 : 6);
  pulseScene(brick.type === "core" ? 0.22 : brick.type === "explosive" ? 0.14 : 0.06);
  awardScore(brickTypes[brick.type].score, brick.x + brick.width / 2, brick.y + brick.height / 2);
  spawnParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, brickTypes[brick.type].color, brick.type === "core" ? 34 : 16);
  synth.brick(brick.type);
  if (brick.type === 'core') state.hitStopTimer = 0.09;
  else if (brick.type === 'explosive') state.hitStopTimer = 0.05;

  if (brick.type === "explosive") {
    explodeAround(brick);
  } else if (brick.type === "pulse") {
    repelHazards(brick.x + brick.width / 2, brick.y + brick.height / 2);
  } else if (brick.type === "core") {
    unleashCoreVolley(brick);
  }

  if (Math.random() < 0.18 || brick.type === "core") {
    dropPickup(brick.x + brick.width / 2, brick.y + brick.height / 2);
  }

  if (ball) {
    ball.energy = Math.min(1, ball.energy + 0.2);
  }

  if (state.bricks.every((candidate) => !candidate.alive)) {
    state.level += 1;
    state.running = false;
    setMessage("Wave erased. Warping next assault pattern.", 2.4);
    synth.waveClear();
    state.paddle.width = Math.max(state.paddle.baseWidth, state.paddle.width * 0.96);
    state.pendingWaveTimer = window.setTimeout(() => {
      buildLevel(state.level);
      resetBall();
      state.pendingWaveTimer = 0;
      syncHud();
    }, 650);
  }
}

function explodeAround(source) {
  const cx = source.x + source.width / 2;
  const cy = source.y + source.height / 2;
  for (const brick of state.bricks) {
    if (!brick.alive || brick === source) continue;
    const bx = brick.x + brick.width / 2;
    const by = brick.y + brick.height / 2;
    if (Math.hypot(cx - bx, cy - by) < 96) {
      brick.hp -= 1;
      brick.hitGlow = 1;
      if (brick.hp <= 0) destroyBrick(brick);
    }
  }
}

function repelHazards(x, y) {
  for (const hazard of state.hazards) {
    const dx = hazard.x - x;
    const dy = hazard.y - y;
    const dist = Math.max(60, Math.hypot(dx, dy));
    hazard.vx += (dx / dist) * 220;
    hazard.vy += (dy / dist) * 180;
  }
}

function unleashCoreVolley(brick) {
  const centerX = brick.x + brick.width / 2;
  const centerY = brick.y + brick.height / 2;
  for (let i = -2; i <= 2; i += 1) {
    state.hazards.push({
      x: centerX + i * 10,
      y: centerY,
      vx: i * 40,
      vy: 180 + Math.abs(i) * 18,
      radius: 8,
      life: 7,
      spawnGlow: 1,
    });
  }
  setMessage("Dread core detonated: scatter volley incoming", 2.4);
}

function bounceBallFromPaddle(ball) {
  const hit = (ball.x - state.paddle.x) / state.paddle.width;
  const angle = (-Math.PI * 0.85) + hit * Math.PI * 0.7;
  const speed = Math.min(
    state.overdriveTimer > 0 ? 980 : 860,
    Math.max(420, Math.hypot(ball.vx, ball.vy) + 18),
  );
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
  ball.y = state.paddle.y - ball.radius - 1;
  ball.energy = Math.min(1, ball.energy + 0.08);
  state.paddle.glow = 1;
  synth.impact(1.2);
  clampBallAngle(ball);
}

function syncHud() {
  hud.score.textContent = Math.round(state.score).toLocaleString();
  hud.lives.textContent = state.lives;
  hud.level.textContent = state.level;
  hud.overdriveFill.style.width = `${Math.max(0, Math.min(100, state.overdrive))}%`;
  hud.combo.textContent = `Combo x${state.combo}`;
  hud.message.textContent = state.message;
}

function updatePaddle(dt) {
  if (state.inputMode === "pointer" && state.pointerActive) {
    const targetX = state.pointerX - state.paddle.width / 2;
    const smoothing = 12;
    const alpha = 1 - Math.exp(-smoothing * dt);
    const prevX = state.paddle.x;
    state.paddle.x += (targetX - state.paddle.x) * alpha;
    state.paddle.vx = (state.paddle.x - prevX) / dt;
  } else {
    const input = (state.keyboard.right ? 1 : 0) - (state.keyboard.left ? 1 : 0);
    const targetVelocity = input * state.paddle.speed;
    const response = input === 0 ? state.paddle.brake : state.paddle.acceleration;
    state.paddle.vx = moveToward(state.paddle.vx, targetVelocity, response * dt);
    if (input === 0 && Math.abs(state.paddle.vx) < 8) state.paddle.vx = 0;
    state.paddle.x += state.paddle.vx * dt;
  }

  const minX = state.arena.marginX * 0.45;
  const maxX = state.width - state.paddle.width - state.arena.marginX * 0.45;
  state.paddle.x = Math.max(
    minX,
    Math.min(maxX, state.paddle.x),
  );
  if ((state.paddle.x === minX && state.paddle.vx < 0) || (state.paddle.x === maxX && state.paddle.vx > 0)) {
    state.paddle.vx = 0;
  }

  if (state.paddle.glow > 0) state.paddle.glow = Math.max(0, state.paddle.glow - dt * 3);
  if (state.paddle.shieldTimer > 0) state.paddle.shieldTimer -= dt;
  if (state.paddle.multiballTimer > 0) state.paddle.multiballTimer -= dt;
  if (state.paddle.plasmaTimer > 0) state.paddle.plasmaTimer -= dt;

  for (const ball of state.balls) {
    if (ball.stuck) {
      ball.x = state.paddle.x + state.paddle.width / 2;
      ball.y = state.paddle.y - ball.radius - 10;
    }
  }
}

function updateBalls(dt) {
  const arenaLeft = state.arena.marginX * 0.45;
  const arenaRight = state.width - state.arena.marginX * 0.45;
  const arenaTop = 30;

  for (const ball of state.balls) {
    if (ball.stuck) continue;
    ball.x += ball.vx * dt * state.timeScale;
    ball.y += ball.vy * dt * state.timeScale;
    ball.trail.push({ x: ball.x, y: ball.y, life: 0.4 });
    if (ball.trail.length > 12) ball.trail.shift();

    if (ball.x - ball.radius <= arenaLeft) {
      ball.x = arenaLeft + ball.radius;
      ball.vx = Math.abs(ball.vx);
      synth.impact(0.8);
      clampBallAngle(ball);
    } else if (ball.x + ball.radius >= arenaRight) {
      ball.x = arenaRight - ball.radius;
      ball.vx = -Math.abs(ball.vx);
      synth.impact(0.8);
      clampBallAngle(ball);
    }

    if (ball.y - ball.radius <= arenaTop) {
      ball.y = arenaTop + ball.radius;
      ball.vy = Math.abs(ball.vy);
      synth.impact(0.8);
      clampBallAngle(ball);
    }

    if (
      ball.y + ball.radius >= state.paddle.y &&
      ball.y - ball.radius <= state.paddle.y + state.paddle.height &&
      ball.x >= state.paddle.x &&
      ball.x <= state.paddle.x + state.paddle.width &&
      ball.vy > 0
    ) {
      bounceBallFromPaddle(ball);
    }

    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      if (
        ball.x + ball.radius > brick.x &&
        ball.x - ball.radius < brick.x + brick.width &&
        ball.y + ball.radius > brick.y &&
        ball.y - ball.radius < brick.y + brick.height
      ) {
        brick.hp -= state.paddle.plasmaTimer > 0 ? 2 : 1;
        brick.hitGlow = 1;
        const overlapLeft = ball.x + ball.radius - brick.x;
        const overlapRight = brick.x + brick.width - (ball.x - ball.radius);
        const overlapTop = ball.y + ball.radius - brick.y;
        const overlapBottom = brick.y + brick.height - (ball.y - ball.radius);
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
        if (state.paddle.plasmaTimer <= 0) {
          if (minOverlap === overlapLeft) ball.vx = -Math.abs(ball.vx);
          else if (minOverlap === overlapRight) ball.vx = Math.abs(ball.vx);
          else if (minOverlap === overlapTop) ball.vy = -Math.abs(ball.vy);
          else ball.vy = Math.abs(ball.vy);
        }
        if (brick.hp <= 0) destroyBrick(brick, ball);
        else {
          brick.hitGlow = 1;
          awardScore(35, brick.x + brick.width / 2, brick.y + brick.height / 2);
          synth.brick(brick.type);
        }
        break;
      }
    }
  }

  state.balls = state.balls.filter((ball) => ball.y - ball.radius <= state.height + 40);
  if (!state.balls.length) {
    loseLife();
  }
}

function updateHazards(dt) {
  if (Math.random() < 0.0015 * state.level && state.bricks.some((brick) => brick.alive && brick.type !== "core")) {
    const launchers = state.bricks.filter((brick) => brick.alive && (brick.type === "armor" || brick.type === "pulse"));
    if (launchers.length) {
      const brick = launchers[Math.floor(Math.random() * launchers.length)];
      state.hazards.push({
        x: brick.x + brick.width / 2,
        y: brick.y + brick.height,
        vx: (Math.random() - 0.5) * 90,
        vy: 220 + Math.random() * 80,
        radius: 7,
        life: 6,
        spawnGlow: 1,
      });
      synth.hazard();
    }
  }

  for (const hazard of state.hazards) {
    hazard.x += hazard.vx * dt * (state.slowTimer > 0 ? 0.55 : 1);
    hazard.y += hazard.vy * dt * (state.slowTimer > 0 ? 0.55 : 1);
    hazard.life -= dt;
    if (
      circleIntersectsRect(
        hazard.x,
        hazard.y,
        hazard.radius,
        state.paddle.x,
        state.paddle.y,
        state.paddle.width,
        state.paddle.height,
      )
    ) {
      if (state.paddle.shieldTimer > 0) {
        hazard.life = 0;
        spawnParticles(hazard.x, hazard.y, "#75f0ff", 10, 220);
      } else {
        hazard.life = 0;
        state.shake = Math.max(state.shake, 10);
        state.flash = Math.max(state.flash, 0.35);
        loseLife();
        break;
      }
    }
  }

  state.hazards = state.hazards.filter(
    (hazard) => hazard.life > 0 && hazard.y < state.height + 24 && hazard.x > -20 && hazard.x < state.width + 20,
  );
}

function updatePickups(dt) {
  for (const pickup of state.pickups) {
    pickup.y += pickup.vy * dt;
    pickup.pulse += dt * 5;
    if (
      pickup.y + pickup.radius >= state.paddle.y &&
      pickup.y - pickup.radius <= state.paddle.y + state.paddle.height &&
      pickup.x >= state.paddle.x - 12 &&
      pickup.x <= state.paddle.x + state.paddle.width + 12
    ) {
      applyPickup(pickup.kind);
      pickup.dead = true;
    }
  }
  state.pickups = state.pickups.filter((pickup) => !pickup.dead && pickup.y < state.height + 30);
}

function updateFx(dt) {
  state.clock += dt;
  state.scenePulse = Math.max(0, state.scenePulse - dt * 0.45);

  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.985;
    particle.vy *= 0.985;
    particle.age += dt;
  }
  state.particles = state.particles.filter((particle) => particle.age < particle.life);

  for (const text of state.floatingTexts) {
    text.y -= 48 * dt;
    text.age += dt;
  }
  state.floatingTexts = state.floatingTexts.filter((text) => text.age < text.life);

  for (const brick of state.bricks) {
    brick.pulse += dt * (brick.type === "pulse" ? 6 : 2.5);
    brick.hitGlow = Math.max(0, brick.hitGlow - dt * 4);
  }

  for (const star of state.stars) {
    star.y += star.speed * dt * (0.2 + state.level * 0.02);
    if (star.y > state.height + 20) {
      star.y = -10;
      star.x = Math.random() * state.width;
    }
  }

  for (const ball of state.balls) {
    for (const point of ball.trail) point.life -= dt;
    ball.trail = ball.trail.filter((point) => point.life > 0);
  }

  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
  } else if (state.combo > 1) {
    state.combo = 1;
  }

  if (state.overdriveTimer > 0) {
    state.overdriveTimer -= dt;
    state.overdrive = 100 * (state.overdriveTimer / 10);
  }

  if (state.slowTimer > 0) {
    state.slowTimer -= dt;
  }
  state.timeScale += (((state.slowTimer > 0 ? 0.72 : 1) - state.timeScale) * Math.min(1, dt * 4));

  if (state.messageTimer > 0) {
    state.messageTimer -= dt;
  } else if (!state.gameOver) {
    state.message = state.running ? "Arena hot. Keep the combo alive." : "Launch when ready.";
  }

  if (state.powerupBanner) {
    state.powerupBanner.timer -= dt;
    if (state.powerupBanner.timer <= 0) state.powerupBanner = null;
  }

  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.8);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 28);

  const aliveBricks = state.bricks.filter(b => b.alive).length;
  if (aliveBricks > 0 && aliveBricks <= 2 && !state.finaleTriggered) {
    state.finaleMode = true;
    state.finaleTriggered = true;
    // Speed boost for all non-stuck balls
    for (const ball of state.balls) {
      if (!ball.stuck) {
        const spd = Math.hypot(ball.vx, ball.vy);
        const boost = spd * 1.30;
        ball.vx = (ball.vx / spd) * boost;
        ball.vy = (ball.vy / spd) * boost;
      }
    }
    state.flash = Math.max(state.flash, 0.55);
    state.shake = Math.max(state.shake, 14);
    addFloatingText(state.width / 2, state.height * 0.52, 'SIEGE FINALE', '#ff4f9f', 1.8);
    setMessage('Siege Finale — no escape for the last stronghold', 3.0);
    synth.finale();
  }

  syncHud();
}

function updateBricks(dt) {
  const arenaLeft  = state.arena.marginX * 0.45;
  const arenaRight = state.width - state.arena.marginX * 0.45;

  // Independent drifters and pendulum sentinels
  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    if (brick.moveType === "drift" || brick.moveType === "sentinel") {
      brick.driftPhase += brick.driftSpeed * dt;
      const nx = brick.baseX + Math.sin(brick.driftPhase) * brick.driftAmplitude;
      brick.x = Math.max(arenaLeft, Math.min(arenaRight - brick.width, nx));
    }
  }

  // Row sweeps — entire rows slide together
  for (let r = 0; r < state.rowVelocities.length; r++) {
    if (state.rowVelocities[r] === 0) continue;
    const rowBricks = state.bricks.filter(b => b.alive && b.row === r && b.moveType === "sweep");
    if (!rowBricks.length) continue;

    const newOffset     = state.rowOffsets[r] + state.rowVelocities[r] * dt;
    const leftmostBase  = Math.min(...rowBricks.map(b => b.baseX));
    const rightmostBase = Math.max(...rowBricks.map(b => b.baseX + b.width));

    if (leftmostBase + newOffset < arenaLeft) {
      state.rowOffsets[r] = arenaLeft - leftmostBase;
      state.rowVelocities[r] = Math.abs(state.rowVelocities[r]);
    } else if (rightmostBase + newOffset > arenaRight) {
      state.rowOffsets[r] = arenaRight - rightmostBase;
      state.rowVelocities[r] = -Math.abs(state.rowVelocities[r]);
    } else {
      state.rowOffsets[r] = newOffset;
    }

    for (const brick of rowBricks) {
      brick.x = brick.baseX + state.rowOffsets[r];
    }
  }
}

function update(dt) {
  updatePaddle(dt);
  updateBricks(dt);
  if (state.running) {
    updateBalls(dt);
    updateHazards(dt);
    updatePickups(dt);
  }
  updateFx(dt);
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
  gradient.addColorStop(0, "#15112a");
  gradient.addColorStop(0.5, "#0a1f28");
  gradient.addColorStop(1, "#061018");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.width, state.height);

  for (const star of state.stars) {
    ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, TAU);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(117, 240, 255, 0.08)";
  ctx.lineWidth = 1;
  for (let y = 0; y < state.height; y += 44) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(state.width, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255, 122, 69, 0.08)";
  ctx.beginPath();
  ctx.arc(state.width * 0.2, state.height * 0.12, 130, 0, TAU);
  ctx.fill();

  ctx.fillStyle = "rgba(117, 240, 255, 0.07)";
  ctx.beginPath();
  ctx.arc(state.width * 0.84, state.height * 0.22, 180, 0, TAU);
  ctx.fill();
}

function drawBricks() {
  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    const def = brickTypes[brick.type];
    const pulseGlow = 12 + Math.sin(brick.pulse) * 4;
    ctx.save();
    ctx.shadowBlur = pulseGlow + brick.hitGlow * 18;
    ctx.shadowColor = def.color;
    ctx.fillStyle = def.color;
    roundRect(brick.x, brick.y, brick.width, brick.height, 8);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#ffffff";
    roundRect(brick.x + 3, brick.y + 3, brick.width - 6, brick.height * 0.35, 6);
    ctx.restore();

    if (brick.hp > 1) {
      ctx.fillStyle = "rgba(7, 13, 22, 0.58)";
      ctx.fillRect(brick.x + 8, brick.y + brick.height - 8, brick.width - 16, 4);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(
        brick.x + 8,
        brick.y + brick.height - 8,
        ((brick.width - 16) * brick.hp) / (brickTypes[brick.type].hp + Math.max(0, Math.floor((state.level - 1) / 4) - (brick.type === "basic" ? 0 : 1))),
        4,
      );
    }
  }
}

function drawPaddle() {
  const paddle = state.paddle;
  const glow = 20 + paddle.glow * 26 + (paddle.plasmaTimer > 0 ? 12 : 0);
  ctx.save();
  ctx.shadowBlur = glow;
  ctx.shadowColor = paddle.shieldTimer > 0 ? "#75f0ff" : paddle.plasmaTimer > 0 ? "#ffd166" : "#ff7a45";
  const gradient = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x + paddle.width, paddle.y + paddle.height);
  gradient.addColorStop(0, paddle.shieldTimer > 0 ? "#75f0ff" : "#ff7a45");
  gradient.addColorStop(1, paddle.plasmaTimer > 0 ? "#ffd166" : "#ff5fcf");
  ctx.fillStyle = gradient;
  roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 12);
  ctx.restore();

  if (paddle.shieldTimer > 0) {
    ctx.strokeStyle = "rgba(117, 240, 255, 0.7)";
    ctx.lineWidth = 3;
    roundRect(paddle.x - 6, paddle.y - 8, paddle.width + 12, paddle.height + 16, 16, true);
  }
}

function drawBalls() {
  for (const ball of state.balls) {
    for (const point of ball.trail) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, point.life) * 0.3})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, ball.radius * point.life, 0, TAU);
      ctx.fill();
    }

    const glow = state.paddle.plasmaTimer > 0 ? "#ffd166" : "#ffffff";
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = 24 + ball.energy * 18 + state.scenePulse * 4;
    ctx.shadowColor = glow;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius + ball.energy * 0.9, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = state.paddle.plasmaTimer > 0 ? "rgba(255, 238, 187, 0.96)" : "rgba(245, 244, 239, 0.96)";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, Math.max(4, ball.radius - 3), 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function drawPickups() {
  const colors = {
    widen: "#75f0ff",
    multiball: "#ff5fcf",
    slow: "#cbff65",
    shield: "#9ee5ff",
    plasma: "#ffd166",
    life: "#ff7a45",
  };
  const labels = {
    widen: "W",
    multiball: "M",
    slow: "S",
    shield: "B",
    plasma: "P",
    life: "+",
  };

  for (const pickup of state.pickups) {
    const scale = 1 + Math.sin(pickup.pulse) * 0.08;
    ctx.save();
    ctx.translate(pickup.x, pickup.y);
    ctx.scale(scale, scale);
    ctx.shadowBlur = 18;
    ctx.shadowColor = colors[pickup.kind];
    ctx.fillStyle = colors[pickup.kind];
    ctx.beginPath();
    ctx.arc(0, 0, pickup.radius, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#071018";
    ctx.font = "bold 14px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(labels[pickup.kind], 0, 1);
    ctx.restore();
  }
}

function drawHazards() {
  for (const hazard of state.hazards) {
    ctx.save();
    // Warning flash on the source brick area for newly spawned hazards
    const warningAlpha = hazard.spawnGlow || 0;
    if (warningAlpha > 0) {
      hazard.spawnGlow = Math.max(0, warningAlpha - 0.04);
    }
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = 18 + warningAlpha * 24;
    ctx.shadowColor = '#ff4f9f';
    ctx.fillStyle = '#ff4f9f';
    ctx.beginPath();
    ctx.arc(hazard.x, hazard.y, hazard.radius, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 95, 207, ${0.6 + warningAlpha * 0.3})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hazard.x - hazard.radius * 1.8, hazard.y);
    ctx.lineTo(hazard.x + hazard.radius * 1.8, hazard.y);
    ctx.moveTo(hazard.x, hazard.y - hazard.radius * 1.8);
    ctx.lineTo(hazard.x, hazard.y + hazard.radius * 1.8);
    ctx.stroke();
    // Inner bright core
    ctx.shadowBlur = 6;
    ctx.fillStyle = `rgba(255, 200, 220, ${0.6 + warningAlpha * 0.4})`;
    ctx.beginPath();
    ctx.arc(hazard.x, hazard.y, hazard.radius * 0.45, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const particle of state.particles) {
    const alpha = 1 - particle.age / particle.life;
    ctx.shadowBlur = 12;
    ctx.shadowColor = particle.color;
    ctx.fillStyle = hexToRgba(particle.color, alpha);
    if (particle.size > 4) {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * 0.45, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
  }
  ctx.restore();
}

function drawTexts() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const text of state.floatingTexts) {
    const alpha = 1 - text.age / text.life;
    ctx.fillStyle = hexToRgba(text.color, alpha);
    ctx.font = `${Math.round(18 * text.size)}px Impact`;
    ctx.fillText(text.text, text.x, text.y);
  }
}

function drawPowerupBanner() {
  const b = state.powerupBanner;
  if (!b) return;

  const progress = 1 - b.timer / b.maxTimer; // 0→1 over lifetime
  const fadeInEnd = 0.12;
  const fadeOutStart = 0.75;
  let alpha;
  if (progress < fadeInEnd) {
    alpha = progress / fadeInEnd;
  } else if (progress > fadeOutStart) {
    alpha = 1 - (progress - fadeOutStart) / (1 - fadeOutStart);
  } else {
    alpha = 1;
  }
  const slideY = progress < fadeInEnd ? (1 - progress / fadeInEnd) * -48 : 0;

  const bw = 420;
  const bh = 88;
  const bx = state.width / 2 - bw / 2;
  const by = state.height * 0.14 + slideY;
  const iconR = 26;
  const iconCx = bx + 22 + iconR;
  const iconCy = by + bh / 2;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Panel background
  ctx.shadowBlur = 32;
  ctx.shadowColor = b.color;
  ctx.fillStyle = "rgba(6, 11, 20, 0.92)";
  roundRect(bx, by, bw, bh, 18);

  // Left accent bar
  ctx.shadowBlur = 0;
  ctx.fillStyle = b.color;
  roundRect(bx, by, 5, bh, 3);

  // Icon circle
  ctx.shadowBlur = 18;
  ctx.shadowColor = b.color;
  ctx.fillStyle = b.color;
  ctx.beginPath();
  ctx.arc(iconCx, iconCy, iconR, 0, TAU);
  ctx.fill();

  // Icon letter
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(6, 11, 20, 0.9)";
  ctx.font = "bold 20px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(b.letter, iconCx, iconCy + 1);

  // Power-up name
  ctx.shadowBlur = 10;
  ctx.shadowColor = b.color;
  ctx.fillStyle = b.color;
  ctx.font = "bold 26px Impact";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(b.name, bx + 72, by + bh / 2 - 12);

  // Description
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(200, 220, 235, 0.75)";
  ctx.font = "14px 'Trebuchet MS', sans-serif";
  ctx.fillText(b.desc, bx + 73, by + bh / 2 + 14);

  ctx.restore();
}

function drawCinematicOverlay() {
  const t = performance.now() * 0.001;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha =
    0.18 +
    (state.overdriveTimer > 0 ? 0.1 : 0) +
    (state.finaleMode ? 0.08 : 0) +
    state.scenePulse * 0.06;

  const leftGlow = ctx.createRadialGradient(
    state.width * 0.18,
    state.height * 0.18,
    0,
    state.width * 0.18,
    state.height * 0.18,
    260,
  );
  leftGlow.addColorStop(0, state.finaleMode ? "rgba(255, 42, 109, 0.16)" : "rgba(255, 122, 69, 0.14)");
  leftGlow.addColorStop(0.5, "rgba(255, 122, 69, 0.04)");
  leftGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = leftGlow;
  ctx.fillRect(0, 0, state.width, state.height);

  const rightGlow = ctx.createRadialGradient(
    state.width * 0.84,
    state.height * 0.24,
    0,
    state.width * 0.84,
    state.height * 0.24,
    340,
  );
  rightGlow.addColorStop(0, "rgba(117, 240, 255, 0.12)");
  rightGlow.addColorStop(0.55, "rgba(117, 240, 255, 0.035)");
  rightGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = rightGlow;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 0.1;
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  for (let y = (t * 28) % 4; y < state.height; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(state.width, y);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  const vignette = ctx.createRadialGradient(
    state.width / 2,
    state.height / 2,
    Math.min(state.width, state.height) * 0.18,
    state.width / 2,
    state.height / 2,
    Math.max(state.width, state.height) * 0.72,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(0.78, "rgba(0, 0, 0, 0.08)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.42)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.restore();
}

function drawArena() {
  ctx.save();
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  drawBackground();
  drawBricks();
  drawPaddle();
  drawBalls();
  drawPickups();
  drawHazards();
  drawParticles();
  drawTexts();

  if (!state.running && !state.gameOver) {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "22px Impact";
    ctx.textAlign = "center";
    ctx.fillText("Launch the interceptor", state.width / 2, state.height * 0.7);
  }
  ctx.restore();

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${state.flash * 0.25})`;
    ctx.fillRect(0, 0, state.width, state.height);
  }
  drawPowerupBanner();
  drawCinematicOverlay();
}

function roundRect(x, y, width, height, radius, stroke = false) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  if (stroke) ctx.stroke();
  else ctx.fill();
}

function hexToRgba(hex, alpha) {
  const normalized = hex.replace("#", "");
  const bigint = Number.parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function frame(ts) {
  if (!state.lastTs) state.lastTs = ts;
  const rawDt = Math.min(0.033, (ts - state.lastTs) / 1000);
  state.lastTs = ts;
  if (state.hitStopTimer > 0) {
    state.hitStopTimer = Math.max(0, state.hitStopTimer - rawDt);
    drawArena();
    requestAnimationFrame(frame);
    return;
  }
  update(rawDt);
  drawArena();
  requestAnimationFrame(frame);
}

function attachEvents() {
  window.addEventListener("resize", resize);

  window.addEventListener("keydown", (event) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      event.preventDefault();
      state.keyboard.left = true;
      state.inputMode = "keyboard";
      state.pointerActive = false;
    }
    if (event.code === "ArrowRight" || event.code === "KeyD") {
      event.preventDefault();
      state.keyboard.right = true;
      state.inputMode = "keyboard";
      state.pointerActive = false;
    }
    if (event.code === "Space") {
      event.preventDefault();
      if (!state.audioReady) synth.ensure();
      if (state.gameOver) {
        startGame();
      } else if (hud.overlay.classList.contains("visible")) {
        startGame();
      } else {
        launchBall();
      }
    }
    if (event.ctrlKey && event.shiftKey && event.code.startsWith("Digit")) {
      event.preventDefault();
      const digit = parseInt(event.code.replace("Digit", ""), 10);
      jumpToLevel(digit === 0 ? 10 : digit);
    }
    if (event.code === "Escape") {
      event.preventDefault();
      if (!state.audioReady) synth.ensure();
      resetRun(true);
      overlayTitle.textContent = defaultOverlayTitle;
      overlayBody.textContent = defaultOverlayBody;
      hud.startButton.textContent = "Start Siege";
      hud.overlay.classList.add("visible");
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      event.preventDefault();
      state.keyboard.left = false;
    }
    if (event.code === "ArrowRight" || event.code === "KeyD") {
      event.preventDefault();
      state.keyboard.right = false;
    }
  });

  canvas.addEventListener("pointerdown", () => {
    if (!state.audioReady) {
      synth.ensure();
      state.audioReady = true;
    }
    if (hud.overlay.classList.contains("visible")) return;
    launchBall();
  });

  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = GAME_W / rect.width;
    state.pointerX = (event.clientX - rect.left) * scaleX;
    state.inputMode = "pointer";
    state.pointerActive = true;
  });

  hud.startButton.addEventListener("click", startGame);
}

attachEvents();
resize();
resetRun(true);
requestAnimationFrame(frame);
