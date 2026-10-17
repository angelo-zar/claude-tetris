# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris. No dependencies, no build step, no package.json, no tests.

- `index.html` — DOM: left panel (`#hold-canvas`, `#status`, `#objective-section`, `#energy-section`, controls), `#board` canvas (300×600, 10×20 grid of 30px blocks) with the `#overlay` (menus, pause, game over, skill picker; `#overlay-extra` holds the records table / name form) on top of it, right panel (`#score`, `#lines`, `#level`, `#combo`, `#next-canvas`, `#queue-canvas`). Loads the scripts below in order.
- `style.css` — dark/light retro arcade styling (theme tokens on `:root` / `[data-theme="light"]`).
- `js/*.js` — plain classic scripts (no modules, no classes). Top-level `let`/`const`/functions are shared globals across files, so load order in `index.html` matters only for code that runs at load time (DOM lookups, the boot code at the end of `main.js`).

## Running the game

No build/install needed. Open `index.html` directly, or serve it statically:

```bash
python3 -m http.server 8000
# or
npx serve .
```

There is no lint, test, or build command in this repo — changes are verified by loading `index.html` in a browser and playing. Debug helpers are plain globals usable from the browser console, e.g. `forcePowerup('bomb')`, `energy = 100`, `lines = 39`, `elapsed = 115000`.

## Modes

`MODES` in `config.js` declares which extra mechanics each mode enables; code checks them with `has('specials' | 'powerups' | 'skills')`.

- **Clásico**: 7 standard pieces (7-bag), hold, combos/B2B/T-spin/Perfect Clear.
- **Arcade**: + special pieces (tuerca and pentominoes, 1×1 reward after a Tetris), power-ups, energy bar + skills.
- **Desafíos**: Clásico rules + one entry of `CHALLENGES` (stored in `challenge`), whose properties (`goalLines`, `timeLimit`, `survive`, `garbageEvery`, `fixedRows`, `invisible`, `reverseFromLevel`) switch rules on in `challenges.js`.

## Architecture (`js/`)

- `config.js` — all tunables: board size, `COLORS`/`PIECES` (index = cell value: 1–7 standard, 8 tuerca, 9–11 pentominoes, 12 single, 13 wildcard, 14 fixed/garbage), scoring tables, `MODES`, `POWERUPS`, `SKILLS`, `CHALLENGES`.
- `audio.js` — WebAudio-synthesized `sfx(name, n)`; `AudioContext` created on first keydown; `M` mutes (persisted).
- `core.js` — core state (`mode`, `board`, `current`, `queue`, `hold`, `score`, …), 7-bag `randomPiece`, `collide`, `rotateCW`, `tryRotate(dir)` with kicks `[0, -1, 1, -2, 2]`, `clearLines` (returns cleared row indexes), `lockPiece`, `spawn`, `holdPiece`.
- `scoring.js` — `combo`, `maxCombo` (best combo of the current game), `b2b`, `lastMoveRotate`, `isTSpin`, `scoreClear` (points, level, popups, sounds, and feeds power-up charge and energy).
- `powerups.js` — power-up charging (every `POWERUP_EVERY` lines the piece in NEXT gets one), effects, wildcard explosions, `freezeMs`.
- `skills.js` — `energy`, skill picker (`uiMode` `'skill'`/`'swap'`), timers (`previewMs`, `slowMs`, `freeHoldMs`) and `snapshot` for undo.
- `challenges.js` — `challenge`, `elapsed`, objective panel, garbage rows, win checks, `rotationDir`, `cellVisible` (invisible pieces).
- `records.js` — local high scores in `localStorage` (all reads/writes in try/catch, read data validated): `'records'` = top `MAX_RECORDS` (5) `{ name, score, lines, maxCombo, mode, date }` sorted by score; `'bests'` = `{ maxCombo, lines }` best combo / most lines in a single game, updated at the end of every finished game (game over or challenge won, whether or not it enters the top; games abandoned from the pause menu do not count) and cleared with the table; `'recordName'` = last name used. `menuRecordsNodes()` (table + "Borrar records" button, confirmed by a second click within 3 s) and `gameOverRecordsNodes()` (updates bests; if `recordRank(score) !== -1` saves the entry right away with the last name used, so Reiniciar/Menú never loses it, and shows a name field, max `NAME_MAX` chars, prefilled; Enter/Guardar renames that row, matched by `date` (local `YYYY-MM-DD HH:MM:SS`) + score; the row stays highlighted) build the DOM with `createElement`/`textContent`.
- `render.js` — board/previews drawing, power-up marks, popups/flash/particles, HUD and per-frame `updateStatus`.
- `main.js` — overlay/menus (`showOverlay(title, subtitle, buttons, titleClass, extra)`, where `extra` are nodes shown in `#overlay-extra`, cleared by default; `uiMode`), `init(mode, challengeId)`, `loop`, `endGame`/`winGame`, input, theme, boot.

Key flows:

- **Piece queue**: `queue` holds `QUEUE_SIZE` upcoming pieces; `queue[0]` is NEXT. Pieces are `{ type, shape, x, y, powerup? }`.
- **Locking** (`lockPiece`): snapshot (Arcade) → T-spin check → `merge` → power-up effect → `clearLines` → wildcard explosion → `scoreClear` → challenge check (may end the game) → `spawn`.
- **Loop**: timers (freeze, skills, challenge) advance with the frame `dt`, so they stop while paused; auto-drop uses `dropInterval × SLOW_FACTOR` while slowed.
- **Scoring**: `(LINE_SCORES[n] or TSPIN_SCORES[n]) × level × combo × (B2B ? 1.5 : 1)` + Perfect Clear bonus; hard drop 2 pts/row, soft drop 1 pt/row. Level = `floor(lines / 10) + 1`, `dropInterval = max(100, 1000 - (level - 1) * 90)`.
- **Game over**: `endGame(reason)` (spawn collision, garbage overflow, time out); `winGame()` for challenges. Both go through `finishGame`, which stops the loop and shows Reiniciar/Menú plus the records table (`gameOverRecordsNodes`).
- **Records**: a score enters the top if it is > 0 and beats the 5th (ties go below existing entries). The new row is highlighted; `maxCombo` is part of the undo snapshot in `skills.js`. `showMenu` shows the table and the global bests.

Input is a single `keydown` listener on `e.code`; events whose target is inside an `input`/`textarea`/`select`/`[contenteditable]` (records name field) are ignored entirely, so typing never reaches the game. Otherwise `M` mute and `P` pause always work; skill picker keys are routed to `handleSkillKey`; game keys (arrows, `X`, `Space`, `C`/`Shift` hold, `E` skills) only run when `uiMode === 'play'`. Overlay buttons call `blur()` after click so `Space` doesn't re-trigger them.

## Tunable constants (`js/config.js`)

If `COLS`/`ROWS`/`BLOCK` change, update the `#board` canvas `width`/`height` in `index.html` to match (`COLS × BLOCK` and `ROWS × BLOCK`). Previews assume pieces fit in a 4×4 box.
