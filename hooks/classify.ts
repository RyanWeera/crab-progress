import type { Outfit, Sess } from '../types'

export const SLEEP_MS = 5 * 60_000
export const DONE_MS = 9_000
export const LONG_MS = 2 * 60_000
export const LONG_TOOLS = 25

// Tiny on-device classifier: keyword weights over the prompt plus the tools used.
// No network, no model call, no tokens.
const FIX = /\b(fix|fixes|fixed|bug|bugs|broken|error|errors|fail|fails|failed|failing|crash|crashes|debug|issue|wrong|repair|patch|regression|not working|isn'?t working|doesn'?t work)\b/i
const CODE = /\b(build|implement|add|create|write|refactor|code|function|component|feature|script|develop|make|mod|plugin)\b/i
const DOCS = /\b(readme|docs?|documentation|essay|email|notes?|summary|summarize|blog|post|article|letter|draft|report|proposal)\b/i
const CODEY = /\b(function|component|script|feature|plugin|code|api|class|refactor|implement)\b/i
const REVIEW = /\b(review|audit|verify|check|test|lint|inspect|critique)\b/i
const PLAN = /\b(plan|design|architect|outline|strategy|roadmap|brainstorm)\b/i
const READING = new Set(['Read', 'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch'])

export const isLong = (s: Sess, at: number): boolean => at - s.startedAt > LONG_MS || s.tools > LONG_TOOLS

export function pickOutfit(s: Sess, at: number): Outfit {
  if (!s.busy) {
    if (s.doneAt > 0 && at - s.doneAt < DONE_MS) return s.end === 'fail' ? 'error' : s.end === 'long' ? 'crown' : 'done'
    return at - s.lastActive > SLEEP_MS ? 'sleeping' : 'idle'
  }
  if (isLong(s, at)) return 'chef'
  if (FIX.test(s.prompt)) return 'fixing'
  if (s.edits === 0 && READING.has(s.lastTool)) return 'reading'
  if (s.edits === 0 && REVIEW.test(s.prompt)) return 'cool'
  if (s.edits === 0 && PLAN.test(s.prompt)) return 'idle'
  if (DOCS.test(s.prompt) && !CODEY.test(s.prompt)) return 'writing'
  if (s.edits > 0 || CODE.test(s.prompt)) return 'coding'
  return 'working'
}

// Is the cache-tax / keepwarm status line, drawn below the bar by another plugin, saying "cold"?
// It renders ' cache-tax · ' followed by a bold state word, so read the element's text in order.
// The prompt cache lives 60 minutes after the last request.
export const CACHE_TTL_MS = 60 * 60 * 1000

// The state word of cache-tax's band ('cold', 'warm', ...), or null when the band is not in the tree.
export function cacheState(node: unknown): string | null {
  const out: string[] = []
  const walk = (n: unknown, depth: number): void => {
    if (depth > 12 || n === null || n === undefined) return
    if (typeof n === 'string') out.push(n)
    else if (Array.isArray(n)) n.forEach(c => walk(c, depth + 1))
    else if (typeof n === 'object') {
      const o = n as { props?: { children?: unknown }; children?: unknown }
      walk(o.props?.children ?? o.children, depth + 1)
    }
  }
  walk(node, 0)
  const i = out.findIndex(t => t.includes('cache-tax'))
  return i >= 0 ? (out[i + 1] ?? null) : null
}

export function isCacheCold(node: unknown): boolean {
  return cacheState(node) === 'cold'
}

// Cold as the band would say it, or, when the band is out of sight (hook order), by our own clock.
export function isIcedNow(node: unknown, doneAt: number, at: number): boolean {
  const st = cacheState(node)
  return st !== null ? st === 'cold' : doneAt > 0 && at - doneAt >= CACHE_TTL_MS
}

// What he was doing when the turn ended, and the victory pose that goes with it.
export function winPose(s: Sess, jumpBy: number, jumpedThisTurn: boolean): Outfit {
  if (jumpedThisTurn && jumpBy >= 0.3) return 'exitCar'
  if (jumpedThisTurn && jumpBy >= 0.12) return 'medal'
  const task = pickOutfit({ ...s, busy: true }, s.doneAt || s.lastActive)
  return task === 'coding' ? 'winCode' : task === 'fixing' ? 'winFix' : task === 'reading' ? 'winRead' : task === 'writing' ? 'winWrite' : 'done'
}

// Bar value for a turn with no explicit progress: creeps toward 95% with tools and time.
export function autoRatio(s: Sess, at: number): number {
  if (s.busy) return Math.min(0.95, 1 - Math.exp(-(s.tools * 0.12 + (at - s.startedAt) / 90_000)))
  return s.doneAt > 0 && at - s.doneAt < DONE_MS ? 1 : 0
}

// What he does when nothing is happening: a loop of steps. A stroll walks to the given
// spot (0..1 of the bar) slowly; every other step stands still where the last stroll ended.
// Poses that travel along the bar (the others stand still).
export const MOVING = new Set<Outfit>(['stroll', 'walkCool', 'walkWizard', 'walkChef', 'walkCode', 'walkCmd', 'fly'])
export const POSE_MS = 8_000
export const STROLL_MS = 18_000
export const IDLE_SCRIPT: readonly [Outfit, number | null][] = [
  ['stroll', 0.55],
  ['idle', null],
  ['walkCool', 0.15],
  ['reading', null],
  ['fly', 0.8],
  ['greeting', null],
  ['walkWizard', 0.35],
  ['propeller', null],
  ['walkCode', 0.65],
  ['cool', null],
  ['walkChef', 0.1],
  ['dance', null],
  ['walkCmd', 0.5],
  ['sunbathe', null],
]

const LENGTH: number[] = IDLE_SCRIPT.map(([, target]) => (target === null ? POSE_MS : STROLL_MS))
export const IDLE_LOOP_MS = LENGTH.reduce((a, b) => a + b, 0)

// Where each step starts: the end of the nearest stroll before it (the script wraps).
const START: number[] = IDLE_SCRIPT.map((_, k) => {
  for (let j = 1; j <= IDLE_SCRIPT.length; j++) {
    const x = IDLE_SCRIPT[(k - j + IDLE_SCRIPT.length * 2) % IDLE_SCRIPT.length]?.[1]
    if (x !== null && x !== undefined) return x
  }
  return 0
})

// A costume change (pulling the next one from a pocket) takes this long.
export const CHANGE_MS = 1_400

export function roamAt(at: number): { pose: Outfit; x: number; age: number } {
  let t = ((at % IDLE_LOOP_MS) + IDLE_LOOP_MS) % IDLE_LOOP_MS
  let k = 0
  while (k < LENGTH.length - 1 && t >= (LENGTH[k] ?? 0)) t -= LENGTH[k++] ?? 0
  const [pose, target] = IDLE_SCRIPT[k] ?? ['idle', null]
  const from = START[k] ?? 0
  if (target === null) return { pose, x: from, age: t }
  const f = t / (LENGTH[k] ?? STROLL_MS)
  const eased = f < 0.5 ? 2 * f * f : 1 - 2 * (1 - f) * (1 - f)
  return { pose, x: from + (target - from) * eased, age: t }
}