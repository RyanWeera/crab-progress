# Security audit — crab-progress

Date: 2026-10-28 · Skill: `key-audit` (20 checks) · Mode: fix automatically

## Summary

**Stack**: TypeScript Claude Code plugin (`crab-progress` v0.7.1). 38 source files across `hooks/`, `hooks/to/`, `types/`, `.claude-plugin/`. No package manager, no build step, no bundler, no server.

**Verdict: CLEAN.** No changes were made — nothing required one.

Counts: 0 critical · 0 high · 0 medium · 1 low (informational, not fixed).

**Why so many N/A.** This is an in-process Claude Code plugin, not a web application. It serves no HTTP, opens no socket, makes no network call of any kind, has no database, no sessions and no users. Eleven of the twenty checks describe controls that have no surface here. The nine that do apply were audited in full.

### Trust boundaries that do exist

The plugin is not free of untrusted input — it just arrives by a different route than in a web app:

1. **Agent-supplied strings** — subagent `description`, `type` and step text, rendered into the SVG panel.
2. **Filesystem-supplied strings** — filenames from whatever repository the user has open, including a cloned one they do not control, rendered into the dig scene and the tree.
3. **User config** — the `open` setting, which names a command to run on double-click.
4. **Process execution** — `$.process.run` calls `find`, `du`, `git`, `touch`, `rm`, `sh`, `open` and `powershell`.

Checks 7, 8 and 19 were audited against these, not against a browser.

## The 20 checks

| # | Check | Status | Note |
|---|---|---|---|
| 1 | Hide API keys | PASS | No credential of any kind in 38 files. No network call exists to use one. |
| 2 | Check env variables | PASS | 11 env reads, all OS/path/feature config. `.gitignore` covers `.env`, `.env.*`. |
| 3 | Check keys in git | PASS | 15 commits scanned across all history. No secret patterns, no env/pem/key file ever added. |
| 4 | Protect admin routes | N/A | No HTTP server, no routes, no admin surface. |
| 5 | Add auth | N/A | Runs in-process in the user's own session; no remote caller to authenticate. |
| 6 | Check user perms | N/A | Single-user, no per-user data, no multi-tenancy. |
| 7 | Sanitize user inputs | PASS | Every `$.process.run` uses argv-array form. No `shell: true`, no string-concatenated command anywhere. |
| 8 | Protect against XSS | PASS | SVG-markup equivalent: all agent- and file-supplied text is escaped before interpolation. |
| 9 | SQL injection protect | N/A | No SQL, no database, no ORM. |
| 10 | Check DB rules | N/A | No database, no BaaS, no storage rules. |
| 11 | Add rate limiting | N/A (web) / PASS (resource bound) | No endpoints to limit. Every subprocess carries an explicit `timeoutMs`; `find` is depth-capped and `-xdev`. |
| 12 | Set spend cap | N/A | No paid API. `classify.ts` is keyword scoring with no model call. |
| 13 | Secure file uploads | N/A | No uploads. The plugin performs no `$.fs.write` at all. |
| 14 | CSRF protection | N/A | No HTTP, no cookies, no state-changing requests. |
| 15 | Check CORS settings | N/A | No HTTP server. |
| 16 | Enable HTTPS | PASS | No outbound requests. All manifest URLs are `https://`. No TLS verification is disabled anywhere. |
| 17 | Add security headers | N/A | No HTTP responses to set headers on. |
| 18 | Secure cookies | N/A | No cookies, no sessions, no tokens. |
| 19 | Disable debug mode | PASS | No debug flag, no `console.*`, no stack trace surfaced. |
| 20 | Check prod settings | PASS | One low-severity note below. Plugin validates, 29/29 tests pass. |

## Findings

| Location | Check | Severity | What | Action |
|---|---|---|---|---|
| `hooks/ft-register.tsx:392` | 20 | low | `sinceNow` builds a mark file at `${TMPDIR or /tmp}/filetree-<session>-<n>.mark` and `touch`es it. If `TMPDIR` were ever unset on a shared-`/tmp` system, a pre-planted symlink at that path could be touched, and later `rm -f`'d. | **Not fixed.** The path is macOS-only (`os !== 'darwin'` returns early), where `TMPDIR` is always set and per-user, and the name contains an unguessable session id. Adding `mktemp` handling would be defensive code for a state that cannot occur. Noted for the record. |

## What was verified, and how

**Check 7 — command execution.** Every call site was read, not just grepped:

- `hooks/ft-open.ts:26` — on Linux the target is passed as a positional `$1` to `sh -c`, never interpolated into the script, and the script opens with `set -f` to disable globbing. On Windows the target goes through the `PANE_OPEN_TARGET` environment variable rather than into the PowerShell command string. Both are the correct pattern.
- `hooks/ft-open.ts:63` — `openWithCommand` word-splits the user's `open` config into an argv array and substitutes `{path}`/`{dir}` per element. No shell is invoked. A user configuring their own open command is equivalent to them running it.
- `hooks/ft-register.tsx:893`, `:1002` — both `sh -c` uses pass data positionally (`sh -c SCRIPT sh "$arg"`).
- `hooks/ft-register.tsx:370`, `:429`, `:781`, `:842`, `:1152` — `find`, `du` and `rm -f` all take argv arrays with paths as separate elements.
- `hooks/ft-register.tsx:903` — `HERDR_BIN_PATH` names an executable. An attacker able to set it already controls the process; not a boundary.

All twelve `.exec(` hits in the initial grep were regular-expression `.exec()`, not process execution.

**Check 8 — markup injection into the SVG panel.** Three escapers, all correct for text content and double-quoted attributes (`& < > "`; `'` is unneeded since attributes use `"`):

- `hooks/agents.ts:133` `xml()` — applied to `a.description`, `a.type`, `meta.join(...)` and `steps` at lines 234–236.
- `hooks/dig.ts:16` `xml()` — applied to filenames at line 64 before they reach the `<text>` at line 67.
- `hooks/to/hooks/register.tsx:972` `esc()` — applied to `mark.badge` and `mark.alt`, including inside the `aria-label` attribute and `<title>`.

Every unescaped `${...}` inside SVG markup was traced to a module constant (`FONT`, `W`, `H`, `GRID_STEP`), a computed number, or a palette value from `toneColor`/`tonesFor`. None is reachable from agent or filesystem input.

**Check 19 — ReDoS.** Scanned for nested quantifiers across all regexes; none found. The transcript and git-output parsers use bounded character classes.

## Keys to rotate now

None. No secret has ever been in this repository's working tree or its history.

## Manual actions for you

None required by this audit. Two optional hardening items, neither a finding:

- The repository is public (`github.com/RyanWeera/crab-progress`). Confirm 2FA is on for the GitHub account — a plugin repo is a supply-chain target regardless of its own code quality.
- Consider enabling Dependabot or Renovate if the plugin ever gains dependencies. It currently has none, which is why `npm audit` was not run.

## Needs testing before deploy

Nothing. No code was changed.

## Verification

| Command | Result |
|---|---|
| `claude plugin validate .` | **pass** (with the usual state read/write warnings) |
| `claude plugin test .` | **pass** — 29 tests, 0 failures, 1.97s |
| Secret pattern scan, working tree (38 files) | 0 hits |
| Secret pattern scan, full git history (15 commits) | 0 hits |
| `git ls-files` for env/key/credential files | 0 hits |
| Network-call grep (`fetch`, `axios`, `http.request`, `WebSocket`, …) | 0 hits |
| `$.fs.write` / filesystem-write grep | 0 hits |

## Not verified

- **No `npm audit` / dependency scan.** The plugin has no dependencies and no lockfile — there is nothing to audit. `node` and `tsc` are not installed in this workspace in any case.
- **No type check.** No `tsc` available; the plugin's own validator and test run are the available substitutes, and both pass.
- **No runtime probing.** There are no endpoints to probe. Behaviour was verified by the test suite, not by driving the plugin live.
- **`hooks/to/` upstream provenance.** This is a merged clone of Token Optimizer's desktop bar (v5.13.57). It was audited as source in this tree; it was not diffed against upstream to confirm it matches what that project published.

---

This file is untracked. Add it to `.gitignore` or delete it before pushing — the repository is public.
