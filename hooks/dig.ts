import type { Character } from '../types'
import { crabCss, crabSvg } from './crab'

// The side-panel scene: while files are being touched, a crab dives into a file, throws things
// out until he finds something, pops up with it, jumps into another file and peeks out of a
// third. One 10 s loop of CSS, started mid-cycle so each redraw carries on where it was.
export const DIG_W = 236
export const DIG_H = 100
export const DIG_LOOP = 10
const G = 60 // ground line
const FILE_W = 54
const XS = [8, 90, 172] as const // file left edges: A (dive in), B (jump in), C (peek out)
const HIDE = 34 // fully behind the file front (its feet stay above the panel's bottom edge)
const PEEK = 12 // eyes and the top of the head show above the file front

const xml = (s: string): string => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
const base = (p: string): string => {
  const name = p.split(/[\\/]/).filter(Boolean).pop() ?? p
  return name.length > 8 ? `${name.slice(0, 7)}…` : name
}

const ITEMS = ['#EEEDE8', '#8E929A', '#D9A23A', '#7FC4F2', '#C0705A', '#4FA37A', '#6A50AA', '#F5C542']

// Deterministic spread so each item flies its own way.
const spread = (i: number): { dx: number; h: number } => ({
  dx: ((i * 37) % 90) - 45,
  h: 26 + ((i * 53) % 30),
})

export const digSvg = (at: number, names: string[], character: Character): string => {
  const t = (at / 1000) % DIG_LOOP
  const delay = `-${t.toFixed(3)}s`
  const cx = (i: number): number => (XS[i] ?? 0) + (FILE_W - 30) / 2
  const [a, b, c] = [cx(0), cx(1), cx(2)]
  const dur = `${DIG_LOOP}s`

  const items = ITEMS.map((color, i) => {
    const s = 17 + i * 5 // percent of the loop each throw starts at
    const { dx, h } = spread(i)
    const name = `th${i}`
    const kf = `@keyframes ${name}{0%,${s}%{opacity:0;transform:translate(0,0)}${s + 0.5}%{opacity:1}${s + 2}%{transform:translate(${dx / 2}px,${-h}px)}${s + 4.5}%{opacity:1;transform:translate(${dx}px,-6px)}${s + 5.5}%,100%{opacity:0;transform:translate(${dx}px,6px)}}`
    const rect = `<g style="animation:${name} ${dur} linear infinite ${delay}"><rect x="${(XS[0] ?? 0) + FILE_W / 2 - 3}" y="${G - 12}" width="${i % 2 ? 7 : 6}" height="${i % 3 ? 6 : 8}" fill="${color}"/></g>`
    return { kf, rect }
  })

  // x/y of the crab over the loop: walk to A, dive, hidden while throwing, pop up, walk to B,
  // dive, travel unseen to C, peek, climb out, and back to the start.
  const path = `@keyframes path{
0%{transform:translate(${c}px,0)}
10%{transform:translate(${a}px,0)}
14%{transform:translate(${a}px,${HIDE}px)}
60%{transform:translate(${a}px,${HIDE}px)}
66%{transform:translate(${a}px,-6px)}
70%{transform:translate(${a}px,0)}
78%{transform:translate(${b}px,0)}
82%{transform:translate(${b}px,${HIDE}px)}
86%{transform:translate(${c}px,${HIDE}px)}
90%{transform:translate(${c}px,${PEEK}px)}
96%{transform:translate(${c}px,${PEEK}px)}
100%{transform:translate(${c}px,0)}}`
  const gem = `@keyframes gem{0%,61%{opacity:0}62%,71%{opacity:1}72%,100%{opacity:0}}`

  const files = XS.map((x, i) => {
    const label = xml(base(names[i] ?? ['index', 'src', 'README'][i] ?? 'file'))
    return {
      back: `<rect class="fb" x="${x}" y="${G - 16}" width="${FILE_W}" height="46" rx="4"/>`,
      front: `<rect class="ff" x="${x}" y="${G + 2}" width="${FILE_W}" height="${DIG_H - (G + 2)}" rx="4"/><text class="ft" x="${x + FILE_W / 2}" y="${G + 20}" text-anchor="middle" font-size="9" font-family="-apple-system,'Segoe UI',sans-serif">${label}</text>`,
    }
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${DIG_W}" height="${DIG_H}" viewBox="0 0 ${DIG_W} ${DIG_H}">${crabCss(at)}
<style>
.bg{fill:rgba(255,255,255,.78)}.fb{fill:#cfccc4}.ff{fill:#e4e1da}.ft{fill:#4a4a47}
@media (prefers-color-scheme: dark){.bg{fill:rgba(24,24,23,.82)}.fb{fill:#3a3a38}.ff{fill:#2c2c2b}.ft{fill:#b8b8b4}}
g{transform-box:fill-box}
${path}
${gem}
${items.map(i => i.kf).join('\n')}
</style>
<rect class="bg" x="0" y="0" width="${DIG_W}" height="${DIG_H}" rx="12"/>
${files.map(f => f.back).join('')}
${items.map(i => i.rect).join('')}
<g style="animation:path ${dur} linear infinite ${delay}">
${crabSvg('working', 0, G - 27, true, character)}
<rect x="24" y="${G - 36}" width="8" height="8" fill="#F5C542" style="animation:gem ${dur} linear infinite ${delay}"/>
</g>
${files.map(f => f.front).join('')}
</svg>`
}
