'use strict';

// Skins visuales: cada una define paleta (15 índices de COLORS), fondo/cuadrícula del canvas
// (null = usar el tema CSS) y drawCell(context, px, py, size, color), que pinta una celda en píxeles.
// Se carga antes de render.js; applySkin copia la paleta in-place en COLORS.

const RETRO_COLORS = COLORS.slice(); // paleta original

// Rectángulo con esquinas redondeadas (sin depender de roundRect).
function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawRetroCell(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)'; // highlight
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

function drawNeonCell(context, px, py, size, color) {
  const alpha = context.globalAlpha;
  context.globalAlpha = alpha * 0.25; // relleno tenue
  context.fillStyle = color;
  context.fillRect(px + 2, py + 2, size - 4, size - 4);
  context.globalAlpha = alpha;
  context.shadowColor = color;
  context.shadowBlur = size / 3;
  context.strokeStyle = color;
  context.lineWidth = size >= 20 ? 2 : 1.5;
  context.strokeRect(px + 3, py + 3, size - 6, size - 6);
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
  // núcleo brillante del borde
  context.strokeStyle = 'rgba(255,255,255,0.55)';
  context.lineWidth = 0.5;
  context.strokeRect(px + 3, py + 3, size - 6, size - 6);
}

function drawPastelCell(context, px, py, size, color) {
  const r = size / 4;
  roundedRectPath(context, px + 1.5, py + 1.5, size - 3, size - 3, r);
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = 'rgba(0,0,0,0.12)';
  context.lineWidth = 1;
  context.stroke();
  roundedRectPath(context, px + size * 0.2, py + size * 0.15, size * 0.6, size * 0.22, size * 0.11);
  context.fillStyle = 'rgba(255,255,255,0.45)'; // brillo suave
  context.fill();
}

function drawPixelCell(context, px, py, size, color) {
  const p = size / 6; // rejilla de 6×6 "píxeles" (5 px en el tablero, 2.5 px en la cola)
  const at = (c, r, w, h) => context.fillRect(Math.round(px + c * p), Math.round(py + r * p),
    Math.round(w * p), Math.round(h * p));
  context.fillStyle = color;
  context.fillRect(px, py, size, size);
  context.fillStyle = 'rgba(255,255,255,0.4)'; // luz arriba/izquierda
  at(0, 0, 6, 1);
  at(0, 1, 1, 5);
  context.fillStyle = 'rgba(0,0,0,0.35)'; // sombra abajo/derecha
  at(1, 5, 5, 1);
  at(5, 1, 1, 4);
  context.fillStyle = 'rgba(255,255,255,0.7)'; // destello
  at(1, 1, 1, 1);
  context.fillStyle = 'rgba(0,0,0,0.15)'; // textura interior
  at(3, 2, 1, 1);
  at(2, 3, 1, 1);
  at(4, 3, 1, 1);
}

const SKINS = [
  { key: 'retro', name: 'Retro', colors: RETRO_COLORS, bg: null, grid: null, drawCell: drawRetroCell },
  {
    key: 'neon', name: 'Neon', bg: '#000000', grid: '#10101c', drawCell: drawNeonCell,
    colors: [null, '#00f0ff', '#fff200', '#d400ff', '#39ff14', '#ff1f4b', '#1f8fff', '#ff8c00',
      '#c8c8ff', '#ff00aa', '#b4ff00', '#7a5cff', '#ffff8c', '#ffffff', '#5c6f8a'],
  },
  {
    key: 'pastel', name: 'Pastel', bg: null, grid: null, drawCell: drawPastelCell,
    colors: [null, '#a8e6ef', '#fdf1a7', '#d9c2f0', '#bfe8c4', '#f7b6b6', '#b9dcf7', '#fbd3a8',
      '#d6dde2', '#f8c3d8', '#d7ecb8', '#bfc6ec', '#fff7c7', '#ffffff', '#a9b6bf'],
  },
  {
    key: 'pixel', name: 'Pixel art', bg: null, grid: null, drawCell: drawPixelCell,
    colors: [null, '#3cbcfc', '#f8b800', '#9c4ad8', '#58d854', '#e45c10', '#0058f8', '#fc7460',
      '#a4a4a4', '#f878f8', '#b8f818', '#6844fc', '#fce0a8', '#ffffff', '#545c64'],
  },
];

let skin = SKINS[0];

function loadSkinPref() {
  try { return localStorage.getItem('skin'); } catch { return null; }
}

// Activa la skin (fallback a Retro si la clave no existe) y copia su paleta en COLORS.
function applySkin(key) {
  skin = SKINS.find(s => s.key === key) || SKINS[0];
  skin.colors.forEach((c, i) => { COLORS[i] = c; });
  try { localStorage.setItem('skin', skin.key); } catch { /* sin almacenamiento */ }
  return skin;
}

function nextSkin() {
  return applySkin(SKINS[(SKINS.indexOf(skin) + 1) % SKINS.length].key);
}

applySkin(loadSkinPref());
