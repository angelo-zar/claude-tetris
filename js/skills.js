'use strict';

// Habilidades cargables (solo Arcade): la energía sube al limpiar líneas y, llena,
// se gasta en una habilidad elegida en un selector (tecla E).

let energy, previewMs, slowMs, freeHoldMs, snapshot;

function resetSkills() {
  energy = 0;
  previewMs = 0;   // tiempo restante viendo las 5 siguientes piezas
  slowMs = 0;      // tiempo restante con la caída ralentizada
  freeHoldMs = 0;  // tiempo restante con hold ilimitado
  snapshot = null; // estado previo a la última fijación (para deshacer)
}

function addEnergy(linesCleared) {
  if (!has('skills')) return;
  energy = Math.min(ENERGY_MAX, energy + linesCleared * ENERGY_PER_LINE + (combo - 1) * ENERGY_PER_COMBO);
}

// Avanza los temporizadores de las habilidades activas (llamado desde el loop).
function tickSkills(dt) {
  previewMs = Math.max(0, previewMs - dt);
  slowMs = Math.max(0, slowMs - dt);
  freeHoldMs = Math.max(0, freeHoldMs - dt);
}

// Guarda el estado justo antes de fijar la pieza actual.
function takeSnapshot() {
  if (!has('skills')) return;
  snapshot = {
    board: board.map(row => [...row]),
    queue: queue.map(p => ({ ...p, shape: p.shape.map(row => [...row]) })),
    bag: [...bag],
    hold: hold && { ...hold },
    piece: { type: current.type, powerup: current.powerup },
    score, lines, combo, maxCombo, b2b, powerupCharge,
  };
}

const SKILL_ACTIONS = {
  preview() { previewMs = PREVIEW_MS; },
  swap() { showSwapPicker(); return false; }, // la energía se gasta al elegir la pieza
  slow() { slowMs = SLOW_MS; },
  undo() {
    const s = snapshot;
    board = s.board;
    queue = s.queue;
    bag = s.bag;
    hold = s.hold;
    ({ score, lines, combo, maxCombo, b2b, powerupCharge } = s);
    updateLevel();
    current = newPiece(s.piece.type);
    current.powerup = s.piece.powerup;
    holdUsed = false;
    snapshot = null;
    drawNext();
    drawHold();
  },
  freeHold() { freeHoldMs = FREE_HOLD_MS; },
};

function skillAvailable(key) {
  return key !== 'undo' || snapshot !== null;
}

function openSkills() {
  if (!has('skills') || energy < ENERGY_MAX || paused) return;
  paused = true;
  cancelAnimationFrame(animId);
  showOverlay('HABILIDAD', 'Elige una (1–5) · E para cancelar', SKILLS.map((s, i) => ({
    label: `${i + 1}. ${s.name}`,
    hint: s.hint,
    disabled: !skillAvailable(s.key),
    action: () => useSkill(s.key),
  })));
  uiMode = 'skill';
}

function closeSkills() {
  paused = false;
  hideOverlay();
  updateHUD();
  lastTime = performance.now();
  loop(lastTime);
}

function useSkill(key) {
  if (!skillAvailable(key)) return;
  if (SKILL_ACTIONS[key]() === false) return; // necesita otro paso
  energy = 0;
  sfx('skill');
  addPopup(SKILLS.find(s => s.key === key).name.toUpperCase(), '#ffd54f');
  closeSkills();
}

function showSwapPicker() {
  showOverlay('INTERCAMBIAR', 'Elige la pieza (1–7)', STANDARD_TYPES.map((type, i) => ({
    label: `${i + 1}. ${PIECE_NAMES[type]}`,
    action: () => swapPiece(type),
  })));
  uiMode = 'swap';
}

function swapPiece(type) {
  const piece = newPiece(type);
  if (collide(piece.shape, piece.x, piece.y)) return; // no cabe arriba: se elige otra
  current = piece;
  lastMoveRotate = false;
  energy = 0;
  sfx('skill');
  addPopup('INTERCAMBIO', '#ffd54f');
  closeSkills();
}

// Teclas dentro del selector. Devuelve true si la tecla se ha consumido.
function handleSkillKey(code) {
  if (code === 'KeyE' || code === 'Escape') { closeSkills(); return true; }
  const n = Number(code.replace(/^(Digit|Numpad)/, ''));
  if (!n) return false;
  if (uiMode === 'skill' && SKILLS[n - 1]) useSkill(SKILLS[n - 1].key);
  else if (uiMode === 'swap' && STANDARD_TYPES[n - 1]) swapPiece(STANDARD_TYPES[n - 1]);
  return true;
}
