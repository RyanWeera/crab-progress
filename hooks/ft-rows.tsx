import type { ClientModule, RenderElement } from 'claude-code'

export type Seg = { t: string; c?: string; b?: boolean; s?: boolean; i?: boolean; sh?: string; dim?: boolean; one?: boolean; spin?: boolean; bg?: string; tab?: string }
export type RowSpec = { id: string; left: Seg[]; right: Seg[]; kind?: 'dir' | 'file' | 'link' }

// The crab digs in three of the real rows: it dives into rows[0], throws things out until it
// finds one, jumps into rows[1] and pokes its head out of rows[2]. Each of those rows gets a
// burrow strip under it, drawn here, in the same grid as the rows.
export type DigSpec = {
  rows: [number, number, number]
  color: string
  dark: string
  stage: string
  glow: string
  // Ticks into the loop to start from (a frame of the animation, for tests and screenshots).
  start?: number
}

export type RowsProps = {
  rows: RowSpec[]
  active: string
  activeBg: string
  hoverBg: string
  tones: Record<string, { bright: string[]; dim: string[] }>
  spinner?: string[]
  pointer?: boolean
  bar?: { pos: number; size: number; thumb: string; track: string }
  preview?: { text: string; path: string; startLine: number; markdown: boolean }
  // Rows two cells high, so the tree has room to breathe (and for the crab to work in).
  tall?: boolean
  dig?: DigSpec
}
type Local = { hover: number; phase: number; drag: boolean; ref: { stop?: () => void; unpoint?: () => void } }

const TICK_MS = 90
const TREE_BUDGET = 70_000
const MAX_ROWS = 1_500
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

// --- the crab, drawn from half blocks: a cell is one pixel wide and two pixel rows tall ---
const STAGE_LINES = 4 // three lines of sprite space and the ground
const PIX_ROWS = 6
const LOOP = 112 // ticks (about 10 s)
const BODY = ['..cccc..', '.ceccec.', 'cccccccc', '.cccccc.']
const LOOK_L = '.eccecc.'
const LOOK_R = '.ccecce.'
const LEGS: [string, string][] = [
  ['.l.ll.l.', '.l.ll.l.'],
  ['l.l..l.l', 'l.l..l.l'],
]
const CRAB_W = 8
const ITEMS = ['#EEEDE8', '#8E929A', '#D9A23A', '#7FC4F2', '#C0705A', '#4FA37A', '#A992E0', '#F5C542']
const GEM = '#F5C542'
const FLOOR = '#3a3a38'

type Canvas = (string | undefined)[][]

const blank = (w: number): Canvas => Array.from({ length: PIX_ROWS }, () => Array<string | undefined>(w).fill(undefined))

function put(c: Canvas, x: number, y: number, color: string): void {
  const row = c[y]
  if (row && x >= 0 && x < row.length) row[x] = color
}

function crab(c: Canvas, x: number, y: number, frame: number, color: string, dark: string, look: -1 | 0 | 1): void {
  const rows = [...BODY]
  if (look < 0) rows[1] = LOOK_L
  if (look > 0) rows[1] = LOOK_R
  const [legA, legB] = LEGS[frame % 2] ?? LEGS[0] ?? ['', '']
  const all = [...rows, legA, legB]
  all.forEach((line, r) => {
    for (let k = 0; k < CRAB_W; k++) {
      const ch = line[k]
      if (ch === 'c') put(c, x + k, y + r, color)
      else if (ch === 'e') put(c, x + k, y + r, dark)
      else if (ch === 'l') put(c, x + k, y + r, color)
    }
  })
}

type StageScene = { crab?: { x: number; y: number; frame: number; look: -1 | 0 | 1; gem: boolean } }

const ease = (t: number, a: number, b: number, from: number, to: number): number => from + (to - from) * Math.min(1, Math.max(0, (t - a) / (b - a)))

// Where the crab is, per burrow, for a tick of the loop.
function script(t: number, w: number): [StageScene, StageScene, StageScene] {
  const xA = 3
  const xB = Math.max(xA + CRAB_W + 2, Math.floor(w / 2) - 4)
  const xC = Math.max(xB + CRAB_W + 2, w - CRAB_W - 4)
  const a: StageScene = {}
  const b: StageScene = {}
  const c: StageScene = {}
  const frame = Math.floor(t / 2)
  if (t < 11) a.crab = { x: Math.round(ease(t, 0, 11, -CRAB_W, xA)), y: 0, frame, look: 1, gem: false }
  else if (t < 16) a.crab = { x: xA, y: Math.round(ease(t, 11, 16, 0, PIX_ROWS)), frame: 0, look: 0, gem: false }
  else if (t < 66) a.crab = undefined
  else if (t < 73) a.crab = { x: xA, y: Math.round(ease(t, 66, 73, PIX_ROWS, 0)), frame: 0, look: 0, gem: t > 70 }
  else if (t < 80) a.crab = { x: xA, y: 0, frame: 0, look: 0, gem: true }
  else if (t < 85) a.crab = { x: xA, y: Math.round(ease(t, 80, 85, 0, -PIX_ROWS - 2)), frame: 0, look: 0, gem: true }
  if (t >= 84 && t < 90) b.crab = { x: xB, y: Math.round(ease(t, 84, 90, -PIX_ROWS - 2, 0)), frame: 0, look: 0, gem: true }
  else if (t >= 90 && t < 95) b.crab = { x: xB, y: Math.round(ease(t, 90, 95, 0, PIX_ROWS)), frame: 0, look: 0, gem: false }
  if (t >= 100 && t < 103) c.crab = { x: xC, y: Math.round(ease(t, 100, 103, PIX_ROWS, 4)), frame: 0, look: 0, gem: false }
  else if (t >= 103 && t < 109) c.crab = { x: xC, y: 4, frame: 0, look: t % 12 < 6 ? -1 : 1, gem: false }
  else if (t >= 109) c.crab = { x: xC, y: Math.round(ease(t, 109, 112, 4, PIX_ROWS)), frame: 0, look: 0, gem: false }
  return [a, b, c]
}

const inside = (t: number, k: number): boolean => (k === 0 ? t >= 11 && t < 80 : k === 1 ? t >= 84 && t < 100 : t >= 100)

type Cell = { ch: string; fg?: string; bg?: string }

function composeStage(scene: StageScene, k: number, t: number, w: number, spec: DigSpec): RenderElement[] {
  const canvas = blank(w)
  const xs = [3, 0, 0]
  const sc = scene.crab
  const holeX = (sc?.x ?? xs[k] ?? 3) + CRAB_W / 2
  if (k === 0) {
    ITEMS.forEach((color, i) => {
      const dt = t - (18 + i * 6)
      if (dt < 0 || dt >= 15) return
      const vy = 1.1 + (i % 3) * 0.15
      const vx = (((i * 37) % 7) - 3) * 0.45
      put(canvas, Math.round(3 + CRAB_W / 2 + vx * dt), Math.round(PIX_ROWS - 1 - (vy * dt - 0.08 * dt * dt)), color)
    })
  }
  if (sc) {
    crab(canvas, sc.x, sc.y, sc.frame, spec.color, spec.dark, sc.look)
    if (sc.gem) put(canvas, sc.x + CRAB_W, Math.max(0, sc.y - 1), GEM)
  }
  const lines: RenderElement[] = []
  for (let l = 0; l < 3; l++) {
    const cells: Cell[] = []
    for (let x = 0; x < w; x++) {
      const top = canvas[2 * l]?.[x]
      const bot = canvas[2 * l + 1]?.[x]
      if (top && bot) cells.push(top === bot ? { ch: '█', fg: top } : { ch: '▀', fg: top, bg: bot })
      else if (top) cells.push({ ch: '▀', fg: top, bg: spec.stage })
      else if (bot) cells.push({ ch: '▄', fg: bot, bg: spec.stage })
      else cells.push({ ch: ' ', bg: spec.stage })
    }
    lines.push(runs(cells))
  }
  // The ground, with the hole he goes into.
  const floor: Cell[] = []
  const hx = Math.round(holeX)
  for (let x = 0; x < w; x++) {
    const d = Math.abs(x - hx)
    floor.push(d <= 4 ? { ch: d >= 4 ? '▂' : '▄', fg: FLOOR, bg: spec.stage } : { ch: ' ', bg: spec.stage })
  }
  lines.push(runs(floor))
  return lines
}

function runs(cells: Cell[]): RenderElement {
  const out: RenderElement[] = []
  let cur: { ch: string; fg?: string; bg?: string } | null = null
  let text = ''
  const flush = () => {
    if (cur) out.push(<Text color={cur.fg} backgroundColor={cur.bg}>{text}</Text>)
  }
  for (const c of cells) {
    if (cur && c.fg === cur.fg && c.bg === cur.bg) {
      text += c.ch
    } else {
      flush()
      cur = c
      text = c.ch
    }
  }
  flush()
  return <Box flexDirection="row" height={1}>{out}</Box>
}

// `Box`/`Text` come from the surface; set once per render so the helpers above can use them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Box: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Text: any

function shimmer(i: number, phase: number, len: number, palette: string[]): string {
  const band = ((phase * 1.6) % (len + 8)) - 4
  const d = Math.abs(i - band)
  return palette[d < 0.8 ? 3 : d < 1.8 ? 2 : d < 2.8 ? 1 : 0] ?? palette[0] ?? '#f97316'
}

const Rows: ClientModule<RowsProps, Local> = (props, surface) => {
  const els = surface.elements
  Box = els.Box
  Text = els.Text
  let state = surface.state
  if (state === undefined) {
    state = { hover: -1, phase: 0, drag: false, ref: {} }
    surface.setState(state)
  }
  const H = props.tall ? 2 : 1
  // Where every row (and burrow) sits, in cells, so pointer positions find their row.
  const stageAfter = new Map<number, number>()
  props.dig?.rows.forEach((r, k) => {
    if (r >= 0 && !stageAfter.has(r)) stageAfter.set(r, k)
  })
  const layout: { top: number; h: number; row: number }[] = []
  let y = 0
  for (let i = 0; i < props.rows.length; i++) {
    layout.push({ top: y, h: H, row: i })
    y += H
    if (stageAfter.has(i)) {
      layout.push({ top: y, h: STAGE_LINES, row: -1 })
      y += STAGE_LINES
    }
  }
  const total = y
  const rowAtY = (yy: number): number => layout.find(l => yy >= l.top && yy < l.top + l.h)?.row ?? -1

  let visible = props.rows.length
  const lit = props.rows.some(r => r.left.some(s => s.sh || s.spin) || r.right.some(s => s.sh || s.spin))
  const animated = lit || Boolean(props.dig)
  if (animated && !state.ref.stop) {
    state.ref.stop = surface.every(TICK_MS, () => {
      const cur = surface.state
      if (cur) surface.setState({ ...cur, phase: cur.phase + 1 })
    })
  } else if (!animated && state.ref.stop) {
    state.ref.stop()
    state.ref.stop = undefined
  }
  if (props.pointer === false) {
    state.ref.unpoint?.()
    state.ref.unpoint = undefined
  } else state.ref.unpoint = surface.onPointer(e => {
    const cur = surface.state ?? state
    const span = Math.max(1, total - 1)
    const onBar = Boolean(props.bar) && e.x >= surface.columns - 1
    if (props.bar && (cur.drag || (onBar && e.type === 'down' && (e.button ?? 'left') === 'left'))) {
      if (e.type === 'up' || e.type === 'leave') {
        surface.setState({ ...cur, drag: false })
        return
      }
      if (e.type === 'down' || e.type === 'move') {
        if (!cur.drag) surface.setState({ ...cur, drag: true, hover: -1 })
        surface.post({ scrollTo: Math.max(0, Math.min(1, e.y / span)) })
        return
      }
    }
    const at = e.type === 'leave' || e.y < 0 ? -1 : rowAtY(e.y)
    if (at < 0 || at >= visible) {
      if (cur.hover !== -1) surface.setState({ ...cur, hover: -1 })
      return
    }
    if (e.type === 'move' && !e.button && cur.hover !== at) surface.setState({ ...cur, hover: at })
    const row = props.rows[at]
    if (e.type === 'down' && e.button === 'right' && row?.id) {
      surface.post({ copy: row.id, shift: Boolean(e.shift) })
      return
    }
    if (e.type !== 'down' || (e.button ?? 'left') !== 'left' || !row) return
    let x = 0
    for (const seg of row.left) {
      const w = [...seg.t].length
      if (seg.tab && e.x >= x && e.x < x + w) {
        surface.post({ tab: seg.tab })
        return
      }
      x += w
    }
    if (row.id) surface.post({ press: row.id, ctrl: Boolean(e.ctrl), shift: Boolean(e.shift) })
  })
  surface.onKey(e => surface.post({ key: e.key, ctrl: Boolean(e.ctrl), shift: Boolean(e.shift) }))
  // The preview draws in this same element, so the focus a click gave the tree stays put.
  if (props.preview) {
    const { Markdown, Code } = surface.elements
    const p = props.preview
    return p.markdown ? <Markdown text={p.text} /> : <Code source={p.text} path={p.path} startLine={p.startLine} wrap="truncate-end" />
  }
  const frames = props.spinner?.length ? props.spinner : FRAMES
  const draw = (s: Seg) => {
    if (s.spin) {
      return (
        <Text color={s.c} bold={s.b}>
          {s.t + (frames[state.phase % frames.length] ?? '')}
        </Text>
      )
    }
    const palette = s.sh ? (s.dim ? props.tones[s.sh]?.dim : props.tones[s.sh]?.bright) : undefined
    if (!palette) {
      return (
        <Text color={s.c} backgroundColor={s.bg} bold={s.b} strikethrough={s.s} italic={s.i}>
          {s.t}
        </Text>
      )
    }
    if (s.one) {
      return (
        <Text color={shimmer(-1, state.phase, s.t.length, palette)}>
          {s.t}
        </Text>
      )
    }
    const chars = [...s.t]
    return (
      <Text bold={s.b}>
        {chars.map((ch, i) => (
          <Text color={shimmer(i, state.phase, chars.length, palette)}>{ch}</Text>
        ))}
      </Text>
    )
  }
  const t = ((props.dig?.start ?? 0) + state.phase) % LOOP
  const dig = props.dig
  const inRow = (i: number): boolean => Boolean(dig) && dig!.rows.some((r, k) => r === i && inside(t, k))
  const rowEl = (r: RowSpec, i: number) => {
    const onThumb = props.bar && i >= props.bar.pos && i < props.bar.pos + props.bar.size
    return (
      <Box
        flexDirection="row"
        height={H}
        alignItems={props.tall ? 'center' : undefined}
        overflow="hidden"
        backgroundColor={r.id && r.id === props.active ? props.activeBg : inRow(i) ? dig?.glow : r.id && i === state.hover ? props.hoverBg : undefined}
      >
        <Box flexShrink={1} overflow="hidden">
          {r.left.map(draw)}
        </Box>
        <Box flexGrow={1} />
        {r.right.map(draw)}
        {props.bar && (
          <Box flexDirection="column">
            {Array.from({ length: H }, () => (
              <Text color={onThumb ? props.bar?.thumb : props.bar?.track}>{onThumb ? '┃' : '│'}</Text>
            ))}
          </Box>
        )}
      </Box>
    )
  }
  const drawn: RenderElement[] = []
  const w = Math.max(24, surface.columns || 40)
  const scenes = dig ? script(t, w) : undefined
  let size = 0
  for (let i = 0; i < props.rows.length; i++) {
    const el = rowEl(props.rows[i] as RowSpec, i)
    let cost = 1_000
    try {
      cost = JSON.stringify(el).length
    } catch {}
    if (size + cost > TREE_BUDGET || drawn.length >= MAX_ROWS) {
      visible = i
      drawn.push(<Text dimColor>{`  … ${props.rows.length - i} more rows, collapse folders or use search`}</Text>)
      break
    }
    size += cost
    drawn.push(el)
    const k = stageAfter.get(i)
    if (dig && scenes && k !== undefined) {
      drawn.push(<Box flexDirection="column" height={STAGE_LINES} overflow="hidden">{composeStage(scenes[k] ?? {}, k, t, w, dig)}</Box>)
    }
  }
  return <Box flexDirection="column">{drawn}</Box>
}

export default Rows
