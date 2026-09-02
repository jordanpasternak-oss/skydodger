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
const overlay = document.getElementById("overlay");
const overlayStatus = document.getElementById("overlayStatus");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMsg = document.getElementById("overlayMsg");
const startBtn = document.getElementById("startBtn");

const W = canvas.width;
const H = canvas.height;
const BEST_KEY = "cometRunBest";
const MULTIPLIER_DURATION = 480;

const player = { w: 30, h: 30, x: W / 2 - 15, y: H - 56, speed: 6 };
let keys = {};
let meteors = [];
let powerups = [];
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

let shieldActive = false;
let multiplierTime = 0;
let spawnPowerupTimer = 0;
let spawnPowerupInterval = 420 + Math.random() * 240;

bestEl.textContent = best;

function resetGame() {
  player.x = W / 2 - player.w / 2;
  meteors = [];
  powerups = [];
  embers = [];
  trail = [];
  score = 0;
  spawnTimer = 0;
  spawnInterval = 66;
  baseFallSpeed = 2.3;
  elapsed = 0;
  shieldActive = false;
  multiplierTime = 0;
  spawnPowerupTimer = 0;
  spawnPowerupInterval = 420 + Math.random() * 240;
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
  powerups.push({
    x: Math.random() * (W - size),
    y: -size,
    size,
    speed: 2,
    angle: 0,
    type: Math.random() < 0.5 ? "shield" : "boost",
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

function spawnEmberBurst(x, y, colors) {
  const palette = colors || ["#ffd166", "#ff8a4c"];
  for (let i = 0; i < 22; i++) {
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

function updateBuffsUI() {
  if (shieldActive && !shieldPillEl) {
    shieldPillEl = document.createElement("span");
    shieldPillEl.className = "buff-pill shield";
    shieldPillEl.textContent = "Shield";
    buffsEl.appendChild(shieldPillEl);
  } else if (!shieldActive && shieldPillEl) {
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

  spawnTimer++;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnMeteor();
  }

  spawnPowerupTimer++;
  if (spawnPowerupTimer >= spawnPowerupInterval && powerups.length === 0) {
    spawnPowerupTimer = 0;
    spawnPowerupInterval = 420 + Math.random() * 240;
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

  const cx = player.x + player.w / 2;
  const cy = player.y + player.h / 2;
  const pr = player.w / 2 - 3;

  for (const m of meteors) {
    if (circleRectOverlap(cx, cy, pr + m.size / 2, { x: m.x, y: m.y, w: m.size, h: m.size })) {
      if (shieldActive) {
        shieldActive = false;
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
        shieldActive = true;
        spawnEmberBurst(cx, cy, ["#63e6e0", "#ede9ff"]);
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

  if (shieldActive) {
    ctx.save();
    ctx.strokeStyle = "#63e6e0";
    ctx.shadowColor = "#63e6e0";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.75 + Math.sin(elapsed * 0.15) * 0.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  for (const m of meteors) drawMeteor(m);
  for (const p of powerups) drawPowerup(p);
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
