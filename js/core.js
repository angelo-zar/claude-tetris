'use strict';

// Estado de la partida y reglas del tablero.

let mode, bag, board, current, queue, hold, holdUsed, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function newPiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

// ¿Está activa esta mecánica en el modo actual? (ver MODES en config.js)
function has(feature) {
  return Boolean(MODES[mode]?.[feature]);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Bolsa de 7: cada pieza estándar sale una vez por ronda. En Arcade, a veces sale una especial.
function randomPiece() {
  if (has('specials') && Math.random() < SPECIAL_CHANCE)
    return newPiece(SPECIAL_TYPES[Math.floor(Math.random() * SPECIAL_TYPES.length)]);
  if (!bag.length) bag = shuffle([...STANDARD_TYPES]);
  return newPiece(bag.pop());
}

function refillQueue() {
  while (queue.length < QUEUE_SIZE) queue.push(randomPiece());
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

// dir = 1 horario, -1 antihorario (tres giros horarios).
function tryRotate(dir = 1) {
  let rotated = rotateCW(current.shape);
  if (dir < 0) rotated = rotateCW(rotateCW(rotated));
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastMoveRotate = true;
      sfx('rotate');
      return;
    }
  }
}

function tryMove(dx) {
  if (collide(current.shape, current.x + dx, current.y)) return;
  current.x += dx;
  lastMoveRotate = false;
  sfx('move');
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

// Elimina las filas completas y devuelve sus índices (antes de desplazar el tablero).
function clearLines() {
  const full = [];
  for (let r = 0; r < ROWS; r++)
    if (board[r].every(v => v !== 0)) full.push(r);
  // en orden ascendente: quitar la fila r no mueve las filas completas de más abajo
  for (const r of full) {
    board.splice(r, 1);
    board.unshift(new Array(COLS).fill(0));
  }
  return full;
}

function updateLevel() {
  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    lastMoveRotate = false;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (gameOver) return; // nunca fijar piezas tras el Game Over (evita sobrescribir celdas)
  takeSnapshot();
  const tspin = isTSpin(); // antes de merge: mira las esquinas libres alrededor de la T
  merge();
  sfx('lock');
  if (current.powerup) applyPowerup(current);
  const rows = clearLines();
  if (rows.length) explodeWilds();
  scoreClear(rows, tspin);
  if (afterLockChallenge(current)) return; // reto superado: no sale otra pieza
  holdUsed = false;
  spawn();
  drawHold();
}

function spawn() {
  current = queue.shift();
  refillQueue();
  lastMoveRotate = false;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

// Guarda la pieza actual en el hold (o la intercambia con la guardada). Un uso por pieza.
function holdPiece() {
  if (holdUsed && freeHoldMs <= 0) return; // la habilidad Hold libre quita el límite
  const held = hold;
  hold = { type: current.type, powerup: current.powerup };
  if (held) {
    current = newPiece(held.type);
    current.powerup = held.powerup;
  } else {
    current = queue.shift();
    refillQueue();
    drawNext();
  }
  holdUsed = true;
  lastMoveRotate = false;
  sfx('hold');
  drawHold();
  if (collide(current.shape, current.x, current.y)) endGame();
}
