import { expect, mock, test } from 'claude-code/testing'

import { CHARACTERS, ITEM_COLOR, crabCss, crabSvg } from './crab'
import { digSvg } from './dig'
import { IDLE_LOOP_MS, IDLE_SCRIPT, MOVING, autoRatio, isCacheCold, isIcedNow, pickOutfit, roamAt, winPose } from './classify'
import { agentSvg, outfitFor } from './agents'
import type { AgentRun, Sess } from '../types'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 100 } as never } as const
const PROGRESS = 'mcp__crab-progress__progress'
const busy = (p: Partial<Sess>): Sess => ({ busy: true, startedAt: 0, lastActive: 0, doneAt: 0, tools: 0, edits: 0, prompt: '', lastTool: '', end: '', ...p })

test('new poses', () => {
  expect(pickOutfit(busy({ prompt: 'where is the config?', lastTool: 'Grep' }), 1000)).toBe('reading')
  expect(pickOutfit(busy({ prompt: 'write up the readme' }), 1000)).toBe('writing')
  expect(pickOutfit(busy({ busy: false, doneAt: 1_000, end: 'long' }), 2_000)).toBe('crown')
  expect(pickOutfit(busy({ busy: false, doneAt: 1_000, end: 'fail' }), 2_000)).toBe('error')
})

test('every pose in the idle loop draws', () => {
  for (const [pose] of IDLE_SCRIPT) {
    const svg = crabSvg(pose, 0, 0, MOVING.has(pose))
    expect(svg).toContain('<rect')
    expect(svg).toContain(`c-${pose}`)
  }
})

test('every character draws every pose', () => {
  for (const c of CHARACTERS) {
    for (const [pose] of IDLE_SCRIPT) {
      const svg = crabSvg(pose, 0, 0, false, c)
      expect(svg).toContain('<rect')
    }
  }
})

test('/mascot switches the character and remembers it', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: 1_000_000 })
  const listed = await $.command.run({ command: 'mascot', args: 'list' } as never)
  expect(String((listed as { text?: string }).text)).toContain('frog')
  const done = await $.command.run({ command: 'mascot', args: 'frog' } as never)
  expect(String((done as { text?: string }).text)).toContain('frog')
  const bad = await $.command.run({ command: 'mascot', args: 'dragon' } as never)
  expect(String((bad as { text?: string }).text)).toContain('Unknown')
})

const agent = (p: Partial<AgentRun>): AgentRun => ({
  id: 'a1', type: 'general-purpose', description: 'Demo', model: 'claude-haiku-5-5', status: 'running', startedAt: 0,
  contextTokens: 1000, contextMax: 1_000_000, tokens: 1000, costUsd: 0.01, steps: 1, round: 1, ...p,
})

test('agent rows wear the chosen character and animate', () => {
  for (const c of CHARACTERS) {
    const running = agentSvg(300, agent({}), 5_000, c)
    expect(running).toContain('walk')
    expect(running).toContain('<rect')
  }
  // finished: cheers first, then idles through other poses
  expect(outfitFor(agent({ status: 'done', endedAt: 1_000 }), 2_000)).toBe('done')
  const later = new Set([20_000, 28_000, 36_000, 44_000, 52_000].map(t => outfitFor(agent({ status: 'done', endedAt: 1_000 }), t)))
  expect(later.size).toBeGreaterThan(1)
  // running agents dress for the task, not the model
  expect(outfitFor(agent({ description: 'Fix the login bug' }), 0)).toBe('fixing')
  expect(outfitFor(agent({ description: 'Add a settings page', edits: 2 }), 0)).toBe('coding')
  expect(outfitFor(agent({ description: 'Where is config?', lastTool: 'Grep' }), 0)).toBe('reading')
  expect(outfitFor(agent({ description: 'Review the diff' }), 0)).toBe('cool')
  expect(outfitFor(agent({ description: 'Plan the rollout' }), 0)).toBe('idle')
  expect(outfitFor(agent({ description: 'Fix it', outfit: 'coding' }), 0)).toBe('coding')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: the agents pane draws`, async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    const pane = { title: '', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } as never
    const ui = await $.ui.mount({ plugin: 'crab-progress', surface, component: 'Pane', requestId: 'crab-agents', props: pane })
    expect(await ui.find({ text: /No subagents yet/ })).toBeDefined()
    await ui.unmount()
  })
}

test('the dig scene shows the touched files for every character', () => {
  for (const c of CHARACTERS) {
    const svg = digSvg(12_345, ['register.tsx', 'crab.ts'], c)
    expect(svg).toContain('@keyframes path')
    expect(svg).toContain('crab.ts')
  }
})

test('costume changes draw an item from the pocket', () => {
  const svg = crabSvg('changing', 0, 0, false, 'claude', { item: '#6A50AA', age: 300 })
  expect(svg).toContain('c-changing')
  expect(svg).toContain('#6A50AA')
  expect(svg).toContain('animation-delay:-300ms')
  expect(ITEM_COLOR.fixing).toBeDefined()
  // a pose just reached is changing, then settles
  expect(roamAt(0).age).toBeGreaterThanOrEqual(0)
})

const PANE_PROPS = { title: '', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } as never

test('touching a file brings the digging crab into the agents panel, and only then', async ($, on) => {
  mock.clock(on, { now: 5_000_000 })
  on('tool.call', () => ({ result: 'ok' }) as never)
  // the file tree beside the crab reads the cwd and the file system when a file is touched
  on('session.cwd', () => ({ value: 'C:/Users/dev/project' }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('process.run', () => ({ value: { stdout: '', stderr: '', exitCode: 0 } }) as never)
  on('fs.stat', () => {
    throw new Error('no such file')
  })
  const dug = async (): Promise<boolean> => {
    const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: PANE_PROPS })
    const sources = (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.source))
    await ui.unmount()
    return sources.some(s => s.includes('@keyframes path'))
  }
  expect(await dug()).toBe(false)
  await $.tool.call({ tool: 'Read', file_path: 'C:\\Users\\dev\\project\\register.tsx' } as never)
  expect(await dug()).toBe(true)
})

test('the merged file tree pane draws, wears the crab icon, and the crab works inside the rows while files are touched', async ($, on) => {
  mock.clock(on, { now: 5_000_000 })
  mock.env(on, { HOME: '/home/dev', USERPROFILE: 'C:\\Users\\dev' })
  on('tool.call', () => ({ result: 'ok' }) as never)
  on('session.cwd', () => ({ value: '/home/dev/project' }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('process.run', () => ({ value: { stdout: '', stderr: '', exitCode: 0 } }) as never)
  on('fs.stat', () => ({ value: { kind: 'dir', size: 0, mtimeMs: 1, isLink: false } }) as never)
  on('fs.list', () =>
    ({
      value: ['crab.ts', 'dig.ts', 'agents.ts', 'classify.ts', 'register.tsx'].map(name => ({ name, kind: 'file', size: 10, mtimeMs: 1, isLink: false })),
    }) as never,
  )
  const look = async (): Promise<{ icon: boolean; dig: unknown; tall: unknown }> => {
    const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: PANE_PROPS })
    const icon = (await ui.findAll({ type: 'Svg' })).some(s => String(s.props.source).includes('c-stroll') || String(s.props.source).includes('c-idle'))
    const client = (await ui.findAll({ type: 'Client' })).find(c => String((c.props as { module?: string }).module).includes('ft-rows'))
    const p = (client?.props as { props?: { dig?: unknown; tall?: unknown } } | undefined)?.props
    await ui.unmount()
    return { icon, dig: p?.dig, tall: p?.tall }
  }
  const before = await look()
  expect(before.icon).toBe(true)
  expect(before.tall).toBe(true)
  expect(before.dig).toBeUndefined()
  await $.tool.call({ tool: 'Edit', file_path: '/home/dev/project/crab.ts' } as never)
  const after = await look()
  const dig = after.dig as { rows: number[] } | undefined
  expect(dig).toBeDefined()
  expect(dig?.rows.length).toBe(3)
})
test('a big jump in the bar sends him sprinting', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  await $.tool.call({ tool: PROGRESS, title: 'Demo', total: 4, done: 0 } as never)
  await $.tool.call({ tool: PROGRESS, title: 'Demo', total: 4, done: 1 } as never)
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', ...BAND })
  const svgs = await ui.findAll({ type: 'Svg' })
  expect(String(svgs[0]?.props.source)).toContain('c-run')
  await ui.unmount()
})

test('hitting 100% in steps never pants: the car, then the win', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  await $.tool.call({ tool: PROGRESS, title: 'Demo', total: 20, done: 0 } as never)
  await $.tool.call({ tool: PROGRESS, title: 'Demo', total: 20, done: 8 } as never)
  await $.tool.call({ tool: PROGRESS, title: 'Demo', total: 20, done: 12 } as never)
  await $.tool.call({ tool: PROGRESS, title: 'Demo', total: 20, done: 20 } as never)
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', ...BAND })
  const src = String((await ui.findAll({ type: 'Svg' }))[0]?.props.source)
  expect(src).toContain('c-drive')
  expect(src).not.toContain('class="c-pant')
  await ui.unmount()
})

test('a huge jump in the bar puts him in a car', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  await $.tool.call({ tool: PROGRESS, title: 'Demo', total: 4, done: 0 } as never)
  await $.tool.call({ tool: PROGRESS, title: 'Demo', total: 4, done: 3 } as never)
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', ...BAND })
  const svgs = await ui.findAll({ type: 'Svg' })
  expect(String(svgs[0]?.props.source)).toContain('c-drive')
  await ui.unmount()
})

test('victory pose follows how the turn went', () => {
  const done = (p: Partial<Sess>): Sess => busy({ busy: false, doneAt: 5_000, ...p })
  expect(winPose(done({}), 0.4, true)).toBe('exitCar')
  expect(winPose(done({}), 0.2, true)).toBe('medal')
  expect(winPose(done({ edits: 2 }), 0, false)).toBe('winCode')
  expect(winPose(done({ prompt: 'fix the bug' }), 0, false)).toBe('winFix')
  expect(winPose(done({ lastTool: 'Read' }), 0, false)).toBe('winRead')
  expect(winPose(done({ prompt: 'write the readme' }), 0, false)).toBe('winWrite')
  expect(winPose(done({ prompt: 'what is this?' }), 0, false)).toBe('done')
})

test('every character gets its own victory flourish and the car stays parked', () => {
  for (const name of CHARACTERS) {
    expect(crabSvg('medal', 0, 0, false, name)).toContain(`vc-${name}`)
  }
  const svg = crabSvg('exitCar', 0, 0)
  expect(svg).toContain('class="car"')
  expect(svg.indexOf('class="body"')).toBeLessThan(svg.indexOf('class="car"'))
  expect(crabSvg('drive', 0, 0)).not.toContain('class="win')
})

test('the beat between the run and the victory has its own drawing, and is not a win', () => {
  const park = crabSvg('park', 0, 0)
  expect(park).toContain('c-park')
  expect(park).toContain('class="car"')
  expect(park).not.toContain('class="win')
  const brace = crabSvg('brace', 0, 0)
  expect(brace).toContain('c-brace')
  expect(brace).not.toContain('class="win')
  expect(crabCss(0)).toContain('.c-park .body')
  expect(crabCss(0)).toContain('.c-brace .body')
})

test('a cold cache band freezes him', () => {
  const band = { type: 'Box', props: { children: [{ type: 'Text', props: { children: [' cache-tax · ', { type: 'Text', props: { color: '#d97757', children: ['cold'] } }, ' · keepwarm 5h left'] } }] } }
  expect(isCacheCold(band)).toBe(true)
  expect(isCacheCold(JSON.parse(JSON.stringify(band).replace('"cold"', '"warm"')))).toBe(false)
  expect(isCacheCold(null)).toBe(false)
  expect(isIcedNow(null, 1000, 1000 + 3_600_000)).toBe(true)
  expect(isIcedNow(null, 1000, 1000 + 60_000)).toBe(false)
  expect(isIcedNow(null, 0, 9e9)).toBe(false)
  expect(isIcedNow(JSON.parse(JSON.stringify(band).replace('"cold"', '"warm"')), 1000, 9e9)).toBe(false)
  expect(crabSvg('frozen', 0, 0)).toContain('class="ice"')
})

test('pose switches settle with a squash-and-stretch', () => {
  const svg = crabSvg('fixing', 0, 0, false, 'claude', undefined, 120)
  expect(svg).toContain('class="pop"')
  expect(svg).toContain('animation-delay:-120ms')
  expect(crabSvg('fixing', 0, 0, false, 'claude', undefined, 900)).not.toContain('class="pop"')
  expect(crabSvg('changing', 0, 0, false, 'claude', { item: '#000', age: 0, dest: 'face' })).toContain('--tx:-9px')
})

test('roaming loops without teleporting', () => {
  const loop = IDLE_LOOP_MS
  expect(Math.abs(roamAt(0).x - roamAt(loop).x)).toBeLessThan(1e-9)
  for (let t = 0; t < loop; t += 500) {
    const a = roamAt(t).x
    expect(Math.abs(roamAt(t + 500).x - a)).toBeLessThan(0.1)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThanOrEqual(1)
  }
})

test('outfit follows the task', () => {
  expect(pickOutfit(busy({ prompt: 'fix the login bug' }), 1000)).toBe('fixing')
  expect(pickOutfit(busy({ prompt: 'add a settings page' }), 1000)).toBe('coding')
  expect(pickOutfit(busy({ prompt: 'what is this?', edits: 2 }), 1000)).toBe('coding')
  expect(pickOutfit(busy({ prompt: 'what is this?' }), 1000)).toBe('working')
  expect(pickOutfit(busy({ prompt: 'fix it', startedAt: 0 }), 3 * 60_000)).toBe('chef')
  expect(pickOutfit(busy({ tools: 30 }), 1000)).toBe('chef')
})

test('outfit when not busy', () => {
  const s = busy({ busy: false, lastActive: 1_000, doneAt: 1_000 })
  expect(pickOutfit(s, 2_000)).toBe('done')
  expect(pickOutfit(s, 60_000)).toBe('idle')
  expect(pickOutfit(s, 10 * 60_000)).toBe('sleeping')
})

test('auto progress rises with tools and never reaches 100% while busy', () => {
  const a = autoRatio(busy({ tools: 1 }), 0)
  const b = autoRatio(busy({ tools: 10 }), 0)
  expect(b).toBeGreaterThan(a)
  expect(autoRatio(busy({ tools: 500 }), 0)).toBeLessThanOrEqual(0.95)
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: explicit progress shows on the band`, async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    expect(await $.tool.call({ tool: PROGRESS, title: 'Demo', total: 4, done: 3 } as never)).toMatchObject({ result: 'ok: 75%' })
    const ui = await $.ui.mount({ plugin: 'crab-progress', surface, ...BAND })
    // Desktop: the crab's progress row plus the Token Optimizer marks and icons drawn beneath it.
    const svgs = (await ui.findAll({ type: 'Svg' })).length
    expect(surface === 'desktop' ? svgs > 1 : svgs === 0).toBe(true)
    await ui.unmount()
  })
}

test('input outside the schema is clamped', async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
  expect(await $.tool.call({ tool: PROGRESS, total: 1e9, done: -5 } as never)).toMatchObject({ result: 'ok: 0%' })
})

test('waiting on the user draws a question bubble and waves, in every character', () => {
  const ask = crabSvg('ask', 0, 0)
  expect(ask).toContain('c-ask')
  expect(ask).toContain('class="qb"')
  expect(ask).toContain('class="wv"')
  expect(ask).not.toContain('class="win')
  expect(crabCss(0)).toContain('.c-ask .qb')
  for (const c of CHARACTERS) expect(crabSvg('ask', 0, 0, false, c)).toContain('c-ask')
})

test('running a command gets its own console, one for Bash and one for PowerShell', () => {
  const shell = crabSvg('shell', 0, 0)
  const pwsh = crabSvg('pwsh', 0, 0)
  expect(shell).toContain('c-shell')
  expect(pwsh).toContain('c-pwsh')
  expect(shell).toContain('class="cur"')
  expect(shell).not.toEqual(pwsh)
  expect(shell).not.toContain('c-ask')
  expect(crabCss(0)).toContain('.c-shell .sc1')
  expect(crabCss(0)).toContain('.c-pwsh .sc1')
  for (const c of CHARACTERS) {
    expect(crabSvg('shell', 0, 0, false, c)).toContain('c-shell')
    expect(crabSvg('pwsh', 0, 0, false, c)).toContain('c-pwsh')
  }
})
