# Changelog

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
