// Data gathering and re-keying for the band.
//
// The engine refuses `$` passed across an import ("$ is followed only into a
// function declared in this same file"), and a plugin has exactly one hooks
// module. So this file never sees `$`: it works over `DataIo`, a port that
// register.tsx builds from `$` in one top-level function (`dataIo($)`), each
// member spelled `$.noun.method(...)` there. That keeps every noun call where
// the engine's scan looks for it, and lets this logic run under plain Node.
//
// Every lookup is best effort: a figure that cannot be read is left null and
// the rest still fill. Nothing here registers a hook; register.tsx wires the
// events and the cadence below.
import type { TokenOptimizerDesktopSession } from '../../../types'
import type { Limit, Quality } from '../src/contracts.ts'
import { parseQualityCache, parseStatusBar, parseUsage, smallerCompactWindow, type StatusBar } from '../src/parse.ts'

/** Redraw once a second, but only inside the cache warning window. */
export const TICK_WARNING_MS = 1_000
/** Redraw otherwise, beside the event-driven redraws. */
export const TICK_IDLE_MS = 60_000
/** Re-read the quality file this often, and after each turn. */
export const QUALITY_REFRESH_MS = 60_000
/** Re-read the savings this long after a turn ends (token-lens writes its file as the turn ends). */
export const STATUS_AFTER_TURN_MS = 5_000
/** `git branch --show-current` is local and instant; anything slower is skipped. */
export const GIT_TIMEOUT_MS = 1_000

/** Shown as the savings reason while token-lens has written no file for this session. */
export const NOT_FOUND = 'Savings show after the first answer once token-lens is installed.'

/**
 * What the gatherer needs from the engine. register.tsx answers each member
 * with the `$` call named beside it; any member may reject.
 */
export type DataIo = {
  /** `$.clock.now()` (ms) */
  now: () => Promise<number>
  /** `$.session.id()` */
  sessionId: () => Promise<string>
  /** `$.session.cwd()` */
  cwd: () => Promise<string>
  /** `$.env.get('HOME')` (the validator wants a literal variable name) */
  envHome: () => Promise<string | undefined>
  /** `$.env.get('CLAUDE_CONFIG_DIR')`: a relocated Claude folder */
  envConfigDir?: () => Promise<string | undefined>
  /** `$.env.get('CLAUDE_CODE_AUTO_COMPACT_WINDOW')`: the raw auto-compaction window override */
  envAutoCompactWindow?: () => Promise<string | undefined>
  /** `$.env.get('USERPROFILE')`, the Windows home */
  envUserProfile: () => Promise<string | undefined>
  /** `$.session.usage()` */
  usage: () => Promise<unknown>
  /** `$.fs.read(path)` */
  read: (path: string) => Promise<string>
  /** `$.process.run(argv, init)` */
  run: (argv: string[], init: { cwd?: string; timeoutMs: number; stdin?: string }) => Promise<{ exitCode: number; stdout: string; stderr?: string }>
}

async function attempt<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work()
  } catch {
    return fallback
  }
}

/** Session ids become file names: letters, digits, `_` and `-` only, as token-lens writes them. */
export function cleanId(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9_-]/g, '')
  // A real session id is a UUID: an id shorter than 6 reads nothing.
  return clean.length >= 6 ? clean : ''
}

/** True when the stored atom belongs to another session (or to none) and must be reset. */
export function shouldReset(stored: TokenOptimizerDesktopSession | null, liveSessionId: string): boolean {
  return stored === null || stored.sessionId !== liveSessionId
}

/** The user's home, as the engine's process sees it. */
export async function readHome(io: DataIo): Promise<string> {
  // USERPROFILE first, as token-lens and project-link look it up, so all three use the same folder.
  return (await attempt(() => io.envUserProfile(), undefined)) || (await attempt(() => io.envHome(), undefined)) || ''
}

/** The Claude folder: CLAUDE_CONFIG_DIR when set, else ~/.claude. */
export async function claudeDir(io: DataIo, home: string): Promise<string> {
  const set = io.envConfigDir ? await attempt(() => io.envConfigDir!(), undefined) : undefined
  const dir = set ? set.trim().replace(/[\\/]+$/, '') : ''
  // Absolute only: a relative one would point the band elsewhere.
  const absolute = dir.startsWith('/') || /^[A-Za-z]:[\\/]/.test(dir)
  return absolute ? dir : home ? `${home}/.claude` : ''
}

/**
 * token-lens writes `~/.claude/token-lens/quality-<sid>.json` after each answer: the grade
 * and, under `status`, the savings and checkpoint facts. null when there is no such file yet,
 * 'unreadable' when it does not parse (caught mid-write).
 */
export async function readLens(io: DataIo, home: string, sid: string): Promise<{ quality: Quality | null; status: StatusBar | null } | 'unreadable' | null> {
  const claude = home && sid ? await claudeDir(io, home) : ''
  const raw = claude ? await attempt(() => io.read(`${claude}/token-lens/quality-${sid}.json`), null) : null
  if (!raw) return null
  let file: { status?: unknown }
  try {
    file = JSON.parse(raw) as { status?: unknown }
  } catch {
    return 'unreadable'
  }
  const nowMs = await attempt(() => io.now(), Date.now())
  return { quality: parseQualityCache(file, nowMs / 1000), status: parseStatusBar(file.status) }
}

function newer(a: number | null, b: number | null): number | null {
  return a === null ? b : b === null ? a : Math.max(a, b)
}

/** The current git branch; null outside a repository, on a detached HEAD, or without git. */
export async function readBranch(io: DataIo, cwd: string): Promise<string | null> {
  const init = cwd ? { cwd, timeoutMs: GIT_TIMEOUT_MS } : { timeoutMs: GIT_TIMEOUT_MS }
  const result = await attempt(() => io.run(['git', 'branch', '--show-current'], init), null)
  const branch = result && result.exitCode === 0 ? result.stdout.trim() : ''

  return branch === '' ? null : branch
}

/** The last branch read, so the once-a-minute refresh does not start git each time. */
let branchSeen: { cwd: string; branch: string | null } | null = null

export type GatherOptions = {
  /** The live session id when the caller knows it better than `$.session.id()` (a classic SessionStart's `session_id`). */
  sessionId?: string
  /** Start over even when the id matches (a clear). */
  reset?: boolean
  /** Read the savings and checkpoint facts (start, after a turn, row opened). */
  savings?: boolean
}

/**
 * The per-session part of a Snapshot. Starts from `previous` only when it
 * belongs to this session, so nothing carries over a clear. Savings and
 * the clock facts come from token-lens's `status` block when asked for; when it is
 * not asked or not there yet, the last known values stay.
 */
/** Only the context figures of a parsed usage, with the reduced flag always present so a stale one is cleared. */
function contextOf(u: ReturnType<typeof parseUsage>) {
  return { contextPercent: u.contextPercent, contextTokens: u.contextTokens, contextWindow: u.contextWindow, contextWindowReduced: u.contextWindowReduced === true, contextModelWindow: u.contextModelWindow ?? null }
}

export async function gather(
  io: DataIo,
  previous: TokenOptimizerDesktopSession | null,
  options: GatherOptions = {},
): Promise<TokenOptimizerDesktopSession> {
  const now = await attempt(() => io.now(), Date.now())
  const sid = cleanId(options.sessionId ?? (await attempt(() => io.sessionId(), '')))
  const base = options.reset || shouldReset(previous, sid) ? null : previous
  const cwd = await attempt(() => io.cwd(), '')
  const home = await readHome(io)
  const autoCompactWindow = io.envAutoCompactWindow ? await attempt(() => io.envAutoCompactWindow!(), undefined) : undefined
  const rawUsage = await attempt(() => io.usage(), null)
  const reported = parseUsage(rawUsage, autoCompactWindow, base?.compactWindow)
  // A limit does not vanish mid-session: a refresh that comes back without one (right
  // after a compact, say) keeps the last known value; once that window has renewed, 0%.
  const keep = (fresh: Limit | null, last: Limit | null | undefined): Limit | null => {
    if (fresh) return fresh
    // Kept only until its own renewal: after that the old figure is wrong, and an unreadable
    // renewal time is no renewal time (either could otherwise stay on screen for good).
    if (!last || last.resetsAt === null) return null
    const renews = Date.parse(last.resetsAt)
    return Number.isFinite(renews) && renews > now ? last : null
  }
  const usage = { ...reported, fiveHour: keep(reported.fiveHour, base?.fiveHour), week: keep(reported.week, base?.week) }
  const sawLimits = Boolean(base?.sawLimits || reported.fiveHour || reported.week)
  // A branch changes rarely: read once per directory, then again only when the caller asks for the full read.
  const branch = options.savings || options.reset || branchSeen === null || branchSeen.cwd !== cwd ? await readBranch(io, cwd) : branchSeen.branch
  branchSeen = { cwd, branch }
  const read = await readLens(io, home, sid)
  // A file caught mid-write keeps the last known figures, so one bad read never blanks the band.
  const lens = read === 'unreadable' ? null : read
  const quality = read === 'unreadable' ? (base?.quality ?? null) : (lens?.quality ?? null)

  let status: StatusBar | null = null
  let notFound = false

  if (options.savings && sid) {
    notFound = read === null
    status = lens?.status ?? null
  }

  const kept = {
    savings: base?.savings ?? null,
    savingsState: base?.savingsState ?? ('unavailable' as const),
    savingsReason: base?.savingsReason ?? null,
    lastRequestEpoch: base?.lastRequestEpoch ?? null,
    cacheLifetime: base?.cacheLifetime ?? null,
    compactWindow: base?.compactWindow ?? null,
    checkpointEpoch: base?.checkpointEpoch ?? null,
    earlierCheckpoint: base?.earlierCheckpoint ?? null,
    compactions: base?.compactions ?? null,
  }
  const seen = { toolCallsSeen: base?.toolCallsSeen ?? 0, compactionsSeen: base?.compactionsSeen ?? 0 }

  const facts = notFound
    ? { ...kept, savings: null, savingsState: 'unavailable' as const, savingsReason: NOT_FOUND, checkpointEpoch: null }
    : status
      ? {
          // While savings load, the last known figures stay on show.
          savings: status.savings ?? (status.savingsState === 'loading' ? kept.savings : null),
          savingsState: status.savingsState,
          savingsReason: status.savings ? null : status.savingsReason,
          lastRequestEpoch: status.lastRequestEpoch ?? kept.lastRequestEpoch,
          cacheLifetime: status.cacheLifetime ?? kept.cacheLifetime,
          // An answer with no window means the user has none now: a kept one must not linger.
          compactWindow: status.compactWindow,
          checkpointEpoch: status.checkpointEpoch,
          earlierCheckpoint: status.earlierCheckpoint,
          compactions: status.compactions ?? kept.compactions,
        }
      : kept

  // The higher count wins: the quality cache can lag a compaction that just landed.
  // Never lower than the band already knew this session (it may have seen the compaction itself).
  const known = Math.max(
    'compactions' in facts && facts.compactions != null ? facts.compactions : 0,
    base?.quality?.compactions ?? 0,
  )
  const counted = quality && known > quality.compactions ? { ...quality, compactions: known } : quality
  // A status answer names token-lens's own latest checkpoint, so it wins over the quality figure.
  const answered = status !== null
  const checkpointEpoch = notFound ? null : answered ? facts.checkpointEpoch : newer(quality?.checkpointEpoch ?? null, facts.checkpointEpoch)
  const merged = counted && answered ? { ...counted, checkpointEpoch } : counted

  // A compact window in the status answer can differ from what the first parse assumed:
  // then the context figures are read again against it.
  const windowNow = smallerCompactWindow(autoCompactWindow, facts.compactWindow)
  const context = windowNow === smallerCompactWindow(autoCompactWindow, base?.compactWindow) ? usage : { ...usage, ...contextOf(parseUsage(rawUsage, autoCompactWindow, facts.compactWindow)) }

  return {
    sessionId: sid,
    gatheredAt: now,
    quality: merged,
    ...context,
    branch,
    ...facts,
    // Without a status answer, the newer of the two figures known.
    ...seen,
    sawLimits,
    checkpointEpoch,
    sheetOpen: base?.sheetOpen ?? false,
  }
}

/**
 * What to store when `fresh` lands on top of `current` (read inside
 * `update`): keeps a row toggle made while gathering, never across sessions
 * or a forced reset.
 */
export function mergeStored(
  current: TokenOptimizerDesktopSession | null,
  fresh: TokenOptimizerDesktopSession,
  reset = false,
  savingsRead = true,
): TokenOptimizerDesktopSession {
  const sameSession = !reset && current !== null && current.sessionId === fresh.sessionId

  // A refresh that began before a compaction landed must not write its count back down.
  const counted = sameSession ? Math.max(current.quality?.compactions ?? 0, fresh.quality?.compactions ?? 0) : null
  const quality = fresh.quality && counted !== null && counted > fresh.quality.compactions ? { ...fresh.quality, compactions: counted } : fresh.quality

  // The band's own counts only grow; a refresh that read them earlier cannot undo a later one.
  const seen = sameSession
    ? {
        toolCallsSeen: Math.max(current.toolCallsSeen ?? 0, fresh.toolCallsSeen ?? 0),
        compactionsSeen: Math.max(current.compactionsSeen ?? 0, fresh.compactionsSeen ?? 0),
      }
    : {}

  // A refresh that did not read the status block only carried its older copy of it:
  // a savings refresh that landed meanwhile keeps its figures.
  const statusFacts =
    sameSession && !savingsRead
      ? {
          savings: current.savings,
          savingsState: current.savingsState,
          savingsReason: current.savingsReason,
          earlierCheckpoint: current.earlierCheckpoint,
          cacheLifetime: current.cacheLifetime ?? fresh.cacheLifetime,
          lastRequestEpoch: newer(current.lastRequestEpoch, fresh.lastRequestEpoch),
          checkpointEpoch: newer(current.checkpointEpoch, fresh.checkpointEpoch),
          compactions:
            current.compactions == null ? fresh.compactions : fresh.compactions == null ? current.compactions : Math.max(current.compactions, fresh.compactions),
        }
      : {}

  return { ...fresh, ...statusFacts, ...seen, quality, sheetOpen: sameSession ? current.sheetOpen : fresh.sheetOpen }
}
