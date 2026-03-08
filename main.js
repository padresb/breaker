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
    width: 112,
    height: 18,
    speed: 1100,
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

class Synth {
  constructor() {
    this.ctx = null;
    this.master = null;
  }

  ensure() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.13;
      this.master.connect(this.ctx.destination);
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
    this.beep({ frequency: 280 + Math.random() * 140, duration: 0.08, type: "triangle", gain: 0.08 * intensity, slide: 1.3 });
  }

  brick(type) {
    const map = {
      basic: [320, 0.12, "triangle"],
      armor: [180, 0.16, "square"],
      explosive: [230, 0.2, "sawtooth"],
      pulse: [480, 0.11, "triangle"],
      core: [130, 0.24, "sawtooth"],
    };
    const [frequency, duration, wave] = map[type];
    this.beep({ frequency, duration, type: wave, gain: 0.11, slide: type === "pulse" ? 1.8 : 0.72 });
    if (type === "explosive" || type === "core") {
      this.noise({ duration: 0.12 + Math.random() * 0.06, gain: 0.06 });
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
  }

  loss() {
    this.beep({ frequency: 180, duration: 0.3, type: "sawtooth", gain: 0.12, slide: 0.48 });
    this.noise({ duration: 0.18, gain: 0.08, highpass: 500 });
  }

  launch() {
    this.beep({ frequency: 380, duration: 0.1, type: "square", gain: 0.08, slide: 1.6 });
  }

  overdrive() {
    this.beep({ frequency: 280, duration: 0.16, type: "sawtooth", gain: 0.12, slide: 1.9 });
    this.beep({ frequency: 560, duration: 0.24, type: "triangle", gain: 0.09, slide: 1.2 });
  }

  hazard() {
    this.beep({ frequency: 210, duration: 0.12, type: "square", gain: 0.08, slide: 0.8 });
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
  if (!state.paddle.x) {
    state.paddle.x = state.width / 2 - state.paddle.width / 2;
  }
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
  state.finaleMode = false;
  state.finaleTriggered = false;
  state.bricks = [];
  const cols = Math.min(7 + level, 11);
  const rows = Math.min(4 + Math.floor(level / 2), 7);
  const gap = 10;
  const marginX = state.arena.marginX;
  const top = state.arena.top;
  const usableWidth = state.width - marginX * 2;
  const brickWidth = Math.max(62, (usableWidth - gap * (cols - 1)) / cols);
  const brickHeight = 28;
  const patterns = ["waves", "spire", "rings"];
  const pattern = patterns[(level - 1) % patterns.length];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      let active = true;
      if (pattern === "waves") {
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

      let type = "basic";
      const roll = Math.random();
      if (roll > 0.9) type = "pulse";
      else if (roll > 0.79) type = "explosive";
      else if (roll > 0.64 || row === 0) type = "armor";

      if (level % 3 === 0 && row === 1 && col === Math.floor(cols / 2)) {
        type = "core";
      }

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
  const hasDrift    = level === 2 || level >= 5;
  const hasSweep    = level === 3 || level >= 5;
  const hasSentinel = level === 4 || level >= 6;
  const speedScale  = 1 + Math.max(0, level - 6) * 0.14;

  // Initialise per-row sweep state
  state.rowOffsets   = Array(rows).fill(0);
  state.rowVelocities = Array(rows).fill(0);
  if (hasSweep) {
    for (let r = 1; r < rows; r += 2) {
      const base = (52 + Math.random() * 68) * speedScale;
      state.rowVelocities[r] = (Math.random() > 0.5 ? 1 : -1) * base;
    }
  }

  // Assign movement to each brick
  for (const brick of state.bricks) {
    const rowSweeps = hasSweep && brick.row % 2 === 1;
    if (hasSentinel && brick.type === "armor") {
      brick.moveType = "sentinel";
      brick.driftPhase = Math.random() * TAU;
      brick.driftSpeed = (0.42 + Math.random() * 0.28) * speedScale;
      brick.driftAmplitude = 62 + Math.random() * 58;
    } else if (rowSweeps) {
      brick.moveType = "sweep";
    } else if (hasDrift && (brick.type === "basic" || brick.type === "pulse") && Math.random() < 0.55) {
      brick.moveType = "drift";
      brick.driftPhase = Math.random() * TAU;
      brick.driftSpeed = (0.5 + Math.random() * 0.9) * speedScale;
      brick.driftAmplitude = 26 + Math.random() * 54;
    }
  }

  setMessage(`Wave ${level} entering the arena`, 2.4);
}

function jumpToLevel(level) {
  if (!state.audioReady) { synth.ensure(); state.audioReady = true; }
  resetRun(true);
  state.level = level;
  buildLevel(level);
  positionPaddle();
  resetBall();
  syncHud();
  hud.overlay.classList.remove("visible");
  setMessage(`DEV — Wave ${level}`, 2.5);
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
}

function activateOverdrive() {
  state.overdrive = 100;
  state.overdriveTimer = 10;
  state.paddle.plasmaTimer = Math.max(state.paddle.plasmaTimer, 10);
  state.flash = 0.7;
  state.shake = Math.max(state.shake, 16);
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
  state.overdrive = Math.min(100, state.overdrive + total * 0.005);
  addFloatingText(x, y, `+${total}`, "#f5f4ef", 1);
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
  if (state.keyboard.left) state.paddle.x -= state.paddle.speed * dt;
  if (state.keyboard.right) state.paddle.x += state.paddle.speed * dt;

  state.paddle.x = Math.max(
    state.arena.marginX * 0.45,
    Math.min(state.width - state.paddle.width - state.arena.marginX * 0.45, state.paddle.x),
  );

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
  if (Math.random() < 0.003 * state.level && state.bricks.some((brick) => brick.alive && brick.type !== "core")) {
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
      hazard.y + hazard.radius >= state.paddle.y &&
      hazard.x >= state.paddle.x - 10 &&
      hazard.x <= state.paddle.x + state.paddle.width + 10
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
    synth.overdrive();
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
  gradient.addColorStop(1, "#071018");
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
    if (state.finaleMode) {
      const finaleGlow = 28 + Math.sin(Date.now() * 0.018) * 14;
      ctx.save();
      ctx.shadowBlur = finaleGlow;
      ctx.shadowColor = '#ff2a6d';
      ctx.strokeStyle = '#ff2a6d';
      ctx.lineWidth = 3;
      roundRect(brick.x - 3, brick.y - 3, brick.width + 6, brick.height + 6, 10, true);
      ctx.restore();
    }
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
    ctx.shadowBlur = 24;
    ctx.shadowColor = glow;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, TAU);
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
    ctx.shadowBlur = 18 + warningAlpha * 24;
    ctx.shadowColor = '#ff4f9f';
    ctx.fillStyle = '#ff4f9f';
    ctx.beginPath();
    ctx.arc(hazard.x, hazard.y, hazard.radius, 0, TAU);
    ctx.fill();
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
  for (const particle of state.particles) {
    const alpha = 1 - particle.age / particle.life;
    ctx.fillStyle = hexToRgba(particle.color, alpha);
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
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
    if (event.code === "ArrowLeft" || event.code === "KeyA") state.keyboard.left = true;
    if (event.code === "ArrowRight" || event.code === "KeyD") state.keyboard.right = true;
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
    if (event.code === "ArrowLeft" || event.code === "KeyA") state.keyboard.left = false;
    if (event.code === "ArrowRight" || event.code === "KeyD") state.keyboard.right = false;
  });

  canvas.addEventListener("pointerdown", () => {
    if (!state.audioReady) {
      synth.ensure();
      state.audioReady = true;
    }
    if (hud.overlay.classList.contains("visible")) return;
    launchBall();
  });

  hud.startButton.addEventListener("click", startGame);
}

attachEvents();
resize();
resetRun(true);
requestAnimationFrame(frame);
