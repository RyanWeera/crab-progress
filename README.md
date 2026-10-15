# crab-progress

A [Claude Code](https://claude.com/claude-code) mod that gives the session a small pixel mascot.
He rides a progress bar above the prompt, wears a costume that matches what Claude is doing,
walks about when nothing is happening, and digs through files in the file tree.

> Unofficial fan project. Not affiliated with or endorsed by Anthropic, Mojang or Microsoft.

## What it does

**Progress bar above the prompt**
- Moves by itself during a turn (creeps toward 95% with tool calls and time, 100% when the turn ends).
  A `progress` tool or `TodoWrite` can set exact done/total.
- The mascot walks along the fill, sprints when the bar jumps 12% or more, then pants when it stops.
- Costume follows the task, picked by a tiny on-device keyword classifier (no model call, no network):
  wizard hat for fixing, sunglasses + terminal for coding, a book for reading, a chef's toque for long
  jobs, a nightcap when idle for a while, a crown after a long task.
- Between costumes he digs the next one out of a belly pocket and puts it on.
- When nothing is happening he roams the bar on a loop: strolls, flies with a propeller cap, reads,
  waves, dances, sunbathes under an umbrella.

**Subagents panel** (`/agents-info`)
- Cost, tokens and time, plus one row per subagent with model, effort, context, cost, elapsed time and
  its own progress bar. Each row's mascot dresses for what that agent is doing.

**File tree** (`/filetree`)
- An IDE-style tree with git status that shimmers where Claude reads and writes. Redesigned for this mod:
  roomier two-line rows on the desktop, the mascot in the header, clay colours.
- While files are touched the crab works *inside the real rows*: a burrow strip opens under three of them,
  he dives into the file that was touched, throws things out until he finds a gem, pops up, jumps into
  another file and pokes his head out of a third. The row he is in lights up. It is drawn with half-block
  characters in the tree's own grid, so it lines up with the rows and scrolls with them.

**Characters** (`/mascot`)
- `/mascot claude | frog | creeper | slime | robot | cat`, or the shortcuts `/frog`, `/creeper`, ...
  The choice is remembered. Costumes and animations apply to every character.

## Install

In Claude Code:

```
/plugin marketplace add RyanWeera/crab-progress
/plugin install crab-progress@crab-progress
```

Restart the session. If you also run the standalone `filetree` or `savvy-progress` mods, remove them:
this mod includes both and registers the same `/filetree` and `/agents-info` commands.

## Settings

The file tree keeps its upstream options (`activity`, `glyphs`, `follow`, `start`, `column`, `hints`,
`open`), set in Claude Code's plugin settings.

## Notes

- The mascot is drawn as SVG rects with CSS animation. Animations run even when the OS asks for reduced
  motion, because the mascot is the point of the mod.
- Nothing is sent anywhere. The mod uses no network access. The file tree runs `git`, `find` and `du`
  locally, as upstream does.
- Tests: `claude plugin test .` and `claude plugin validate .` from the repo root.

## Credits and merged mods

This mod folds two existing mods into one so they share a look and one set of hooks. Both are MIT
licensed; see [NOTICE.md](NOTICE.md).

| Merged mod | Author | Link |
|---|---|---|
| **filetree** (file tree pane with git status and Claude activity) | Kurt Buhler / data-goblin | https://github.com/data-goblin/claude-code-filetree |
| **savvy-progress** (progress bar and subagents panel) | johnnyvizz | https://github.com/JohnnyVizz/claude-kit (`plugins/savvy-progress`) |

Reference art and ideas:

- Mascot proportions and several poses (wizard hat, nightcap, sunglasses, propeller cap, crown,
  reading, sleeping, error) follow the **Mascot Studio** sheet by Harriszed:
  https://github.com/Harriszed/mascot-studio (credited there to Ayotomiwa Wale-Durojaye).
- The thread that started it: https://www.reddit.com/r/claudexplorers/comments/1uptdtz/anyone_else_obsessed_with_clawd_claude_code_mascot/
- The chef costume and panel layout are adapted from savvy-progress, which credits DockCrab ("Clawdy")
  for its pixel crab.
- The frog, creeper and slime are original pixel homages to Minecraft's warm frog, creeper and slime.
  Minecraft is a trademark of Mojang / Microsoft.

## License

MIT for this repository's own code (see [LICENSE](LICENSE)). The merged file tree keeps its upstream
MIT license ([LICENSE-filetree](LICENSE-filetree)); see [NOTICE.md](NOTICE.md) for savvy-progress.
