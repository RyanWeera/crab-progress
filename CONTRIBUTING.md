# Contributing

Thanks for helping. This is a small Claude Code mod; changes should stay small and testable.

## Setup

You need the Claude Code CLI (2.1.x) and git. From the repo root:

```bash
claude plugin validate .   # manifest and hooks check
claude plugin test .       # runs hooks/progress.test.tsx
```

Run it live from a checkout without installing:

```bash
claude --plugin-dir .
```

## Where things are

- `hooks/crab.ts` sprites, characters and animation CSS (`crabCss`)
- `hooks/classify.ts` costume choice and the idle-roam script
- `hooks/register.tsx` bar, agents panel hooks, commands
- `hooks/ft-*.ts(x)` the file tree, merged from upstream filetree. Keep upstream attribution.

## Rules of the road

- One hooks module per plugin. New hooks that share an event with an existing one need a matcher.
- `atom({ plugin: '...' })` takes string literals.
- Do not add a `prefers-reduced-motion` rule; it disables every animation on systems that report it.
- Render with the real clock (`$.clock.now()`), not the `now` atom.
- Files are UTF-8 without a BOM.
- Add or update a test in `hooks/progress.test.tsx` for behaviour you change.
- No personal paths, names or tokens in code, tests or docs.

## Pull requests

Describe what changed and how you checked it (`plugin validate` and `plugin test` output is enough).
By contributing you agree your work is released under the MIT license.
