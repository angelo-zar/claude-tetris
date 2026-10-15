'use strict';

// Dibujo en canvas y actualización del HUD.

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const muteEl = document.getElementById('mute-state');
const statusEl = document.getElementById('status');
const energySection = document.getElementById('energy-section');
const energyFill = document.getElementById('energy-fill');
const queueCanvas = document.getElementById('queue-canvas');
const queueCtx = queueCanvas.getContext('2d');

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  comboEl.textContent = combo > 1 ? `x${combo}` : '-';
  muteEl.textContent = muted ? 'off' : 'on';
  energySection.hidden = !has('skills');
  energyFill.style.width = `${(energy / ENERGY_MAX) * 100}%`;
  energySection.classList.toggle('full', energy >= ENERGY_MAX);
}

// Efectos temporales activos (se llama en cada frame).
function updateStatus() {
  const items = [];
  if (freezeMs > 0) items.push(`❄️ congelado ${(freezeMs / 1000).toFixed(1)}s`);
  if (slowMs > 0) items.push(`🐢 lento ${(slowMs / 1000).toFixed(1)}s`);
  if (freeHoldMs > 0) items.push(`♾️ hold libre ${(freeHoldMs / 1000).toFixed(1)}s`);
  if (previewMs > 0) items.push(`👁️ cola visible ${(previewMs / 1000).toFixed(1)}s`);
  const text = items.join('\n');
  if (statusEl.textContent !== text) statusEl.textContent = text;
  if (queueCanvas.hidden !== !(previewMs > 0)) {
    queueCanvas.hidden = !(previewMs > 0);
    drawQueue();
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = colorIndex === WILD_TYPE
    ? `hsl(${(performance.now() / 8 + (x + y) * 40) % 360}, 85%, 65%)` // comodín: arcoíris animado
    : COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (!current) return drawEffects(); // menú inicial: solo el tablero

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  if (current.powerup) drawPowerupMark(ctx, current.shape, current.x, current.y, BLOCK, current.powerup);

  drawEffects();
}

// Dibuja una pieza centrada en un canvas de 4×4 celdas (preview).
function drawPreview(context, piece, size) {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  drawPieceInBox(context, piece, size, 0, 0);
}

// Dibuja la pieza centrada en una caja de 4×4 celdas cuya esquina está en la celda (boxX, boxY).
function drawPieceInBox(context, piece, size, boxX, boxY) {
  if (!piece) return;
  const shape = piece.shape;
  const offX = boxX + Math.floor((4 - shape[0].length) / 2);
  const offY = boxY + Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], size);
  if (piece.powerup) drawPowerupMark(context, shape, offX, offY, size, piece.powerup);
}

// Borde pulsante en cada celda y el icono del power-up en el centro de la pieza.
function drawPowerupMark(context, shape, ox, oy, size, powerup) {
  const cells = [];
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) cells.push([ox + c, oy + r]);
  context.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 120);
  context.strokeStyle = '#ffffff';
  context.lineWidth = 2;
  for (const [x, y] of cells) context.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
  context.globalAlpha = 1;
  const cx = cells.reduce((s, [x]) => s + x, 0) / cells.length;
  const cy = cells.reduce((s, [, y]) => s + y, 0) / cells.length;
  const px = (cx + 0.5) * size, py = (cy + 0.5) * size;
  context.fillStyle = 'rgba(0,0,0,0.55)';
  context.beginPath();
  context.arc(px, py, size * 0.45, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#ffffff';
  context.font = `${Math.round(size * 0.6)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(POWERUPS[powerup].icon, px, py);
  context.textBaseline = 'alphabetic';
}

function drawNext() {
  drawPreview(nextCtx, queue[0], 30);
  if (!queueCanvas.hidden) drawQueue();
}

// Las 4 piezas que siguen a NEXT (habilidad Ver 5 piezas), en dos columnas de cajas 4×4.
function drawQueue() {
  queueCtx.clearRect(0, 0, queueCanvas.width, queueCanvas.height);
  queue.slice(1, 5).forEach((piece, i) => drawPieceInBox(queueCtx, piece, 15, (i % 2) * 4, Math.floor(i / 2) * 4));
}

function drawHold() {
  drawPreview(holdCtx, hold && { ...newPiece(hold.type), powerup: hold.powerup }, 30);
  holdCanvas.classList.toggle('locked', holdUsed); // atenuado: ya se usó en esta pieza
}

// ---- Efectos visuales: textos flotantes, destello de filas y partículas ----

const POPUP_MS = 1100;
const FLASH_MS = 250;
const PARTICLE_MS = 700;
let popups = [], flashes = [], particles = [];

function resetEffects() {
  popups = []; flashes = []; particles = [];
}

function addPopup(text, color) {
  popups.push({ text, color, born: performance.now() });
}

// Partículas saliendo de cada celda [fila, columna] indicada.
function burstCells(cells) {
  const now = performance.now();
  for (const [r, c] of cells)
    for (let i = 0; i < 3; i++)
      particles.push({
        x: (c + 0.5) * BLOCK,
        y: (r + 0.5) * BLOCK,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.25 - 0.05,
        color: COLORS[1 + Math.floor(Math.random() * 7)],
        born: now,
      });
}

function flashRows(rows) {
  const now = performance.now();
  for (const row of rows) {
    flashes.push({ row, born: now });
    for (let i = 0; i < 12; i++) {
      particles.push({
        x: Math.random() * COLS * BLOCK,
        y: (row + 0.5) * BLOCK,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.25 - 0.05,
        color: COLORS[1 + Math.floor(Math.random() * 7)],
        born: now,
      });
    }
  }
}

function drawEffects() {
  const now = performance.now();
  flashes = flashes.filter(f => now - f.born < FLASH_MS);
  particles = particles.filter(p => now - p.born < PARTICLE_MS);
  popups = popups.filter(p => now - p.born < POPUP_MS);

  for (const f of flashes) {
    ctx.globalAlpha = 0.7 * (1 - (now - f.born) / FLASH_MS);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, f.row * BLOCK, COLS * BLOCK, BLOCK);
  }
  for (const p of particles) {
    const t = now - p.born;
    ctx.globalAlpha = 1 - t / PARTICLE_MS;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x + p.vx * t, p.y + p.vy * t + 0.0004 * t * t, 4, 4);
  }

  ctx.textAlign = 'center';
  ctx.font = 'bold 20px system-ui, sans-serif';
  popups.forEach((p, i) => {
    const t = (now - p.born) / POPUP_MS;
    ctx.globalAlpha = 1 - t * t;
    ctx.fillStyle = p.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    const y = 220 + i * 28 - t * 30;
    ctx.strokeText(p.text, COLS * BLOCK / 2, y);
    ctx.fillText(p.text, COLS * BLOCK / 2, y);
  });
  ctx.globalAlpha = 1;
}
