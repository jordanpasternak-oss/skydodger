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
const overlay = document.getElementById("overlay");
const overlayStatus = document.getElementById("overlayStatus");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMsg = document.getElementById("overlayMsg");
const startBtn = document.getElementById("startBtn");

const W = canvas.width;
const H = canvas.height;
const BEST_KEY = "cometRunBest";

const player = { w: 30, h: 30, x: W / 2 - 15, y: H - 56, speed: 6 };
let keys = {};
let meteors = [];
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

bestEl.textContent = best;

function resetGame() {
  player.x = W / 2 - player.w / 2;
  meteors = [];
  embers = [];
  trail = [];
  score = 0;
  spawnTimer = 0;
  spawnInterval = 66;
  baseFallSpeed = 2.3;
  elapsed = 0;
  scoreEl.textContent = "0";
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

function circleRectOverlap(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function spawnEmberBurst(x, y) {
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    embers.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 32,
      r: 1.5 + Math.random() * 2,
    });
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

  if (elapsed % 300 === 0) {
    spawnInterval = Math.max(20, spawnInterval - 4);
    baseFallSpeed += 0.3;
  }

  for (const m of meteors) {
    m.y += m.speed;
    m.angle += m.spin;
  }
  meteors = meteors.filter((m) => m.y < H + 40);

  const cx = player.x + player.w / 2;
  const cy = player.y + player.h / 2;
  const pr = player.w / 2 - 3;
  for (const m of meteors) {
    if (circleRectOverlap(cx, cy, pr + m.size / 2, { x: m.x, y: m.y, w: m.size, h: m.size })) {
      spawnEmberBurst(cx, cy);
      gameOver();
      return;
    }
  }

  for (const e of embers) {
    e.x += e.vx;
    e.y += e.vy;
    e.vy += 0.05;
    e.life--;
  }
  embers = embers.filter((e) => e.life > 0);

  score += 1;
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
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  for (const m of meteors) drawMeteor(m);
  drawPlayer();

  for (const e of embers) {
    ctx.globalAlpha = Math.max(e.life / 32, 0);
    ctx.fillStyle = e.r > 2.5 ? "#ffd166" : "#ff8a4c";
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
