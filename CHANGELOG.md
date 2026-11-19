# Changelog

## 0.9.0

- The band reads Token Optimizer again, and token-lens is no longer used. The grade is Token Optimizer's own: its quality hook's `quality-cache-<session>.json` (resource health and its grade). Savings, checkpoint time, cache lifetime and compactions come from `measure.py status-bar --session <id> --json`. **Full dashboard** runs `measure.py dashboard --user`. A grade from a cache older than 6 hours is still hidden.
- measure.py runs only from the installed Token Optimizer plugin's own folder (its `installed_plugins.json` entry, under `~/.claude/plugins/`). A copy anywhere else, a registry entry pointing outside that folder, or a path with `..` is never run.
- **Start fresh** uses Token Optimizer's checkpoint and lean resume again (`compact-capture`, then `resume-lean`). When Token Optimizer is not installed or its capture fails, it builds the hand-off from the conversation itself; a missing Python 3 is reported.

## 0.8.0

- New: on `/compact` (typed, automatic or from a plugin) the crab drives a bulldozer that squeezes the fill, with a "compacting" banner (an SVG on remote views, text in the terminal) until 2 s after it ends, at most 120 s. `/clear` shows a "fresh start" banner for 2 s. A failed banner write never stops the compaction or the clear.
- The band title reads "token-lens", and a quality file with `top_drag: null` now shows no drag (it used to guess one from the breakdown). A quality file caught mid-write keeps the last known figures instead of blanking the band.
- Fix: **Start fresh** works without Token Optimizer. It used to stop with "Token Optimizer was not found" once that plugin was uninstalled. It now builds the hand-off from the conversation itself (last three prompts, files edited, lines that read like decisions, secrets redacted, the same rules as token-lens checkpoints) and runs no outside script. No checkpoint file is written any more.
- The band now reads the token-lens mod instead of Token Optimizer: the grade, savings and checkpoint time come from `~/.claude/token-lens/quality-<session>.json`, and **Full dashboard** runs `/tokens dashboard`. The band no longer looks for `measure.py` or starts Python.
- Remote Control: on a phone or web view (any surface but terminal, desktop and VS Code) the bar shows only his idle strolling, with no fill and no percent. Progress is not read there, and no model call is made.
- Mark cards open on a press, not on hover (a hover card could stay stuck open). A second press, or six seconds, closes it.
- More accurate bar: the desktop app's task list (`update_plan`: steps, `advance`, `done`, and `wrap_up`) now sets done/total like `TodoWrite` does, so a plan on step 1 of 6 shows about 17%, not 95%.
- Without a plan or `progress` call, the guessed percentage climbs about four times slower (tool calls count 0.03 each, time over ten minutes), so a long turn no longer sits at 95%.

## 0.7.1

- Fix: a running command no longer makes him ask. The question pose now comes from a real permission dialog (`classic.PermissionRequest`) instead of the permission check, which also fires for commands the rules or mode allow. It clears on a tool result, a denial, the next tool call or the end of the turn. Limit: after you allow a command that needed approval, he keeps asking until that command finishes (the engine gives no event when you answer).
- New poses: `shell` (a dark console, green prompt, output scrolling, blinking cursor) while a Bash command runs, and `pwsh` (the same console in PowerShell blue) while a PowerShell command runs.

## 0.7.0

- New `ask` pose: when Claude waits on you (a question, a plan to approve, a permission prompt) the crab stops, waves a claw, a gold question bubble bobs over his head and the bar turns gold, until you answer. A permission check that is answered in under a second does not flash it.
- README credits all three merged mods and the two used alongside it, with links and licenses; the plugin description names them too.

## 0.6.1

- Fixed a leak: every session start added another once-a-second redraw timer that was never cancelled, so a long-running app (or one that switched sessions often) redrew faster and faster. One timer now.
- A session nobody has touched for two minutes stops strolling and redraws every 15 s instead of every second.
- Session switches no longer wait on Token Optimizer's reads (git, quality files, the status command) or on registering each command in turn; both run off the start event.
- Token Optimizer's pose machinery (Clawd's 14 moods, two atom writes per tool call) is removed, along with the Clawd art. The git branch is read once per directory instead of every minute, and an idle session is read every 10 minutes instead of every minute. The theme file is polled every 10 s, not 2 s.

## 0.6.0

- Token Optimizer's desktop bar is merged in (its source is `hooks/to/`): the sentence, five marks with hover cards, details row, savings and the Clean up / Start fresh / Keep warm / Full dashboard buttons now sit under the progress row in one band. Clawd is gone; the crab is the mascot. Marks are drawn as crab-style rounded bars. The progress row has more room (padding, thicker bar, wider percent gap).
- Switch the Token Optimizer rows off with `CRAB_OPTIMIZER_BAR=0` in settings `env`; `CRAB_OPTIMIZER_BAR_SIZE=slim` starts them slim. The original plugin's own bar must stay off (`TOKEN_OPTIMIZER_STATUS_BAR=0`) or two bands draw.

## 0.5.0
n## 0.5.1

- A 1.4 s beat now sits between the run and the victory: the car brakes with smoke and brake lights (`park`), the sprinter catches his breath (`pant`), every other win crouches while sparks gather (`brace`). The done window is 9 s so the victory still gets its time.

- Ice cube no longer depends on seeing cache-tax's band: with the band out of sight, an hour since the last turn counts as cold.

- No more panting after the car: he parks and climbs out. Panting stays for the sprint.
- Reaching 100% in steps (or while the turn still runs) now plays the win at once instead of a pant,
  and a small jump right behind a big one no longer cuts the car short.
- Victory poses at 100%: out of the car after a drive, a medal after a sprint, and a pose for the
  task itself (terminal with a check after coding, a firework after fixing, a shut book after reading,
  a ticked page after writing). Each character celebrates in its own way (frog hops, creeper swells,
  slime squishes, robot shakes, cat sways).
- When keepwarm's cache-tax line says the prompt cache is cold, he is frozen in a cube of ice, shivering,
  until the next turn.

## 0.4.0

- Bigger leaps in the bar (30%+) put the crab in a little red convertible instead of sprinting.
  12-30% still sprints; both end with heavy breathing.

## 0.3.0

- File tree merged in from filetree; restyled, two-line rows on desktop.
- The crab works inside the real tree rows while files are touched: dives, throws, finds a gem,
  jumps between files and peeks out of another.
- Costume changes: he pulls the next costume out of a pocket and puts it on where it belongs, then
  lands with a squash-and-stretch.
- Sprint when the bar jumps, heavy breathing when it stops.
- Subagent rows dress for the task and idle when finished.

## 0.2.0

- Subagents panel merged in from savvy-progress; rows wear the chosen character.
- `/mascot` and shortcut commands: claude, frog, creeper, slime, robot, cat.
- Idle roaming loop with walking variants, flying, sunbathing and more poses.

## 0.1.0

- Progress bar with a walking crab that moves by itself, plus task-driven costumes.
