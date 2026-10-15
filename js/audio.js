'use strict';

// Efectos de sonido sintetizados con WebAudio (sin archivos de audio).

let audioCtx = null;
let muted = false;
try { muted = localStorage.getItem('muted') === '1'; } catch (e) { /* almacenamiento no disponible */ }

// Los navegadores solo permiten crear/reanudar el AudioContext tras un gesto del usuario.
function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  } else if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function tone(freq, dur, { type = 'square', vol = 0.04, delay = 0 } = {}) {
  const t = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function arpeggio(freqs, step, opts) {
  freqs.forEach((f, i) => tone(f, step * 1.5, { ...opts, delay: i * step }));
}

const SFX = {
  move:     () => tone(220, 0.03, { vol: 0.015 }),
  rotate:   () => tone(440, 0.04, { vol: 0.02 }),
  hold:     () => arpeggio([392, 523], 0.05, { type: 'triangle' }),
  lock:     () => tone(110, 0.08, { type: 'triangle', vol: 0.06 }),
  clear:    n  => arpeggio([523, 659, 784].slice(0, n), 0.06),
  tetris:   () => arpeggio([523, 659, 784, 1047], 0.07),
  tspin:    () => arpeggio([392, 587, 784], 0.07, { type: 'sawtooth', vol: 0.03 }),
  combo:    n  => tone(440 * Math.pow(2, Math.min(n, 12) / 12), 0.15, { type: 'triangle', vol: 0.05, delay: 0.2 }),
  perfect:  () => arpeggio([523, 659, 784, 1047, 1319, 1568], 0.08, { type: 'triangle', vol: 0.06 }),
  powerup:  () => arpeggio([880, 660, 990, 1320], 0.05, { type: 'sawtooth', vol: 0.03 }),
  skill:    () => arpeggio([330, 440, 554, 659], 0.05, { type: 'triangle' }),
  gameover: () => arpeggio([392, 330, 262, 196], 0.15, { type: 'triangle', vol: 0.06 }),
  win:      () => arpeggio([523, 659, 784, 1047, 784, 1047], 0.1, { type: 'triangle', vol: 0.06 }),
};

function sfx(name, n) {
  if (muted || !audioCtx || !SFX[name]) return;
  SFX[name](n);
}

function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('muted', muted ? '1' : '0'); } catch (e) { /* ignorar */ }
  updateHUD();
}
