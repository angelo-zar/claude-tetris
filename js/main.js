'use strict';

// Bucle de juego, entrada de teclado, menú/overlay y tema.

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const overlayButtons = document.getElementById('overlay-buttons');

let uiMode = 'menu'; // 'menu' (overlay con botones) | 'play' | 'skill' | 'swap' (selector de habilidades)
let overlayBack = null; // acción de Escape en la vista actual del overlay (null = ninguna)
let overlayKeys = null; // teclas extra de la vista actual: fn(code) → true si la consume

// Muestra el overlay con un título, un subtítulo y botones [{ label, hint, action }].
function showOverlay(title, subtitle, buttons, titleClass = '') {
  uiMode = 'menu';
  overlayBack = null;
  overlayKeys = null;
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
  overlayBack = null;
  overlayKeys = null;
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
  showOverlay('TETRIS', 'Elige un modo', [
    ...Object.entries(MODES).map(([key, m]) => ({
      label: m.name,
      hint: m.hint,
      action: key === 'challenge' ? showChallenges : () => init(key),
    })),
    { label: `Nivel inicial: ${startLevel}`, hint: 'Clásico y Arcade', action: () => showLevelPicker(showMenu) },
  ]);
}

function showChallenges() {
  showOverlay('DESAFÍOS', 'Elige un reto', [
    ...CHALLENGES.map(c => ({ label: c.name, hint: c.hint, action: () => init('challenge', c.id) })),
    { label: 'Volver', action: showMenu },
  ]);
  overlayBack = showMenu;
}

// Selector del nivel inicial (se aplica en la próxima partida). back = vista a la que volver.
function showLevelPicker(back) {
  const change = d => {
    setStartLevel(startLevel + d);
    showLevelPicker(back);
  };
  showOverlay('NIVEL INICIAL', `Nivel ${startLevel} de ${START_LEVEL_MAX}\n← → para cambiar\nSe aplica en la próxima partida\n(no en Desafíos)`, [
    { label: '+ Subir', action: () => change(1), disabled: startLevel >= START_LEVEL_MAX },
    { label: '− Bajar', action: () => change(-1), disabled: startLevel <= 1 },
    { label: 'Volver', action: back },
  ]);
  overlayBack = back;
  overlayKeys = code => {
    if (code === 'ArrowRight' || code === 'ArrowUp') { if (startLevel < START_LEVEL_MAX) change(1); return true; }
    if (code === 'ArrowLeft' || code === 'ArrowDown') { if (startLevel > 1) change(-1); return true; }
    return false;
  };
}

// Lista de teclas para la vista "Ver controles" del menú de pausa.
function controlsText() {
  return [
    '← →  mover',
    '↑ / X  rotar',
    '↓  bajar',
    'Space  caída rápida',
    'C / Shift  reservar',
    ...(has('skills') ? ['E  habilidad'] : []),
    'P / Esc  pausa',
    'M  sonido',
  ].join('\n');
}

function showPauseMenu() {
  const levelHint = mode === 'challenge' ? 'no aplica en Desafíos' : 'al reiniciar';
  showOverlay('PAUSA', '', [
    { label: 'Reanudar', action: togglePause },
    { label: 'Reiniciar', action: () => init(mode, challenge?.id) },
    { label: 'Ver controles', action: showControls },
    { label: `Nivel inicial: ${startLevel}`, hint: levelHint, action: () => showLevelPicker(showPauseMenu) },
    { label: 'Menú', action: showMenu },
  ]);
  overlayBack = togglePause; // Escape en el menú de pausa reanuda
}

function showControls() {
  showOverlay('CONTROLES', controlsText(), [{ label: 'Volver', action: showPauseMenu }]);
  overlayBack = showPauseMenu;
}

// Teclas pulsadas ahora mismo. Al reanudar/empezar, las que siguen pulsadas se bloquean
// hasta soltarlas, para que una tecla mantenida en el menú no mueva la pieza al volver.
const keysDown = new Set();
let blockedKeys = new Set();

function blockHeldKeys() {
  blockedKeys = new Set(keysDown);
  dropAccum = 0; // la pieza no cae de golpe al volver
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
  // el selector de habilidades ya pausa el juego y se cierra con E/Escape
  if (gameOver || !current || uiMode === 'skill' || uiMode === 'swap') return;
  paused = !paused;
  if (!paused) {
    hideOverlay();
    blockHeldKeys();
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showPauseMenu();
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
  baseLevel = newMode === 'challenge' ? 1 : startLevel; // los retos están calibrados desde nivel 1
  updateLevel(); // level y dropInterval desde el nivel inicial
  paused = false;
  gameOver = false;
  blockHeldKeys(); // también pone dropAccum = 0
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
  keysDown.add(e.code);
  if (e.code === 'KeyM') { if (!e.repeat) toggleMute(); return; }
  if (e.code === 'KeyP') { if (!e.repeat) togglePause(); return; }
  if ((uiMode === 'skill' || uiMode === 'swap') && handleSkillKey(e.code)) return;
  if (e.code === 'Escape') {
    if (e.repeat) return;
    if (uiMode === 'menu' && overlayBack) overlayBack(); // sub-vista → atrás; menú de pausa → reanudar
    else if (uiMode === 'play') togglePause();
    return;
  }
  if (uiMode === 'menu') {
    if (overlayKeys?.(e.code)) e.preventDefault();
    return;
  }
  if (uiMode !== 'play' || paused || gameOver) return;
  if (blockedKeys.has(e.code)) return; // mantenida desde antes de reanudar: esperar a soltarla
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

document.addEventListener('keyup', e => {
  keysDown.delete(e.code);
  blockedKeys.delete(e.code);
});

// Al perder el foco no llegan los keyup: olvidar las teclas pulsadas.
window.addEventListener('blur', () => {
  keysDown.clear();
  blockedKeys.clear();
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
resetSkills();
score = lines = 0;
level = 1;
updateHUD();
applyTheme(document.documentElement.dataset.theme);
showMenu();
