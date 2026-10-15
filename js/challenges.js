'use strict';

// Modo Desafíos: cada reto (ver CHALLENGES en config.js) añade reglas y un objetivo.

let challenge = null; // reto activo, o null fuera del modo Desafíos
let elapsed, garbageMs, lastLock, reverseAnnounced;

const objectiveSection = document.getElementById('objective-section');
const objectiveEl = document.getElementById('objective');

function formatTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function setupChallenge() {
  elapsed = 0;
  garbageMs = 0;
  lastLock = null;
  reverseAnnounced = false;
  objectiveSection.hidden = !challenge;
  if (challenge?.fixedRows) {
    // patrón fijo y disperso: ninguna fila queda completa
    for (let r = ROWS - challenge.fixedRows; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if ((c + 2 * r) % 5 === 0 || (3 * c + r) % 7 === 0) board[r][c] = GARBAGE_TYPE;
  }
  updateObjective();
}

function countGarbage() {
  return board.reduce((n, row) => n + row.filter(v => v === GARBAGE_TYPE).length, 0);
}

function updateObjective() {
  if (!challenge) return;
  const parts = [challenge.name];
  if (challenge.goalLines) parts.push(`Líneas ${Math.min(lines, challenge.goalLines)}/${challenge.goalLines}`);
  if (challenge.timeLimit) parts.push(`Quedan ${formatTime(challenge.timeLimit - elapsed)}`);
  if (challenge.survive) parts.push(`Sobrevive ${formatTime(challenge.survive - elapsed)}`);
  if (challenge.garbageEvery) parts.push(`Basura en ${formatTime(challenge.garbageEvery - garbageMs)}`);
  if (challenge.fixedRows) parts.push(`Quedan ${countGarbage()} bloques`);
  const text = parts.join('\n');
  if (objectiveEl.textContent !== text) objectiveEl.textContent = text;
}

// Sube una fila de basura con un hueco aleatorio por abajo.
function addGarbageRow() {
  if (board[0].some(v => v)) return endGame('La basura llegó arriba');
  board.shift();
  const hole = Math.floor(Math.random() * COLS);
  board.push(Array.from({ length: COLS }, (_, c) => (c === hole ? 0 : GARBAGE_TYPE)));
  if (collide(current.shape, current.x, current.y)) current.y--;
  if (collide(current.shape, current.x, current.y)) endGame('La basura llegó arriba');
}

// Temporizadores del reto (llamado en cada frame con el tiempo transcurrido).
function tickChallenge(dt) {
  if (!challenge) return;
  elapsed += dt;
  if (challenge.timeLimit && elapsed >= challenge.timeLimit) return endGame('¡Se acabó el tiempo!');
  if (challenge.garbageEvery) {
    garbageMs += dt;
    if (garbageMs >= challenge.garbageEvery) {
      garbageMs -= challenge.garbageEvery;
      addGarbageRow();
      if (gameOver) return;
    }
  }
  if (challenge.survive && elapsed >= challenge.survive) return winGame();
  updateObjective();
}

// Tras fijar una pieza. Devuelve true si el reto se ha superado.
function afterLockChallenge(piece) {
  if (!challenge) return false;
  if (challenge.invisible) lastLock = { cells: new Set(pieceCells(piece).map(([r, c]) => `${r},${c}`)), at: performance.now() };
  if (challenge.reverseFromLevel && level >= challenge.reverseFromLevel && !reverseAnnounced) {
    reverseAnnounced = true;
    addPopup('¡ROTACIÓN INVERSA!', '#ff8a65');
  }
  updateObjective();
  if ((challenge.goalLines && lines >= challenge.goalLines) || (challenge.fixedRows && countGarbage() === 0)) {
    winGame();
    return true;
  }
  return false;
}

// Sentido de giro: el reto de rotación inversa lo invierte a partir de cierto nivel.
function rotationDir() {
  return challenge?.reverseFromLevel && level >= challenge.reverseFromLevel ? -1 : 1;
}

// Reto de piezas invisibles: solo se ve un destello de la última pieza fijada.
function cellVisible(r, c) {
  if (!challenge?.invisible) return true;
  return Boolean(lastLock) && performance.now() - lastLock.at < LOCK_FLASH_MS && lastLock.cells.has(`${r},${c}`);
}
