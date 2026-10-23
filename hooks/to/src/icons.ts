// 16x16 stroke icons from the design page, plus a standalone SVG builder for
// the drawing layer's Svg element. Pure.

export const ICONS = {
  branch: '<circle cx="4" cy="3.5" r="1.6"></circle><circle cx="4" cy="12.5" r="1.6"></circle><circle cx="12" cy="5" r="1.6"></circle><path d="M4 5.1v5.8M12 6.6c0 2.6-4 2.2-6.6 4.2"></path>',
  clock: '<circle cx="8" cy="8" r="5.8"></circle><path d="M8 4.8V8l2.2 1.4"></path>',
  tool: '<path d="M10.2 2.2a3.2 3.2 0 0 0-3 4.3L2.6 11a1.4 1.4 0 0 0 2 2l4.6-4.6a3.2 3.2 0 0 0 4.2-3.7l-1.9 1.9-1.6-.4-.4-1.6 1.9-1.9a3.2 3.2 0 0 0-1.2-.5z"></path>',
  compact: '<path d="M3 2.5h10M3 13.5h10M8 4.3v2.8M6.4 5.7 8 7.2l1.6-1.5M8 11.7V8.9M6.4 10.3 8 8.8l1.6 1.5"></path>',
  bookmark: '<path d="M4.5 2.5h7v11L8 10.8l-3.5 2.7z"></path>',
  cold: '<path d="M8 2v12M2.8 5l10.4 6M13.2 5 2.8 11"></path>',
  hourglass: '<path d="M4.5 2.5h7M4.5 13.5h7M5 2.5c0 3 3 3.6 3 5.5s-3 2.5-3 5.5M11 2.5c0 3-3 3.6-3 5.5s3 2.5 3 5.5"></path>',
  gauge: '<path d="M2.8 11.5a5.8 5.8 0 1 1 10.4 0M8 9l2.6-3.2"></path>',
  check: '<circle cx="8" cy="8" r="5.8"></circle><path d="M5.6 8.2 7.3 9.9l3.2-3.6"></path>',
  slip: '<path d="M2.5 4.5 6.5 8.5l2.5-2.5 4.5 4.5M13.5 7v3.5H10"></path>',
  ask: '<circle cx="8" cy="8" r="5.8"></circle><path d="M6.3 6.4a1.75 1.75 0 1 1 2.4 1.6c-.45.2-.7.55-.7 1v.35M8 11.3v.05"></path>',
  saved: '<ellipse cx="8" cy="4.2" rx="4.8" ry="1.9"></ellipse><path d="M3.2 4.2v3.8c0 1 2.1 1.9 4.8 1.9s4.8-.9 4.8-1.9V4.2M3.2 8v3.8c0 1 2.1 1.9 4.8 1.9s4.8-.9 4.8-1.9V8"></path>',
} as const

export type IconName = keyof typeof ICONS

/** Default alt text naming each icon, used when the caller passes none. */
export const ICON_ALT: Record<IconName, string> = {
  branch: 'Branch',
  clock: 'Clock',
  tool: 'Tool calls',
  compact: 'Compaction',
  bookmark: 'Checkpoint',
  cold: 'Cold cache',
  hourglass: 'Cache countdown',
  gauge: 'Gauge',
  check: 'All clear',
  slip: 'Quality slipping',
  ask: 'Question',
  saved: 'Tokens saved',
}

function attr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** A complete standalone SVG string for an icon stroked in `color`. */
export function iconSvg(name: IconName, color: string, opts: { size?: number; alt?: string } = {}): string {
  const size = opts.size ?? 16
  const alt = opts.alt ?? ICON_ALT[name]
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" ` +
    `stroke="${attr(color)}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${attr(alt)}">` +
    `<title>${attr(alt)}</title>${ICONS[name]}</svg>`
  )
}
