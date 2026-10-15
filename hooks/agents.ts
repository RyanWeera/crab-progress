import type { AgentRun, Character, Outfit } from '../types'
import { ITEM_COLOR, ITEM_DEST, crabCss, crabSvg } from './crab'
import { CHANGE_MS, pickOutfit } from './classify'

// Subagent panel drawing, ported from savvy-progress (MIT, JohnnyVizz/claude-kit) into this
// mod. Pure functions only: the hooks that feed it live in register.tsx.

const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif"
export const ROW_H = 66
export const LINE_H = 24
const GRID_STEP = 16
const GRID_TILE = 4096
const DOT = '·'
const ELLIPSIS = '…'
const APPROX = '≈'

// --- model facts -----------------------------------------------------------

type Price = [input: number, output: number, cacheRead: number, cacheWrite: number]

// USD per million tokens; the first row that matches the model id wins. Cache writes are
// priced at the 1-hour rate (2x input), which is what Claude Code writes on a subscription.
const PRICES: [RegExp, Price][] = [
  [/(fable|mythos)-5-1/, [10, 50, 0.25, 20]],
  [/fable|mythos/, [10, 50, 1, 20]],
  [/opus-5-5/, [4, 20, 0.2, 8]],
  [/opus/, [5, 25, 0.5, 10]],
  [/sonnet-5-5/, [2, 10, 0.1, 4]],
  [/sonnet-5/, [2, 10, 0.2, 4]],
  [/sonnet/, [3, 15, 0.3, 6]],
  [/haiku-5-5/, [0.1, 0.5, 0.01, 0.2]],
  [/haiku/, [1, 5, 0.1, 2]],
]
const HAIKU_LONG_PROMPT = 100_000
const HAIKU_LONG: Price = [0.5, 2.5, 0.05, 1]

export type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

const priceOf = (model: string, prompt: number): Price => {
  const id = model.toLowerCase()
  if (prompt > HAIKU_LONG_PROMPT && /haiku-5-5/.test(id)) return HAIKU_LONG
  return PRICES.find(([re]) => re.test(id))?.[1] ?? [4, 20, 0.2, 8]
}

// `isRequest` says the usage is one model request, which is what a prompt-length price is
// set by; a turn's sum is priced at the model's ordinary prices.
export const costOf = (model: string, u: Usage, isRequest: boolean): number => {
  const prompt = isRequest ? (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) : 0
  const [i, o, r, w] = priceOf(model, prompt)
  return (
    ((u.input_tokens || 0) * i + (u.output_tokens || 0) * o + (u.cache_read_input_tokens || 0) * r + (u.cache_creation_input_tokens || 0) * w) /
    1e6
  )
}

export const windowOf = (model: string): number => (/haiku-4|claude-3/i.test(model) ? 200_000 : 1_000_000)

export const modelName = (id: string): string => {
  const m = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/i.exec(id)
  const [, family = '', major = '', minor] = m ?? []
  if (!family) return id.replace(/^claude-/, '').replace(/\[.*\]$/, '') || '—'
  return `${family.charAt(0).toUpperCase()}${family.slice(1).toLowerCase()} ${major}${minor ? '.' + minor : ''}`
}

const FAMILY_COLOR: Record<string, string> = { fable: '#7F77DD', mythos: '#7F77DD', opus: '#D85A30', sonnet: '#378ADD', haiku: '#1D9E75' }
const familyOf = (model: string): string => /(fable|mythos|opus|sonnet|haiku)/i.exec(model)?.[1]?.toLowerCase() ?? 'other'
const colorOf = (a: AgentRun): string => FAMILY_COLOR[familyOf(a.model)] ?? '#888780'

// What a running agent looks like follows the task: its brief and the tools it is using.
export const taskOutfit = (a: AgentRun, at: number): Outfit =>
  pickOutfit(
    {
      busy: true,
      startedAt: a.startedAt,
      lastActive: at,
      doneAt: 0,
      tools: a.tools ?? 0,
      edits: a.edits ?? 0,
      prompt: `${a.description} ${a.type}`,
      lastTool: a.lastTool ?? (/explore/i.test(a.type) ? 'Read' : ''),
      end: '',
    },
    at,
  )

const ACTIVITY: Partial<Record<Outfit, string>> = {
  coding: 'coding',
  fixing: 'fixing',
  reading: 'reading',
  writing: 'writing',
  cool: 'reviewing',
  idle: 'planning',
  chef: 'cooking',
  working: 'thinking',
  error: 'error',
}

// What a finished agent does while it waits, a new pose every 8 s (offset per agent).
const IDLE_POSES: Outfit[] = ['idle', 'greeting', 'cool', 'dance', 'propeller', 'sunbathe', 'reading']
const hash = (s: string): number => [...s].reduce((h, ch) => (h * 31 + (ch.codePointAt(0) ?? 0)) % 100003, 7)

// The costume a working agent wears follows its model; the character under it follows /mascot.
// A finished agent cheers for a few seconds, then idles through a loop of small animations.
export const outfitFor = (a: AgentRun, at: number): Outfit => {
  if (a.status === 'done') {
    if (at - (a.endedAt ?? at) < 6_000) return 'done'
    return IDLE_POSES[(hash(a.id) + Math.floor(at / 8_000)) % IDLE_POSES.length] ?? 'idle'
  }  if (a.status === 'failed') return 'error'
  if (a.outfit) return a.outfit
  return taskOutfit(a, at)
}

// --- formatting ------------------------------------------------------------

const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
export const sameTask = (a: string, b: string): boolean => norm(a) === norm(b)

const fmtTokens = (n: number): string => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${Math.round(n)}`)
const fmtCost = (usd: number): string => `$${usd < 10 ? usd.toFixed(2) : usd.toFixed(1)}`
export const fmtTime = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const xml = (s: string): string => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

// CJK and fullwidth text advances about 1em; the rest is a rough proportional estimate.
const charEm = (ch: string): number =>
  (ch.codePointAt(0) ?? 0) >= 0x2e80 ? 1 : /[\s.,:;'|!il1()[\]]/.test(ch) ? 0.3 : /[A-Z@%mw]/.test(ch) ? 0.72 : 0.56
const textWidth = (s: string, size: number): number => [...s].reduce((w, ch) => w + charEm(ch) * size, 0)
const fitText = (s: string, size: number, maxW: number): string => {
  if (textWidth(s, size) <= maxW) return s
  let out = ''
  for (const ch of s) {
    if (textWidth(out + ch + ELLIPSIS, size) > maxW) break
    out += ch
  }
  return out + ELLIPSIS
}

// --- numbers ---------------------------------------------------------------

export const elapsed = (a: AgentRun, at: number): number => (a.endedAt ?? Math.max(at, a.startedAt)) - a.startedAt

export const totals = (list: AgentRun[], at: number) => {
  const cost = list.reduce((s, a) => s + a.costUsd, 0)
  const tokens = list.reduce((s, a) => s + a.tokens, 0)
  const start = Math.min(...list.map(a => a.startedAt))
  const end = Math.max(...list.map(a => a.endedAt ?? Math.max(at, a.startedAt)))
  return { cost, tokens, time: list.length ? end - start : 0 }
}
export type Totals = ReturnType<typeof totals>

const progressOf = (a: AgentRun): number | null => {
  if (a.status === 'done') return 1
  if (a.stepTotal) return Math.min(1, (a.stepDone ?? 0) / a.stepTotal)
  return null
}
const ctxOf = (a: AgentRun): number => (a.contextMax ? Math.min(100, Math.round((a.contextTokens / a.contextMax) * 100)) : 0)

export const summaryOf = (t: Totals): string => `${APPROX}${fmtCost(t.cost)}, ${fmtTokens(t.tokens)} tokens, ${fmtTime(t.time)}`

// --- drawings --------------------------------------------------------------

const PANE_CSS = `<style>
.t{fill:#1f1f1f}.s{fill:#6b6b68}.m{fill:#9a9a96}.k{fill:#ecebe8}.ln{stroke:#e4e4e1}.tile{fill:#f4f3f0}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.s{fill:#a8a8a4}.m{fill:#7d7d79}.k{fill:#2c2c2b}.ln{stroke:#333331}.tile{fill:#262625}}
.live{animation:p 1.6s ease-in-out infinite}@keyframes p{50%{opacity:.3}}
</style>`

const svg = (W: number, H: number, at: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${PANE_CSS}${crabCss(at)}${body}</svg>`

// The pane's backdrop: a dotted grid as tall as the content laid over it.
export const gridTiles = (H: number): number[] => Array.from({ length: Math.ceil(H / GRID_TILE) }, (_, i) => Math.min(GRID_TILE, H - i * GRID_TILE))
export const gridSvg = (W: number, H: number): string => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>.d{fill:#d9d8d4}@media (prefers-color-scheme: dark){.d{fill:#3a3a38}}</style>
<defs><pattern id="g" width="${GRID_STEP}" height="${GRID_STEP}" patternUnits="userSpaceOnUse"><circle class="d" cx="${GRID_STEP / 2}" cy="${GRID_STEP / 2}" r="1"/></pattern></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
</svg>`

export const HEADER_H = 44

export const headerSvg = (W: number, at: number, t: Totals): string => {
  const gap = 6
  const tw = (W - gap * 2) / 3
  const tile = (i: number, k: string, v: string): string =>
    `<rect class="tile" x="${i * (tw + gap)}" y="0" width="${tw}" height="40" rx="8"/>
<text class="s" x="${i * (tw + gap) + 9}" y="16" font-family="${FONT}" font-size="11">${k}</text>
<text class="t" x="${i * (tw + gap) + 9}" y="33" font-family="${FONT}" font-size="15" font-weight="600" font-variant-numeric="tabular-nums">${v}</text>`
  return svg(W, HEADER_H, at, `${tile(0, 'Cost', APPROX + fmtCost(t.cost))}${tile(1, 'Tokens', fmtTokens(t.tokens))}${tile(2, 'Time', fmtTime(t.time))}`)
}

export const agentSvg = (W: number, a: AgentRun, at: number, character: Character): string => {
  const color = colorOf(a)
  const ctx = ctxOf(a)
  const textW = W - 42 - 22
  const meta = [a.effort ? `${modelName(a.model)} ${DOT} ${a.effort}` : modelName(a.model)]
  if (a.round > 1) meta.push(`round ${a.round}`)
  if (a.status === 'failed') meta.push('error')
  const doing = a.status === 'running' ? ACTIVITY[outfitFor(a, at)] : undefined
  if (doing) meta.push(doing)
  const progress = progressOf(a)
  const o = outfitFor(a, at)
  const item = ITEM_COLOR[o]
  const age = a.outfitAt === undefined ? Infinity : at - a.outfitAt
  const isChanging = a.status === 'running' && item !== undefined && age < CHANGE_MS
  const shown: Outfit = isChanging ? 'changing' : o
  const change = isChanging ? { item, age, dest: ITEM_DEST[o] } : undefined
  const settle = a.status === 'running' && !isChanging ? age - (item === undefined ? 0 : CHANGE_MS) : undefined
  const stats = `ctx ${ctx}% ${DOT} ${fmtTokens(a.contextTokens)}  ${APPROX}${fmtCost(a.costUsd)}  ${fmtTime(elapsed(a, at))}`
  const steps = a.stepTotal ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ` ${DOT} ${a.stepNote}` : ''}` : ''
  const stepsW = Math.max(0, textW - textWidth(stats, 11) - 12)
  const fillW = Math.round(textW * (progress ?? ctx / 100))
  const mark =
    a.status === 'running'
      ? `<circle class="live" cx="${W - 8}" cy="16" r="3.5" fill="${color}"/>`
      : a.status === 'done'
        ? `<path d="M${W - 13} 16l3.5 3.5 6.5-7" fill="none" stroke="#3B9C5F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
        : `<path d="M${W - 12} 12l8 8M${W - 4} 12l-8 8" stroke="#D0453F" stroke-width="1.8" stroke-linecap="round"/>`
  return svg(
    W,
    ROW_H,
    at,
    `${crabSvg(shown, 0, 22, a.status === 'running', character, change, settle)}
<text class="t" x="42" y="18" font-family="${FONT}" font-size="13" font-weight="600">${xml(fitText(a.description || a.type, 13, textW))}</text>
<text x="42" y="34" font-family="${FONT}" font-size="11"><tspan fill="${color}">${xml(a.type)}</tspan><tspan class="s">  ${xml(meta.join(`  ${DOT}  `))}</tspan></text>
${steps && stepsW > 30 ? `<text class="t" x="42" y="49" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${xml(fitText(steps, 11, stepsW))}</text>` : ''}
<text class="s" x="${42 + textW}" y="49" text-anchor="end" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${stats}</text>
<rect class="k" x="42" y="55" width="${textW}" height="4" rx="2"/><rect${progress === null ? ' class="m"' : ''} x="42" y="55" width="${fillW}" height="4" rx="2"${progress === null ? '' : ` fill="${color}"`}/>
${mark}
<line class="ln" x1="0" y1="65.5" x2="${W}" y2="65.5"/>`,
  )
}

export const compactSvg = (W: number, list: AgentRun[], at: number, t: Totals, character: Character): string => {
  const ordered = [...list.filter(a => a.status === 'running'), ...list.filter(a => a.status !== 'running')]
  const fit = Math.max(1, Math.floor((W - 150) / 40))
  const shown = ordered.slice(0, fit)
  const more = ordered.length - shown.length
  const body = shown.map((a, i) => crabSvg(outfitFor(a, at), i * 40, 6, a.status === 'running', character)).join('')
  return svg(
    W,
    40,
    at,
    `${body}${more ? `<text class="s" x="${shown.length * 40 + 4}" y="26" font-family="${FONT}" font-size="12">+${more}</text>` : ''}
<text class="s" x="${W}" y="26" text-anchor="end" font-family="${FONT}" font-size="12" font-variant-numeric="tabular-nums">${APPROX}${fmtCost(t.cost)} ${DOT} ${fmtTokens(t.tokens)} ${DOT} ${fmtTime(t.time)}</text>`,
  )
}

// --- terminal rows ---------------------------------------------------------

export const ctxBar = (pct: number, width: number): string => {
  const filled = Math.round((width * pct) / 100)
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
}
export const agentLine = (a: AgentRun, at: number): { title: string; meta: string; stats: string; progress: number | null; ctx: number } => ({
  title: a.description || a.type,
  meta: `${a.type} ${DOT} ${a.effort ? `${modelName(a.model)} ${DOT} ${a.effort}` : modelName(a.model)}`,
  stats: `${a.stepTotal ? `${a.stepDone ?? 0}/${a.stepTotal} ${DOT} ` : ''}ctx ${ctxOf(a)}% ${DOT} ${fmtTokens(a.contextTokens)} ${APPROX}${fmtCost(a.costUsd)} ${fmtTime(elapsed(a, at))}`,
  progress: progressOf(a),
  ctx: ctxOf(a),
})
