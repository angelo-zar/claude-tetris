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
  '#ffffff', // comodín (se dibuja en arcoíris)
  '#607d8b', // bloque fijo / basura
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

const PIECE_NAMES = [null, 'I', 'O', 'T', 'S', 'Z', 'J', 'L', 'Tuerca', '+', 'U', 'Y', '1×1'];
const STANDARD_TYPES = [1, 2, 3, 4, 5, 6, 7]; // se reparten en bolsas de 7
const SPECIAL_TYPES = [8, 9, 10, 11];        // tuerca y pentominós (solo Arcade)
const SPECIAL_CHANCE = 0.12;                 // probabilidad de que salga una especial
const SINGLE_TYPE = 12;                      // premio tras un Tetris (solo Arcade)
const WILD_TYPE = 13;                        // celda comodín creada por el power-up Tinte
const GARBAGE_TYPE = 14;                     // bloque fijo o fila de basura (desafíos)

// Power-ups (solo Arcade)
const POWERUP_EVERY = 8;   // líneas necesarias para cargar una pieza con power-up
const FREEZE_MS = 5000;    // duración de Congelar
const WILD_POINTS = 50;    // puntos × nivel por cada comodín que explota
const POWERUPS = {
  bomb:    { icon: '💣', name: 'BOMBA' },
  laser:   { icon: '⚡', name: 'RAYO' },
  tint:    { icon: '🎨', name: 'TINTE' },
  gravity: { icon: '⬇️', name: 'GRAVEDAD' },
  freeze:  { icon: '❄️', name: 'CONGELAR' },
};

// Habilidades cargables (solo Arcade)
const ENERGY_MAX = 100;
const ENERGY_PER_LINE = 10;   // energía por línea limpiada
const ENERGY_PER_COMBO = 5;   // extra por cada nivel de combo encadenado
const PREVIEW_MS = 30000;     // Ver 5 piezas
const SLOW_MS = 10000;        // Ralentizar
const SLOW_FACTOR = 3;        // el intervalo de caída se multiplica por esto
const FREE_HOLD_MS = 20000;   // Hold libre
const SKILLS = [
  { key: 'preview',  name: 'Ver 5 piezas', hint: 'Muestra la cola durante 30 s' },
  { key: 'swap',     name: 'Intercambiar', hint: 'Elige otra pieza actual' },
  { key: 'slow',     name: 'Ralentizar',   hint: 'Caída ×3 más lenta 10 s' },
  { key: 'undo',     name: 'Deshacer',     hint: 'Revierte la última colocación' },
  { key: 'freeHold', name: 'Hold libre',   hint: 'Hold sin límite durante 20 s' },
];

// Modos de juego: qué mecánicas extra activa cada uno.
const MODES = {
  classic: { name: 'Clásico', hint: 'Hold y combos', specials: false },
  arcade:  { name: 'Arcade',  hint: 'Piezas especiales, power-ups y habilidades', specials: true, powerups: true, skills: true },
  challenge: { name: 'Desafíos', hint: 'Cinco retos con objetivo' },
};

const LINE_SCORES = [0, 100, 300, 500, 800];

const QUEUE_SIZE = 5; // piezas generadas por adelantado (queue[0] es la "next")
const TSPIN_SCORES = [400, 800, 1200, 1600]; // T-spin sin líneas, single, double, triple
const B2B_MULTIPLIER = 1.5;                  // Tetris/T-spin consecutivos
const PERFECT_CLEAR_BONUS = 3000;            // × nivel, al dejar el tablero vacío
const MAX_COMBO = 10;                        // tope del multiplicador de combo

// Retos del modo Desafíos. Cada propiedad activa una regla en challenges.js.
const LOCK_FLASH_MS = 500; // reto Invisibles: cuánto se ve la pieza recién fijada
const CHALLENGES = [
  { id: 'sprint',    name: 'Sprint',           hint: '40 líneas en 2 minutos',                goalLines: 40, timeLimit: 120000 },
  { id: 'garbage',   name: 'Basura',           hint: 'Sobrevive 2 min; sube basura cada 10 s', survive: 120000, garbageEvery: 10000 },
  { id: 'fixed',     name: 'Bloques fijos',    hint: 'Elimina todos los bloques grises',       fixedRows: 8 },
  { id: 'invisible', name: 'Invisibles',       hint: '20 líneas sin ver las piezas fijadas',   goalLines: 20, invisible: true },
  { id: 'reverse',   name: 'Rotación inversa', hint: '40 líneas; desde nivel 3 rota al revés', goalLines: 40, reverseFromLevel: 3 },
];
