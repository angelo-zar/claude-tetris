'use strict';

// Puntuación: líneas, combos encadenados, T-spin, Back-to-Back y Perfect Clear.

let combo, b2b, lastMoveRotate;

const LINE_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'];

function resetScoring() {
  combo = 0;      // fijaciones consecutivas que limpian líneas
  b2b = false;    // la última limpieza fue "difícil" (Tetris o T-spin)
  lastMoveRotate = false;
}

// T-spin: la T se fijó justo después de rotar y 3 de las 4 esquinas de su caja 3×3 están ocupadas.
function isTSpin() {
  if (current.type !== 3 || !lastMoveRotate) return false;
  let filled = 0;
  for (const [r, c] of [[0, 0], [0, 2], [2, 0], [2, 2]]) {
    const y = current.y + r, x = current.x + c;
    if (x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x])) filled++;
  }
  return filled >= 3;
}

function scoreClear(rows, tspin) {
  const n = rows.length;
  if (!n) {
    combo = 0;
    if (tspin) {
      score += TSPIN_SCORES[0] * level;
      addPopup('T-SPIN', COLORS[3]);
      sfx('tspin');
    }
    updateHUD();
    return;
  }

  combo = Math.min(combo + 1, MAX_COMBO);
  const difficult = tspin || n >= 4;
  const backToBack = difficult && b2b;
  b2b = difficult;

  const base = tspin ? TSPIN_SCORES[Math.min(n, 3)] : (LINE_SCORES[n] || LINE_SCORES[4]);
  let points = base * level * combo * (backToBack ? B2B_MULTIPLIER : 1);

  const name = (tspin ? 'T-SPIN ' : '') + (LINE_NAMES[n] || `${n} LÍNEAS`);
  addPopup((backToBack ? 'B2B ' : '') + name, tspin ? COLORS[3] : n >= 4 ? COLORS[1] : '#ffffff');
  if (combo > 1) addPopup(`COMBO x${combo}`, '#ffd54f');

  if (n >= 4 && has('specials')) {
    queue.splice(1, 0, newPiece(SINGLE_TYPE)); // premio: justo detrás de la pieza que va a salir
    addPopup('¡PREMIO 1×1!', COLORS[SINGLE_TYPE]);
  }

  const perfect = board.every(row => row.every(v => !v));
  if (perfect) {
    points += PERFECT_CLEAR_BONUS * level;
    addPopup('PERFECT CLEAR', '#ff80ab');
  }

  score += Math.round(points);
  lines += n;
  updateLevel();
  chargePowerup(n);
  addEnergy(n);
  flashRows(rows);

  if (perfect) sfx('perfect');
  else if (tspin) sfx('tspin');
  else if (n >= 4) sfx('tetris');
  else sfx('clear', n);
  if (combo > 1) sfx('combo', combo);

  updateHUD();
}
