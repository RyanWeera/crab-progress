// The cache clock as a pure state machine. The anchor is the last
// main-thread request; the deadline is anchor plus lifetime. Time is passed
// in; `canKeepWarm` is the single guard every Keep warm caller uses.
import type { CacheState, CacheView } from './contracts.ts'

/** Keep warm is refused this close to expiry. Agent default (plan Assumptions). */
export const KEEP_WARM_MARGIN_MS = 15_000
/** Lifetime the warning and cold rules use until a measurement lands. */
const UNMEASURED_RULE_SECONDS = 300
/** A warm-up that read less than this share of the context found the cache lapsed. */
const LAPSED_READ_SHARE = 0.5
/** Below this many tokens read, a warm-up of unknown context size found the cache gone. */
const LAPSED_FLOOR_TOKENS = 1024

export type Lifetime = '1h' | '5m'

export type ClockEvent =
  | { type: 'request-done'; at: number; lifetime: Lifetime | null; contextTokens: number }
  | { type: 'working-changed'; working: boolean }
  | { type: 'warm-start' }
  | { type: 'warm-done'; at: number; cacheReadTokens: number; contextTokens: number }
  | { type: 'warm-failed' }
  | { type: 'clear' }
  | { type: 'lifetime-measured'; lifetime: Lifetime }
  | { type: 'tick'; now: number }

export type ClockState = {
  /** Time of the last main-thread request (ms); null until one lands. */
  anchor: number | null
  /** Measured lifetime; null while unmeasured. */
  lifetime: Lifetime | null
  contextTokens: number | null
  working: boolean
  warming: boolean
  /** A warm-up found the cache lapsed; cold until a real request lands. */
  lapsed: boolean
}

export function initialClock(): ClockState {
  return { anchor: null, lifetime: null, contextTokens: null, working: false, warming: false, lapsed: false }
}

const seconds = (l: Lifetime): number => (l === '1h' ? 3600 : 300)

/**
 * One step. `now` matters only for `warm-start`, which re-checks the guard at
 * press time because a button handle can outlive the drawing that showed it.
 */
export function reduceClock(state: ClockState, event: ClockEvent, now?: number): ClockState {
  switch (event.type) {
    case 'request-done':
      // An older request than the anchor says nothing about the cache now.
      if (state.anchor !== null && event.at < state.anchor) return state
      return {
        ...state,
        anchor: event.at,
        lifetime: event.lifetime ?? state.lifetime,
        contextTokens: event.contextTokens,
        lapsed: false,
      }
    case 'working-changed':
      return { ...state, working: event.working }
    case 'warm-start':
      // No press time given: refuse rather than guess.
      return now !== undefined && canKeepWarm(state, now) ? { ...state, warming: true } : state
    case 'warm-done':
      // With no known context size, a warm-up that read (almost) nothing from the cache found it gone.
      if (event.contextTokens > 0 ? event.cacheReadTokens < LAPSED_READ_SHARE * event.contextTokens : event.cacheReadTokens < LAPSED_FLOOR_TOKENS) {
        return { ...state, warming: false, lapsed: true, contextTokens: event.contextTokens }
      }
      return {
        ...state,
        warming: false,
        lapsed: false,
        anchor: Math.max(state.anchor ?? event.at, event.at),
        contextTokens: event.contextTokens,
      }
    case 'warm-failed':
      return { ...state, warming: false }
    case 'clear':
      // A new session: re-measure before trusting a lifetime again.
      return { ...initialClock(), working: state.working }
    case 'lifetime-measured':
      return { ...state, lifetime: event.lifetime }
    case 'tick':
      return state
  }
}

/** The single Keep warm guard. */
export function canKeepWarm(state: ClockState, now: number): boolean {
  if (state.working || state.warming || state.lapsed) return false
  if (state.anchor === null || state.lifetime === null) return false
  const deadline = state.anchor + seconds(state.lifetime) * 1000
  return now < deadline - KEEP_WARM_MARGIN_MS
}

/**
 * The clock as the band shows it. While unmeasured, the countdown runs against
 * the plan default (1h on Claude plans, 5m on the API) but warning and cold use
 * five minutes, so a lapsed cache is never shown as warm.
 */
export function view(state: ClockState, now: number, planDefault: 3600 | 300): CacheView {
  const measured = state.lifetime !== null
  const lifetime = state.lifetime !== null ? seconds(state.lifetime) : planDefault
  const base = { lifetime, measured, tokensAtStake: state.contextTokens }

  if (state.working) return { ...base, state: 'refreshing', secondsLeft: lifetime }
  if (state.anchor === null) return { ...base, state: 'unknown', secondsLeft: null, tokensAtStake: null }

  const left = Math.max(0, Math.ceil((state.anchor + lifetime * 1000 - now) / 1000))
  if (state.warming) return { ...base, state: 'warming', secondsLeft: left }
  if (state.lapsed) return { ...base, state: 'cold', secondsLeft: 0 }

  const rule = measured ? lifetime : UNMEASURED_RULE_SECONDS
  const window = rule >= 3600 ? 300 : 60
  const ruleDeadline = state.anchor + rule * 1000
  let cache: CacheState
  if (now >= ruleDeadline) cache = 'cold'
  else if (now >= ruleDeadline - window * 1000) cache = 'warning'
  else cache = 'warm'
  return { ...base, state: cache, secondsLeft: cache === 'cold' ? 0 : left }
}
