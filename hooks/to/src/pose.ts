// Clawd's pose as a pure reducer. A base pose derived from what is
// going on, plus short transient poses with holds. No I/O, no 'claude-code':
// register.tsx maps engine events onto PoseEvent and passes the time in.
import type { Pose } from './contracts.ts'

/** Working sub-pose changes wait this long to settle, so read/type bursts do not strobe. */
export const DEBOUNCE_MS = 900
/** A working sub-pose stays on screen at least this long before the next one replaces it. */
export const MIN_DWELL_MS = 1600
/** Idle this long (no events) and Clawd naps. Agent default (plan Assumptions). */
export const NAP_AFTER_MS = 10 * 60_000
/** How long each transient pose holds. */
export const HOLD_MS = { wake: 2000, done: 2500, stop: 2500, error: 4000 } as const

type Transient = keyof typeof HOLD_MS
type SubPose = 'think' | 'read' | 'type' | 'write' | 'lift'

export type PoseEvent =
  | { type: 'session-start' }
  | { type: 'turn-start' }
  | { type: 'working-changed'; working: boolean }
  | { type: 'thinking' }
  | { type: 'text' }
  | { type: 'tool-call'; tool: string; agentId?: string }
  | { type: 'tool-done'; agentId?: string }
  | { type: 'agent-spawn'; agentId: string; background: boolean }
  | { type: 'agent-done'; agentId: string }
  | { type: 'permission-open' }
  | { type: 'permission-closed' }
  | { type: 'question-open' }
  | { type: 'question-closed' }
  | { type: 'compact-start' }
  | { type: 'compact-end' }
  | { type: 'turn-complete'; reason: 'answer' | 'aborted' | 'refusal' | 'error'; agentId?: string }
  | { type: 'cache-cold-changed'; cold: boolean }
  | { type: 'tick'; now: number }

export type PoseState = {
  /** The pose on screen. */
  pose: Pose
  /** When the pose on screen last changed (ms). */
  since: number
  /** Last time the reducer saw (ms). */
  now: number
  working: boolean
  /** Latest main-thread working signal, before the debounce. */
  rawSub: SubPose | null
  /** When rawSub last changed. */
  rawSince: number
  /** The working sub-pose that has settled and may show. */
  sub: SubPose | null
  /** Running subagents by id; true = background (outlives the main turn). */
  agents: Readonly<Record<string, boolean>>
  permissions: number
  questions: number
  compacting: boolean
  cold: boolean
  /** Last non-tick, non-cache event (ms); napping counts from here. */
  lastActivity: number
  /** Transient hold deadlines (ms); 0 = not playing. */
  until: Readonly<Record<Transient, number>>
}

const READ_TOOLS = new Set(['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'NotebookRead', 'LS'])
const LIFT_TOOLS = new Set(['Task', 'Agent'])

/** Which pose a main-thread tool call shows. Unknown tools type. */
export function toolPose(tool: string): 'read' | 'type' | 'lift' {
  if (READ_TOOLS.has(tool)) return 'read'
  if (LIFT_TOOLS.has(tool)) return 'lift'
  return 'type'
}

const NO_TRANSIENTS: Record<Transient, number> = { wake: 0, done: 0, stop: 0, error: 0 }

export function initialPose(now: number): PoseState {
  return {
    pose: 'idle',
    since: now,
    now,
    working: false,
    rawSub: null,
    rawSince: now,
    sub: null,
    agents: {},
    permissions: 0,
    questions: 0,
    compacting: false,
    cold: false,
    lastActivity: now,
    until: NO_TRANSIENTS,
  }
}

/**
 * One step. `now` defaults to the tick's own time, or the last time seen for
 * other events; pass it explicitly when the caller knows when the event landed.
 */
export function reducePose(state: PoseState, event: PoseEvent, now?: number): PoseState {
  const t = now ?? (event.type === 'tick' ? event.now : state.now)
  let s: PoseState = { ...state, now: t }
  if (event.type !== 'tick' && event.type !== 'cache-cold-changed') s.lastActivity = t

  const setRaw = (sub: SubPose | null): void => {
    if (s.rawSub === sub) return
    s.rawSub = sub
    s.rawSince = t
  }
  const play = (tr: Transient): void => {
    // Dropped, not queued, while Clawd is asking for you.
    if (needsYou(s)) return
    s.until = { ...s.until, [tr]: t + HOLD_MS[tr] }
  }
  const dropAgent = (id: string): void => {
    if (!(id in s.agents)) return
    const rest = { ...s.agents }
    delete rest[id]
    s.agents = rest
  }

  switch (event.type) {
    case 'session-start':
      s = { ...initialPose(t), pose: s.pose, since: s.since, cold: s.cold }
      play('wake')
      break
    case 'turn-start':
      setRaw('think')
      break
    case 'working-changed':
      s.working = event.working
      if (event.working && s.rawSub === null) setRaw('think')
      if (!event.working) {
        setRaw(null)
        s.sub = null
      }
      break
    case 'thinking':
      setRaw('think')
      break
    case 'text':
      setRaw('write')
      break
    case 'tool-call':
      // Subagent events only feed heavy lifting, through spawn/done.
      if (event.agentId === undefined) setRaw(toolPose(event.tool))
      break
    case 'tool-done':
      if (event.agentId === undefined && s.rawSub === 'lift') setRaw('think')
      break
    case 'agent-spawn':
      s.agents = { ...s.agents, [event.agentId]: event.background }
      break
    case 'agent-done':
      dropAgent(event.agentId)
      break
    case 'permission-open':
      s.permissions += 1
      break
    case 'permission-closed':
      s.permissions = Math.max(0, s.permissions - 1)
      break
    case 'question-open':
      s.questions += 1
      break
    case 'question-closed':
      s.questions = Math.max(0, s.questions - 1)
      break
    case 'compact-start':
      s.compacting = true
      break
    case 'compact-end':
      s.compacting = false
      break
    case 'turn-complete':
      if (event.agentId !== undefined) {
        dropAgent(event.agentId)
        break
      }
      // Foreground agents end with the main turn; background ones keep lifting.
      s.agents = Object.fromEntries(Object.entries(s.agents).filter(([, bg]) => bg))
      setRaw(null)
      s.sub = null
      play(event.reason === 'error' ? 'error' : event.reason === 'aborted' ? 'stop' : 'done')
      break
    case 'cache-cold-changed':
      s.cold = event.cold
      break
    case 'tick':
      break
  }

  settle(s, t)
  const pose = derive(s, t)
  if (pose !== s.pose) {
    s.pose = pose
    s.since = t
  }
  return s
}

function needsYou(s: PoseState): boolean {
  return s.permissions > 0 || s.questions > 0
}

/** Debounce: the first sub-pose of a turn shows at once; later changes wait to settle. */
function settle(s: PoseState, t: number): void {
  if (s.rawSub === s.sub) return
  if (s.sub === null || (t - s.rawSince >= DEBOUNCE_MS && t - s.since >= MIN_DWELL_MS)) s.sub = s.rawSub
}

function playing(s: PoseState, tr: Transient, t: number): boolean {
  return s.until[tr] > t
}

/** Precedence: needs-you > dizzy > stopped > compacting > heavy lifting > working > done > wake > cold > napping > watching. */
function derive(s: PoseState, t: number): Pose {
  if (needsYou(s)) return 'ask'
  if (playing(s, 'error', t)) return 'error'
  if (playing(s, 'stop', t)) return 'stop'
  if (s.compacting) return 'compact'
  if (Object.keys(s.agents).length > 0) return 'lift'
  if (s.working) return s.sub ?? 'think'
  if (playing(s, 'done', t)) return 'done'
  if (playing(s, 'wake', t)) return 'wake'
  if (s.cold) return 'cold'
  if (t - s.lastActivity >= NAP_AFTER_MS) return 'sleep'
  return 'idle'
}
