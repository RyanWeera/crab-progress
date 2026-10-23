# Third-party notices

This repository includes code adapted from the following projects. Unless stated otherwise each is used under the MIT
license.

## filetree

- Source: https://github.com/data-goblin/claude-code-filetree
- Author: Kurt Buhler (data-goblin)
- License: MIT. The full text is in [LICENSE-filetree](LICENSE-filetree).
- Where: `hooks/ft-*.ts` and `hooks/ft-*.tsx`. Changes: renamed files, state moved under this
  plugin's name, hooks given matchers so they can share one module with the rest of this mod, theme
  and shimmer colours changed, a mascot icon in the header and a digging scene drawn over the tree.

## savvy-progress

- Source: https://github.com/JohnnyVizz/claude-kit (`plugins/savvy-progress`)
- Author: johnnyvizz
- License: MIT, as declared in that plugin's manifest.
- Where: `hooks/agents.ts` (model prices, formatting, row and header drawings) and the subagent hooks
  in `hooks/register.tsx` (`agent.spawn`, `turn.step`, `turn.complete`, the `step` tool).
  Changes: English only, no flow bar, rows drawn with this mod's mascot and costumes.

The savvy-progress copyright notice and permission notice, as MIT requires:

```
MIT License

Copyright (c) johnnyvizz

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT
OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## token-optimizer (NOT MIT: noncommercial only)

- Source: https://github.com/alexgreensh/token-optimizer (`desktop/token-optimizer-desktop`, v5.13.57)
- Author: Alex Greenshpun
- License: PolyForm Noncommercial 1.0.0. The terms are in [LICENSE-token-optimizer](LICENSE-token-optimizer)
  and the small-business permission in
  [LICENSE-token-optimizer-small-business.md](LICENSE-token-optimizer-small-business.md).
  Required Notice: Copyright Alex Greenshpun (https://linkedin.com/in/alexgreensh)
- Where: everything under `hooks/to/`. Changes: Clawd is no longer drawn (the crab replaces him),
  marks are drawn as crab-style bars, state is kept under this plugin's `to-*` keys, hooks carry
  match-all matchers so they share one module with the rest of this mod, and the env switches are
  `CRAB_OPTIMIZER_BAR` and `CRAB_OPTIMIZER_BAR_SIZE`. The rest of this repository stays MIT, but
  `hooks/to/` may be used for noncommercial purposes only.

## Reference art

Pose proportions and several costumes follow the Mascot Studio sheet
(https://github.com/Harriszed/mascot-studio). It carries no license file in what was reviewed, so
nothing from it is copied: the sprites in `hooks/crab.ts` were redrawn from scratch as rectangles.
If its author prefers, tell us and the affected poses will be changed.
