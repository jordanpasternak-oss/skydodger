const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- ambient starfield ---------- */
(function starfield() {
  const canvas = document.getElementById("starfield");
  const ctx = canvas.getContext("2d");
  let w, h, stars, shooting = [];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    const count = Math.floor((w * h) / 9000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.3 + 0.3,
      speed: Math.random() * 0.15 + 0.03,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  function drawStatic() {
    ctx.fillStyle = "#0d0716";
    ctx.fillRect(0, 0, w, h);
    for (const s of stars) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#ede9ff";
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }

  let t = 0;
  function draw() {
    t += 1;
    ctx.fillStyle = "#0d0716";
    ctx.fillRect(0, 0, w, h);

    for (const s of stars) {
      s.y += s.speed;
      if (s.y > h) s.y = 0;
      const twinkle = 0.4 + Math.sin(t * 0.02 + s.phase) * 0.3;
      ctx.globalAlpha = Math.max(twinkle, 0.1);
      ctx.fillStyle = "#ede9ff";
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    if (Math.random() < 0.006) {
      shooting.push({ x: Math.random() * w * 0.6, y: Math.random() * h * 0.3, len: 60 + Math.random() * 60, life: 40 });
    }
    for (const sh of shooting) {
      ctx.strokeStyle = "rgba(255, 209, 102, 0.7)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(sh.x - sh.len * 0.5, sh.y - sh.len);
      ctx.stroke();
      sh.x += 4;
      sh.y += 8;
      sh.life--;
    }
    shooting = shooting.filter((sh) => sh.life > 0);

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();
  if (reduceMotion) {
    drawStatic();
  } else {
    requestAnimationFrame(draw);
  }
})();

/* ---------- game ---------- */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const buffsEl = document.getElementById("buffs");
const fireBtn = document.getElementById("fireBtn");
const overlay = document.getElementById("overlay");
const overlayStatus = document.getElementById("overlayStatus");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMsg = document.getElementById("overlayMsg");
const startBtn = document.getElementById("startBtn");
const equationEl = document.getElementById("equation");
const modeButtons = document.querySelectorAll(".mode-btn");

const W = canvas.width;
const H = canvas.height;
const BEST_KEY = "cometRunBest";
const MULTIPLIER_DURATION = 480;
const SHIELD_MAX = 3;
const WEAPON_MAX = 4;

const WEAPON_LEVELS = {
  1: { cooldown: 17, pattern: [0] },
  2: { cooldown: 12, pattern: [0] },
  3: { cooldown: 12, pattern: [-6, 6] },
  4: { cooldown: 10, pattern: [-9, 0, 9] },
};

const PLAYER_Y_MIN = 14;
const PLAYER_Y_MAX = H - 44;
const PLAYER_START_Y = H - 56;

const SHIP_NOSE_Y = -20;
const SHIP_TAIL_Y = 20;

const SPAWN_INTERVAL_START = 66;
const SPAWN_INTERVAL_MIN = 14;
const SPAWN_RAMP_RATE = 0.0217;
const FALL_SPEED_START = 2.3;
const FALL_SPEED_RAMP_RATE = 0.0015;

const MATH_FALL_SPEED_BASE = 1.1;
const MATH_METEOR_SIZE = 40;
const MATH_LEVEL_MAX = 4;
const MATH_STREAK_TO_LEVEL_UP = 3;

const player = { w: 30, h: 30, x: W / 2 - 15, y: PLAYER_START_Y, speed: 6 };
let keys = {};
let touchFiring = false;
let meteors = [];
let powerups = [];
let bolts = [];
let embers = [];
let trail = [];
let score = 0;
let best = Number(localStorage.getItem(BEST_KEY)) || 0;
let spawnTimer = 0;
let spawnInterval = SPAWN_INTERVAL_START;
let baseFallSpeed = FALL_SPEED_START;
let elapsed = 0;
let running = false;
let animId = null;

let shieldCharges = 0;
let weaponLevel = 1;
let fireCooldown = 0;
let multiplierTime = 0;
let spawnPowerupTimer = 0;
let spawnPowerupInterval = 260 + Math.random() * 160;

let selectedMode = "classic";
let mathMode = false;
let mathLevel = 1;
let mathStreak = 0;
let equation = null;
let equationStartFrame = 0;

bestEl.textContent = best;

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedMode = btn.dataset.mode;
    modeButtons.forEach((b) => b.classList.toggle("active", b === btn));
  });
});

function resetGame() {
  player.x = W / 2 - player.w / 2;
  player.y = PLAYER_START_Y;
  meteors = [];
  powerups = [];
  bolts = [];
  embers = [];
  trail = [];
  score = 0;
  spawnTimer = 0;
  spawnInterval = SPAWN_INTERVAL_START;
  baseFallSpeed = FALL_SPEED_START;
  elapsed = 0;
  shieldCharges = 0;
  weaponLevel = 1;
  fireCooldown = 0;
  multiplierTime = 0;
  spawnPowerupTimer = 0;
  spawnPowerupInterval = 260 + Math.random() * 160;
  mathMode = selectedMode === "math";
  mathLevel = 1;
  mathStreak = 0;
  equation = null;
  equationEl.classList.toggle("hidden", !mathMode);
  equationEl.textContent = "";
  scoreEl.textContent = "0";
  updateBuffsUI();
}

function spawnMeteor() {
  const size = 22 + Math.random() * 24;
  meteors.push({
    x: Math.random() * (W - size),
    y: -size,
    size,
    speed: baseFallSpeed + Math.random() * 1.5,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.08,
  });
}

function generateEquation(level) {
  let a, b, op, answer;
  if (level <= 1) {
    op = "+";
    a = 1 + Math.floor(Math.random() * 9);
    b = 1 + Math.floor(Math.random() * 9);
    answer = a + b;
  } else if (level === 2) {
    op = Math.random() < 0.5 ? "+" : "-";
    a = 1 + Math.floor(Math.random() * 9);
    b = 1 + Math.floor(Math.random() * 9);
    if (op === "-" && a < b) { const t = a; a = b; b = t; }
    answer = op === "+" ? a + b : a - b;
  } else if (level === 3) {
    op = Math.random() < 0.5 ? "+" : "-";
    a = 5 + Math.floor(Math.random() * 15);
    b = 1 + Math.floor(Math.random() * 15);
    if (op === "-" && a < b) { const t = a; a = b; b = t; }
    answer = op === "+" ? a + b : a - b;
  } else {
    op = "×";
    a = 1 + Math.floor(Math.random() * 9);
    b = 1 + Math.floor(Math.random() * 9);
    answer = a * b;
  }
  return { text: `${a} ${op} ${b} = ?`, answer };
}

function spawnEquationMeteors() {
  equation = generateEquation(mathLevel);
  equationStartFrame = elapsed;
  equationEl.textContent = equation.text;

  const values = new Set([equation.answer]);
  let guard = 0;
  while (values.size < 3 && guard < 50) {
    guard++;
    const delta = 1 + Math.floor(Math.random() * 4);
    const candidate = equation.answer + (Math.random() < 0.5 ? -delta : delta);
    if (candidate >= 0) values.add(candidate);
  }
  const vals = Array.from(values);
  for (let i = vals.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [vals[i], vals[j]] = [vals[j], vals[i]];
  }

  const slotW = W / vals.length;
  const speed = MATH_FALL_SPEED_BASE + Math.min(mathLevel - 1, MATH_LEVEL_MAX) * 0.15;
  vals.forEach((val, i) => {
    meteors.push({
      x: slotW * i + slotW / 2 - MATH_METEOR_SIZE / 2 + (Math.random() * 16 - 8),
      y: -MATH_METEOR_SIZE - i * 50,
      size: MATH_METEOR_SIZE,
      speed,
      angle: 0,
      spin: 0,
      isNumber: true,
      value: val,
      correct: val === equation.answer,
    });
  });
}

function spawnPowerup() {
  const size = 26;
  const r = Math.random();
  const type = r < 0.5 ? "weapon" : r < 0.75 ? "shield" : "boost";
  powerups.push({
    x: Math.random() * (W - size),
    y: -size,
    size,
    speed: 2,
    angle: 0,
    type,
  });
}

function circleRectOverlap(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function circleCircleOverlap(x1, y1, r1, x2, y2, r2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const rr = r1 + r2;
  return dx * dx + dy * dy < rr * rr;
}

function spawnEmberBurst(x, y, colors, count) {
  const palette = colors || ["#ffd166", "#ff8a4c"];
  for (let i = 0; i < (count || 22); i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    embers.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 32,
      r: 1.5 + Math.random() * 2,
      color: palette[Math.floor(Math.random() * palette.length)],
    });
  }
}

let shieldPillEl = null;
let boostPillEl = null;
let laserPillEl = null;

function updateBuffsUI() {
  if (!laserPillEl) {
    laserPillEl = document.createElement("span");
    laserPillEl.className = "buff-pill laser";
    buffsEl.appendChild(laserPillEl);
  }
  laserPillEl.textContent = `Laser · Lv ${weaponLevel}`;

  if (shieldCharges > 0) {
    if (!shieldPillEl) {
      shieldPillEl = document.createElement("span");
      shieldPillEl.className = "buff-pill shield";
      buffsEl.appendChild(shieldPillEl);
    }
    shieldPillEl.textContent = `Shield · Lv ${shieldCharges}`;
  } else if (shieldPillEl) {
    shieldPillEl.remove();
    shieldPillEl = null;
  }

  if (multiplierTime > 0) {
    if (!boostPillEl) {
      boostPillEl = document.createElement("span");
      boostPillEl.className = "buff-pill boost";
      buffsEl.appendChild(boostPillEl);
    }
    boostPillEl.textContent = `×2 · ${(multiplierTime / 60).toFixed(1)}s`;
  } else if (boostPillEl) {
    boostPillEl.remove();
    boostPillEl = null;
  }
}

function fireBolts(cx) {
  const config = WEAPON_LEVELS[weaponLevel];
  const noseY = player.y + player.h / 2 + SHIP_NOSE_Y;
  for (const offset of config.pattern) {
    bolts.push({ x: cx + offset, y: noseY });
  }
}

function update() {
  elapsed++;

  const moving = (keys["ArrowLeft"] || keys["a"] || keys["A"]) !== (keys["ArrowRight"] || keys["d"] || keys["D"]);
  if (keys["ArrowLeft"] || keys["a"] || keys["A"]) player.x -= player.speed;
  if (keys["ArrowRight"] || keys["d"] || keys["D"]) player.x += player.speed;
  player.x = Math.max(0, Math.min(W - player.w, player.x));

  if (keys["ArrowUp"] || keys["w"] || keys["W"]) player.y -= player.speed;
  if (keys["ArrowDown"] || keys["s"] || keys["S"]) player.y += player.speed;
  player.y = Math.max(PLAYER_Y_MIN, Math.min(PLAYER_Y_MAX, player.y));

  if (elapsed % 2 === 0) {
    trail.push({ x: player.x + player.w / 2, y: player.y + player.h / 2 + SHIP_TAIL_Y, life: 18, moving });
  }
  for (const t of trail) t.life--;
  trail = trail.filter((t) => t.life > 0);

  if (fireCooldown > 0) fireCooldown--;
  if ((keys[" "] || touchFiring) && fireCooldown <= 0) {
    fireCooldown = WEAPON_LEVELS[weaponLevel].cooldown;
    fireBolts(player.x + player.w / 2);
  }
  for (const b of bolts) b.y -= 9;
  bolts = bolts.filter((b) => b.y > -20);

  if (mathMode) {
    if (meteors.filter((m) => m.isNumber).length === 0) {
      spawnEquationMeteors();
    }
  } else {
    spawnTimer++;
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      spawnMeteor();
    }

    spawnPowerupTimer++;
    if (spawnPowerupTimer >= spawnPowerupInterval && powerups.length === 0) {
      spawnPowerupTimer = 0;
      spawnPowerupInterval = 260 + Math.random() * 160;
      spawnPowerup();
    }

    spawnInterval = Math.max(SPAWN_INTERVAL_MIN, spawnInterval - SPAWN_RAMP_RATE);
    baseFallSpeed += FALL_SPEED_RAMP_RATE;
  }

  for (const m of meteors) {
    m.y += m.speed;
    m.angle += m.spin;
  }
  meteors = meteors.filter((m) => m.y < H + 40);

  for (const p of powerups) {
    p.y += p.speed;
    p.angle += 0.03;
  }
  powerups = powerups.filter((p) => p.y < H + 40);

  const meteorsHit = new Set();
  const boltsUsed = new Set();
  let correctHit = false;
  for (const b of bolts) {
    for (const m of meteors) {
      if (meteorsHit.has(m) || boltsUsed.has(b)) continue;
      const dx = b.x - (m.x + m.size / 2);
      const dy = b.y - (m.y + m.size / 2);
      if (Math.hypot(dx, dy) < m.size / 2 + 4) {
        meteorsHit.add(m);
        boltsUsed.add(b);
        if (m.isNumber) {
          if (m.correct) {
            correctHit = true;
            const answerTime = (elapsed - equationStartFrame) / 60;
            const speedBonus = Math.max(0, 30 - answerTime * 8);
            score += Math.round((30 + speedBonus) * (multiplierTime > 0 ? 2 : 1));
            mathStreak++;
            if (mathStreak >= MATH_STREAK_TO_LEVEL_UP) {
              mathStreak = 0;
              mathLevel = Math.min(mathLevel + 1, MATH_LEVEL_MAX);
            }
            spawnEmberBurst(m.x + m.size / 2, m.y + m.size / 2, ["#6fe7a6", "#ede9ff"], 20);
          } else {
            mathStreak = 0;
            spawnEmberBurst(m.x + m.size / 2, m.y + m.size / 2, ["#ff6b57", "#ede9ff"], 10);
          }
        } else {
          spawnEmberBurst(m.x + m.size / 2, m.y + m.size / 2, ["#ffd166", "#ff8a4c"], 14);
          score += (multiplierTime > 0 ? 2 : 1) * 15;
        }
        break;
      }
    }
  }
  if (meteorsHit.size) meteors = meteors.filter((m) => !meteorsHit.has(m));
  if (boltsUsed.size) bolts = bolts.filter((b) => !boltsUsed.has(b));
  if (correctHit) meteors = meteors.filter((m) => !m.isNumber);

  const cx = player.x + player.w / 2;
  const cy = player.y + player.h / 2;
  const pr = player.w / 2 - 3;

  for (const m of meteors) {
    if (circleRectOverlap(cx, cy, pr + m.size / 2, { x: m.x, y: m.y, w: m.size, h: m.size })) {
      if (shieldCharges > 0) {
        shieldCharges--;
        meteors = meteors.filter((mm) => mm !== m);
        spawnEmberBurst(cx, cy, ["#63e6e0", "#ede9ff"]);
        updateBuffsUI();
        break;
      }
      spawnEmberBurst(cx, cy, ["#ffd166", "#ff8a4c"]);
      gameOver();
      return;
    }
  }

  for (const p of powerups) {
    if (circleCircleOverlap(cx, cy, pr, p.x + p.size / 2, p.y + p.size / 2, p.size / 2)) {
      if (p.type === "shield") {
        shieldCharges = Math.min(shieldCharges + 1, SHIELD_MAX);
        spawnEmberBurst(cx, cy, ["#63e6e0", "#ede9ff"]);
      } else if (p.type === "weapon") {
        if (weaponLevel < WEAPON_MAX) {
          weaponLevel++;
        } else {
          score += (multiplierTime > 0 ? 2 : 1) * 50;
        }
        spawnEmberBurst(cx, cy, ["#ff5fa2", "#ede9ff"]);
      } else {
        multiplierTime = Math.min(multiplierTime + MULTIPLIER_DURATION, MULTIPLIER_DURATION * 2);
        spawnEmberBurst(cx, cy, ["#6fe7a6", "#ffd166"]);
      }
      powerups = powerups.filter((pp) => pp !== p);
      updateBuffsUI();
      break;
    }
  }

  if (multiplierTime > 0) {
    multiplierTime--;
    if (multiplierTime % 6 === 0) updateBuffsUI();
  }

  for (const e of embers) {
    e.x += e.vx;
    e.y += e.vy;
    e.vy += 0.05;
    e.life--;
  }
  embers = embers.filter((e) => e.life > 0);

  score += multiplierTime > 0 ? 2 : 1;
  scoreEl.textContent = Math.floor(score / 10);
}

function drawMeteor(m) {
  ctx.save();
  ctx.translate(m.x + m.size / 2, m.y + m.size / 2);
  ctx.rotate(m.angle);
  const r = m.size / 2;
  const grad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
  grad.addColorStop(0, "#ffd166");
  grad.addColorStop(0.55, "#ff8a4c");
  grad.addColorStop(1, "#9a3f22");
  ctx.fillStyle = grad;
  ctx.beginPath();
  const spikes = 7;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    const rr = r * (0.78 + (i % 2 === 0 ? 0.22 : 0));
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawNumberMeteor(m) {
  const cx = m.x + m.size / 2;
  const cy = m.y + m.size / 2;
  const r = m.size / 2;
  ctx.save();
  ctx.shadowColor = "#9b8dff";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "rgba(20, 12, 36, 0.85)";
  ctx.strokeStyle = "#9b8dff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ede9ff";
  ctx.font = "700 18px Rajdhani, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(m.value), cx, cy + 1);
  ctx.restore();
}

function drawPowerup(p) {
  ctx.save();
  ctx.translate(p.x + p.size / 2, p.y + p.size / 2);
  ctx.rotate(p.angle);
  const r = p.size / 2;

  if (p.type === "shield") {
    ctx.shadowColor = "#63e6e0";
    ctx.shadowBlur = 14;
    ctx.strokeStyle = "#63e6e0";
    ctx.lineWidth = 2.5;
    ctx.fillStyle = "rgba(99, 230, 224, 0.18)";
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * r * 0.85;
      const py = Math.sin(a) * r * 0.85;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (p.type === "weapon") {
    ctx.shadowColor = "#ff5fa2";
    ctx.shadowBlur = 14;
    ctx.strokeStyle = "#ff5fa2";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, r * 0.15);
    ctx.lineTo(0, -r * 0.65);
    ctx.lineTo(r * 0.55, r * 0.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, r * 0.7);
    ctx.lineTo(0, -r * 0.1);
    ctx.lineTo(r * 0.55, r * 0.7);
    ctx.stroke();
  } else {
    ctx.shadowColor = "#6fe7a6";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#6fe7a6";
    ctx.beginPath();
    const spikes = 4;
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : r * 0.4;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawBolt(b) {
  ctx.save();
  ctx.shadowColor = "#c9c2ff";
  ctx.shadowBlur = 8;
  const grad = ctx.createLinearGradient(b.x, b.y - 11, b.x, b.y + 5);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, "#9b8dff");
  ctx.fillStyle = grad;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(b.x - 2, b.y - 11, 4, 16, 2);
    ctx.fill();
  } else {
    ctx.fillRect(b.x - 2, b.y - 11, 4, 16);
  }
  ctx.restore();
}

function drawPlayer() {
  const cx = player.x + player.w / 2;
  const cy = player.y + player.h / 2;
  const r = player.w / 2;

  for (const t of trail) {
    ctx.globalAlpha = Math.max(t.life / 18, 0) * 0.5;
    ctx.fillStyle = "#9b8dff";
    ctx.beginPath();
    ctx.arc(t.x, t.y, r * 0.35 * (t.life / 18), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = "#9b8dff";
  ctx.shadowBlur = 16;
  const grad = ctx.createLinearGradient(0, SHIP_NOSE_Y, 0, SHIP_TAIL_Y);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.45, "#ede9ff");
  grad.addColorStop(1, "#9b8dff");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, SHIP_NOSE_Y);
  ctx.lineTo(6, -8);
  ctx.lineTo(17, 16);
  ctx.lineTo(5, 11);
  ctx.lineTo(0, SHIP_TAIL_Y);
  ctx.lineTo(-5, 11);
  ctx.lineTo(-17, 16);
  ctx.lineTo(-6, -8);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#2c1852";
  ctx.beginPath();
  ctx.arc(0, -11, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (shieldCharges > 0) {
    ctx.save();
    ctx.strokeStyle = "#63e6e0";
    ctx.shadowColor = "#63e6e0";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    for (let i = 0; i < shieldCharges; i++) {
      ctx.globalAlpha = (0.7 + Math.sin(elapsed * 0.15 + i) * 0.2) * (1 - i * 0.18);
      ctx.beginPath();
      ctx.arc(cx, cy, r + 6 + i * 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  for (const m of meteors) (m.isNumber ? drawNumberMeteor(m) : drawMeteor(m));
  for (const p of powerups) drawPowerup(p);
  for (const b of bolts) drawBolt(b);
  drawPlayer();

  for (const e of embers) {
    ctx.globalAlpha = Math.max(e.life / 32, 0);
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function loop() {
  if (!running) return;
  update();
  draw();
  if (running) animId = requestAnimationFrame(loop);
}

function gameOver() {
  running = false;
  cancelAnimationFrame(animId);
  draw();
  const finalScore = Math.floor(score / 10);
  let newBest = false;
  if (finalScore > best) {
    best = finalScore;
    newBest = true;
    localStorage.setItem(BEST_KEY, String(best));
    bestEl.textContent = best;
  }
  overlayStatus.textContent = "> Impact detected";
  overlayTitle.textContent = "Impact";
  overlayMsg.innerHTML = newBest
    ? `New best &mdash; <strong>${finalScore}</strong>`
    : `Score <strong>${finalScore}</strong> &middot; Best <strong>${best}</strong>`;
  startBtn.textContent = "Relaunch";
  overlay.classList.remove("hidden");
  if (shieldPillEl) { shieldPillEl.remove(); shieldPillEl = null; }
  if (boostPillEl) { boostPillEl.remove(); boostPillEl = null; }
  if (laserPillEl) { laserPillEl.remove(); laserPillEl = null; }
  equationEl.classList.add("hidden");
}

function startGame() {
  resetGame();
  overlay.classList.add("hidden");
  running = true;
  animId = requestAnimationFrame(loop);
}

startBtn.addEventListener("click", startGame);

window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  if (e.key === " " && !running) {
    e.preventDefault();
    startGame();
  }
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
});

window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

if (fireBtn) {
  const setFiring = (val) => (e) => {
    touchFiring = val;
    e.preventDefault();
  };
  fireBtn.addEventListener("touchstart", setFiring(true), { passive: false });
  fireBtn.addEventListener("touchend", setFiring(false), { passive: false });
  fireBtn.addEventListener("mousedown", setFiring(true));
  fireBtn.addEventListener("mouseup", setFiring(false));
  fireBtn.addEventListener("mouseleave", setFiring(false));
}

let touchX = null;
let touchY = null;
canvas.addEventListener("touchstart", (e) => {
  touchX = e.touches[0].clientX;
  touchY = e.touches[0].clientY;
});
canvas.addEventListener("touchmove", (e) => {
  if (touchX === null) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  const dx = (e.touches[0].clientX - touchX) * scaleX;
  const dy = (e.touches[0].clientY - touchY) * scaleY;
  player.x = Math.max(0, Math.min(W - player.w, player.x + dx));
  player.y = Math.max(PLAYER_Y_MIN, Math.min(PLAYER_Y_MAX, player.y + dy));
  touchX = e.touches[0].clientX;
  touchY = e.touches[0].clientY;
  e.preventDefault();
}, { passive: false });

draw();
