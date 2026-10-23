# claude-code-progress

- `.claude-plugin/` — plugin manifest
- `hooks/` — the mod module and its test
  - `to/` — Token Optimizer's bar (merged from its desktop mod): data, pure logic, drawing
- `types/` — state contract

## Where to change things
| Task | Folder |
|---|---|
| Bar look, crab, percent | `hooks/` |
| Token Optimizer marks, sentence, buttons | `hooks/to/` |
| What feeds the bar | `hooks/` |
| Stored value shape | `types/` |
