# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris. Three files, no dependencies, no build step, no package.json, no tests.

- `index.html` — DOM structure: `#board` canvas (300×600, 10×20 grid of 30px blocks), `#next-canvas` preview (120×120), HUD spans (`#score`, `#lines`, `#level`), and the pause/game-over `#overlay`.
- `style.css` — dark/retro arcade styling.
- `game.js` — all game logic (~300 lines), plain top-level script (no modules, no classes).

## Running the game

No build/install needed. Open `index.html` directly, or serve it statically:

```bash
python3 -m http.server 8000
# or
npx serve .
```

There is no lint, test, or build command in this repo — changes are verified by loading `index.html` in a browser and playing.

## Architecture (`game.js`)

Everything lives in module-level `let` state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropAccum`, `dropInterval`, `animId`) mutated directly by functions — there is no state container or class.

- **Board**: `ROWS × COLS` matrix where each cell is `0` (empty) or a color index `1–8` identifying the piece type.
- **Pieces**: `PIECES` holds each shape as a square matrix using its own color index as the fill value (see the `PIECES`/`COLORS` arrays at the top of the file). `rotateCW` rotates a shape via transpose + row-reverse.
- **Collision** (`collide`): checks a shape at a given offset against board bounds and existing locked cells.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` until one doesn't collide, else the rotation is discarded.
- **Game loop** (`loop`, driven by `requestAnimationFrame`): accumulates elapsed time in `dropAccum`; once it exceeds `dropInterval`, the piece drops one row (or locks if it can't).
- **Locking** (`lockPiece` → `merge` + `clearLines` + `spawn`): merges the current piece into `board`, clears completed rows (shifting the stack down, inserting an empty row at the top), then spawns the next piece.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` indexed by lines-cleared-at-once, multiplied by `level`. Hard drop adds 2 pts/row dropped; soft drop adds 1 pt/row.
- **Leveling/speed**: level = `floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
- **Ghost piece** (`ghostY`): projects the current piece straight down to its landing row; drawn at `globalAlpha = 0.2`.
- **Game over**: triggered in `spawn()` when the newly spawned piece immediately collides with the board.

Input is a single `keydown` listener switching on `e.code` (arrows + `KeyX` to rotate, `Space` for hard drop, `KeyP` for pause); it's a no-op while paused or game-over except for the pause key itself.

## Tunable constants (top of `game.js`)

`COLS`, `ROWS`, `BLOCK` (px per cell), `COLORS`, `LINE_SCORES`, initial `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `#board` canvas `width`/`height` in `index.html` to match (`COLS × BLOCK` and `ROWS × BLOCK`).
