'use strict';

// Tabla de records local (localStorage): top 5 puntuaciones con nombre y récords globales.
//   'records'    → [{ name, score, lines, maxCombo, mode, date }] ordenado por score (máx. MAX_RECORDS)
//   'bests'      → { maxCombo, lines }: mejor combo y más líneas en una partida, de TODAS las partidas
//                  terminadas (entren o no en el top); se borra junto con la tabla
//   'recordName' → último nombre usado, para precargar el campo

const MAX_RECORDS = 5;
const NAME_MAX = 12;

function readStorage(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* almacenamiento no disponible: los records solo duran esta sesión */ }
}

const toCount = v => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

// Lee y valida la tabla: descarta entradas corruptas y normaliza campos.
function loadRecords() {
  const raw = readStorage('records');
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(r => r && typeof r === 'object' && Number.isFinite(r.score) && r.score > 0)
    .map(r => ({
      name: String(r.name ?? '').slice(0, NAME_MAX) || '???',
      score: Math.floor(r.score),
      lines: toCount(r.lines),
      maxCombo: toCount(r.maxCombo),
      mode: String(r.mode ?? '').slice(0, 20),
      date: typeof r.date === 'string' ? r.date : '',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECORDS);
}

function loadBests() {
  const raw = readStorage('bests');
  return { maxCombo: toCount(raw?.maxCombo), lines: toCount(raw?.lines) };
}

// Registra el mejor combo y las líneas de la partida terminada.
function updateBests(gameLines, gameCombo) {
  const b = loadBests();
  writeStorage('bests', { maxCombo: Math.max(b.maxCombo, gameCombo), lines: Math.max(b.lines, gameLines) });
}

// Posición (0-based) que ocuparía la puntuación en el top, o -1 si no entra.
// En empate la nueva va detrás de las existentes.
function recordRank(value, list = loadRecords()) {
  if (!(value > 0)) return -1;
  const i = list.findIndex(r => value > r.score);
  const rank = i === -1 ? list.length : i;
  return rank < MAX_RECORDS ? rank : -1;
}

// Inserta el record y devuelve su posición (o -1 si ya no entra).
function addRecord(entry) {
  const list = loadRecords();
  const rank = recordRank(entry.score, list);
  if (rank === -1) return -1;
  list.splice(rank, 0, entry);
  writeStorage('records', list.slice(0, MAX_RECORDS));
  return rank;
}

function clearRecords() {
  try {
    localStorage.removeItem('records');
    localStorage.removeItem('bests');
  } catch { /* nada que borrar */ }
}

function lastRecordName() {
  const n = readStorage('recordName');
  return typeof n === 'string' ? n.slice(0, NAME_MAX) : '';
}

// Etiqueta del modo de la partida actual (el nombre del reto en Desafíos).
function currentModeLabel() {
  return mode === 'challenge' && challenge ? challenge.name : MODES[mode]?.name || '';
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Tabla de records + récords globales. highlight = índice de la fila a resaltar.
function buildRecordsTable(list, highlight = -1, b = loadBests()) {
  const wrap = el('div', 'records');
  wrap.appendChild(el('span', 'records-label', 'RECORDS'));
  if (!list.length) {
    wrap.appendChild(el('p', 'records-empty', 'Sin records todavía'));
  } else {
    const table = el('table', 'records-table');
    const head = el('tr');
    for (const h of ['#', 'Nombre', 'Puntos', 'Lín', 'Cmb', 'Modo']) head.appendChild(el('th', '', h));
    table.appendChild(head);
    list.forEach((r, i) => {
      const tr = el('tr', i === highlight ? 'highlight' : '');
      if (r.date) tr.title = r.date;
      for (const v of [i + 1, r.name, r.score.toLocaleString(), r.lines, r.maxCombo, r.mode]) {
        tr.appendChild(el('td', '', String(v)));
      }
      table.appendChild(tr);
    });
    wrap.appendChild(table);
  }
  wrap.appendChild(el('p', 'records-bests', `Mejor combo: x${b.maxCombo} · Líneas máx.: ${b.lines}`));
  return wrap;
}

// Botón "Borrar records" con confirmación por segundo click (3 s para confirmar).
function buildClearButton(list, b, onCleared) {
  const btn = el('button', 'records-clear', 'Borrar records');
  btn.type = 'button';
  btn.disabled = !list.length && !b.maxCombo && !b.lines;
  let timer = 0;
  btn.addEventListener('click', () => {
    btn.blur();
    if (!timer) {
      btn.textContent = '¿Seguro? Pulsa otra vez';
      btn.classList.add('confirm');
      timer = setTimeout(() => {
        timer = 0;
        btn.textContent = 'Borrar records';
        btn.classList.remove('confirm');
      }, 3000);
      return;
    }
    clearTimeout(timer);
    timer = 0;
    clearRecords();
    onCleared();
  });
  return btn;
}

// Contenido del menú inicial: tabla + botón de borrar (se reconstruye al borrar).
function menuRecordsNodes() {
  const box = el('div', 'records-box');
  const render = () => {
    const list = loadRecords(), b = loadBests();
    box.replaceChildren(buildRecordsTable(list, -1, b), buildClearButton(list, b, render));
  };
  render();
  return [box];
}

// Fecha y hora locales 'YYYY-MM-DD HH:MM:SS' (identifica la fila al renombrarla).
function localStamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// Contenido del fin de partida: registra récords globales y, si la puntuación entra en el top,
// la guarda ya con el último nombre usado (para no perderla si se pulsa Reiniciar/Menú) y
// ofrece un campo para cambiar el nombre. La fila nueva se muestra resaltada.
function gameOverRecordsNodes() {
  updateBests(lines, maxCombo);
  const entry = {
    name: lastRecordName() || '???', score, lines, maxCombo,
    mode: currentModeLabel(),
    date: localStamp(),
  };
  const rank = addRecord(entry);
  if (rank === -1) return [buildRecordsTable(loadRecords())];

  const box = el('div', 'records-box');
  let table = buildRecordsTable(loadRecords(), rank);

  const form = el('form', 'records-form');
  form.appendChild(el('span', 'records-new', `¡Nuevo récord! Puesto #${rank + 1}`));
  const input = el('input', 'records-input');
  input.type = 'text';
  input.maxLength = NAME_MAX;
  input.placeholder = 'Tu nombre';
  input.value = lastRecordName();
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Nombre del jugador');
  const save = el('button', 'records-save', 'Guardar');
  save.type = 'submit';
  form.append(input, save);

  // Un Space mantenido desde la última caída no debe sobrescribir el nombre precargado
  input.addEventListener('keydown', e => { if (e.repeat) e.preventDefault(); });
  // Vista previa del nombre en la fila resaltada mientras se escribe
  input.addEventListener('input', () => {
    const cell = table.querySelector('tr.highlight td:nth-child(2)');
    if (cell) cell.textContent = input.value.trim() || '???';
  });

  // Enter en el campo envía el formulario: renombra la fila ya guardada
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = input.value.trim().slice(0, NAME_MAX) || '???';
    writeStorage('recordName', name);
    const list = loadRecords();
    const pos = list.findIndex(r => r.date === entry.date && r.score === entry.score && r.name === entry.name);
    if (pos !== -1) {
      list[pos].name = entry.name = name;
      writeStorage('records', list);
    }
    const fresh = buildRecordsTable(list, pos);
    table.replaceWith(fresh);
    table = fresh;
    input.blur();
    form.remove();
  });

  box.append(form, table);
  setTimeout(() => { if (form.isConnected) { input.focus(); input.select(); } }, 0);
  return [box];
}
