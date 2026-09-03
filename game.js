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
const modeHintEl = document.getElementById("modeHint");
const scoreLabelEl = document.getElementById("scoreLabel");
const bestLabelEl = document.getElementById("bestLabel");

const MODE_HINTS = {
  classic: "Classic: dodge or blast the meteor storm.",
  math: "Math: shoot the meteor with the right answer.",
  silly: "Silly: fetch treats, dodge tennis balls, good boy.",
};
const MODE_LABELS = {
  classic: { score: "Score", best: "Best" },
  math: { score: "Score", best: "Best" },
  silly: { score: "Treats", best: "Top dog" },
};

const W = canvas.width;
const H = canvas.height;
const BEST_KEY = "cometRunBest";
const MULTIPLIER_DURATION = 480;
const SHIELD_MAX = 3;
const WEAPON_MAX = 5;

const WEAPON_LEVELS = {
  1: { cooldown: 17, pattern: [0] },
  2: { cooldown: 12, pattern: [0] },
  3: { cooldown: 12, pattern: [-6, 6] },
  4: { cooldown: 10, pattern: [-9, 0, 9] },
  5: { cooldown: 10, pattern: [-9, 0, 9], pierce: 1 },
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
const FALL_SPEED_MAX = 9.5;
const VOLLEY_INTERVAL = 480; // ~8s at 60fps, once spawn rate & fall speed are both maxed
const ARMORED_METEOR_START = 3600; // ~60s at 60fps
const ARMORED_METEOR_INTERVAL = 600; // ~10s, replaces the next normal spawn
const POWERUP_TOP_BIAS_START = 1800; // ~30s, past the early game
const METEOR_KILL_SCORE = 15;
const ARMORED_KILL_SCORE = 30;

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
let volleyTimer = 0;
let armoredTimer = 0;
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
let sillyMode = false;
let mathLevel = 1;
let mathStreak = 0;
let equation = null;
let equationStartFrame = 0;

bestEl.textContent = best;

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedMode = btn.dataset.mode;
    modeButtons.forEach((b) => b.classList.toggle("active", b === btn));
    modeHintEl.textContent = MODE_HINTS[selectedMode];
    scoreLabelEl.textContent = MODE_LABELS[selectedMode].score;
    bestLabelEl.textContent = MODE_LABELS[selectedMode].best;
    if (fireBtn) fireBtn.setAttribute("aria-label", selectedMode === "silly" ? "Throw biscuit" : "Fire laser");
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
  volleyTimer = 0;
  armoredTimer = 0;
  elapsed = 0;
  shieldCharges = 0;
  weaponLevel = 1;
  fireCooldown = 0;
  multiplierTime = 0;
  spawnPowerupTimer = 0;
  spawnPowerupInterval = 260 + Math.random() * 160;
  mathMode = selectedMode === "math";
  sillyMode = selectedMode === "silly";
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

function spawnArmoredMeteor() {
  const size = 46 + Math.random() * 14;
  meteors.push({
    x: Math.random() * (W - size),
    y: -size,
    size,
    speed: baseFallSpeed + Math.random() * 1.5,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.06,
    armored: true,
    hp: 2,
  });
}

function spawnVolley() {
  const meteorCount = 3 + Math.floor(Math.random() * 2); // 3 or 4 meteors
  const lanes = meteorCount + 1; // + 1 deliberate gap lane
  const gapLane = Math.floor(Math.random() * lanes);
  const slotW = W / lanes;
  for (let i = 0; i < lanes; i++) {
    if (i === gapLane) continue;
    const size = 22 + Math.random() * 24;
    meteors.push({
      x: slotW * i + slotW / 2 - size / 2,
      y: -size,
      size,
      speed: baseFallSpeed + Math.random() * 1.5,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.08,
    });
  }
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
  const weaponAvailable = weaponLevel < WEAPON_MAX;
  const type = weaponAvailable
    ? (r < 0.5 ? "weapon" : r < 0.75 ? "shield" : "boost")
    : (r < 0.5 ? "shield" : "boost");
  const topBiased = (type === "weapon" || type === "shield") && elapsed >= POWERUP_TOP_BIAS_START;
  const y = topBiased ? -size + Math.random() * (H / 3 + size) : -size;
  powerups.push({
    x: Math.random() * (W - size),
    y,
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

// 1.5x near the top of the play field, scaling down to 1x near the bottom.
function killHeightFactor(y) {
  const ratio = Math.max(0, Math.min(1, 1 - y / H));
  return 1 + ratio * 0.5;
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
  const laserLabel = sillyMode ? "Biscuits" : "Laser";
  laserPillEl.textContent = weaponLevel >= WEAPON_MAX ? `${laserLabel} · Overcharge` : `${laserLabel} · Lv ${weaponLevel}`;

  if (shieldCharges > 0) {
    if (!shieldPillEl) {
      shieldPillEl = document.createElement("span");
      shieldPillEl.className = "buff-pill shield";
      buffsEl.appendChild(shieldPillEl);
    }
    shieldPillEl.textContent = `${sillyMode ? "Bubbles" : "Shield"} · Lv ${shieldCharges}`;
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
    // pierce budget lives on the bolt itself so it survives across frames
    // (a bolt keeps flying after a partial hit, not just within one frame).
    bolts.push({ x: cx + offset, y: noseY, pierce: (config.pierce || 0) + 1 });
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
    if (elapsed >= ARMORED_METEOR_START) armoredTimer++;

    // Armored meteors take over an occasional normal spawn tick rather than
    // adding to the spawn rate, so overall density is unchanged.
    if (elapsed >= ARMORED_METEOR_START && armoredTimer >= ARMORED_METEOR_INTERVAL && spawnTimer >= spawnInterval) {
      armoredTimer = 0;
      spawnTimer = 0;
      spawnArmoredMeteor();
    } else if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      spawnMeteor();
    }

    // Once frequency and speed both cap out, difficulty keeps climbing via
    // gap-finding volleys instead of ever-faster single meteors.
    const difficultyMaxed = spawnInterval <= SPAWN_INTERVAL_MIN && baseFallSpeed >= FALL_SPEED_MAX;
    if (difficultyMaxed) {
      volleyTimer++;
      if (volleyTimer >= VOLLEY_INTERVAL) {
        volleyTimer = 0;
        spawnTimer = 0; // avoid an immediate extra single spawn right on top of the volley
        spawnVolley();
      }
    }

    spawnPowerupTimer++;
    if (spawnPowerupTimer >= spawnPowerupInterval && powerups.length === 0) {
      spawnPowerupTimer = 0;
      spawnPowerupInterval = 260 + Math.random() * 160;
      spawnPowerup();
    }

    spawnInterval = Math.max(SPAWN_INTERVAL_MIN, spawnInterval - SPAWN_RAMP_RATE);
    baseFallSpeed = Math.min(FALL_SPEED_MAX, baseFallSpeed + FALL_SPEED_RAMP_RATE);
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
      if (b.pierce <= 0) break;
      if (meteorsHit.has(m)) continue;
      const dx = b.x - (m.x + m.size / 2);
      const dy = b.y - (m.y + m.size / 2);
      if (Math.hypot(dx, dy) < m.size / 2 + 4) {
        b.pierce--;
        if (m.isNumber) {
          meteorsHit.add(m);
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
          // Armored meteors have hp 2 and need a second hit; plain meteors
          // have no hp set, so (m.hp || 1) - 1 destroys them on the first hit.
          m.hp = (m.hp || 1) - 1;
          if (m.hp > 0) {
            spawnEmberBurst(m.x + m.size / 2, m.y + m.size / 2, ["#c9d4e0", "#ff8a4c"], 8);
          } else {
            meteorsHit.add(m);
            const baseScore = m.armored ? ARMORED_KILL_SCORE : METEOR_KILL_SCORE;
            const heightFactor = killHeightFactor(m.y);
            score += Math.round((multiplierTime > 0 ? 2 : 1) * baseScore * heightFactor);
            spawnEmberBurst(m.x + m.size / 2, m.y + m.size / 2, ["#ffd166", "#ff8a4c"], m.armored ? 22 : 14);
          }
        }
        if (b.pierce <= 0) boltsUsed.add(b);
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

function drawArmoredMeteor(m) {
  ctx.save();
  ctx.translate(m.x + m.size / 2, m.y + m.size / 2);
  ctx.rotate(m.angle);
  const r = m.size / 2;
  const grad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
  grad.addColorStop(0, "#c9d4e0");
  grad.addColorStop(0.55, "#7c8ba1");
  grad.addColorStop(1, "#333d4d");
  ctx.fillStyle = grad;
  ctx.strokeStyle = m.hp > 1 ? "#ff8a4c" : "#ff4c4c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  const spikes = 8;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    const rr = r * (0.82 + (i % 2 === 0 ? 0.18 : 0));
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawTennisBall(m) {
  ctx.save();
  ctx.translate(m.x + m.size / 2, m.y + m.size / 2);
  ctx.rotate(m.angle);
  const r = m.size / 2;
  ctx.fillStyle = "#cdea3e";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#eef8c8";
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.beginPath();
  ctx.moveTo(-r * 0.7, -r * 0.55);
  ctx.quadraticCurveTo(0, 0, -r * 0.7, r * 0.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.7, -r * 0.55);
  ctx.quadraticCurveTo(0, 0, r * 0.7, r * 0.55);
  ctx.stroke();
  ctx.restore();
}

function drawBeachBall(m) {
  ctx.save();
  ctx.translate(m.x + m.size / 2, m.y + m.size / 2);
  ctx.rotate(m.angle);
  const r = m.size / 2;
  const colors = ["#ff6b57", "#ffd166", "#63e6e0", "#9b8dff", "#6fe7a6", "#ff5fa2"];
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, (i / 6) * Math.PI * 2, ((i + 1) / 6) * Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = m.hp > 1 ? "#ff8a4c" : "#ff4c4c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
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

  if (p.type === "shield" && sillyMode) {
    ctx.shadowColor = "#9fd8f5";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "rgba(223, 243, 255, 0.55)";
    ctx.strokeStyle = "#9fd8f5";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-r * 0.35, -r * 0.35, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fill();
  } else if (p.type === "shield") {
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
  } else if (p.type === "weapon" && sillyMode) {
    ctx.shadowColor = "#ff5fa2";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#d9a55c";
    ctx.beginPath(); ctx.arc(-r * 0.45, -r * 0.35, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-r * 0.45, r * 0.35, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.35, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.45, r * 0.35, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-r * 0.45, -r * 0.3, r * 0.9, r * 0.6);
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
  } else if (sillyMode) {
    ctx.shadowColor = "#6fe7a6";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#6fe7a6";
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(-r * 0.5, -r * 0.5, r, r * 1.1, 3);
      ctx.fill();
    } else {
      ctx.fillRect(-r * 0.5, -r * 0.5, r, r * 1.1);
    }
    ctx.fillRect(-r * 0.3, -r * 0.75, r * 0.6, r * 0.3);
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
  if (sillyMode) {
    ctx.save();
    ctx.shadowColor = "#e8c39e";
    ctx.shadowBlur = 6;
    ctx.fillStyle = "#d9a55c";
    ctx.beginPath();
    ctx.arc(b.x, b.y - 7, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(b.x, b.y + 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(b.x - 2, b.y - 7, 4, 10);
    ctx.restore();
    return;
  }
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

function drawShip(cx, cy) {
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
}

function drawPuppy(cx, cy) {
  const r = player.w / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = "#f5c98a";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#c9955f";
  ctx.beginPath();
  ctx.ellipse(-0.8 * r, -0.37 * r, 0.37 * r, 0.85 * r, -0.314, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.8 * r, -0.37 * r, 0.37 * r, 0.85 * r, 0.314, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e8c39e";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f5e6d0";
  ctx.beginPath();
  ctx.ellipse(0, 0.52 * r, 0.56 * r, 0.44 * r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a2415";
  ctx.beginPath();
  ctx.arc(0, 0.68 * r, 0.12 * r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-0.39 * r, -0.19 * r, 0.12 * r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0.39 * r, -0.19 * r, 0.12 * r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer() {
  const cx = player.x + player.w / 2;
  const cy = player.y + player.h / 2;
  const r = player.w / 2;

  const trailColor = sillyMode ? "#e8c39e" : "#9b8dff";
  for (const t of trail) {
    ctx.globalAlpha = Math.max(t.life / 18, 0) * 0.5;
    ctx.fillStyle = trailColor;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r * 0.35 * (t.life / 18), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (sillyMode) {
    drawPuppy(cx, cy);
  } else {
    drawShip(cx, cy);
  }

  if (shieldCharges > 0) {
    ctx.save();
    const shieldColor = sillyMode ? "#9fd8f5" : "#63e6e0";
    ctx.strokeStyle = shieldColor;
    ctx.shadowColor = shieldColor;
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

  for (const m of meteors) {
    if (m.isNumber) drawNumberMeteor(m);
    else if (m.armored) (sillyMode ? drawBeachBall(m) : drawArmoredMeteor(m));
    else (sillyMode ? drawTennisBall(m) : drawMeteor(m));
  }
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
