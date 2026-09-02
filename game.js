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

const player = { w: 30, h: 30, x: W / 2 - 15, y: H - 56, speed: 6 };
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
let spawnInterval = 66;
let baseFallSpeed = 2.3;
let elapsed = 0;
let running = false;
let animId = null;

let shieldCharges = 0;
let weaponLevel = 1;
let fireCooldown = 0;
let multiplierTime = 0;
let spawnPowerupTimer = 0;
let spawnPowerupInterval = 260 + Math.random() * 160;

bestEl.textContent = best;

function resetGame() {
  player.x = W / 2 - player.w / 2;
  meteors = [];
  powerups = [];
  bolts = [];
  embers = [];
  trail = [];
  score = 0;
  spawnTimer = 0;
  spawnInterval = 66;
  baseFallSpeed = 2.3;
  elapsed = 0;
  shieldCharges = 0;
  weaponLevel = 1;
  fireCooldown = 0;
  multiplierTime = 0;
  spawnPowerupTimer = 0;
  spawnPowerupInterval = 260 + Math.random() * 160;
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
  for (const offset of config.pattern) {
    bolts.push({ x: cx + offset, y: player.y });
  }
}

function update() {
  elapsed++;

  const moving = (keys["ArrowLeft"] || keys["a"] || keys["A"]) !== (keys["ArrowRight"] || keys["d"] || keys["D"]);
  if (keys["ArrowLeft"] || keys["a"] || keys["A"]) player.x -= player.speed;
  if (keys["ArrowRight"] || keys["d"] || keys["D"]) player.x += player.speed;
  player.x = Math.max(0, Math.min(W - player.w, player.x));

  if (elapsed % 2 === 0) {
    trail.push({ x: player.x + player.w / 2, y: player.y + player.h, life: 18, moving });
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

  if (elapsed % 300 === 0) {
    spawnInterval = Math.max(20, spawnInterval - 4);
    baseFallSpeed += 0.3;
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
  for (const b of bolts) {
    for (const m of meteors) {
      if (meteorsHit.has(m) || boltsUsed.has(b)) continue;
      const dx = b.x - (m.x + m.size / 2);
      const dy = b.y - (m.y + m.size / 2);
      if (Math.hypot(dx, dy) < m.size / 2 + 4) {
        meteorsHit.add(m);
        boltsUsed.add(b);
        spawnEmberBurst(m.x + m.size / 2, m.y + m.size / 2, ["#ffd166", "#ff8a4c"], 14);
        score += (multiplierTime > 0 ? 2 : 1) * 15;
        break;
      }
    }
  }
  if (meteorsHit.size) meteors = meteors.filter((m) => !meteorsHit.has(m));
  if (boltsUsed.size) bolts = bolts.filter((b) => !boltsUsed.has(b));

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
  ctx.shadowColor = "#9b8dff";
  ctx.shadowBlur = 16;
  const grad = ctx.createRadialGradient(cx, cy - r * 0.2, r * 0.1, cx, cy, r);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.5, "#ede9ff");
  grad.addColorStop(1, "#9b8dff");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
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

  for (const m of meteors) drawMeteor(m);
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
  if (["ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
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
canvas.addEventListener("touchstart", (e) => {
  touchX = e.touches[0].clientX;
});
canvas.addEventListener("touchmove", (e) => {
  if (touchX === null) return;
  const rect = canvas.getBoundingClientRect();
  const scale = W / rect.width;
  const dx = (e.touches[0].clientX - touchX) * scale;
  player.x = Math.max(0, Math.min(W - player.w, player.x + dx));
  touchX = e.touches[0].clientX;
  e.preventDefault();
}, { passive: false });

draw();
