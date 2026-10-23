// The Token Optimizer half of the crab band (merged from token-optimizer's desktop mod).
//
// `registerOptimizer` adds the hooks that feed it; `optimizerBand` draws it under the crab's
// progress row, in the crab's art style. Every decision lives in ../src (pure) and ./data.ts
// (the data gatherer over a port). The engine allows `$` only into functions declared at the
// top of a module, so each `$` helper below is one, and closures made inside hooks only ever
// hand `$` on to them.
//
// State the drawing reads lives in `$.state` atoms (../../../types, keys `to-*`) so a hot
// reload keeps it. Clawd is gone (the crab replaces him), and so is his pose machinery.
import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register } from 'claude-code'

import type { TokenOptimizerDesktopSession } from '../../../types'
import {
  BUSY_TIMEOUT_MS,
  CAPTURE_TIMEOUT_MS,
  DASHBOARD_ARGS,
  DASHBOARD_FAILED,
  DASHBOARD_TIMEOUT_MS,
  HANDOFF_KEY,
  HANDOFF_TTL_MS,
  RESUME_TIMEOUT_MS,
  WARM_PROMPT,
  attachesHandoff,
  busyNow,
  busyTimeoutMs,
  canOpenDashboard,
  cleanUpOutcome,
  dashboardFailed,
  dashboardStatus,
  handoffFate,
  initialUi,
  isArmed,
  lifetimeFromUsage,
  liveTokens,
  noteNow,
  prepareHandoff,
  requestContextTokens,
  stripCrossSessionPointer,
  warmToast,
  withBusy,
  withNote,
  type Busy,
  type Handoff,
  type HandoffPort,
  type UiState,
} from '../src/actions.ts'
import { canKeepWarm, initialClock, reduceClock, view, type ClockEvent, type ClockState } from '../src/clock.ts'
import { LIGHT, type Palette } from '../src/palette.ts'
import type { Snapshot } from '../src/contracts.ts'
import { ICONS, ICON_ALT, iconSvg, type IconName } from '../src/icons.ts'
import { COMPACT_HEAVY, QUALITY_FLOOR, sentence, type ActionId, type Run } from '../src/ladder.ts'
import { cards, marks, row, type Card, type Mark, type MarkTone } from '../src/marks.ts'
import { envSize, slimSide, storedSize, type BandSize } from '../src/size.ts'
import {
  QUALITY_REFRESH_MS,
  STATUS_AFTER_TURN_MS,
  TICK_IDLE_MS,
  TICK_WARNING_MS,
  cleanId,
  findTokenOptimizerRoot,
  gather,
  mergeStored,
  readHome,
  runMeasure,
  type DataIo,
  type GatherOptions,
} from './data.ts'

const sessionAtom = atom({ plugin: 'crab-progress', key: 'to-session' } as const, null)
const handoffAtom = atom({ plugin: 'crab-progress', key: 'to-handoff' } as const, null)
const clockAtom = atom({ plugin: 'crab-progress', key: 'to-clock' } as const, null)
const engineCallAtom = atom({ plugin: 'crab-progress', key: 'to-engineCall' } as const, null)
const uiAtom = atom({ plugin: 'crab-progress', key: 'to-ui' } as const, null)
const frameAtom = atom({ plugin: 'crab-progress', key: 'to-frame' } as const, 0)

type Desktop = Elements['desktop']
type Tones = { good: string; caution: string; bad: string; cold: string; ink: string; track: string; card: string; line: string }

/** The crab's colours: its win green and gold (light; each picture follows dark mode itself, see DARK_STYLE). */
function tonesFor(p: Palette): Tones {
  return { good: '#5fbf8f', caution: '#D9A23A', bad: p.bad, cold: p.cold, ink: p.ink, track: '#d9d6cd', card: p.card, line: '#e2dfd6' }
}

// ---- module state: plain variables, rebuilt from the atoms after a reload ----

let enabled = true
let active = false
/** Whether the CRAB_OPTIMIZER_BAR switches have been read in this environment. */
let switchesRead = false
let timers: { cancel: () => void }[] = []
let statusTimer: { cancel: () => void } | null = null
let frameText = ''
/** The transcript Claude Code named for one session: never handed to another session's read. */
let transcript: { sessionId: string; path: string } | null = null

function noteTranscript(sessionId: unknown, path: unknown): void {
  if (typeof path === 'string' && path && typeof sessionId === 'string' && sessionId) transcript = { sessionId: cleanId(sessionId), path }
}

function transcriptFor(sid: string): string | undefined {
  return transcript !== null && sid !== '' && transcript.sessionId === sid ? transcript.path : undefined
}
let warmInFlight = false
/**
 * Which session the band is serving: bumped when one starts, is cleared or is
 * swapped in. Work begun under one generation drops its result in the next.
 */
let sessionGen = 0
/**
 * A press is being claimed: a second press meanwhile is ignored (no double
 * compaction). A claim older than the busy timeout is stale: a stuck press
 * never holds the buttons past it.
 */
let claim: { at: number } | null = null
/**
 * The one engine call the buttons may have running: our `$.session.compact()`
 * or our `$.command.run({ command: 'clear' })`. Set before the call's first
 * await, cleared only when it settles, whatever the busy timeout says: a
 * second compaction or clear never overlaps it. `engineCallAtom` records it
 * too, so a reload mid-call still refuses (see runningCall).
 */
let engineCall: 'compact' | 'clear' | null = null
/** When engineCall was claimed: a call that never settles stops blocking after HANDOFF_TTL_MS. */
let engineCallAt = 0
/** The live session a render last asked to re-read after finding another session's figures. */
let resyncFor = ''
/** Compactions that landed in this process, so Clean up can tell one happened during its /compact. */
let compactionsLanded = 0

/** The store key for the user's band size: the user's choice, so it survives sessions and restarts. */
const SIZE_KEY = 'status-bar-size'
/** The env default (CRAB_OPTIMIZER_BAR_SIZE), read once in readSwitches. */
let sizeEnvDefault: BandSize = 'full'
/** The stored size, once read or pressed: null while only the env default applies. */
let sizeClicked: BandSize | null = null
/** Whether $.store was consulted for the size successfully (a failed read retries next render). */
let sizeRead = false

const attempt = async <T,>(work: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await work()
  } catch {
    return fallback
  }
}

/** Session ids become file names; keep what Token Optimizer's sanitizer keeps (as data.ts does). */

// ---- data ----

/** The gatherer's port over `$` (data.ts never sees `$`). */
function dataIo($: EngineInterface): DataIo {
  return {
    now: () => $.clock.now(),
    sessionId: () => $.session.id(),
    cwd: () => $.session.cwd(),
    envHome: () => $.env.get('HOME'),
    envUserProfile: () => $.env.get('USERPROFILE'),
    envConfigDir: () => $.env.get('CLAUDE_CONFIG_DIR'),
    envAutoCompactWindow: () => $.env.get('CLAUDE_CODE_AUTO_COMPACT_WINDOW'),
    usage: () => $.session.usage(),
    list: path => $.fs.list(path),
    stat: path => $.fs.stat(path),
    read: async path => {
      const text = await $.fs.read(path)
      return typeof text === 'string' ? text : ''
    },
    run: (argv, init) => $.process.run(argv, init),
    pluginRoot: () => $.plugin.root,
    log: async text => {
      await $.ui.log(text, { to: 'debug' })
    },
  }
}

/** Gather and store the session's figures, then let the cache clock learn from them. */
async function refresh($: EngineInterface, options: GatherOptions = {}): Promise<void> {
  refreshedAt = Date.now()
  let gen = sessionGen
  const current = await attempt(() => read($, sessionAtom), null)
  const liveSid = cleanId(options.sessionId ?? (await attempt(() => $.session.id(), '')))
  const path = options.transcript ?? transcriptFor(liveSid)
  const fresh = await gather(dataIo($), current, path ? { ...options, transcript: path } : options)
  // Begun before a clear or a session change: its figures belong to the old session.
  if (gen !== sessionGen) return
  if (!options.reset && current !== null && fresh.sessionId !== '' && current.sessionId !== fresh.sessionId) {
    // Another session (a new one, or a resume): nothing of the last one carries over.
    sessionGen += 1
    gen = sessionGen
    toolsPending = 0
    await feedClock($, { type: 'clear' })
    await setUi($, () => initialUi())
  }
  const latest = await attempt(() => read($, sessionAtom), null)
  if (gen !== sessionGen) return
  const merged = mergeStored(latest, fresh, options.reset, options.savings === true)
  // Nothing shown changed (gatheredAt always does): no write, so no redraw.
  if (latest !== null && sameShown(latest, merged)) return void (await syncClock($, fresh, gen))
  await update($, sessionAtom, cur => gen === sessionGen ? mergeStored(cur, fresh, options.reset, options.savings === true) : cur)
  if (gen !== sessionGen) return
  await syncClock($, fresh, gen)
}

function sameShown(a: TokenOptimizerDesktopSession, b: TokenOptimizerDesktopSession): boolean {
  return JSON.stringify({ ...a, gatheredAt: 0 }) === JSON.stringify({ ...b, gatheredAt: 0 })
}

/**
 * Runs work off the current event (the status command can take seconds). Where no
 * clock can schedule it, it runs now rather than not at all.
 */
async function later($: EngineInterface, work: () => Promise<void>): Promise<void> {
  // Work for the session as it is now: a clear or session change before it runs drops it.
  const gen = sessionGen
  const guarded = async () => {
    if (gen === sessionGen) await work()
  }
  try {
    $.clock.after(0, () => void attempt(guarded, undefined))
  } catch {
    await attempt(guarded, undefined)
  }
}

/** A prompt is taking the hand-off: a second prompt in the same moment does not. */
let takingHandoff = false

/** Tool calls the band counted since the last write: written alongside a redraw that happens anyway. */
let toolsPending = 0

async function flushTools($: EngineInterface): Promise<void> {
  if (toolsPending === 0) return
  const n = toolsPending
  toolsPending = 0
  await attempt(() => update($, sessionAtom, cur => (cur ? { ...cur, toolCallsSeen: (cur.toolCallsSeen ?? 0) + n } : cur)), undefined)
}

/** The status command's anchor and measured lifetime feed the clock when they are newer than what it holds. */
async function syncClock($: EngineInterface, s: TokenOptimizerDesktopSession, gen?: number): Promise<void> {
  if (gen !== undefined && gen !== sessionGen) return
  await attempt(
    () =>
      update($, clockAtom, cur => {
        if (gen !== undefined && gen !== sessionGen) return cur
        let c: ClockState = cur ?? initialClock()
        if (s.cacheLifetime && c.lifetime !== s.cacheLifetime) c = reduceClock(c, { type: 'lifetime-measured', lifetime: s.cacheLifetime })
        if (s.lastRequestEpoch !== null) {
          const at = s.lastRequestEpoch * 1000
          if (c.anchor === null || at > c.anchor) {
            c = reduceClock(c, { type: 'request-done', at, lifetime: s.cacheLifetime, contextTokens: s.contextTokens ?? c.contextTokens ?? 0 })
          }
        }
        if (c.contextTokens === null && s.contextTokens !== null) c = { ...c, contextTokens: s.contextTokens }
        return c
      }),
    undefined,
  )
}

async function feedClock($: EngineInterface, event: ClockEvent, now?: number): Promise<void> {
  await attempt(() => update($, clockAtom, cur => reduceClock(cur ?? initialClock(), event, now)), undefined)
}

function planDefault(s: TokenOptimizerDesktopSession | null): 3600 | 300 {
  // Rate limits mean a Claude plan: an hour of cache; the API keeps five minutes.
  // A limit seen once this session keeps it a plan, even if usage briefly stops reporting one.
  return s && (s.fiveHour || s.week || s.sawLimits) ? 3600 : 300
}

/**
 * Redraws when what the band shows changes: by the second near a deadline, otherwise every 5 s,
 * with at most one redraw a minute while nothing moves.
 */
/** Last tick that did its full work: when nothing moves by the second, every 5 s is enough. */
let fullTickAt = 0
const QUIET_TICK_MS = 5000
/** Something on screen changes by the second (the last cache minutes, a note, a pending press). */
let nearDeadline = false

async function tick($: EngineInterface): Promise<void> {
  try {
    const now = await $.clock.now()
    // By the second only while a countdown is near its end or a press is pending; otherwise
    // every 5 s (each tick is several engine calls).
    if (now - fullTickAt < QUIET_TICK_MS && !nearDeadline) return
    fullTickAt = now
    const clock = (await read($, clockAtom)) ?? initialClock()
    const session = await read($, sessionAtom)
    const ui = (await read($, uiAtom)) ?? initialUi()
    const v = view(clock, now, planDefault(session))
    // Only a change the band shows redraws it, at most once a minute.
    // One minute clock: the cache countdown's when it runs, else the wall clock's (for "27m ago").
    const minute = v.secondsLeft != null ? `c${Math.ceil(v.secondsLeft / 60)}` : `w${Math.floor(now / TICK_IDLE_MS)}`
    const text = [v.state, minute, busyNow(ui, now), noteNow(ui, now), isArmed(ui, now)].join('|')
    nearDeadline = v.state === 'warning' || v.state === 'warming' || busyNow(ui, now) !== null || noteNow(ui, now) !== null || isArmed(ui, now)
    if (text !== frameText) await flushTools($)
    if (text !== frameText) {
      frameText = text
      await update($, frameAtom, n => (n ?? 0) + 1)
    }
  } catch {
    // The next tick tries again.
  }
}

/** When the session last did something (a tool call or a turn): an idle session needs fewer reads. */
let activityAt = Date.now()
/** When the last full read finished. */
let refreshedAt = 0
const IDLE_AFTER_MS = 10 * 60_000

/** The once-a-minute read; a session idle for ten minutes is read every ten minutes instead. */
async function periodic($: EngineInterface): Promise<void> {
  const now = Date.now()
  if (now - activityAt > IDLE_AFTER_MS && now - refreshedAt < IDLE_AFTER_MS) return
  await attempt(() => refresh($), undefined)
}

function startCadence($: EngineInterface): void {
  for (const t of timers) t.cancel()
  timers = []
  try {
    timers.push($.clock.every(TICK_WARNING_MS, () => void tick($)))
    timers.push($.clock.every(QUALITY_REFRESH_MS, () => void periodic($)))
  } catch {
    // No timers: the band still redraws on events.
  }
}

/** Everything a desktop session needs once: a pending hand-off from disk, figures, the cadence. */
async function start($: EngineInterface): Promise<void> {
  sessionGen += 1
  // A warm-up marked running with no fork in flight here was cut off by a reload.
  const clock = await attempt(() => read($, clockAtom), null)
  if (clock?.warming && !warmInFlight) await feedClock($, { type: 'warm-failed' })
  const sizing = attempt(() => readSize($), undefined)
  const held = await heldHandoff($)
  if (held) await handoffThatFits($, held)
  await sizing
  // The quick reads now, so the band fills at once; the status command (seconds, at worst)
  // runs off the start event, so the session never waits on it.
  await attempt(() => refresh($), undefined)
  await later($, () => refresh($, { savings: true }))
  startCadence($)
}

function isHandoff(v: unknown): v is Handoff {
  if (!v || typeof v !== 'object') return false
  const h = v as Record<string, unknown>
  return typeof h.fromSessionId === 'string' && typeof h.cwd === 'string' && typeof h.text === 'string' && h.text !== '' && typeof h.checkpointPath === 'string' && typeof h.createdAt === 'number'
}

/**
 * The pending hand-off. `$.store` is the truth (it survives restarts and is
 * deleted when one session takes it); the atom only mirrors it for drawing. A
 * store that cannot be read holds nothing: no stale mirror is ever attached.
 */
async function heldHandoff($: EngineInterface): Promise<Handoff | null> {
  let stored: unknown
  try {
    stored = await $.store.get(HANDOFF_KEY)
  } catch {
    return null
  }
  const held = isHandoff(stored) ? stored : null
  if (stored != null && !held) await attempt(() => $.store.delete(HANDOFF_KEY), undefined)
  const mirror = await attempt(() => read($, handoffAtom), null)
  if (JSON.stringify(mirror) !== JSON.stringify(held)) await attempt(() => update($, handoffAtom, () => held), undefined)
  return held
}

/** When the live session began (`$.clock.now()` ms), or null when the engine cannot say. */
async function sessionStartedAt($: EngineInterface): Promise<number | null> {
  const usage = await attempt(() => $.session.usage(), null)
  return typeof usage?.startedAt === 'number' && Number.isFinite(usage.startedAt) ? usage.startedAt : null
}

/**
 * The held hand-off when it joins this session: another session than
 * the one that saved it, in its project, started since the save, within 10
 * minutes of it. An expired one in this project is dropped with a one-line
 * note; another project's is left alone. `as` names the session when the
 * caller knows its id better than the engine does yet (a clear's own start event).
 */
async function handoffThatFits($: EngineInterface, h: Handoff, as?: { sessionId: string; startedAt: number | null }): Promise<Handoff | null> {
  const sessionId = as?.sessionId ?? cleanId(await attempt(() => $.session.id(), ''))
  const cwd = await attempt(() => $.session.cwd(), '')
  const now = await $.clock.now()
  const startedAt = as ? as.startedAt : await sessionStartedAt($)
  const fate = handoffFate(h, { sessionId, cwd, startedAt, now })
  if (fate === 'attach') return h
  if (fate === 'skip') return null
  await dropHandoff($)
  const line = `Start fresh's saved hand-off was discarded: ${fate.drop}.`
  await setUi($, u => withNote(u, line, now))
  toast($, line)
  return null
}

/** The refusal for a press while our compaction or clear still runs. */
function stillRunning(kind: 'compact' | 'clear'): string {
  return kind === 'compact' ? 'Still finishing the last clean-up.' : 'Still clearing.'
}

/**
 * Our compaction or clear still running: this module's own, or one recorded
 * before a reload that is under 10 minutes old (an older record is cleared).
 */
async function runningCall($: EngineInterface): Promise<'compact' | 'clear' | null> {
  if (engineCall) {
    const at = await attempt(() => $.clock.now(), null)
    if (at === null || at - engineCallAt < HANDOFF_TTL_MS) return engineCall
    // Never settled: the record's own expiry below decides, as after a reload.
    engineCall = null
  }
  const held = await attempt(() => read($, engineCallAtom), null)
  if (engineCall) return engineCall
  if (!held) return null
  // A clock that cannot be read keeps the record: refuse rather than overlap.
  const now = await attempt(() => $.clock.now(), null)
  if (now === null || now - held.startedAt < HANDOFF_TTL_MS) return held.kind
  await attempt(() => update($, engineCallAtom, cur => (cur && cur.startedAt === held.startedAt && cur.kind === held.kind ? null : cur)), undefined)
  return null
}

/**
 * Claims the one engine call (the caller checked runningCall with no await
 * since) and records it for a reload. False when it cannot be recorded: the
 * call is not made.
 */
async function claimCall($: EngineInterface, kind: 'compact' | 'clear'): Promise<{ kind: 'compact' | 'clear'; startedAt: number } | null> {
  // Never over a call already in flight, whatever the caller checked before.
  if (engineCall !== null) return null
  engineCall = kind
  try {
    const mine = { kind, startedAt: await $.clock.now() }
    engineCallAt = mine.startedAt
    await update($, engineCallAtom, () => mine)
    return mine
  } catch {
    engineCall = null
    return null
  }
}

/** The call settled: release it here and in the record (only our own record). */
async function releaseCall($: EngineInterface, mine: { kind: 'compact' | 'clear'; startedAt: number }): Promise<void> {
  engineCall = null
  await attempt(() => update($, engineCallAtom, cur => (cur && cur.kind === mine.kind && cur.startedAt === mine.startedAt ? null : cur)), undefined)
}

// ---- buttons ----

function toast($: EngineInterface, text: string): void {
  try {
    $.ui.toast(text)
  } catch {
    // A toast that cannot show is not worth failing a press over.
  }
}

async function setUi($: EngineInterface, fn: (ui: UiState) => UiState): Promise<void> {
  await attempt(() => update($, uiAtom, cur => fn(cur ?? initialUi())), undefined)
}

async function disarm($: EngineInterface): Promise<void> {
  const ui = await attempt(() => read($, uiAtom), null)
  if (ui?.freshArmedAt != null) await setUi($, u => ({ ...u, freshArmedAt: null }))
}

const BUSY_WORDS: Record<Exclude<Busy, null>, string> = {
  clean: 'Clean up',
  'fresh-capture': 'Start fresh',
  'fresh-clear': 'Start fresh',
  dashboard: 'Opening the dashboard',
}

/** A busy state ends by itself: a step label never outlives its work. */
function armBusyTimeout($: EngineInterface, busy: Exclude<Busy, null>, since: number): void {
  try {
    $.clock.after(busyTimeoutMs(busy), () => void expireBusy($, busy, since))
  } catch {
    // busyNow() still treats it as over after the timeout.
  }
}

async function expireBusy($: EngineInterface, busy: Exclude<Busy, null>, since: number): Promise<void> {
  const ui = await attempt(() => read($, uiAtom), null)
  if (!ui || ui.busy !== busy || ui.busySince !== since) return
  const now = await $.clock.now()
  // The clear waits for the turn to end and can still land: the hand-off stays
  // for the conversation it creates, within 10 minutes of the save.
  const line =
    busy === 'fresh-clear' ? 'Start fresh clears when the current turn ends.' : busy === 'dashboard' ? DASHBOARD_FAILED : `${BUSY_WORDS[busy]} timed out.`
  await setUi($, u => withNote(withBusy(u, null, now), line, now))
  // The dashboard link fails by its note alone.
  if (busy !== 'dashboard') toast($, line)
}

/** Deletes the held hand-off, store first; true only when the delete succeeded (the mirror follows it). */
async function dropHandoff($: EngineInterface): Promise<boolean> {
  try {
    await $.store.delete(HANDOFF_KEY)
  } catch {
    return false
  }
  await attempt(() => update($, handoffAtom, () => null), undefined)
  return true
}

async function isTurnRunning($: EngineInterface): Promise<boolean> {
  const clock = await attempt(() => read($, clockAtom), null)
  return Boolean(clock?.working)
}

/** Clean up: compaction with Token Optimizer's own PreCompact guidance, run outside the press. */
async function cleanUp($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  const ui = (await attempt(() => read($, uiAtom), null)) ?? initialUi()
  if (busyNow(ui, now) !== null) return
  await disarm($)
  const running = await runningCall($)
  if (running) {
    toast($, stillRunning(running))
    return
  }
  if (await isTurnRunning($)) {
    toast($, 'Clean up waits until the turn finishes.')
    return
  }
  await setUi($, u => withBusy(u, 'clean', now))
  armBusyTimeout($, 'clean', now)
  $.clock.after(0, () => void attempt(() => runCompact($, now), undefined))
}

async function runCompact($: EngineInterface, since: number): Promise<void> {
  // A turn that started since the press would be cut short.
  if (await isTurnRunning($)) {
    const ui = await attempt(() => read($, uiAtom), null)
    if (!ui || ui.busy !== 'clean' || ui.busySince !== since) return
    const now = await $.clock.now()
    await setUi($, u => withBusy(u, null, now))
    toast($, 'Clean up waits until the turn finishes.')
    return
  }
  const running = await runningCall($)
  if (running || engineCall) {
    const ui = await attempt(() => read($, uiAtom), null)
    if (!ui || ui.busy !== 'clean' || ui.busySince !== since) return
    const now = await $.clock.now()
    await setUi($, u => withBusy(u, null, now))
    toast($, stillRunning(running ?? engineCall ?? 'compact'))
    return
  }
  /** The note when no compaction can be confirmed; null after a confirmed one. */
  let skip: string | null = null
  const skipped = (reason: string) => `Clean up skipped: ${reason.replace(/\.$/, '')}.`
  // Claimed with no await between the check and the claim; recorded before the call.
  const mine = await claimCall($, 'compact')
  if (!mine) {
    skip = skipped('it could not be recorded')
  } else {
    try {
      // The command, as if typed: $.session.compact() is refused in a headless
      // session, and the desktop app runs its sessions headless.
      // Success is decided from evidence, never from the reply's words (#207):
      // Claude Code answers a refused /compact ("Not enough messages to compact.",
      // a hook's veto) without throwing, and a reply may be empty or not English.
      const landedBefore = compactionsLanded
      const tokensBefore = liveTokens(await attempt(() => $.session.usage(), null))
      const answer = await $.command.run({ command: 'compact' })
      const tokensAfter = liveTokens(await attempt(() => $.session.usage(), null))
      const outcome = cleanUpOutcome({
        landed: compactionsLanded > landedBefore,
        tokensBefore,
        tokensAfter,
        said: answer?.text ?? '',
      })
      if (!outcome.ok) skip = outcome.line
    } catch (error) {
      skip = skipped(error instanceof Error && error.message ? error.message.split('\n')[0] ?? 'it failed' : 'it failed')
    } finally {
      await releaseCall($, mine)
    }
  }
  const ui = await attempt(() => read($, uiAtom), null)
  // Timed out meanwhile, or another step took over: nothing to report here.
  if (!ui || ui.busy !== 'clean' || ui.busySince !== since) return
  const now = await $.clock.now()
  if (skip !== null) {
    const line = skip
    await setUi($, u => withNote(withBusy(u, null, now), line, now))
    toast($, line)
  } else {
    await setUi($, u => withNote(withBusy(u, null, now), 'Cleaned up.', now))
  }
  $.clock.after(0, () => void attempt(() => refresh($), undefined))
}

/** Keep warm: guarded at press time, one fork, never on a timer. */
async function keepWarm($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  await disarm($)
  const clock = (await attempt(() => read($, clockAtom), null)) ?? initialClock()
  if (warmInFlight || clock.warming) {
    toast($, 'A warm-up is already running.')
    return
  }
  if (!canKeepWarm(clock, now)) {
    toast($, clock.working || (await isTurnRunning($)) ? 'Keep warm waits until the turn finishes.' : 'The cache is too close to dropping to keep it warm.')
    return
  }
  warmInFlight = true
  const gen = sessionGen
  await feedClock($, { type: 'warm-start' }, now)
  $.clock.after(0, () => void attempt(() => runWarm($, clock.contextTokens, gen), undefined))
}

type ForkReply = Awaited<ReturnType<EngineInterface['model']['fork']>>

/** The warm-up fork, or null once `ms` pass without an answer; a late answer is then ignored. */
function forkWithin($: EngineInterface, ms: number): Promise<ForkReply | null> {
  return new Promise<ForkReply | null>((resolve, reject) => {
    let timer: { cancel: () => void } | null = null
    try {
      timer = $.clock.after(ms, () => resolve(null))
    } catch {
      // No timer: the fork alone decides.
    }
    $.model.fork({ prompt: WARM_PROMPT }).then(
      reply => {
        timer?.cancel()
        resolve(reply)
      },
      error => {
        timer?.cancel()
        reject(error)
      },
    )
  })
}

async function runWarm($: EngineInterface, known: number | null, gen: number): Promise<void> {
  try {
    const session = await attempt(() => read($, sessionAtom), null)
    // A recorded 0 is no size at all: fall back to the session's own.
    const contextTokens = known || session?.contextTokens || 0
    const reply = await forkWithin($, BUSY_TIMEOUT_MS)
    // Cleared meanwhile: this warm-up says nothing about the new session.
    if (gen !== sessionGen) return
    const at = await $.clock.now()
    if (reply === null) {
      await feedClock($, { type: 'warm-failed' })
      toast($, warmToast({ ok: false, reason: 'the request failed' }))
    } else if (reply.isAnswered) {
      await feedClock($, { type: 'warm-done', at, cacheReadTokens: reply.usage.cache_read_input_tokens, contextTokens })
      const after = await attempt(() => read($, clockAtom), null)
      const line = warmToast({
        ok: true,
        lapsed: Boolean(after?.lapsed),
        contextTokens,
        cacheRead: reply.usage.cache_read_input_tokens,
        lifetimeS: view(after ?? initialClock(), at, planDefault(session)).lifetime,
      })
      toast($, line)
      // Also in the sentence for a few seconds, where the eye already is.
      await setUi($, u => withNote(u, line, at))
    } else {
      await feedClock($, { type: 'warm-failed' })
      toast($, warmToast({ ok: false, reason: reply.reason }))
    }
  } catch {
    if (gen !== sessionGen) return
    await feedClock($, { type: 'warm-failed' })
    toast($, warmToast({ ok: false, reason: 'the request failed' }))
  } finally {
    warmInFlight = false
  }
}

/**
 * "Full dashboard": the dashboard command (it regenerates the page and opens it in the
 * browser, whatever the OS opener is) through the runner Start fresh uses. A click while
 * anything is busy is ignored; a failure is a note for NOTE_MS and nothing else.
 */
async function openDashboard($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  const ui = (await attempt(() => read($, uiAtom), null)) ?? initialUi()
  if (!canOpenDashboard(ui, now)) return
  await setUi($, u => withBusy(u, 'dashboard', now))
  armBusyTimeout($, 'dashboard', now)
  $.clock.after(0, () => void attempt(() => runDashboard($, now), undefined))
}

async function runDashboard($: EngineInterface, since: number): Promise<void> {
  const io = dataIo($)
  const root = await attempt(async () => findTokenOptimizerRoot(io, await readHome(io)), null)
  const result = root ? await attempt(() => runMeasure(io, root, DASHBOARD_ARGS, { timeoutMs: DASHBOARD_TIMEOUT_MS }), null) : null
  const ui = await attempt(() => read($, uiAtom), null)
  // Timed out meanwhile, or another step took over: the person was told already.
  if (!ui || ui.busy !== 'dashboard' || ui.busySince !== since) return
  const now = await $.clock.now()
  const failed = dashboardFailed(result)
  await setUi($, u => (failed ? withNote(withBusy(u, null, now), DASHBOARD_FAILED, now) : withBusy(u, null, now)))
}

/** Start fresh: first press arms, a second within 5 s runs it. */
async function startFresh($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  const ui = (await attempt(() => read($, uiAtom), null)) ?? initialUi()
  if (busyNow(ui, now) !== null) return
  if (!isArmed(ui, now)) {
    await setUi($, u => ({ ...u, freshArmedAt: now }))
    return
  }
  const running = await runningCall($)
  if (running) {
    await disarm($)
    toast($, stillRunning(running))
    return
  }
  if (await isTurnRunning($)) {
    await disarm($)
    toast($, 'Start fresh waits until the turn finishes.')
    return
  }
  const sid = cleanId(await attempt(() => $.session.id(), ''))
  if (!sid) {
    await disarm($)
    toast($, 'Start fresh stopped: no session to save. Nothing was cleared.')
    return
  }
  const gen = sessionGen
  await setUi($, u => withBusy(u, 'fresh-capture', now))
  armBusyTimeout($, 'fresh-capture', now)
  $.clock.after(0, () => void attempt(() => runFresh($, sid, now, gen), undefined))
}

/** Still the session Start fresh was pressed in: a typed /clear meanwhile means stand down. */
async function stillSession($: EngineInterface, sid: string, gen: number): Promise<boolean> {
  return gen === sessionGen && cleanId(await attempt(() => $.session.id(), '')) === sid
}

async function runFresh($: EngineInterface, sid: string, since: number, gen: number): Promise<void> {
  const io = dataIo($)
  const stop = async (reason: string): Promise<void> => {
    const ui = await attempt(() => read($, uiAtom), null)
    if (!ui || ui.busySince !== since) return
    const now = await $.clock.now()
    const line = `Start fresh stopped: ${reason}. Nothing was cleared.`
    await setUi($, u => withNote(withBusy(u, null, now), line, now))
    toast($, line)
  }

  const root = await findTokenOptimizerRoot(io, await readHome(io))
  if (!root) return stop('Token Optimizer was not found')
  const port: HandoffPort = {
    run: (args, stdin) =>
      runMeasure(io, root, args, {
        timeoutMs: args[0] === 'compact-capture' ? CAPTURE_TIMEOUT_MS : RESUME_TIMEOUT_MS,
        ...(stdin === undefined ? {} : { stdin }),
      }),
    read: path => io.read(path),
  }
  const cwd = await attempt(() => $.session.cwd(), '')
  // `now` is a placeholder: the hand-off is stamped once its save lands (below).
  const result = await prepareHandoff(port, { sessionId: sid, transcriptPath: transcriptFor(cleanId(sid)) ?? null, cwd, now: since })
  const standDown = async (): Promise<void> => {
    const now = await $.clock.now()
    await setUi($, u => (u.busySince === since ? withBusy(u, null, now) : u))
  }
  // The session changed under it (a typed /clear, a resume): clear nothing, and say so.
  const changed = async (): Promise<void> => {
    await standDown()
    toast($, 'Start fresh stopped: the session changed.')
  }
  if (!(await stillSession($, sid, gen))) return changed()
  const ui = await attempt(() => read($, uiAtom), null)
  // Timed out meanwhile: the person was told; clear nothing.
  if (!ui || ui.busy !== 'fresh-capture' || ui.busySince !== since) return
  if (!result.ok) return stop(result.reason)
  // Our compaction or clear still running: never overlap it.
  const running = await runningCall($)
  if (running) return stop(running === 'compact' ? 'the last clean-up is still running' : 'the last clear is still running')
  // A turn started during the capture: a queued clear would wipe it.
  if (await isTurnRunning($)) {
    await standDown()
    toast($, 'Start fresh waits until the turn finishes.')
    return
  }

  // Saved, then stamped from the clock right after the save lands: the
  // 10-minute window and "started since the save" both count from there.
  let handoff: Handoff
  try {
    // First kept with a stamp in the far future, so no session can count as "started
    // since the save" until the real stamp below lands.
    await $.store.set(HANDOFF_KEY, { ...result.handoff, createdAt: Number.MAX_SAFE_INTEGER, pendingSince: since })
  } catch {
    return stop('the hand-off could not be kept on disk')
  }
  try {
    handoff = { ...result.handoff, createdAt: await $.clock.now() }
    await $.store.set(HANDOFF_KEY, handoff)
  } catch {
    await dropHandoff($)
    return stop('the hand-off could not be kept on disk')
  }
  try {
    await update($, handoffAtom, () => handoff)
  } catch {
    // The new session would never see it.
    await dropHandoff($)
    return stop('the hand-off could not be kept on disk')
  }
  if (!(await stillSession($, sid, gen))) {
    await dropHandoff($)
    return changed()
  }
  const now = await $.clock.now()
  await setUi($, u => withBusy(u, 'fresh-clear', now))
  armBusyTimeout($, 'fresh-clear', now)
  $.clock.after(0, () => void attempt(() => runClear($, now, handoff, sid, gen), undefined))
}

async function runClear($: EngineInterface, since: number, handoff: Handoff, sid: string, gen: number): Promise<void> {
  const ours = (h: Handoff | null) => h !== null && h.fromSessionId === handoff.fromSessionId && h.createdAt === handoff.createdAt
  const fail = async (line: string): Promise<void> => {
    const held = await attempt(() => read($, handoffAtom), null)
    if (ours(held)) await dropHandoff($)
    const now = await $.clock.now()
    await setUi($, u => withNote(u.busy === 'fresh-clear' && u.busySince === since ? withBusy(u, null, now) : u, line, now))
    toast($, line)
  }
  // The session changed while the clear waited its turn: clear nothing.
  if (gen !== sessionGen || cleanId(await attempt(() => $.session.id(), '')) !== sid) {
    const held = await attempt(() => read($, handoffAtom), null)
    if (ours(held)) await dropHandoff($)
    const now = await $.clock.now()
    await setUi($, u => (u.busy === 'fresh-clear' && u.busySince === since ? withBusy(u, null, now) : u))
    toast($, 'Start fresh stopped: the session changed.')
    return
  }
  const running = await runningCall($)
  if (running || engineCall) return fail(`Start fresh stopped: ${(running ?? engineCall) === 'compact' ? 'the last clean-up is still running' : 'the last clear is still running'}. Nothing was cleared.`)
  // Claimed with no await between the check and the claim; recorded before the call.
  const mine = await claimCall($, 'clear')
  if (!mine) return fail('Start fresh could not clear. Your conversation is unchanged.')
  let cleared = false
  try {
    await $.command.run({ command: 'clear' })
    cleared = true
  } catch {
    // Reported below, once the call has settled.
  } finally {
    await releaseCall($, mine)
  }
  if (!cleared) return fail('Start fresh could not clear. Your conversation is unchanged.')
  // The hand-off now waits for the first prompt of a conversation started since the save.
  const now = await $.clock.now()
  await setUi($, u => (u.busy === 'fresh-clear' && u.busySince === since ? withBusy(u, null, now) : u))
}

/**
 * The user's band size: a stored click first, else the env default. The store
 * is read off the render path (a store read can be slow) and kept in module
 * state; a press made meanwhile always wins (it set sizeClicked itself).
 */
function bandSize(): BandSize {
  return sizeClicked ?? sizeEnvDefault
}

/** One store read for the size, fired off the render path; a found size redraws once when it differs. */
async function readSize($: EngineInterface): Promise<void> {
  if (sizeRead || sizeClicked !== null) return
  try {
    const stored = await $.store.get(SIZE_KEY)
    sizeRead = true
    const found = storedSize(stored)
    if (sizeClicked === null) {
      sizeClicked = found
      // A stored size that differs from what was drawn earns one redraw.
      if (found !== null && found !== sizeEnvDefault) await attempt(() => update($, frameAtom, n => (n ?? 0) + 1), undefined)
    }
  } catch {
    // Store unreadable for now: the env default serves; a later readSize call retries.
  }
}

/** The size button: flips the band and remembers the choice. A refused write just does not persist. */
async function toggleSize($: EngineInterface): Promise<void> {
  await disarm($)
  const next: BandSize = bandSize() === 'slim' ? 'full' : 'slim'
  sizeClicked = next
  await attempt(() => $.store.set(SIZE_KEY, next), undefined)
  await attempt(() => update($, frameAtom, n => (n ?? 0) + 1), undefined)
}

async function toggleDetails($: EngineInterface): Promise<void> {
  await disarm($)
  await flushTools($)
  const current = await attempt(() => read($, sessionAtom), null)
  if (!current) return
  const opening = !current.sheetOpen
  await update($, sessionAtom, cur => (cur ? { ...cur, sheetOpen: !cur.sheetOpen } : cur))
  // Savings read when the row opens.
  if (opening) $.clock.after(0, () => void attempt(() => refresh($, { savings: true }), undefined))
}

async function act($: EngineInterface, id: ActionId | 'dashboard'): Promise<void> {
  // One press at a time: the claim is taken before the first await, so a second press
  // arriving while this one reads the clock sees it (an unread time counts as now).
  const prior = claim
  if (prior !== null && prior.at === Number.POSITIVE_INFINITY) return
  const mine = { at: Number.POSITIVE_INFINITY }
  claim = mine
  const now = await attempt(() => $.clock.now(), 0)
  if (prior !== null && now - prior.at < BUSY_TIMEOUT_MS) {
    if (claim === mine) claim = prior
    return
  }
  mine.at = now
  try {
    if (id === 'clean' || id === 'clean-first') await cleanUp($)
    else if (id === 'dashboard') await openDashboard($)
    else if (id === 'fresh') await startFresh($)
    else await keepWarm($)
  } catch {
    toast($, 'That did not work. Try again in a moment.')
  } finally {
    if (claim === mine) claim = null
  }
}

// ---- drawing ----

/**
 * The desktop gives the band no light/dark signal (the config's theme is the
 * terminal's), so the marks and icons follow the app's own appearance through their
 * colour-scheme query; the drawn colours are the light ones, the fallback.
 * Classes: k = ink stroke, kf = ink fill, t = track stroke, tf = track fill.
 */
const DARK_STYLE = '<style>@media (prefers-color-scheme: dark){.k{stroke:#f3f1ea}.kf{fill:#f3f1ea}.t{stroke:#4b4a46}.tf{fill:#4b4a46}}</style>'

function themed(svg: string, rootClass?: string): string {
  const open = svg.indexOf('>') + 1
  const head = rootClass ? svg.slice(0, open - 1).replace('<svg ', `<svg class="${rootClass}" `) + '>' : svg.slice(0, open)
  return head + DARK_STYLE + svg.slice(open)
}

const esc = (v: string): string => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * A mark as the crab draws a bar: a rounded track, filled in the tone's colour. A cold cache is
 * a dashed outline instead of a fill; a grade is a rounded badge. Colour lives here, the text stays ink.
 */
const MARK_W = 18
const MARK_H = 16
const BADGE_W = 16
const TRACK_STYLE = '<style>.tk{fill:#e4e4e2}@media (prefers-color-scheme: dark){.tk{fill:#2c2c2c}}</style>'

const markWidth = (mark: Mark): number => (mark.badge !== undefined ? BADGE_W : MARK_W)

function markSvg(mark: Mark, t: Tones): string {
  const color = toneColor(mark.tone, t)
  const w = markWidth(mark)
  const p = Math.max(0, Math.min(100, mark.ringPercent ?? 0))
  const fillW = p > 0 ? Math.max(8, Math.round((MARK_W * p) / 100)) : 0
  const body =
    mark.badge !== undefined
      ? `<rect class="${mark.tone === 'none' ? 'tk' : ''}" x="0" y="0" width="${BADGE_W}" height="${MARK_H}" rx="4" fill="${mark.tone === 'none' ? t.track : color}"/>` +
        `<text x="${BADGE_W / 2}" y="12" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="${t.card}">${esc(mark.badge)}</text>`
      : mark.tone === 'cold'
        ? `<rect x="1" y="4" width="${MARK_W - 2}" height="8" rx="4" fill="none" stroke="${color}" stroke-width="1.6" stroke-dasharray="3 3"/>`
        : `<rect class="tk" x="0" y="3" width="${MARK_W}" height="10" rx="5"/>` +
          (fillW > 0 ? `<rect x="0" y="3" width="${fillW}" height="10" rx="5" fill="${color}"/>` : '')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${MARK_H}" viewBox="0 0 ${w} ${MARK_H}" role="img" aria-label="${esc(mark.alt)}"><title>${esc(mark.alt)}</title>${TRACK_STYLE}${body}</svg>`
}

function toneColor(tone: MarkTone, t: Tones): string {
  return tone === 'none' ? t.track : t[tone]
}

function runsOf(D: Desktop, runs: Run[], t: Tones) {
  const { Text } = D
  return runs.map(r => (r.lose ? <Text bold color={t.bad}>{r.text}</Text> : r.strong ? <Text bold>{r.text}</Text> : r.text))
}

function icon(D: Desktop, name: IconName, color: string, alt?: string) {
  const { Svg } = D
  const label = alt ?? ICON_ALT[name]
  const svg = iconSvg(name, color, { alt: label })
  return <Svg source={color === LIGHT.ink ? themed(svg, 'k') : svg} alt={label} width={16} height={16} />
}

type Model = {
  snap: Snapshot
  tones: Tones
  sheetOpen: boolean
  savingsReason: string | null
  /** Keep warm can run now (the one guard): only then does the row offer it. */
  canWarm: boolean
}

/** Below this, "saved this session" is noise and stays off the row. */
const SESSION_SAVED_MIN = 1000

type Handlers = { act: (id: ActionId) => void; dashboard: () => void; details: () => void; size: () => void }


/** The five marks with their hover cards: one line, never wrapped, in both sizes. */
function markRow(D: Desktop, markList: Mark[], cardList: Card[], t: Tones, on: Handlers) {
  const { Box, Text, Svg } = D
  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={2} rowGap={1}>
      {markList.map((mark, i) => (
        <Box key={`mark-${mark.id}`} position="relative" flexDirection="row" alignItems="center" columnGap={1}>
          <Svg source={markSvg(mark, t)} alt={mark.alt} width={markWidth(mark)} height={MARK_H} />
          <Text bold>{mark.value}</Text>
          {/* Always labelled: without the word, nobody knows which number is which. */}
          <Text>{mark.label}</Text>
          {(() => {
            // Matched by id, not position: a missing limit never shifts a card under the wrong mark.
            const card = cardList.find(c => c.id === mark.id)
            return card ? cardBox(D, card, i, t, on) : ''
          })()}
        </Box>
      ))}
    </Box>
  )
}

function cardBox(D: Desktop, card: Card, index: number, t: Tones, on: Handlers) {
  const { Box, Text, Button } = D
  const side = index < 2 ? { left: 0 } : { right: 0 }
  return (
    <Box
      position="absolute"
      bottom={1}
      {...side}
      display="none"
      hover={{ display: 'flex' }}
      flexDirection="column"
      width={34}
      paddingX={1}
      borderStyle="round"
      borderColor={t.line}
      backgroundColor={t.card}
    >
      <Text bold>{card.title}</Text>
      <Text wrap="wrap">{runsOf(D, card.body, t)}</Text>
      {card.actions.length > 0 ? (
        <Box flexDirection="row" columnGap={1} marginTop={1}>
          {card.actions.map(a => (
            <Button key={`card-${card.id}-${a.id}`} label={a.label} onPress={() => on.act(a.id)} />
          ))}
        </Box>
      ) : (
        ''
      )}
    </Box>
  )
}

/** The unfolded row, shared by both sizes: the facts, any card action the moment calls for, the savings. */
function detailRow(D: Desktop, m: Model, on: Handlers, size: BandSize) {
  const { Box, Text, Button } = D
  const { snap, tones: t } = m
  const say = sentence(snap)
  const cardList = cards(snap)
  const detail = row(snap)
  // A card action joins the row only when the moment calls for it (quality sagging, the cache
  // about to drop) and the sentence's own button is not already offering it.
  const q = snap.quality
  const sagging = q !== null && (q.score < QUALITY_FLOOR || q.compactions >= COMPACT_HEAVY)
  const rowActions = [
    ...(sagging ? cardList.find(c => c.id === 'quality')?.actions ?? [] : []),
    ...(m.canWarm && snap.cache.state === 'warning' ? [{ id: 'warm' as const, label: 'Keep warm' }] : []),
  ].filter(a => a.id !== say.action?.id && !(a.id === 'clean' && say.action?.id === 'clean-first'))

  // Said plainly: a bare "47M past 30 days" reads like tokens spent, and a 30-bar chart
  // ruled by one big day said nothing. The total is the dashboard's own.
  const sessionSaved = (detail.savings.sessionTokens ?? 0) >= SESSION_SAVED_MIN
  // No figure yet: say why (or that it is being measured), never "Saved -- tokens".
  const savingsBlock =
    detail.savings.last30Tokens == null ? (
      <Box flexDirection="row" alignItems="center" columnGap={1}>
        {icon(D, 'saved', t.ink)}
        <Text>{detail.savings.state === 'loading' ? 'Measuring savings…' : (m.savingsReason ?? detail.savings.reason ?? 'Savings appear once Token Optimizer has measured some.')}</Text>
      </Box>
    ) : (
      <Box flexDirection="row" alignItems="center" columnGap={1}>
        {icon(D, 'saved', t.good)}
        <Text>
          Saved <Text bold>{detail.savings.last30Text}</Text> tokens in 30 days
          {sessionSaved ? (
            <Text>
              {' '}(<Text bold>{detail.savings.sessionText}</Text> this session)
            </Text>
          ) : (
            ''
          )}
        </Text>
      </Box>
    )

  // The end of the row: a plain text link (a Button drawn without chrome, the only thing the
  // desktop lets be pressed), its label its accessible name. The slim band has no sentence
  // line to carry "Opening the dashboard.", so there the status stands beside the link.
  const status = size === 'slim' ? dashboardStatus(snap.busy, snap.note) : null
  const dashboardLink = (
    <Box flexDirection="row" alignItems="center" columnGap={1}>
      {status !== null ? (
        <Box key="dashboard-status">
          <Text>{status}</Text>
        </Box>
      ) : (
        ''
      )}
      <Button key="dashboard" plain label="Full dashboard" onPress={() => on.dashboard()} />
    </Box>
  )

  return (
    <Box key="row" flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="space-between" columnGap={2} rowGap={1}>
      <Box flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={2} rowGap={1}>
        {detail.facts.map(f => (
          <Box flexDirection="row" alignItems="center" columnGap={1}>
            {icon(D, f.icon, t.ink)}
            <Text>{runsOf(D, f.runs, t)}</Text>
          </Box>
        ))}
        {rowActions.length > 0 ? (
          <Box flexDirection="row" alignItems="center" columnGap={1}>
            {rowActions.map(a => (
              <Button key={`row-${a.id}`} label={a.label} onPress={() => on.act(a.id)} />
            ))}
          </Box>
        ) : (
          ''
        )}
      </Box>
      <Box flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={2} rowGap={1}>
        {savingsBlock}
        {dashboardLink}
      </Box>
    </Box>
  )
}

/** The unfold arrow and the size button, together at the end of the marks line. */
function controls(D: Desktop, m: Model, on: Handlers, size: BandSize) {
  const { Box, Button } = D
  return (
    <Box flexDirection="row" columnGap={1} flexShrink={0}>
      {/* Only a Button can be pressed, and its label is text, so the arrow opens the detail row. */}
      <Button key="details" label={m.sheetOpen ? '▴' : '▾'} onPress={() => on.details()} />
      {/* One line instead of two: vertical space is at a premium. */}
      <Button key="size" label={size === 'slim' ? '+' : '–'} onPress={() => on.size()} />
    </Box>
  )
}

/** The full band: what matters now (one sentence, at most one button), the five marks, the detail row when open. */
function drawBand(D: Desktop, m: Model, on: Handlers) {
  const { Box, Text, Button } = D
  const { snap, tones: t } = m
  const say = sentence(snap)
  return (
    // Keyed: the whole band is one hover zone (the desktop reveals within a keyed Box).
    <Box key="band" flexDirection="column" paddingX={1} rowGap={1}>
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" columnGap={2}>
        <Box flexDirection="row" alignItems="center" columnGap={1} flexShrink={1}>
          <Text bold>Token Optimizer</Text>
          {icon(D, say.icon, toneColor(say.tone, t))}
          <Text wrap="wrap">{runsOf(D, say.runs, t)}</Text>
        </Box>
        <Box flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
          {say.action ? <Button key="action" variant="primary" label={say.action.label} onPress={() => on.act(say.action!.id)} /> : ''}
          {controls(D, m, on, 'full')}
        </Box>
      </Box>
      {/* Its own line, with room: the marks wrap before they ever overlap. */}
      {markRow(D, marks(snap), cards(snap), t, on)}
      {m.sheetOpen ? detailRow(D, m, on, 'full') : ''}
    </Box>
  )
}

/** The slim band: the marks on one line with the arrow and +, what the sentence earns on the right, the detail row when open. */
function drawSlim(D: Desktop, m: Model, on: Handlers) {
  const { Box, Text, Button } = D
  const { snap, tones: t } = m
  const side = slimSide(sentence(snap))
  return (
    <Box key="band" flexDirection="column" paddingX={1} rowGap={1}>
      <Box flexDirection="row" flexWrap="nowrap" alignItems="center" columnGap={2}>
        {controls(D, m, on, 'slim')}
        <Box flexGrow={1} flexShrink={1}>
          {markRow(D, marks(snap), cards(snap), t, on)}
        </Box>
        {side.kind === 'action' ? (
          <Box flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
            {icon(D, side.icon, toneColor(side.tone, t))}
            <Button key="action" variant="primary" label={side.action.label} onPress={() => on.act(side.action!.id)} />
          </Box>
        ) : side.kind === 'warn' ? (
          <Box flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
            {icon(D, side.icon, toneColor(side.tone, t))}
            <Text>{runsOf(D, side.runs, t)}</Text>
          </Box>
        ) : (
          ''
        )}
      </Box>
      {m.sheetOpen ? detailRow(D, m, on, 'slim') : ''}
    </Box>
  )
}

/** The band's side of a finished turn: the clock, and the refreshes after it. */
async function endTurn($: EngineInterface, agentId: string | undefined): Promise<void> {
  try {
    if (agentId !== undefined) {
      return
    }
    activityAt = Date.now()
    await flushTools($)
    await feedClock($, { type: 'working-changed', working: false })
    // Quality after each turn now; savings and the clock facts a little later.
    $.clock.after(0, () => void attempt(() => refresh($), undefined))
    statusTimer?.cancel()
    statusTimer = $.clock.after(STATUS_AFTER_TURN_MS, () => void attempt(() => refresh($, { savings: true }), undefined))
  } catch {
    // The band never breaks the turn it watched.
  }
}

/** Set to 0, false, off or no, a Token Optimizer switch turns its feature off. */
function switchedOff(value: string | undefined): boolean {
  return /^(0|false|off|no)$/i.test((value ?? '').trim())
}

/** Reads the CRAB_OPTIMIZER_BAR switches once per environment. */
async function readSwitches($: EngineInterface): Promise<void> {
  if (switchesRead) return
  switchesRead = true
  if (switchedOff(await attempt(() => $.env.get('CRAB_OPTIMIZER_BAR'), undefined))) enabled = false
  sizeEnvDefault = envSize(await attempt(() => $.env.get('CRAB_OPTIMIZER_BAR_SIZE'), undefined))
}

/**
 * Reads the switches after the band is live (a wait before that would drop a
 * turn ending meanwhile) and, when switched off, stops it: no timers, no drawing.
 */
async function applySwitches($: EngineInterface): Promise<void> {
  await readSwitches($)
  if (enabled) return
  active = false
  for (const t of timers) t.cancel()
  timers = []
  statusTimer?.cancel()
  statusTimer = null
}

// ---- hooks ----

// A matcher that matches every event: two matcherless hooks on one event are refused, so ours carries one.
const ANY = /./
const ANY_TEXT = /^[\s\S]*$/

export const registerOptimizer: Register = on => {
  enabled = true
  // The store is re-read (the durable choice survives); the env default stays as read.
  sizeClicked = null
  sizeRead = false

  on('session.start', { cwd: ANY_TEXT }, async ($, e, next) => {
    const result = await next(e)
    active = enabled && e.isInteractive && e.surface !== 'terminal' && e.surface !== 'vscode'
    // Off the start event: reading figures and a git branch must not hold a session switch.
    if (active) $.clock.after(0, () => void attempt(() => start($), undefined))
    return result
  })

  // A clear: no session.start follows; this start carries the new id.
  on('classic.SessionStart', { session_id: ANY }, async ($, e, next) => {
    const result = await next(e)
    noteTranscript(e.session_id, e.transcript_path)
    if (!active || e.source !== 'clear') return result
    // Work begun in the old session drops its result from here on.
    sessionGen += 1
    toolsPending = 0
    const sid = cleanId(e.session_id)
    // The new conversation's own start, never this event's arrival; unknown
    // means nothing is attached or announced until a prompt can read it.
    const startedAt = await sessionStartedAt($)
    await feedClock($, { type: 'clear' })
    // Every step, note and Start fresh arm belonged to the old session.
    await setUi($, () => initialUi())
    const held = await heldHandoff($)
    const handoff = held ? await handoffThatFits($, held, { sessionId: sid, startedAt }) : null
    // Both reads run off this event: a clear must not wait on git or the status command.
    const clearedSid = e.session_id
    const clearedPath = e.transcript_path || undefined
    await later($, async () => {
      await refresh($, { sessionId: clearedSid, reset: true, transcript: clearedPath })
      await refresh($, { sessionId: clearedSid, savings: true, transcript: clearedPath })
    })
    // The held hand-off replaces Token Optimizer's cross-session pointer.
    if (handoff && result.additionalContext) {
      return { ...result, additionalContext: stripCrossSessionPointer(result.additionalContext) ?? [] }
    }
    return result
  })

  // The hand-off joins the first prompt the person sends, once.
  on('prompt.submit', { text: ANY_TEXT }, async ($, e, next) => {
    if (!active || !attachesHandoff(e.origin?.kind) || takingHandoff) return next(e)
    // One prompt at a time takes it here, even if two are submitted at once.
    takingHandoff = true
    let handoff: Handoff | null = null
    try {
      const held = await heldHandoff($)
      handoff = held ? await handoffThatFits($, held) : null
      // Taken only once it is deleted: a failed delete attaches nothing.
      if (handoff && !(await dropHandoff($))) handoff = null
    } finally {
      takingHandoff = false
    }
    if (!handoff) return next(e)
    try {
      return await next({ ...e, context: [...(e.context ?? []), handoff.text] })
    } catch (error) {
      // Not accepted: the hand-off waits for the next prompt.
      const kept = await attempt(async () => {
        await $.store.set(HANDOFF_KEY, handoff)
        return true
      }, false)
      if (kept) await attempt(() => update($, handoffAtom, () => handoff), undefined)
      else toast($, `Start fresh's hand-off could not be kept. The checkpoint is still at ${handoff.checkpointPath}.`)
      throw error
    }
  })

  // compact-capture wants the transcript; these classic events carry its path.
  on('classic.UserPromptSubmit', ($, e, next) => {
    noteTranscript(e.session_id, e.transcript_path)
    return next(e)
  })
  on('classic.Stop', ($, e, next) => {
    noteTranscript(e.session_id, e.transcript_path)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (active) {
      activityAt = Date.now()
      await feedClock($, { type: 'working-changed', working: true })
    }
    return next(e)
  })

  // Per-request usage lives on each step's stop chunk; turn.complete's is summed.
  on('turn.step', { model: ANY }, async function* ($, e, next) {
    const stream = next(e)
    if (!active || e.agentId !== undefined) return yield* stream
    for (;;) {
      const step = await stream.next()
      if (step.done) return step.value
      const chunk = step.value
      if (chunk.kind === 'stop' && chunk.usage) {
        try {
          const at = await $.clock.now()
          await feedClock($, { type: 'request-done', at, lifetime: lifetimeFromUsage(chunk.usage), contextTokens: requestContextTokens(chunk.usage) })
        } catch {
          // Watching the stream never breaks it.
        }
      }
      yield chunk
    }
  })

  // Counted in memory: a write per call would redraw the band several times a second.
  on('tool.call', { tool: ANY }, async ($, e, next) => {
    if (active && e.agentId === undefined) {
      toolsPending += 1
      activityAt = Date.now()
    }
    return next(e)
  })

  on('session.compact', async ($, e, next) => {
    if (!active || e.trigger === 'precompute' || e.agentId !== undefined) return next(e)
    const before = await attempt(async () => {
      const cur = await read($, sessionAtom)
      return Math.max(cur?.compactionsSeen ?? 0, cur?.quality?.compactions ?? 0)
    }, 0)
    try {
      const result = await next(e)
      // The band watched this one land: count it now, before Claude Code writes its
      // marker to the transcript (it does so late) and before Token Optimizer re-reads.
      if (!('skip' in result && result.skip)) {
        compactionsLanded += 1
        await attempt(
          () =>
            update($, sessionAtom, cur =>
              cur
                ? {
                    ...cur,
                    // Counted from what was known BEFORE it ran: Token Optimizer's own +1 may already be in.
                    compactionsSeen: Math.max(cur.compactionsSeen ?? 0, before + 1),
                  }
                : cur,
            ),
          undefined,
        )
      }
      return result
    } finally {
      // Any compaction (button, typed /compact, automatic): Token Optimizer saved a checkpoint
      // before it, so re-read everything now and again once its after-compact hooks have written.
      $.clock.after(0, () => void attempt(() => refresh($, { savings: true }), undefined))
      $.clock.after(STATUS_AFTER_TURN_MS, () => void attempt(() => refresh($, { savings: true }), undefined))
    }
  })

  on('turn.complete', { turnId: ANY }, async ($, e, next) => {
    // The turn is over even when a hook beneath rejects: the band says so either way.
    try {
      return await next(e)
    } finally {
      if (active) await endTurn($, e.agentId)
    }
  })

  // Registered last in the crab's register, so the crab's progress row (which calls next) draws
  // this band beneath it, one look; whatever is beneath this goes below it.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const band = await optimizerBand($, e)
    if (band === null) return next(e)
    const beneath = await attempt(() => next(e), null)
    if (beneath === null || beneath.type === 'engine') return band
    const D = $.ui.resolve(e)
    return (
      <D.Box flexDirection="column" rowGap={1}>
        {band}
        {beneath}
      </D.Box>
    )
  })
}

type AboveEvent = Parameters<EngineInterface['ui']['resolve']>[0] & { surface: string; props: { hasSurvey?: boolean; isWorking?: boolean } }

/**
 * The Token Optimizer rows for the crab band: null when this is not the desktop, a survey holds
 * the band, or the band is switched off. The crab draws the progress row above and anything
 * beneath it below; this is the middle.
 */
async function optimizerBand($: EngineInterface, e: AboveEvent) {
  if (!enabled || e.surface !== 'desktop' || e.props.hasSurvey) return null
  // The off switch is read here, off the start path (a wait there would drop a turn ending meanwhile).
  if (!switchesRead) {
    await applySwitches($)
    if (!enabled) return null
  }
  if (!active) {
    // A band without a session.start of ours (a late enable): start now, outside the drawing.
    active = true
    $.clock.after(0, () => void attempt(() => start($), undefined))
  }
  // The stored size is read off the render path; until it lands the env default draws.
  if (!sizeRead && sizeClicked === null) $.clock.after(0, () => void attempt(() => readSize($), undefined))

  // Every read fails soft: a hiccup in one value draws the band without it, never no band.
  await attempt(() => read($, frameAtom), 0)
  const now = await attempt(() => $.clock.now(), Date.now())
  const stored = await attempt(() => read($, sessionAtom), null)
  const clock = (await attempt(() => read($, clockAtom), null)) ?? initialClock()
  const ui = (await attempt(() => read($, uiAtom), null)) ?? initialUi()
  const handoff = await attempt(() => read($, handoffAtom), null)
  const liveSid = cleanId(await attempt(() => $.session.id(), ''))
  // A stored figure of another session never shows, nor its clock: a
  // resume with no session.start reads its own figures now.
  const otherSession = stored !== null && liveSid !== '' && stored.sessionId !== liveSid
  const s = otherSession ? null : stored
  if (otherSession && resyncFor !== liveSid) {
    resyncFor = liveSid
    $.clock.after(0, () => void attempt(() => refresh($, { savings: true }), undefined))
  }
  const working = e.props.isWorking
  // The rule the first prompt applies; dropping an expired one is left to that prompt.
  const ready = handoff !== null && handoffFate(handoff, { sessionId: liveSid, cwd: await attempt(() => $.session.cwd(), ''), startedAt: await sessionStartedAt($), now }) === 'attach'
  const shownClock = otherSession ? initialClock() : clock

  const snap: Snapshot = {
    now,
    working,
    quality: s?.quality ?? null,
    contextPercent: s?.contextPercent ?? (s?.contextWindowReduced ? null : s?.quality?.fillPct ?? null),
    contextTokens: s?.contextTokens ?? null,
    contextWindow: s?.contextWindow ?? null,
    contextModelWindow: s?.contextWindowReduced ? s?.contextModelWindow ?? null : null,
    fiveHour: s?.fiveHour ?? null,
    week: s?.week ?? null,
    cache: view({ ...shownClock, working }, now, planDefault(s)),
    branch: s?.branch ?? null,
    savings: s?.savings ?? null,
    savingsLoading: s?.savingsState === 'loading',
    busy: busyNow(ui, now) ?? (shownClock.warming ? 'warming' : null),
    note: noteNow(ui, now),
    handoffPending: ready,
    freshArmed: isArmed(ui, now),
    earlierCheckpoint: s?.earlierCheckpoint ?? null,
    checkpointEpoch: s?.checkpointEpoch ?? null,
    startedAtMs: s?.startedAtMs ?? null,
    toolCallsSeen: s?.toolCallsSeen ?? 0,
    compactionsSeen: s?.compactionsSeen ?? 0,
  }
  const model: Model = {
    snap,
    tones: tonesFor(LIGHT),
    sheetOpen: s?.sheetOpen ?? false,
    savingsReason: s?.savingsReason ?? null,
    canWarm: canKeepWarm({ ...shownClock, working }, now),
  }
  const handlers: Handlers = {
    act: id => void act($, id),
    dashboard: () => void act($, 'dashboard'),
    details: () => void toggleDetails($),
    size: () => void toggleSize($),
  }
  const D = $.ui.resolve(e)
  return bandSize() === 'slim' ? drawSlim(D, model, handlers) : drawBand(D, model, handlers)
}
