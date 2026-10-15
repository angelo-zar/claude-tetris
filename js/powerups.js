'use strict';

// Power-ups (solo Arcade): cada POWERUP_EVERY líneas una pieza llega cargada con un efecto
// que se dispara al fijarla, después de merge() y antes de clearLines().

let powerupCharge, freezeMs;

function resetPowerups() {
  powerupCharge = 0; // líneas acumuladas hacia el próximo power-up
  freezeMs = 0;      // tiempo restante sin caída automática
}

// Llamado tras sumar líneas: carga la pieza que se verá en NEXT tras el próximo spawn.
function chargePowerup(n) {
  if (!has('powerups')) return;
  powerupCharge += n;
  if (powerupCharge < POWERUP_EVERY) return;
  powerupCharge -= POWERUP_EVERY;
  const keys = Object.keys(POWERUPS);
  const target = queue[1];
  if (target && !target.powerup) target.powerup = keys[Math.floor(Math.random() * keys.length)];
}

// Celdas [fila, columna] que ocupa la pieza en el tablero.
function pieceCells(piece) {
  const cells = [];
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c]) cells.push([piece.y + r, piece.x + c]);
  return cells;
}

function pieceCenter(piece) {
  const cells = pieceCells(piece);
  const avg = i => Math.round(cells.reduce((s, cell) => s + cell[i], 0) / cells.length);
  return [avg(0), avg(1)];
}

function clearCell(r, c) {
  if (r >= 0 && r < ROWS && c >= 0 && c < COLS) board[r][c] = 0;
}

const POWERUP_EFFECTS = {
  // Vacía el área 3×3 alrededor del centro de la pieza.
  bomb(piece) {
    const [cr, cc] = pieceCenter(piece);
    const cells = [];
    for (let r = cr - 1; r <= cr + 1; r++)
      for (let c = cc - 1; c <= cc + 1; c++) {
        clearCell(r, c);
        cells.push([r, c]);
      }
    burstCells(cells);
  },

  // Vacía la columna central de la pieza y elimina su fila más baja (lo de arriba baja una fila).
  laser(piece) {
    const cells = pieceCells(piece);
    const row = Math.max(...cells.map(cell => cell[0]));
    const col = pieceCenter(piece)[1];
    for (let r = 0; r < ROWS; r++) clearCell(r, col);
    board.splice(row, 1);
    board.unshift(new Array(COLS).fill(0));
    flashRows([row]);
    burstCells(Array.from({ length: ROWS }, (_, r) => [r, col]));
  },

  // Convierte en comodines todos los bloques del color más abundante.
  tint() {
    const counts = {};
    for (const row of board)
      for (const v of row)
        if (v && v !== WILD_TYPE && v !== GARBAGE_TYPE) counts[v] = (counts[v] || 0) + 1;
    const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    if (!top) return;
    for (const row of board)
      for (let c = 0; c < COLS; c++)
        if (row[c] === Number(top)) row[c] = WILD_TYPE;
  },

  // Compacta cada columna hacia abajo, eliminando los huecos.
  gravity() {
    for (let c = 0; c < COLS; c++) {
      const blocks = [];
      for (let r = 0; r < ROWS; r++) if (board[r][c]) blocks.push(board[r][c]);
      for (let r = 0; r < ROWS; r++)
        board[r][c] = r >= ROWS - blocks.length ? blocks[r - (ROWS - blocks.length)] : 0;
    }
  },

  // Detiene la caída automática unos segundos.
  freeze() {
    freezeMs = FREEZE_MS;
  },
};

function applyPowerup(piece) {
  POWERUP_EFFECTS[piece.powerup](piece);
  addPopup(`${POWERUPS[piece.powerup].icon} ${POWERUPS[piece.powerup].name}`, '#ffffff');
  sfx('powerup');
}

// Al limpiar cualquier línea, todos los comodines del tablero explotan y dan puntos.
function explodeWilds() {
  const cells = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] === WILD_TYPE) {
        board[r][c] = 0;
        cells.push([r, c]);
      }
  if (!cells.length) return;
  score += cells.length * WILD_POINTS * level;
  burstCells(cells);
  addPopup(`COMODINES +${cells.length * WILD_POINTS * level}`, '#ffffff');
}

// Depuración desde la consola: forcePowerup('bomb' | 'laser' | 'tint' | 'gravity' | 'freeze')
function forcePowerup(name) {
  if (current && POWERUPS[name]) current.powerup = name;
}
