import type { Character, Outfit } from '../types'

// Pixel Clawd on a 30-wide grid, matching the Mascot Studio reference sheet: body 16x13,
// claws 4x4, eyes 2x2, four 2x4 legs. Groups: `la`/`lb` leg pairs, everything else rides
// inside `.body`; a class names a prop so CSS can move it on its own.
export const CRAB_SCALE = 1
export const CRAB_W = 30 * CRAB_SCALE
// Feet sit at grid y=27; the tallest hat reaches y=-4, a flying crab lifts 5 more.
export const CRAB_H = 27 * CRAB_SCALE
export const BAR_H = 10
export const BAR_Y = Math.round(31 * CRAB_SCALE + 6)
export const ROW_H = BAR_Y + BAR_H + 3
// Sizes drawn in pixels (the code window) follow the crab's scale.
export const PX = CRAB_SCALE / 0.75

const CLAY = '#D97757'
const INK = '#1F1E1D'
const GLASS = 'rgba(169,214,245,.55)'
const GOLD = '#D9A23A'
const PAPER = '#EEEDE8'

type Fill = (x: number, y: number, w: number, h: number, c: string, cls?: string) => void

const stamp = (f: Fill, x: number, y: number, rows: string[], map: Record<string, string>, cls?: string): void =>
  rows.forEach((row, dy) => [...row].forEach((ch, dx) => map[ch] && f(x + dx, y + dy, 1, 1, map[ch] ?? '', cls)))

// What differs between characters: the body, eyes, legs and arms. Outfits are drawn on top.
type Parts = {
  legs: (f: Fill) => void
  torso: (f: Fill) => void
  eyes: (f: Fill, y: number) => void
  arm: (f: Fill, x: number, y: number, cls?: string) => void
}

const solid = (color: string) => (f: Fill, x: number, y: number, cls?: string): void => f(x, y, 4, 4, color, cls)
// Arms are only drawn when a prop needs holding.
const propArm = (color: string) => (f: Fill, x: number, y: number, cls?: string): void => {
  if (cls) f(x, y, 4, 4, color, cls)
}
const fourLegs = (color: string) => (f: Fill): void => {
  f(7, 23, 2, 4, color, 'la')
  f(17, 23, 2, 4, color, 'la')
  f(11, 23, 2, 4, color, 'lb')
  f(21, 23, 2, 4, color, 'lb')
}
const pair = (color: string, w = 4) => (f: Fill): void => {
  f(7, 23, w, 4, color, 'la')
  f(23 - w, 23, w, 4, color, 'la')
  f(7 + w + 1, 23, w, 4, color, 'lb')
  f(22 - 2 * w, 23, w, 4, color, 'lb')
}

const FROG = '#C66B3E'
const FROG_LIGHT = '#DA8E5E'
const CAT = '#E39A4A'
const CREEPER = '#5DAA4E'
const SLIME = '#6CC25F'
const STEEL_BLUE = '#9AA4B0'

const CHARS: Record<Character, Parts> = {
  // The default: Clawd, the crab.
  claude: {
    legs: fourLegs(CLAY),
    torso: f => f(7, 10, 16, 13, CLAY),
    eyes: (f, y) => {
      f(9, y, 2, 2, INK, 'eye')
      f(19, y, 2, 2, INK, 'eye')
    },
    arm: solid(CLAY),
  },
  // The Minecraft warm frog: squat, bulging eyes with wide black pupils, tan belly, big back legs.
  frog: {
    legs: f => {
      f(2, 19, 6, 8, FROG, 'la'); f(22, 19, 6, 8, FROG, 'la'); f(0, 26, 3, 1, FROG_LIGHT, 'la'); f(27, 26, 3, 1, FROG_LIGHT, 'la')
      f(10, 23, 4, 4, FROG, 'lb'); f(16, 23, 4, 4, FROG, 'lb'); f(9, 26, 6, 1, FROG_LIGHT, 'lb'); f(15, 26, 6, 1, FROG_LIGHT, 'lb')
    },
    torso: f => {
      f(7, 12, 16, 11, FROG); f(7, 9, 6, 4, FROG); f(17, 9, 6, 4, FROG)
      f(8, 9, 4, 1, FROG_LIGHT); f(18, 9, 4, 1, FROG_LIGHT)
      f(11, 17, 8, 6, '#E2C285'); f(8, 16, 14, 1, '#8E4A2A')
    },
    eyes: (f, y) => {
      f(8, y - 1, 4, 2, INK, 'eye'); f(18, y - 1, 4, 2, INK, 'eye')
      f(8, y - 2, 4, 1, '#8A8D4B'); f(18, y - 2, 4, 1, '#8A8D4B')
    },
    arm: solid(FROG),
  },
  // The Minecraft creeper: green block, dark face, stub legs.
  creeper: {
    legs: pair('#3E7F36'),
    torso: f => {
      f(7, 10, 16, 13, CREEPER)
      f(8, 11, 2, 2, '#3E7F36'); f(20, 12, 2, 2, '#3E7F36'); f(10, 20, 2, 2, '#3E7F36'); f(18, 19, 3, 2, '#3E7F36')
      f(13, 15, 4, 2, INK); f(12, 17, 2, 3, INK); f(16, 17, 2, 3, INK)
    },
    eyes: (f, y) => {
      f(9, y, 3, 3, INK, 'eye')
      f(18, y, 3, 3, INK, 'eye')
    },
    arm: propArm(CREEPER),
  },
  // The Minecraft slime: a wobbly green cube with a darker core.
  slime: {
    legs: () => {},
    torso: f => {
      f(7, 11, 16, 12, SLIME); f(10, 14, 10, 7, '#4E9F47'); f(8, 12, 3, 1, '#B8F0A8'); f(9, 13, 1, 2, '#B8F0A8')
      f(14, 19, 2, 1, INK)
    },
    eyes: (f, y) => {
      f(11, y + 1, 2, 2, INK, 'eye')
      f(17, y + 1, 2, 2, INK, 'eye')
    },
    arm: propArm(SLIME),
  },
  // A little robot: steel body, cyan eyes, antenna with a light.
  robot: {
    legs: pair('#6B7480', 3),
    torso: f => {
      f(7, 10, 16, 13, STEEL_BLUE); f(10, 16, 10, 5, '#5B6570'); f(11, 17, 2, 1, '#E0505A'); f(14, 17, 2, 1, '#5FBF8F'); f(17, 17, 2, 1, '#F5C542')
      f(14, 6, 2, 4, '#6B7480'); f(13, 4, 4, 2, '#E0505A', 'ant')
    },
    eyes: (f, y) => {
      f(9, y, 3, 2, '#7FD6FF', 'eye')
      f(18, y, 3, 2, '#7FD6FF', 'eye')
    },
    arm: solid('#6B7480'),
  },
  // A tabby cat: ears, stripes, whiskers.
  cat: {
    legs: fourLegs(CAT),
    torso: f => {
      f(7, 10, 16, 13, CAT); f(7, 6, 4, 5, CAT); f(19, 6, 4, 5, CAT); f(8, 7, 2, 3, '#F2B6A0'); f(20, 7, 2, 3, '#F2B6A0')
      f(10, 10, 2, 3, '#B8702E'); f(14, 10, 2, 2, '#B8702E'); f(18, 10, 2, 3, '#B8702E')
      f(14, 15, 2, 1, '#E58AA0'); f(3, 15, 5, 1, '#F2F0EA'); f(22, 15, 5, 1, '#F2F0EA')
      f(23, 20, 6, 2, CAT, 'tail'); f(27, 14, 2, 8, CAT, 'tail')
    },
    eyes: (f, y) => {
      f(9, y, 2, 3, INK, 'eye')
      f(19, y, 2, 3, INK, 'eye')
    },
    arm: solid(CAT),
  },
}

export const CHARACTERS = Object.keys(CHARS) as Character[]

// The colour of the thing he pulls out of his pocket when changing into each outfit.
export const ITEM_COLOR: Partial<Record<Outfit, string>> = {
  coding: '#2B2B2D',
  walkCmd: '#2B2B2D',
  cool: '#2B2B2D',
  walkCool: '#2B2B2D',
  fixing: '#6A50AA',
  walkWizard: '#6A50AA',
  chef: '#F4F3EE',
  walkChef: '#F4F3EE',
  reading: '#EEEDE8',
  writing: '#EEEDE8',
  walkCode: '#EEEDE8',
  sleeping: '#3C79B8',
  propeller: '#3FA796',
  fly: '#3FA796',
  idle: '#A9D6F5',
  sunbathe: '#D8503F',
}

// Where the item ends up: on his head, in front of his eyes, in front of his belly, or held up.
export type Dest = 'head' | 'face' | 'belly' | 'hand'
export const ITEM_DEST: Partial<Record<Outfit, Dest>> = {
  fixing: 'head', walkWizard: 'head', chef: 'head', walkChef: 'head', sleeping: 'head', propeller: 'head', fly: 'head', sunbathe: 'head',
  coding: 'face', walkCmd: 'face', cool: 'face', walkCool: 'face',
  reading: 'belly', writing: 'belly', walkCode: 'belly',
  idle: 'hand',
}
const DEST_XY: Record<Dest, [number, number]> = { head: [-10, -15], face: [-9, -3], belly: [-12, 4], hand: [-2, -8] }

// The item held up during a change; set by crabSvg.
let ITEM = '#888888'

// Set by crabSvg for the drawing in progress.
let P: Parts = CHARS.claude
const legs = (f: Fill): void => P.legs(f)
const torso = (f: Fill): void => P.torso(f)
const eyes = (f: Fill, y = 12): void => P.eyes(f, y)
const happyEyes = (f: Fill): void => {
  stamp(f, 9, 12, ['.x.', 'x.x'], { x: INK })
  stamp(f, 19, 12, ['.x.', 'x.x'], { x: INK })
}
const shutEyes = (f: Fill): void => {
  f(9, 13, 2, 1, INK)
  f(19, 13, 2, 1, INK)
}
const lClaw = (f: Fill, y = 15, cls?: string): void => P.arm(f, 3, y, cls)
const rClaw = (f: Fill, y = 15, cls?: string): void => P.arm(f, 23, y, cls)
const shades = (f: Fill): void => {
  f(8, 11, 5, 3, INK)
  f(17, 11, 5, 3, INK)
  f(13, 11, 4, 1, INK)
  f(9, 12, 2, 1, '#6B6B6B')
  f(19, 12, 2, 1, '#6B6B6B')
}
// An open book held over his belly; the right page turns.
const book = (f: Fill): void => {
  f(6, 17, 19, 9, INK)
  f(7, 18, 8, 7, PAPER)
  f(16, 18, 8, 7, PAPER, 'pg')
  f(8, 19, 6, 1, CLAY)
  f(8, 21, 6, 1, CLAY)
  f(17, 19, 6, 1, CLAY, 'pg')
  f(17, 21, 6, 1, CLAY, 'pg')
}

const WIZ = { p: '#6A50AA', l: '#A992E0', g: GOLD }
const CAP = { b: '#3C79B8', w: '#F2F0EA' }

const wizHat = (f: Fill): void => {
  stamp(f, 5, -4, [
      '..........pp........',
      '..........pp........',
      '.........ppp........',
      '.........ppp........',
      '.........ppp........',
      '.......pppppp.......',
      '.......ppgppp.......',
      '.....pppggggppp.....',
      '.....pppppgpppp.....',
      '.....pppppppppp.....',
      '...llllllllllllll...',
      '...pppppppppppppp...',
      'pppppppppppppppppppp',
      'pppppppppppppppppppp',
    ], WIZ)
}
const toque = (f: Fill): void => {
  stamp(f, 6, 0, ['........lll.......', '.......lllll......', '.wwwwgwwwwwwgwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwgwwwwwggwwwww', '.wwwwgwwwwwggwwwww', '.bbbbbbbbbbbbbbbb.', '.bbbbbbbbbbbbbbbb.', '.bbbbbbbbbbbbbbbb.'], { w: '#F4F3EE', l: '#F7F6F2', g: '#D2D1C8', b: '#E6E4DA' })
}
const propCap = (f: Fill): void => {
  f(9, 8, 12, 2, '#3C79B8'); f(11, 6, 8, 2, '#B5432A'); f(13, 4, 4, 2, '#C9A24A'); f(14, 2, 2, 2, INK); f(9, 1, 12, 1, '#3FA796', 'prop')
}
// A small floating code panel he reads while walking.
const codePanel = (f: Fill): void => {
  f(18, 1, 12, 8, INK); f(19, 2, 10, 6, PAPER)
  f(20, 3, 6, 1, '#7FC4F2', 'ln1'); f(21, 5, 8, 1, CLAY, 'ln2'); f(20, 7, 4, 1, '#4FA37A', 'ln3')
}

// Victory poses; the character's own flourish (CSS `vc-<name>`) rides on these.
export const WIN: ReadonlySet<Outfit> = new Set<Outfit>(['done', 'crown', 'exitCar', 'medal', 'winCode', 'winFix', 'winRead', 'winWrite'])

// A little red convertible; `dx` parks it beside the crab. Drawn in front of his belly.
const car = (f: Fill, dx = 0): void => {
  f(dx, 20, 28, 5, '#D9453B', 'car'); f(dx, 20, 28, 1, '#B8352D', 'car'); f(dx + 4, 22, 20, 1, 'rgba(255,255,255,.35)', 'car')
  f(dx + 27, 21, 3, 2, '#FFE9A8', 'car')
  f(dx + 3, 24, 6, 4, INK, 'wh'); f(dx + 4, 25, 4, 2, '#8E929A', 'hub'); f(dx + 19, 24, 6, 4, INK, 'wh'); f(dx + 20, 25, 4, 2, '#8E929A', 'hub')
}

const DRAW: Record<Outfit, (f: Fill) => void> = {
  // Idle: holds a magnifying glass and looks up at the code.
  idle: f => {
    legs(f); torso(f); lClaw(f); rClaw(f, 9, 'it'); eyes(f, 11)
    stamp(f, 22, 0, ['.kkkk.', 'kllllk', 'klwllk', 'kllllk', 'kllllk', '.kkkk.'], { k: '#3A3A3C', l: GLASS, w: '#fff' }, 'it')
    f(24, 6, 1, 3, '#7A4A26', 'it')
  },
  // Stroll: just walking about, arms swinging.
  stroll: f => {
    legs(f); torso(f); lClaw(f, 15, 'ta'); rClaw(f, 15, 'tb'); eyes(f)
  },
  // Coding: sunglasses and a terminal window held over his belly; claws at the sides.
  coding: f => {
    legs(f); torso(f); lClaw(f, 15, 'ta'); rClaw(f, 15, 'tb'); shades(f)
    f(6, 18, 19, 7, INK); f(7, 19, 17, 5, PAPER)
    stamp(f, 9, 20, ['x.', '.x', 'x.'], { x: INK })
    f(13, 20, 5, 1, CLAY, 'ln1'); f(13, 22, 7, 1, '#4FA37A', 'ln2'); f(21, 20, 1, 1, '#8E929A', 'ln3')
  },
  // Fixing: wizard hat and a wand that waves and sparkles.
  fixing: f => {
    legs(f); torso(f); lClaw(f); eyes(f); rClaw(f, 9, 'it')
    wizHat(f)
    f(26, 8, 1, 1, '#7A4A26', 'it'); f(27, 7, 1, 1, '#7A4A26', 'it'); f(28, 6, 1, 1, '#7A4A26', 'it'); f(29, 5, 1, 1, '#7A4A26', 'it')
    f(28, 3, 2, 2, '#F5C542', 'it'); f(26, 1, 1, 1, '#fff', 'sp'); f(29, 8, 1, 1, '#fff', 'st'); f(25, 4, 1, 1, '#F5C542', 'st')
  },
  // Chef: for the long jobs; tosses an omelette and now and then wipes his forehead.
  chef: f => {
    legs(f); torso(f); eyes(f)
    toque(f)
    lClaw(f, 15, 'wipe'); rClaw(f, 10, 'pan')
    f(22, 8, 7, 2, '#4A4A48', 'pan'); f(26, 10, 1, 1, '#4A4A48', 'pan'); f(24, 7, 3, 1, '#F5B731', 'egg')
    f(2, 7, 2, 3, '#7FC4F2', 'drop')
  },
  // Reading: nose in a book while he goes through files.
  reading: f => {
    legs(f); torso(f); lClaw(f, 16); rClaw(f, 16); eyes(f, 13); book(f)
  },
  // Writing: the same book with a pencil scribbling.
  writing: f => {
    legs(f); torso(f); lClaw(f, 16); rClaw(f, 16); eyes(f, 13); book(f)
    f(24, 16, 1, 1, INK, 'wr'); f(25, 15, 1, 1, '#F5C542', 'wr'); f(26, 14, 1, 1, '#F5C542', 'wr'); f(27, 13, 1, 1, '#E8B04A', 'wr'); f(28, 12, 1, 1, '#C0705A', 'wr')
  },
  // Sleeping: nightcap, eyes shut, a pair of Zs floating up.
  sleeping: f => {
    legs(f); torso(f); lClaw(f); rClaw(f); shutEyes(f)
    stamp(f, 7, 4, [
      '...bbbbbb.......',
      '.bbbbbbbbbb.....',
      'bbbbbbbbbbbbbb..',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
      'wwwwwwwwwwwwwwww',
    ], CAP)
    f(22, 9, 3, 3, '#F2F0EA')
    stamp(f, 24, 3, ['zzz', '..z', '.z.', 'z..', 'zzz'], { z: '#C0705A' }, 'z1')
    stamp(f, 27, -2, ['zz', '.z', 'z.', 'zz'], { z: '#C0705A' }, 'z2')
  },
  // Working, no special task: thinking, three dots rising above his head.
  working: f => {
    legs(f); torso(f); lClaw(f); rClaw(f); eyes(f)
    f(13, 5, 2, 2, '#C0705A', 'd1'); f(17, 3, 2, 2, '#C0705A', 'd2'); f(21, 5, 2, 2, '#C0705A', 'd3')
  },
  // Just finished: claws up, happy eyes.
  done: f => {
    legs(f); torso(f); happyEyes(f)
    lClaw(f, 8, 'cheer'); rClaw(f, 8, 'cheer')
    f(1, 3, 1, 1, '#F5C542', 'st'); f(28, 3, 1, 1, '#F5C542', 'st'); f(14, 4, 2, 2, '#F5C542', 'sp')
  },
  // Finished a long job: crown.
  crown: f => {
    legs(f); torso(f); lClaw(f); rClaw(f); happyEyes(f)
    f(10, 4, 2, 3, GOLD); f(14, 3, 2, 4, GOLD); f(18, 4, 2, 3, GOLD); f(10, 7, 10, 3, GOLD); f(10, 9, 10, 1, '#B8841F')
    f(14, 8, 2, 1, '#C0392B', 'gem')
  },
  // Something went wrong: a shaken crab with an exclamation mark.
  error: f => {
    legs(f); torso(f); lClaw(f); rClaw(f); shutEyes(f)
    f(14, 0, 2, 6, '#C0392B', 'ex'); f(14, 7, 2, 2, '#C0392B', 'ex')
  },
  // Greeting: waves with the right claw.
  greeting: f => {
    legs(f); torso(f); lClaw(f); happyEyes(f); rClaw(f, 7, 'wv')
  },
  // Propeller cap: the blades spin.
  propeller: f => {
    legs(f); torso(f); lClaw(f); rClaw(f); eyes(f)
    propCap(f)
  },
  // Cool: just the sunglasses.
  cool: f => {
    legs(f); torso(f); lClaw(f); rClaw(f); shades(f)
  },
  // Sunbathe: stretched out on a deck chair under a striped umbrella, sunglasses on.
  sunbathe: f => {
    f(14, 0, 2, 11, '#CDBB93', 'um')
    const span = (y: number, x0: number, x1: number): void => {
      for (let x = x0; x <= x1; x++) f(x, y, 1, 1, Math.floor((x - 5) / 3) % 2 === 0 ? '#D8503F' : '#F4F1EA', 'um')
    }
    span(-4, 13, 21); span(-3, 10, 24); span(-2, 7, 27); span(-1, 5, 29)
    f(0, -3, 4, 4, '#F5C542', 'sun'); f(5, -3, 1, 1, '#F5C542', 'sun')
    legs(f); torso(f); lClaw(f, 16); rClaw(f, 16); shades(f)
    f(3, 22, 24, 2, '#4FA3C7'); f(5, 22, 2, 2, '#F4F1EA'); f(13, 22, 2, 2, '#F4F1EA'); f(21, 22, 2, 2, '#F4F1EA')
    f(4, 24, 2, 3, '#8E929A'); f(24, 24, 2, 3, '#8E929A')
  },
  // On the move: a plain stroll with sunglasses on.
  walkCool: f => {
    legs(f); torso(f); lClaw(f, 15, 'ta'); rClaw(f, 15, 'tb'); shades(f)
  },
  // On the move in a wizard hat.
  walkWizard: f => {
    legs(f); torso(f); lClaw(f, 15, 'ta'); rClaw(f, 15, 'tb'); eyes(f); wizHat(f)
  },
  // On the move in a chef's toque.
  walkChef: f => {
    legs(f); torso(f); lClaw(f, 15, 'ta'); rClaw(f, 15, 'tb'); eyes(f); toque(f)
  },
  // Flying: the propeller cap lifts him off the bar, claws flapping, legs dangling.
  fly: f => {
    legs(f); torso(f); lClaw(f, 12, 'fa'); rClaw(f, 12, 'fb'); eyes(f); propCap(f)
  },
  // Looking up at a code panel while he walks.
  walkCode: f => {
    legs(f); torso(f); lClaw(f, 15, 'ta'); rClaw(f, 15, 'tb')
    f(10, 11, 2, 2, INK, 'eye'); f(20, 11, 2, 2, INK, 'eye')
    codePanel(f)
  },
  // Running commands on a terminal while he walks.
  walkCmd: f => {
    legs(f); torso(f); lClaw(f, 15, 'ta'); rClaw(f, 15, 'tb'); shades(f)
    f(6, 18, 19, 7, INK); f(7, 19, 17, 5, PAPER)
    stamp(f, 9, 20, ['x.', '.x', 'x.'], { x: INK })
    f(13, 20, 5, 1, CLAY, 'ln1'); f(13, 22, 7, 1, '#4FA37A', 'ln2'); f(21, 20, 1, 1, '#8E929A', 'ln3')
  },
  // The bar just jumped: sprinting, leaning forward, speed lines streaming behind.
  run: f => {
    legs(f); torso(f); lClaw(f, 14, 'ra'); rClaw(f, 14, 'rb'); eyes(f, 11)
    f(-4, 13, 7, 1, 'rgba(140,140,140,.65)', 'sl'); f(-6, 17, 8, 1, 'rgba(140,140,140,.5)', 'sl'); f(-3, 21, 6, 1, 'rgba(140,140,140,.65)', 'sl')
    f(3, 26, 3, 2, '#C9C5BC', 'dust'); f(0, 25, 2, 2, '#D8D4CB', 'dust')
  },
  // An even bigger leap: behind the wheel of a little red convertible, shades on, wheels spinning.
  drive: f => {
    torso(f); lClaw(f, 14, 'ra'); rClaw(f, 14, 'rb'); shades(f)
    car(f)
    f(-9, 14, 9, 1, 'rgba(140,140,140,.65)', 'sl'); f(-12, 19, 11, 1, 'rgba(140,140,140,.5)', 'sl'); f(-8, 23, 8, 1, 'rgba(140,140,140,.65)', 'sl')
    f(-3, 22, 3, 3, '#C9C5BC', 'dust'); f(-6, 25, 3, 3, '#D8D4CB', 'dust')
  },
  // ...and then stopped: bent over, gasping, sweating, little clouds of breath.
  pant: f => {
    legs(f); torso(f); lClaw(f, 17); rClaw(f, 17); shutEyes(f)
    f(13, 16, 4, 3, INK, 'mouth')
    f(5, 9, 2, 3, '#7FC4F2', 'sw'); f(24, 8, 2, 3, '#7FC4F2', 'sw')
    f(26, 15, 3, 2, '#FFFFFF', 'hf'); f(28, 18, 2, 2, '#FFFFFF', 'hf'); f(1, 15, 3, 2, '#FFFFFF', 'hf')
  },
  // Between the drive and the victory: the car brakes, wheels still, smoke and brake lights.
  park: f => {
    torso(f); lClaw(f, 14); rClaw(f, 14); eyes(f, 11)
    car(f)
    f(0, 21, 2, 2, '#FF3B30', 'bl')
    f(-3, 25, 3, 3, '#C9C5BC', 'dust'); f(-7, 23, 3, 3, '#D8D4CB', 'dust'); f(-10, 28, 10, 1, '#8E929A')
    f(24, 14, 2, 3, '#7FC4F2', 'sw')
  },
  // Between a finished task and its victory: a crouch, claws coming up, sparks drawn in.
  brace: f => {
    legs(f); torso(f); lClaw(f, 17, 'wd'); rClaw(f, 17, 'wd'); eyes(f, 11)
    f(1, 5, 2, 2, GOLD, 'g1'); f(27, 5, 2, 2, GOLD, 'g2'); f(14, 0, 2, 2, '#fff', 'g3')
  },
  // Victory after the car: he has climbed out, the car is parked beside him, claws up.
  exitCar: f => {
    legs(f); torso(f); happyEyes(f); lClaw(f, 8, 'cheer'); rClaw(f, 8, 'cheer')
    car(f, -26)
    f(1, 3, 1, 1, '#F5C542', 'st'); f(28, 3, 1, 1, '#F5C542', 'st'); f(14, 4, 2, 2, '#F5C542', 'sp')
  },
  // Victory after the sprint: a gold medal on a red and blue ribbon.
  medal: f => {
    legs(f); torso(f); happyEyes(f); lClaw(f, 8, 'cheer'); rClaw(f, 8, 'cheer')
    f(12, 14, 2, 2, '#D9453B'); f(14, 16, 2, 2, '#D9453B'); f(18, 14, 2, 2, '#3B6FD9'); f(16, 16, 2, 2, '#3B6FD9')
    f(13, 18, 6, 5, GOLD); f(14, 19, 4, 3, '#F2C14E'); f(15, 20, 2, 1, '#FFF3C4', 'gem')
    f(1, 3, 1, 1, '#F5C542', 'st'); f(28, 3, 1, 1, '#F5C542', 'st'); f(14, 4, 2, 2, '#F5C542', 'sp')
  },
  // Victory after coding: shades on, the terminal shows a green check.
  winCode: f => {
    legs(f); torso(f); shades(f); lClaw(f, 8, 'cheer'); rClaw(f, 8, 'cheer')
    f(6, 18, 19, 7, INK); f(7, 19, 17, 5, PAPER)
    stamp(f, 12, 19, ['......x', '.....x.', 'x...x..', '.x.x...', '..x....'], { x: '#4FA37A' }, 'gem')
    f(1, 3, 1, 1, '#F5C542', 'st'); f(28, 3, 1, 1, '#F5C542', 'sp')
  },
  // Victory after fixing: the wizard throws a firework from the wand.
  winFix: f => {
    legs(f); torso(f); lClaw(f, 15); happyEyes(f); wizHat(f); rClaw(f, 8, 'cheer')
    f(26, 5, 2, 2, GOLD, 'sp'); f(29, 8, 1, 1, '#fff', 'st'); f(23, 3, 1, 1, '#F5C542', 'st'); f(1, 4, 2, 2, '#A992E0', 'sp'); f(2, 10, 1, 1, '#fff', 'st')
  },
  // Victory after reading: the book is shut and held over his head.
  winRead: f => {
    legs(f); torso(f); happyEyes(f); lClaw(f, 8, 'cheer'); rClaw(f, 8, 'cheer')
    f(9, 1, 12, 8, '#3C79B8'); f(9, 1, 2, 8, '#2B5C93'); f(13, 3, 5, 1, PAPER); f(13, 5, 3, 1, PAPER); f(22, 1, 1, 1, '#F5C542', 'sp')
  },
  // Victory after writing: the finished page, ticked off, held over his head.
  winWrite: f => {
    legs(f); torso(f); happyEyes(f); lClaw(f, 8, 'cheer'); rClaw(f, 8, 'cheer')
    f(10, 0, 10, 10, INK); f(11, 1, 8, 8, PAPER); f(12, 2, 5, 1, CLAY); f(12, 4, 6, 1, CLAY)
    stamp(f, 14, 6, ['..x', 'x.x', '.x.'], { x: '#4FA37A' }, 'gem')
  },
  // The prompt cache went cold: shivering inside a cube of ice.
  frozen: f => {
    legs(f); torso(f); lClaw(f); rClaw(f); eyes(f, 11)
    f(1, 2, 28, 27, 'rgba(150,215,245,.3)', 'ice'); f(3, 0, 28, 2, 'rgba(215,242,253,.9)', 'ice'); f(29, 2, 3, 27, 'rgba(100,170,212,.75)', 'ice')
    f(1, 2, 28, 1, '#D9F2FD', 'ice'); f(1, 2, 1, 27, '#D9F2FD', 'ice'); f(1, 28, 28, 1, '#6FB6DB', 'ice')
    f(3, 4, 5, 1, '#FFFFFF', 'ice'); f(3, 5, 1, 4, '#FFFFFF', 'ice')
    f(22, 24, 2, 2, '#FFFFFF', 'gl'); f(9, 8, 1, 1, '#FFFFFF', 'gl'); f(25, 10, 1, 1, '#FFFFFF', 'gl')
  },
  // Changing costume: digs the next one out of a belly pocket, holds it over his head, puffs.
  changing: f => {
    legs(f); torso(f); lClaw(f); eyes(f)
    rClaw(f, 15, 'pk')
    f(24, 8, 8, 5, ITEM, 'itm'); f(25, 9, 3, 1, 'rgba(255,255,255,.65)', 'itm')
    f(11, 4, 2, 2, '#fff', 'puff'); f(18, 3, 2, 2, '#fff', 'puff'); f(14, 0, 2, 2, '#fff', 'puff'); f(8, 7, 2, 2, '#fff', 'puff'); f(21, 7, 2, 2, '#fff', 'puff')
  },
  // Dance: claws pumping, hopping.
  dance: f => {
    legs(f); torso(f); lClaw(f, 15, 'da'); rClaw(f, 15, 'db'); happyEyes(f)
  },
}

export const crabSvg = (
  outfit: Outfit,
  x: number,
  y: number,
  isWalking = false,
  character: Character = 'claude',
  change?: { item: string; age: number; dest?: Dest },
  settle?: number,
): string => {
  P = CHARS[character] ?? CHARS.claude
  ITEM = change?.item ?? '#888888'
  const groups = new Map<string, string[]>()
  const f: Fill = (cx, cy, w, h, c, cls = 'bd') => {
    let g = groups.get(cls)
    if (!g) groups.set(cls, (g = []))
    g.push(`<rect x="${cx}" y="${cy}" width="${w}" height="${h}" fill="${c}"/>`)
  }
  DRAW[outfit](f)
  const [tx, ty] = DEST_XY[change?.dest ?? 'head']
  const phase = outfit === 'changing' && change ? `style="animation-delay:-${Math.round(change.age)}ms;--tx:${tx}px;--ty:${ty}px"` : ''
  const pop = settle !== undefined && settle >= 0 && settle < 400
  const grp = (k: string): string => `<g class="${k}" ${phase}>${groups.get(k)?.join('') ?? ''}</g>`
  // Legs go behind the body; the car goes in front of it and stays put while he bounces.
  const BEHIND = ['la', 'lb']
  const FRONT = ['car', 'wh', 'hub']
  const legPairs = BEHIND.filter(k => groups.has(k)).map(grp).join('')
  const front = FRONT.filter(k => groups.has(k)).map(grp).join('')
  const rest = [...groups.keys()].filter(k => !BEHIND.includes(k) && !FRONT.includes(k)).map(grp).join('')
  const cls = `c-${outfit}${WIN.has(outfit) ? ` win vc-${character}` : ''}${isWalking ? ' walk' : ''}${outfit === 'stroll' || outfit.startsWith('walk') ? ' amble' : ''}`
  return `<g transform="translate(${x},${y}) scale(${CRAB_SCALE})" shape-rendering="crispEdges">${pop ? `<g class="pop" style="animation-delay:-${Math.round(settle ?? 0)}ms">` : ''}<g class="${cls}">${legPairs}<g class="body">${rest}</g>${front}</g>${pop ? '</g>' : ''}</g>`
}

// The code the idle crab studies, beside him.
export const codeWindow = (x: number, y: number): string => `<g class="win" transform="translate(${x},${y}) scale(${PX})">
<rect class="k" x="0" y="0" width="40" height="18" rx="2"/>
<rect class="ln1" x="4" y="3" width="14" height="2" fill="#7FC4F2"/>
<rect class="ln2" x="8" y="7" width="22" height="2" fill="${CLAY}"/>
<rect class="ln3" x="4" y="11" width="10" height="2" fill="#8FD694"/>
</g>`

// Every loop is started `at` into its cycle, so the drawing that replaces this one each
// second carries on from where the last left off instead of restarting.
export const crabCss = (at: number): string => {
  const s = at / 1000
  const d = (period: number, offset = 0): string => `-${((s + offset) % period).toFixed(3)}s`
  return `<style>
g{transform-box:fill-box}
.k{fill:#e4e4e2}.m{fill:#8a8a8a}
@media (prefers-color-scheme: dark){.k{fill:#2c2c2c}.m{fill:#9a9a9a}}
.body{animation:bob 1s ease-in-out infinite ${d(1)}}
@keyframes bob{50%{transform:translateY(1px)}}
.eye{animation:eb 5s steps(1) infinite ${d(5)}}
@keyframes eb{0%,94%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
.walk .la{animation:st .5s steps(1) infinite ${d(0.5)}}.walk .lb{animation:st .5s steps(1) infinite ${d(0.5, 0.25)}}
.amble.walk .la{animation:st .8s steps(1) infinite ${d(0.8)}}.amble.walk .lb{animation:st .8s steps(1) infinite ${d(0.8, 0.4)}}
.walk .ta{animation:sw .5s steps(1) infinite ${d(0.5, 0.25)}}.walk .tb{animation:sw .5s steps(1) infinite ${d(0.5)}}
@keyframes st{50%{transform:translateY(-3px)}}
@keyframes sw{50%{transform:translateY(2px)}}
.c-working .d1,.c-working .d2,.c-working .d3{animation:dot 1.5s steps(1) infinite ${d(1.5)}}
.c-working .d2{animation-delay:${d(1.5, 1)}}.c-working .d3{animation-delay:${d(1.5, 0.5)}}
@keyframes dot{0%{opacity:0}33%{opacity:1}100%{opacity:1}}
.c-idle .it{transform-origin:50% 100%;animation:sweep 3s ease-in-out infinite ${d(3)}}
@keyframes sweep{0%,100%{transform:rotate(-8deg) translateX(-1px)}50%{transform:rotate(10deg) translateX(1px)}}
.c-idle .eye{animation:lookup 4s steps(1) infinite ${d(4)}}
@keyframes lookup{0%,100%{transform:translate(0,0)}30%{transform:translate(1px,-1px)}60%{transform:translate(0,-1px)}}
.ln1{animation:cur 1.4s steps(1) infinite ${d(1.4)}}.ln2{animation:cur 1.4s steps(1) infinite ${d(1.4, 0.5)}}.ln3{animation:cur 1.4s steps(1) infinite ${d(1.4, 0.9)}}
@keyframes cur{50%{opacity:.35}}
.c-coding .ta{animation:tap .3s steps(1) infinite ${d(0.3)}}.c-coding .tb{animation:tap .3s steps(1) infinite ${d(0.3, 0.15)}}
@keyframes tap{50%{transform:translateY(2px)}}
.c-fixing .it{transform-origin:0 100%;animation:wave 1.2s ease-in-out infinite ${d(1.2)}}
@keyframes wave{50%{transform:rotate(-25deg)}}
.c-fixing .sp,.c-done .sp{animation:blink .6s steps(1) infinite ${d(0.6)}}.c-fixing .st,.c-done .st{animation:blink .6s steps(1) infinite ${d(0.6, 0.3)}}
@keyframes blink{50%{opacity:.1}}
.c-chef .pan{transform-origin:0 50%;animation:tilt 1s ease-in-out infinite ${d(1)}}
.c-chef .egg{animation:flip 1s ease-in-out infinite ${d(1)}}
@keyframes tilt{20%,40%{transform:rotate(-12deg)}}
@keyframes flip{30%{transform:translateY(-5px) scaleY(-1)}60%{transform:translateY(0)}}
.c-chef .wipe{animation:wipe 11.3s ease-in-out infinite ${d(11.3)}}
@keyframes wipe{0%,72%{transform:translate(0,0)}78%,84%{transform:translate(2px,-7px)}88%{transform:translate(0,-7px)}92%{transform:translate(2px,-7px)}100%{transform:translate(0,0)}}
.c-chef .drop{animation:drop 11.3s linear infinite ${d(11.3)}}
@keyframes drop{0%,76%{opacity:0;transform:translateY(0)}80%{opacity:1}96%{opacity:0;transform:translateY(5px)}100%{opacity:0}}
.c-reading .pg,.c-writing .pg{transform-origin:0 50%;animation:page 4s ease-in-out infinite ${d(4)}}
@keyframes page{0%,80%,100%{transform:scaleX(1)}88%{transform:scaleX(.1)}}
.c-writing .wr{animation:scribble .4s steps(1) infinite ${d(0.4)}}
@keyframes scribble{50%{transform:translate(-1px,1px)}}
.c-greeting .wv{transform-origin:0 100%;animation:wave2 .6s ease-in-out infinite ${d(0.6)}}
@keyframes wave2{50%{transform:rotate(-22deg)}}
.c-propeller .prop{animation:spin .25s steps(1) infinite ${d(0.25)}}
@keyframes spin{50%{transform:scaleX(.3)}}
.c-fly{animation:fly 1.6s ease-in-out infinite ${d(1.6)}}
@keyframes fly{0%,100%{transform:translateY(-3px)}50%{transform:translateY(-5px)}}
.c-fly .prop{animation:spin .15s steps(1) infinite ${d(0.15)}}
.c-fly .fa{animation:flap .3s steps(1) infinite ${d(0.3)}}.c-fly .fb{animation:flap .3s steps(1) infinite ${d(0.3, 0.15)}}
@keyframes flap{50%{transform:translateY(-3px)}}
.c-fly .la{animation:dangle 1.6s ease-in-out infinite ${d(1.6)}}.c-fly .lb{animation:dangle 1.6s ease-in-out infinite ${d(1.6, 0.8)}}
@keyframes dangle{50%{transform:translateY(1px)}}
.c-propeller .body{animation:jump 1.2s ease-out infinite ${d(1.2)}}
@keyframes jump{0%,60%,100%{transform:translateY(0)}15%{transform:translateY(-7px)}30%{transform:translateY(0)}45%{transform:translateY(-4px)}}
.c-sunbathe .um{transform-origin:50% 100%;animation:sway 4s ease-in-out infinite ${d(4)}}
@keyframes sway{50%{transform:rotate(1.5deg)}}
.c-sunbathe .sun{animation:blink 2s steps(1) infinite ${d(2)}}
.c-sunbathe .body{animation:breathe 4s ease-in-out infinite ${d(4)}}
.c-error .body{animation:shake .15s steps(1) infinite ${d(0.15)}}
@keyframes shake{50%{transform:translateX(1px)}}
.c-error .ex{animation:blink .5s steps(1) infinite ${d(0.5)}}
.c-changing .pk,.c-changing .itm{animation:pkmove 1.4s ease-in-out forwards}
.c-changing .itm{animation:pkmove 1.4s ease-in-out forwards,show 1.4s steps(1) forwards}
@keyframes pkmove{0%{transform:translate(0,0)}20%,45%{transform:translate(-12px,4px)}80%,100%{transform:translate(var(--tx,-10px),var(--ty,-15px))}}
.pop{transform-origin:50% 100%;animation:pop .4s ease-out both}
@keyframes pop{0%{transform:scale(.82,1.18)}35%{transform:scale(1.12,.88)}65%{transform:scale(.97,1.04)}100%{transform:scale(1,1)}}
.c-run .la{animation:sprint .16s steps(1) infinite ${d(0.16)}}.c-run .lb{animation:sprint .16s steps(1) infinite ${d(0.16, 0.08)}}
@keyframes sprint{50%{transform:translateY(-5px)}}
.c-run .body{transform-origin:50% 100%;animation:lean .32s ease-in-out infinite ${d(0.32)}}
@keyframes lean{0%,100%{transform:rotate(7deg) translateY(0)}50%{transform:rotate(7deg) translateY(-2px)}}
.c-run .ra{animation:pumpa .16s steps(1) infinite ${d(0.16)}}.c-run .rb{animation:pumpa .16s steps(1) infinite ${d(0.16, 0.08)}}
@keyframes pumpa{50%{transform:translate(2px,-5px)}}
.c-drive .body{animation:rumble .2s steps(1) infinite ${d(0.2)}}
@keyframes rumble{50%{transform:translateY(1px)}}
.c-drive .hub{animation:roll .12s steps(1) infinite ${d(0.12)}}
@keyframes roll{50%{transform:translate(1px,1px)}}
.c-drive .ra{animation:pumpa .3s steps(1) infinite ${d(0.3)}}.c-drive .rb{animation:pumpa .3s steps(1) infinite ${d(0.3, 0.15)}}
.c-run .sl,.c-drive .sl{animation:rush .24s linear infinite ${d(0.24)}}
@keyframes rush{0%{opacity:.9;transform:translateX(0)}100%{opacity:0;transform:translateX(-8px)}}
.c-run .dust,.c-drive .dust{animation:dust .32s linear infinite ${d(0.32)}}
@keyframes dust{0%{opacity:.9;transform:translate(0,0) scale(.6)}100%{opacity:0;transform:translate(-6px,-4px) scale(1.4)}}
.c-pant .body{transform-origin:50% 100%;animation:pant .75s ease-in-out infinite ${d(0.75)}}
@keyframes pant{0%,100%{transform:scale(1,1)}50%{transform:scale(1.06,.91)}}
.c-pant .mouth{transform-origin:50% 0;animation:gasp .75s ease-in-out infinite ${d(0.75)}}
@keyframes gasp{50%{transform:scaleY(1.7)}}
.c-pant .sw{animation:drip 1.5s linear infinite ${d(1.5)}}
@keyframes drip{0%{opacity:0;transform:translateY(0)}20%{opacity:1}100%{opacity:0;transform:translateY(7px)}}
.c-pant .hf{animation:huff .75s ease-out infinite ${d(0.75)}}
@keyframes huff{0%{opacity:.95;transform:translate(0,0) scale(.6)}100%{opacity:0;transform:translate(6px,-4px) scale(1.5)}}
.c-park .body{animation:lurch .5s ease-out infinite ${d(0.5)}}
@keyframes lurch{0%{transform:translateX(3px)}100%{transform:translateX(0)}}
.c-park .bl{animation:blink .4s steps(1) infinite ${d(0.4)}}
.c-park .dust{animation:dust .5s linear infinite ${d(0.5)}}
.c-park .sw{animation:drip 1.5s linear infinite ${d(1.5)}}
.c-brace .body{transform-origin:50% 100%;animation:crouch .7s ease-in infinite ${d(0.7)}}
@keyframes crouch{0%{transform:scale(1,1)}80%,100%{transform:scale(1.1,.84)}}
.c-brace .wd{animation:raise .7s ease-in infinite ${d(0.7)}}
@keyframes raise{0%{transform:translateY(0)}100%{transform:translateY(-6px)}}
.c-brace .g1,.c-brace .g2,.c-brace .g3{animation:gather .7s ease-in infinite ${d(0.7)}}
.c-brace .g1{--gx:11px;--gy:9px}.c-brace .g2{--gx:-11px;--gy:9px}.c-brace .g3{--gx:0px;--gy:11px}
@keyframes gather{0%{opacity:0;transform:translate(0,0)}25%{opacity:1}100%{opacity:0;transform:translate(var(--gx),var(--gy))}}
@keyframes show{0%,44%{opacity:0}45%,100%{opacity:1}}
.c-changing .puff{animation:puff 1.4s ease-out forwards}
@keyframes puff{0%,80%{opacity:0;transform:scale(.3)}90%{opacity:1;transform:scale(1.3)}100%{opacity:0;transform:scale(1.6)}}
.c-dance .da{animation:up .5s steps(1) infinite ${d(0.5)}}.c-dance .db{animation:up .5s steps(1) infinite ${d(0.5, 0.25)}}
@keyframes up{50%{transform:translateY(-6px)}}
.c-dance .body{animation:hop .5s ease-in-out infinite ${d(0.5)}}
@keyframes hop{50%{transform:translateY(-2px)}}
.c-crown .gem,.win .gem{animation:blink 1s steps(1) infinite ${d(1)}}
.win .sp,.win .st{animation:blink .6s steps(1) infinite ${d(0.6)}}
.win .cheer{animation:cheer .4s steps(1) infinite ${d(0.4)}}
.win.vc-claude .body{transform-origin:50% 100%;animation:vclaude .5s ease-out infinite ${d(0.5)}}
@keyframes vclaude{50%{transform:translateY(-3px)}}
.win.vc-frog .body{transform-origin:50% 100%;animation:vfrog .6s ease-out infinite ${d(0.6)}}
@keyframes vfrog{0%,100%{transform:translateY(0) scale(1.06,.9)}50%{transform:translateY(-9px) scale(.95,1.1)}}
.win.vc-creeper .body{transform-origin:50% 100%;animation:vcreep .5s ease-in-out infinite ${d(0.5)}}
@keyframes vcreep{0%,100%{transform:scale(1,1)}50%{transform:scale(1.14,1.14)}}
.win.vc-slime .body{transform-origin:50% 100%;animation:vslime .5s ease-in-out infinite ${d(0.5)}}
@keyframes vslime{0%,100%{transform:scale(1.12,.86)}50%{transform:translateY(-4px) scale(.9,1.14)}}
.win.vc-robot .body{transform-origin:50% 100%;animation:vrobot .3s steps(1) infinite ${d(0.3)}}
@keyframes vrobot{0%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
.win.vc-cat .body{transform-origin:50% 100%;animation:vcat 1s ease-in-out infinite ${d(1)}}
@keyframes vcat{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg) translateY(-2px)}}
.c-frozen .body,.c-frozen .eye{animation:none}
.c-frozen .bd{animation:shiver .14s steps(1) infinite ${d(0.14)}}
@keyframes shiver{50%{transform:translateX(1px)}}
.c-frozen .gl{animation:blink 1.6s steps(1) infinite ${d(1.6)}}
.c-sleeping .body{animation:breathe 3s ease-in-out infinite ${d(3)}}
@keyframes breathe{50%{transform:translateY(1px)}}
.c-sleeping .z1{animation:zf 2.4s ease-in infinite ${d(2.4)}}.c-sleeping .z2{animation:zf 2.4s ease-in infinite ${d(2.4, 1.2)}}
@keyframes zf{0%{opacity:0;transform:translate(0,3px)}30%{opacity:1}100%{opacity:0;transform:translate(2px,-5px)}}
.c-done .cheer{animation:cheer .4s steps(1) infinite ${d(0.4)}}
@keyframes cheer{50%{transform:translateY(-2px)}}
</style>`
}
