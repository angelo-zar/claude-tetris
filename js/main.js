'use strict';

// Bucle de juego, entrada de teclado, menú/overlay y tema.

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const overlayButtons = document.getElementById('overlay-buttons');

let uiMode = 'menu'; // 'menu' (overlay con botones) | 'play'

// Muestra el overlay con un título, un subtítulo y botones [{ label, hint, action }].
function showOverlay(title, subtitle, buttons, titleClass = '') {
  uiMode = 'menu';
  overlayTitle.textContent = title;
  overlayTitle.className = titleClass;
  overlayScore.textContent = subtitle;
  overlayButtons.replaceChildren(...buttons.map(({ label, hint, action }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'overlay-btn';
    btn.textContent = label;
    if (hint) {
      const small = document.createElement('small');
      small.textContent = hint;
      btn.appendChild(small);
    }
    btn.addEventListener('click', () => {
      btn.blur(); // evita que Space reactive el botón durante el juego
      action();
    });
    return btn;
  }));
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
  uiMode = 'play';
}

function showMenu() {
  cancelAnimationFrame(animId);
  current = null; // sin partida activa: P no reanuda nada
  paused = false;
  queue = [];
  hold = null;
  holdUsed = false;
  drawNext();
  drawHold();
  draw();
  showOverlay('TETRIS', 'Elige un modo', Object.entries(MODES).map(([key, m]) => ({
    label: m.name,
    hint: m.hint,
    action: () => init(key),
  })));
}

const restartButtons = () => [
  { label: 'Reiniciar', action: () => init(mode) },
  { label: 'Menú', action: showMenu },
];

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  sfx('gameover');
  showOverlay('GAME OVER', `Puntuación: ${score.toLocaleString()}`, restartButtons(), 'danger');
}

function togglePause() {
  if (gameOver || !current) return;
  paused = !paused;
  if (!paused) {
    hideOverlay();
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showOverlay('PAUSA', '', [{ label: 'Continuar', action: togglePause }, ...restartButtons()]);
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (freezeMs > 0) freezeMs = Math.max(0, freezeMs - dt); // Congelar: sin caída automática
  else dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  // lockPiece() puede terminar la partida: no programar otro frame
  if (gameOver) return;
  draw();
  updateStatus();
  animId = requestAnimationFrame(loop);
}

function init(newMode) {
  mode = newMode;
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  queue = [];
  bag = [];
  resetScoring();
  resetEffects();
  resetPowerups();
  hold = null;
  holdUsed = false;
  refillQueue();
  spawn();
  drawHold();
  updateHUD();
  hideOverlay();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  ensureAudio();
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (uiMode !== 'play' || paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      tryMove(-1);
      break;
    case 'ArrowRight':
      tryMove(1);
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      holdPiece();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

const themeToggle = document.getElementById('theme-toggle');
const themeLabel = document.getElementById('theme-label');

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('theme', theme);
  themeToggle.setAttribute('aria-checked', theme === 'light');
  themeLabel.textContent = theme === 'light' ? 'Claro' : 'Oscuro';
  draw(); // la cuadrícula del canvas depende del tema
}

themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeToggle.blur(); // evita que Space reactive el botón durante el juego
});

// Arranque: tablero vacío detrás del menú de modos.
board = createBoard();
resetScoring();
resetEffects();
resetPowerups();
score = lines = 0;
level = 1;
updateHUD();
applyTheme(document.documentElement.dataset.theme);
showMenu();
