'use strict';

// Bucle de juego, entrada de teclado, menú/overlay y tema.

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const overlayButtons = document.getElementById('overlay-buttons');

let uiMode = 'menu'; // 'menu' (overlay con botones) | 'play' | 'skill' | 'swap' (selector de habilidades)

// Muestra el overlay con un título, un subtítulo y botones [{ label, hint, action }].
function showOverlay(title, subtitle, buttons, titleClass = '') {
  uiMode = 'menu';
  overlayTitle.textContent = title;
  overlayTitle.className = titleClass;
  overlayScore.textContent = subtitle;
  overlayButtons.replaceChildren(...buttons.map(({ label, hint, action, disabled }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.disabled = Boolean(disabled);
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
  resetPowerups();
  resetSkills();
  challenge = null;
  setupChallenge();
  updateStatus();
  queue = [];
  hold = null;
  holdUsed = false;
  drawNext();
  drawHold();
  draw();
  showOverlay('TETRIS', 'Elige un modo', Object.entries(MODES).map(([key, m]) => ({
    label: m.name,
    hint: m.hint,
    action: key === 'challenge' ? showChallenges : () => init(key),
  })));
}

function showChallenges() {
  showOverlay('DESAFÍOS', 'Elige un reto', [
    ...CHALLENGES.map(c => ({ label: c.name, hint: c.hint, action: () => init('challenge', c.id) })),
    { label: 'Volver', action: showMenu },
  ]);
}

const restartButtons = () => [
  { label: 'Reiniciar', action: () => init(mode, challenge?.id) },
  { label: 'Menú', action: showMenu },
];

function finishGame(title, subtitle, titleClass, sound) {
  gameOver = true;
  cancelAnimationFrame(animId);
  draw();
  sfx(sound);
  showOverlay(title, subtitle, restartButtons(), titleClass);
}

function endGame(reason) {
  const summary = `Puntuación: ${score.toLocaleString()}`;
  finishGame('GAME OVER', reason ? `${reason}\n${summary}` : summary, 'danger', 'gameover');
}

// Reto superado (modo Desafíos).
function winGame() {
  finishGame('¡SUPERADO!', `${challenge.name} · ${formatTime(elapsed)}\nPuntuación: ${score.toLocaleString()}`, 'success', 'win');
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
  tickSkills(dt);
  tickChallenge(dt);
  if (gameOver) return; // el reto puede terminar la partida (tiempo, basura)
  if (dropAccum >= dropInterval * (slowMs > 0 ? SLOW_FACTOR : 1)) {
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

function init(newMode, challengeId) {
  mode = newMode;
  challenge = CHALLENGES.find(c => c.id === challengeId) || null;
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
  resetSkills();
  hold = null;
  holdUsed = false;
  setupChallenge();
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
  if ((uiMode === 'skill' || uiMode === 'swap') && handleSkillKey(e.code)) return;
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
      tryRotate(rotationDir());
      break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      holdPiece();
      break;
    case 'KeyE':
      openSkills();
      return;
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

// Selector de skin: cicla entre SKINS y redibuja todos los canvases sin recargar.
const skinToggle = document.getElementById('skin-toggle');
const skinLabel = document.getElementById('skin-label');

function refreshSkin() {
  skinLabel.textContent = skin.name;
  draw();
  if (queue) { drawHold(); drawNext(); }
  else { drawPreview(holdCtx, null, 30); drawPreview(nextCtx, null, 30); } // antes de la primera partida
}

skinToggle.addEventListener('click', () => {
  nextSkin();
  refreshSkin();
  skinToggle.blur(); // evita que Space reactive el botón durante el juego
});

// Arranque: tablero vacío detrás del menú de modos.
board = createBoard();
resetScoring();
resetEffects();
resetPowerups();
resetSkills();
score = lines = 0;
level = 1;
updateHUD();
applyTheme(document.documentElement.dataset.theme);
refreshSkin();
showMenu();
