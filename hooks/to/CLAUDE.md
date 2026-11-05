# to (Token Optimizer band)
Token Optimizer's desktop bar (sentence, five marks, details row, buttons) drawn in the crab's style under the progress row. Merged from github.com/alexgreensh/token-optimizer v5.13.57; PolyForm Noncommercial, see `../../NOTICE.md`.

- Entry point: `hooks/register.tsx` (`registerOptimizer`, called last from `../register.tsx`)
- Key files: `hooks/data.ts` (reads figures, runs `measure.py`), `src/marks.ts`, `src/ladder.ts`, `src/clock.ts`, `src/actions.ts`
- Uses: `../../types/index.d.ts` (`to-*` state keys), Token Optimizer's installed scripts
- Used by: `../register.tsx`
- Tests: `../progress.test.tsx`
- Env: `CRAB_OPTIMIZER_BAR=0` hides it, `CRAB_OPTIMIZER_BAR_SIZE=slim` starts slim
- Hooks carry match-all matchers (`ANY`); `$` stays inside this module's own functions
