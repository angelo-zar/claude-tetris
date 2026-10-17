# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris. No dependencies, no build step, no package.json, no tests.

- `index.html` — DOM: left panel (`#hold-canvas`, `#status`, `#objective-section`, `#energy-section`, controls), `#board` canvas (300×600, 10×20 grid of 30px blocks) with the `#overlay` (menus, pause, game over, skill picker) on top of it, right panel (`#score`, `#lines`, `#level`, `#combo`, `#next-canvas`, `#queue-canvas`). Loads the scripts below in order.
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
- `scoring.js` — `combo`, `b2b`, `lastMoveRotate`, `isTSpin`, `scoreClear` (points, level, popups, sounds, and feeds power-up charge and energy).
- `powerups.js` — power-up charging (every `POWERUP_EVERY` lines the piece in NEXT gets one), effects, wildcard explosions, `freezeMs`.
- `skills.js` — `energy`, skill picker (`uiMode` `'skill'`/`'swap'`), timers (`previewMs`, `slowMs`, `freeHoldMs`) and `snapshot` for undo.
- `challenges.js` — `challenge`, `elapsed`, objective panel, garbage rows, win checks, `rotationDir`, `cellVisible` (invisible pieces).
- `skins.js` — `SKINS` (Retro, Neon, Pastel, Pixel art): each has a 15-color palette, canvas `bg`/`grid` (`null` = CSS theme) and `drawCell(context, px, py, size, color)`. `applySkin(key)` copies the palette in-place into `COLORS` (Retro keeps the original), persists `localStorage('skin')` and falls back to Retro on invalid values; loaded before `render.js`.
- `render.js` — board/previews drawing (`drawBlock` delegates to `skin.drawCell`; `clearCanvas` paints the skin background on board/hold/next/queue), power-up marks, popups/flash/particles, HUD and per-frame `updateStatus`.
- `main.js` — skin selector `#skin-toggle` (cycles skins, redraws via `refreshSkin`), overlay/menus (`showOverlay`, `uiMode`), `init(mode, challengeId)`, `loop`, `endGame`/`winGame`, input, theme, boot.

Key flows:

- **Piece queue**: `queue` holds `QUEUE_SIZE` upcoming pieces; `queue[0]` is NEXT. Pieces are `{ type, shape, x, y, powerup? }`.
- **Locking** (`lockPiece`): snapshot (Arcade) → T-spin check → `merge` → power-up effect → `clearLines` → wildcard explosion → `scoreClear` → challenge check (may end the game) → `spawn`.
- **Loop**: timers (freeze, skills, challenge) advance with the frame `dt`, so they stop while paused; auto-drop uses `dropInterval × SLOW_FACTOR` while slowed.
- **Scoring**: `(LINE_SCORES[n] or TSPIN_SCORES[n]) × level × combo × (B2B ? 1.5 : 1)` + Perfect Clear bonus; hard drop 2 pts/row, soft drop 1 pt/row. Level = `floor(lines / 10) + 1`, `dropInterval = max(100, 1000 - (level - 1) * 90)`.
- **Game over**: `endGame(reason)` (spawn collision, garbage overflow, time out); `winGame()` for challenges. Both go through `finishGame`, which stops the loop and shows Reiniciar/Menú.

Input is a single `keydown` listener on `e.code`: `M` mute and `P` pause always work; skill picker keys are routed to `handleSkillKey`; game keys (arrows, `X`, `Space`, `C`/`Shift` hold, `E` skills) only run when `uiMode === 'play'`. Overlay buttons call `blur()` after click so `Space` doesn't re-trigger them.

## Tunable constants (`js/config.js`)

If `COLS`/`ROWS`/`BLOCK` change, update the `#board` canvas `width`/`height` in `index.html` to match (`COLS × BLOCK` and `ROWS × BLOCK`). Previews assume pieces fit in a 4×4 box.
