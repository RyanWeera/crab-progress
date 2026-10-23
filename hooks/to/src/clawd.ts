// Clawd, drawn on an 18 x 14.2 pixel grid, one SVG document per pose.
//
// The desktop draws an interactive Svg in a sandboxed frame where SMIL plays
// but page CSS never reaches, so every loop is an <animate>/<animateTransform>
// and every colour is inlined from the palette. With `animate` off the same
// markup is emitted without any animation element: the pose's still frame.

import type { Mood, Pose } from './contracts.ts'

export type Palette = {
  skin: string
  eye: string
  blush: string
  ink: string
  laptop: string
  spark: string
  card: string
  bad: string
  cold: string
  ground: string
}

export const LIGHT: Palette = {
  skin: '#d97757',
  eye: '#2a1a12',
  blush: '#f4a58a',
  ink: '#1f1e1d',
  laptop: '#3d3b37',
  spark: '#e9a820',
  card: '#ffffff',
  bad: '#d6453d',
  cold: '#4f8fd0',
  ground: '#1f1e1d',
}

export const DARK: Palette = {
  skin: '#e08a6c',
  eye: '#1b100b',
  blush: '#f7b9a2',
  ink: '#f3f1ea',
  laptop: '#d8d4c8',
  spark: '#f5c451',
  card: '#3a3a37',
  bad: '#f0685f',
  cold: '#7db4ee',
  ground: '#f3f1ea',
}

/** Where Clawd looks while the pointer is on the band: over at it. */
export type Gaze = 'right'

/** Eye offsets per gaze, in the picture's own units (the face is 9 wide). */
export const GAZE: Record<Gaze, [number, number]> = {
  right: [1.5, 0],
}

export type ClawdOptions = {
  animate: boolean
  palette: Palette
  /** A watching Clawd's steady look toward the pointer; no glance, no fade in. */
  gaze?: Gaze
  /** Fade in when drawn (a new pose); off for the gaze pictures stacked over him. */
  fadeIn?: boolean
}

const ALT: Record<Pose, string> = {
  wake: 'Clawd: waking up',
  idle: 'Clawd: watching',
  think: 'Clawd: thinking',
  read: 'Clawd: reading',
  type: 'Clawd: typing',
  lift: 'Clawd: heavy lifting',
  ask: 'Clawd: needs you',
  write: 'Clawd: writing',
  compact: 'Clawd: compacting',
  done: 'Clawd: done',
  stop: 'Clawd: stopped',
  error: 'Clawd: dizzy',
  cold: 'Clawd: cold',
  sleep: 'Clawd: napping',
}

export function clawdAlt(pose: Pose): string {
  return ALT[pose]
}

// The CSS design used ease-in-out; SMIL takes it as a spline per segment.
const EASE = '0.42 0 0.58 1'

type Loop = { dur: number; begin?: number; ease?: boolean; keyTimes?: string }

function splines(values: string, ease: boolean): string {
  if (!ease) return ''
  const segments = values.split(';').length - 1
  return ` calcMode="spline" keySplines="${Array(segments).fill(EASE).join(';')}"`
}

function timing(o: Loop, values: string): string {
  const begin = o.begin ? ` begin="${o.begin}s"` : ''
  const times = o.keyTimes ? ` keyTimes="${o.keyTimes}"` : ''
  return ` dur="${o.dur}s" repeatCount="indefinite"${begin}${times}${splines(values, o.ease ?? true)}`
}

/** Builds SMIL loops, or nothing when the still frame is wanted. */
function smil(animate: boolean) {
  return {
    attr(name: string, values: string, o: Loop): string {
      return animate ? `<animate attributeName="${name}" values="${values}"${timing(o, values)}/>` : ''
    },
    move(type: 'translate' | 'rotate' | 'scale', values: string, o: Loop): string {
      return animate ? `<animateTransform attributeName="transform" type="${type}" values="${values}"${timing(o, values)} additive="sum"/>` : ''
    },
  }
}

/** Wraps `inner` so a scale animation pivots on (cx, cy) instead of the origin. */
function pivot(cx: number, cy: number, anim: string, inner: string): string {
  if (!anim) return inner
  return `<g transform="translate(${cx} ${cy})"><g>${anim}<g transform="translate(${-cx} ${-cy})">${inner}</g></g></g>`
}

function rect(x: number, y: number, w: number, h: number, fill: string, extra = ''): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`
}

const BODY = 'M4 4H13V9H12.5V11H11.5V9H10.5V11H9.5V9H7.5V11H6.5V9H5.5V11H4.5V9H4Z'

/** Seconds a new pose takes to fade in. */
export const FADE_IN_S = 0.35

export function clawdSvg(pose: Pose, mood: Mood, opts: ClawdOptions): string {
  const p = opts.palette
  const a = smil(opts.animate)
  const stroke = (color: string, width: number) => ` fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`

  // Eyes.
  const eyeH = mood === 'calm' ? 1.6 : 2
  const openEyes = pivot(8.5, 6.2, a.move('scale', '1 1;1 1;1 0.1;1 1', { dur: 5.2, keyTimes: '0;0.93;0.96;1', ease: false }),
    rect(6, 5.2, 1, eyeH, p.eye) + rect(10, 5.2, 1, eyeH, p.eye) +
    rect(6, 5.2, 0.4, 0.4, '#ffffff', ' opacity="0.9"') + rect(10, 5.2, 0.4, 0.4, '#ffffff', ' opacity="0.9"'))
  const smile = (d: string) => `<path d="${d}"${stroke(p.eye, 0.55)}/>`
  const eyesFor: Partial<Record<Pose, string>> = {
    done: smile('M5.9 6.5L6.5 5.6L7.1 6.5') + smile('M9.9 6.5L10.5 5.6L11.1 6.5'),
    lift: rect(5.8, 5.9, 1.4, 0.6, p.eye) + rect(9.8, 5.9, 1.4, 0.6, p.eye),
    compact: smile('M5.8 5.6l1.2.6-1.2.6M11.2 5.6l-1.2.6 1.2.6'),
    sleep: smile('M5.8 6.3h1.4M9.8 6.3h1.4'),
    wake: rect(6, 5.9, 1, 0.8, p.eye) + rect(10, 5.9, 1, 0.8, p.eye),
    error: smile('M6.5 6.1a.45.45 0 1 1 .45.45a.9.9 0 1 1-.9-.9M10.5 6.1a.45.45 0 1 1 .45.45a.9.9 0 1 1-.9-.9'),
    stop: rect(5.8, 5, 1.3, 2.3, p.eye) + rect(9.8, 5, 1.3, 2.3, p.eye) +
      rect(5.8, 5, 0.5, 0.5, '#ffffff', ' opacity="0.9"') + rect(9.8, 5, 0.5, 0.5, '#ffffff', ' opacity="0.9"'),
  }
  const look = pose === 'think' ? ' transform="translate(0.5 -0.45)"' : pose === 'write' ? ' transform="translate(0.2 0.5)"' : ''
  // Watching with no pointer to follow: centred eyes that glance left, then right, about every 7 s.
  const gazeAt = opts.gaze ? GAZE[opts.gaze] : null
  const scan = gazeAt ? '' : pose === 'type'
    ? a.move('translate', '-0.5 0.55;0.5 0.55;-0.5 0.55', { dur: 2.6 })
    : pose === 'idle'
      ? a.move('translate', '0 0;0 0;-0.6 0;-0.6 0;0.6 0;0.6 0;0 0;0 0', { dur: 7, keyTimes: '0;0.7;0.74;0.8;0.85;0.91;0.95;1' })
      : ''
  const eyes = `<g${gazeAt ? ` transform="translate(${gazeAt[0]} ${gazeAt[1]})"` : look}>${scan}${eyesFor[pose] ?? openEyes}</g>`

  // Arms.
  const arm = (side: 'l' | 'r', y: number, h = 1.2, anim = '', x?: number, w = 1.3) =>
    `<rect x="${x ?? (side === 'l' ? 2.9 : 12.8)}" y="${y}" width="${w}" height="${h}" fill="${p.skin}">${anim}</rect>`
  const key = (begin: number) => a.move('translate', '0 0;0 0.9;0 0', { dur: 0.26, begin, ease: false })
  const reach = (side: 'l' | 'r') => pivot(side === 'l' ? 3.55 : 13.45, 7.2,
    a.move('scale', '1 1;1 1;1 1.75;1 1.75;1 1', { dur: 1.7, keyTimes: '0;0.12;0.45;0.62;1' }), arm(side, 3.5, 3.7))
  const sign = `<rect x="12.6" y="-1.5" width="3.9" height="2.9" rx="0.35" fill="${p.card}" stroke="${p.ink}" stroke-width="0.25"/>` +
    `<path d="M13.95 -0.6q.6-.75 1.25 0q0 .55-.62.8v.35"${stroke(p.ink, 0.4)}/><circle cx="14.58" cy="1.05" r="0.17" fill="${p.ink}"/>`
  const waveArm = `<g transform="translate(13.45 5.2)"><g>${a.move('rotate', '-8;8;-8', { dur: 1.8 })}<g transform="translate(-13.45 -5.2)">${arm('r', 1.8, 3.4)}${sign}</g></g></g>`
  const armsFor: Partial<Record<Pose, string>> = {
    think: arm('l', 6) + arm('r', 4.7),
    type: arm('l', 7, 1.2, key(0)) + arm('r', 7, 1.2, key(0.13)),
    done: arm('l', 4.3) + arm('r', 4.3),
    lift: reach('l') + reach('r'),
    write: arm('l', 7.6) + arm('r', 7.6),
    read: arm('l', 6) + arm('r', 7.2),
    stop: arm('l', 2.4, 2.8) + arm('r', 2.4, 2.8),
    wake: arm('l', 1.6, 3.6) + arm('r', 1.6, 3.6),
    compact: arm('l', 4.6) + arm('r', 4.6),
    ask: arm('l', 6) + waveArm,
  }
  const arms = armsFor[pose] ?? arm('l', 6) + arm('r', 6)

  // What Clawd holds.
  const hold = pose === 'lift'
    ? `<g>${a.move('translate', '0 0;0 0;0 -2.7;0 -2.7;0 0', { dur: 1.7, keyTimes: '0;0.12;0.45;0.62;1' })}` +
      rect(0.6, 3.1, 15.8, 0.55, '#6b6861', ' rx="0.2"') +
      rect(0.9, 2, 0.9, 2.75, p.ink, ' rx="0.25"') + rect(1.95, 2.45, 0.6, 1.85, p.ink, ' rx="0.2"') +
      rect(15.2, 2, 0.9, 2.75, p.ink, ' rx="0.25"') + rect(14.45, 2.45, 0.6, 1.85, p.ink, ' rx="0.2"') + '</g>'
    : ''

  // The sweat drop shows when the session is in trouble or Clawd is straining.
  const sweating = mood !== 'calm' || pose === 'lift'
  const drop = sweating
    ? `<path d="M13.4 2.7c.5.7.7 1 .7 1.3a.7.7 0 0 1-1.4 0c0-.3.2-.6.7-1.3z" fill="#5aa9e6">` +
      `${a.move('translate', '0 0;0 2.4', { dur: 1.8, ease: false })}${a.attr('opacity', '0;1;0', { dur: 1.8, keyTimes: '0;0.2;1', ease: false })}</path>`
    : ''

  // The whole body's motion, pivoting on the feet.
  const rigMotion: Partial<Record<Pose, string>> = {
    idle: mood === 'panic'
      ? a.move('translate', '0 0;-0.3 0;0.3 0;0 0', { dur: 0.28, ease: false })
      : a.move('translate', '0 0;0 -0.4;0 0', { dur: 2.6 }),
    think: a.move('rotate', '-1.4 8.5 11;1.4 8.5 11;-1.4 8.5 11', { dur: 3.6 }),
    type: a.move('translate', '0 0;0 0.3;0 0', { dur: 0.22, ease: false }),
    lift: pivotScale('1 0.95;1 0.95;1 1.03;1 1.03;1 0.95', 1.7, '0;0.12;0.45;0.62;1'),
    done: a.move('translate', '0 0;0 -1.9;0 0;0 -0.7;0 0;0 0', { dur: 1.5, keyTimes: '0;0.22;0.44;0.58;0.72;1' }),
    ask: a.move('translate', '0 0;0 -0.4;0 0', { dur: 1.2 }),
    write: a.move('translate', '0 0;0 0.3;0 0', { dur: 0.3, ease: false }),
    read: a.move('rotate', '-1.4 8.5 11;1.4 8.5 11;-1.4 8.5 11', { dur: 4 }),
    compact: pivotScale('1 1;1.05 0.84;1 1', 1.3),
    stop: a.move('translate', '0 0;0 -1.2;0 0;0 0', { dur: 1.6, keyTimes: '0;0.08;0.2;1' }),
    error: a.move('rotate', '-3 8.5 11;3 8.5 11;-3 8.5 11', { dur: 1.2 }),
    cold: a.move('translate', '0 0;-0.3 0;0.3 0;0 0', { dur: 0.18, ease: false }),
    sleep: pivotScale('1 1;1 1.03;1 1', 3),
    wake: pivotScale('1 1;1 1.07;1 1.07;1 1', 2.4, '0;0.35;0.55;1'),
  }
  function pivotScale(values: string, dur: number, keyTimes?: string): string {
    // Scaling pivots on the feet: shift the origin down, scale, shift back.
    return opts.animate
      ? `<animateTransform attributeName="transform" type="translate" values="8.5 11" dur="${dur}s" repeatCount="indefinite" additive="sum"/>` +
        a.move('scale', values, { dur, keyTimes }) +
        `<animateTransform attributeName="transform" type="translate" values="-8.5 -11" dur="${dur}s" repeatCount="indefinite" additive="sum"/>`
      : ''
  }

  // Props in front of the body.
  const sparkle = (d: string, begin: number) =>
    `<path d="${d}" fill="${p.spark}">${a.attr('opacity', '0.2;1;0.2', { dur: 1.1, begin })}</path>`
  const sparks = sparkle('M1.6 1.4L2 2.5L3.1 2.9L2 3.3L1.6 4.4L1.2 3.3L0.1 2.9L1.2 2.5Z', 0) +
    sparkle('M15.6 0L15.9 0.9L16.8 1.2L15.9 1.5L15.6 2.4L15.3 1.5L14.4 1.2L15.3 0.9Z', 0.35)
  const dot = (cx: number, cy: number, r: number, begin: number) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#6b6861">${a.attr('r', `${r * 0.55};${r};${r * 0.55}`, { dur: 1.5, begin })}${a.attr('opacity', '0.5;1;0.5', { dur: 1.5, begin })}</circle>`
  const codeLine = (x: number, y: number, w: number, begin: number) =>
    `<rect x="${x}" y="${y}" width="${w}" height="0.36" rx="0.18" fill="${p.ink}" opacity="${opts.animate ? 0 : 0.6}">` +
    `${a.move('translate', '0 0;0 -3.4', { dur: 1.5, begin, ease: false })}${a.attr('opacity', '0;0.9;0', { dur: 1.5, begin, keyTimes: '0;0.25;1', ease: false })}</rect>`
  const inkLine = (d: string, begin: number) =>
    `<path d="${d}"${stroke(p.ink, 0.3)} stroke-dasharray="6" stroke-dashoffset="${opts.animate ? 6 : 0}">` +
    `${a.attr('stroke-dashoffset', '6;0;0', { dur: 1.8, begin, keyTimes: '0;0.6;1', ease: false })}</path>`
  const flake = (d: string, begin: number) =>
    `<path d="${d}"${stroke(p.cold, 0.3)}>${a.move('translate', '0 -1;0 5', { dur: 2, begin, ease: false })}${a.attr('opacity', '0;1;0', { dur: 2, begin, keyTimes: '0;0.2;1', ease: false })}</path>`
  const zz = (d: string, begin: number) =>
    `<path d="${d}"${stroke(p.ink, 0.3)} opacity="${opts.animate ? 0 : 1}">${a.move('translate', '0 0;0.8 -2', { dur: 2.7, begin })}${a.attr('opacity', '0;1;0', { dur: 2.7, begin, keyTimes: '0;0.25;1' })}</path>`
  const frontFor: Partial<Record<Pose, string>> = {
    think: dot(14.4, 3.4, 0.38, 0) + dot(15.5, 2.2, 0.55, 0.2) + dot(16.9, 0.7, 0.8, 0.4),
    type: rect(5.1, 7.5, 6.8, 3.5, p.laptop, ' rx="0.5"') + `<circle cx="8.5" cy="9.2" r="0.48" fill="${p.skin}"/>` +
      rect(4.2, 10.75, 8.6, 0.6, p.laptop, ' rx="0.3"') + codeLine(14.6, 6, 1.7, 0) + codeLine(14.9, 7, 1.1, 0.5) + codeLine(14.4, 8, 1.4, 1),
    done: sparks,
    write: rect(4.4, 8.9, 8.2, 2.5, p.card, ` rx="0.3" stroke="${p.ink}" stroke-width="0.2"`) +
      inkLine('M5.2 9.75h5.4', 0) + inkLine('M5.2 10.6h3.6', 0.9) +
      `<g>${a.move('translate', '-4 0;0 0;-4 0', { dur: 1.8 })}<rect x="10.9" y="7.3" width="0.55" height="2.3" rx="0.2" fill="${p.spark}" transform="rotate(28 11.2 8.5)"/></g>`,
    read: `<g>${a.move('translate', '-4 0;0.3 0;-4 0', { dur: 4.4 })}<circle cx="10.5" cy="6.1" r="1.75" fill="#ffffff" fill-opacity="0.35" stroke="${p.ink}" stroke-width="0.35"/>` +
      `<path d="M11.8 7.4L13.5 9.1"${stroke(p.ink, 0.6)}/></g>`,
    compact: `<g>${a.move('translate', '0 0;0 1.1;0 0', { dur: 1.3 })}<path d="M6 -1.2v2.1M5.25 0.25l.75.75.75-.75"${stroke(p.ink, 0.4)}/><path d="M11 -1.2v2.1M10.25 0.25l.75.75.75-.75"${stroke(p.ink, 0.4)}/></g>`,
    stop: rect(8.15, -0.9, 0.75, 2.1, p.bad, ' rx="0.2"') + rect(8.15, 1.6, 0.75, 0.7, p.bad, ' rx="0.2"'),
    error: `<g>${a.move('rotate', '0 8.5 2.6;360 8.5 2.6', { dur: 1.6, ease: false })}` +
      ['M4.6 2.2', 'M12.4 3.1', 'M8.5 0.2'].map(m => `<path d="${m}l.25.6.6.25-.6.25-.25.6-.25-.6-.6-.25.6-.25Z" fill="${p.spark}"/>`).join('') + '</g>',
    cold: flake('M2 1v1.4M1.3 1.7h1.4', 0) + flake('M15.4 0v1.4M14.7 0.7h1.4', 0.7) + flake('M12 -1v1.4M11.3 -0.3h1.4', 1.3),
    sleep: zz('M13.6 2.6h1.1l-1.1 1.1h1.1', 0) + zz('M14.9 0.9h1.4l-1.4 1.4h1.4', 0.9) + zz('M16.4 -1h1.6l-1.6 1.6h1.6', 1.8),
  }

  const glow = pose === 'type'
    ? `<rect x="4" y="6.4" width="9" height="1.1" fill="#ffffff" opacity="0.16">${a.attr('opacity', '0.08;0.22;0.08', { dur: 2.2 })}</rect>`
    : ''
  const frost = pose === 'cold' ? `<path d="M4 4H13V9H4Z" fill="${p.cold}" opacity="0.22"/>` : ''

  const body = `<path d="${BODY}" fill="${p.skin}"/>` +
    rect(4, 8.2, 9, 0.8, '#000000', ' opacity="0.13"') + rect(4.6, 4.4, 2.4, 0.45, '#ffffff', ' opacity="0.26"') +
    rect(4.9, 7.25, 1.1, 0.5, p.blush, ' opacity="0.85"') + rect(11, 7.25, 1.1, 0.5, p.blush, ' opacity="0.85"')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -1.6 18 14.2" role="img" aria-label="${ALT[pose]}">` +
    `<title>${ALT[pose]}</title>` +
    // A new pose fades in over the old one the band keeps beneath it, so a switch never cuts.
    (opts.animate && opts.fadeIn !== false ? `<g opacity="0"><animate attributeName="opacity" from="0" to="1" begin="0s" dur="${FADE_IN_S}s" fill="freeze"/>` : '<g>') +
    `<ellipse cx="8.5" cy="11.2" rx="5.2" ry="0.5" fill="${p.ground}" opacity="0.1"/>` +
    `<g>${rigMotion[pose] ?? ''}${arms}${body}${glow}${frost}${eyes}${drop}${hold}</g>` +
    (frontFor[pose] ?? '') + '</g></svg>'
}
