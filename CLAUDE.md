# crab-progress

A Claude Code mod: progress bar with a pixel mascot, subagents panel, file tree, `/mascot` characters.
Plugin name is `crab-progress` because `claude-*` names are reserved.

@DIRECTORY_MAP.md

## Commands
- Validate: `claude plugin validate .`
- Test: `claude plugin test .` (file: `hooks/progress.test.tsx`)

## How it works
- The bar moves by itself: toward 95% with tool calls and time, 100% on turn end. The `progress` tool
  or main-session `TodoWrite` set exact done/total. A rise of 12%+ plays `run`, 30%+ plays `drive` (car), then `pant`.
- Outfit comes from `classify.ts` (keyword scores over prompt and tools, no model call). Idle roams a
  looping script (`IDLE_SCRIPT`). Outfit changes play a 1.4 s pocket routine (`ITEM_COLOR`, `ITEM_DEST`).
- Art is rects in `crab.ts` on a 30-wide grid; CSS lives in `crabCss(at)` and starts mid-cycle so the
  once-a-second redraw does not restart animations. `CHARS` swaps body/eyes/legs/arms per character.
- `agents.ts` draws the subagents panel; the hooks that feed it are in `register.tsx`.
- `dig.ts` is the SVG digging scene, used in the Agents panel. In the file tree (`ft-*.ts*`, upstream filetree) the crab is part of the rows: `ft-rows.tsx` draws rows two cells high on desktop (`tall`) and, when `dig` is set, a 4-line burrow strip under three real rows, with the crab as half-block pixels on a 112-tick loop (`script`). A client module only gets the terminal element table (no Svg), so everything there is text cells.

## Gotchas
- One hooks module per plugin. `register.tsx` calls the tree's `register`; the tree's hooks carry
  matchers (`isInteractive`, `wait`, `tool`) so they do not duplicate ours.
- `atom({ plugin: '...' })` needs string literals. A function that takes `$` must be a top-level
  function declaration in the module.
- Do not add a `prefers-reduced-motion` rule: some systems report it and it disables every animation.
- Render with the real clock (`$.clock.now()`), not the `now` atom, or redraws between ticks jitter.
- Write files without a BOM.
