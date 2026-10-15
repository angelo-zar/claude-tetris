'use strict';

// Constantes ajustables. Se carga primero: el resto de scripts las usa como globales.

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#81d4fa', // J - light blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (gris metálico)
  '#f06292', // + - pentominó (rosa)
  '#aed581', // U - pentominó (lima)
  '#7986cb', // Y - pentominó (índigo)
  '#fff59d', // single 1×1 (premio)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (hueco central)
  [[0,9,0],[9,9,9],[0,9,0]],                  // + - pentominó
  [[10,0,10],[10,10,10],[0,0,0]],             // U - pentominó
  [[0,0,0,0],[11,11,11,11],[0,11,0,0],[0,0,0,0]], // Y - pentominó
  [[12]],                                      // single 1×1
];

const STANDARD_TYPES = [1, 2, 3, 4, 5, 6, 7]; // se reparten en bolsas de 7
const SPECIAL_TYPES = [8, 9, 10, 11];        // tuerca y pentominós (solo Arcade)
const SPECIAL_CHANCE = 0.12;                 // probabilidad de que salga una especial
const SINGLE_TYPE = 12;                      // premio tras un Tetris (solo Arcade)

// Modos de juego: qué mecánicas extra activa cada uno.
const MODES = {
  classic: { name: 'Clásico', hint: 'Hold y combos', specials: false },
  arcade:  { name: 'Arcade',  hint: 'Piezas especiales', specials: true },
};

const LINE_SCORES = [0, 100, 300, 500, 800];

const QUEUE_SIZE = 5; // piezas generadas por adelantado (queue[0] es la "next")
const TSPIN_SCORES = [400, 800, 1200, 1600]; // T-spin sin líneas, single, double, triple
const B2B_MULTIPLIER = 1.5;                  // Tetris/T-spin consecutivos
const PERFECT_CLEAR_BONUS = 3000;            // × nivel, al dejar el tablero vacío
const MAX_COMBO = 10;                        // tope del multiplicador de combo
