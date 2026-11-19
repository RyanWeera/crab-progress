import { expect, mock, test } from 'claude-code/testing'

import { CHARACTERS, ITEM_COLOR, crabCss, crabSvg } from './crab'
import { digSvg } from './dig'
import { IDLE_LOOP_MS, IDLE_SCRIPT, MOVING, autoRatio, isCacheCold, isIcedNow, pickOutfit, roamAt, winPose } from './classify'
import { agentSvg, outfitFor } from './agents'
import { NO_PYTHON_REASON, checkpointPathFrom, dashboardFailed, freshHandoff, handoffFromMessages, isStubCheckpoint, prepareHandoff, type HandoffPort, type Msg } from './to/src/actions.ts'
import { NOT_FOUND, findTokenOptimizerRoot, gather, resetLauncher, type DataIo } from './to/hooks/data.ts'
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

test('/clear plays a banner that goes away', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  on('command.run', { command: 'clear' }, () => ({ text: '' }) as never)
  await $.command.run({ command: 'clear', args: '' } as never)
  const has = async () => {
    const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', ...BAND })
    const found = (await ui.findAll({ type: 'Svg' })).some(s => String(s.props.source).includes('@keyframes a{'))
    await ui.unmount()
    return found
  }
  expect(await has()).toBe(true)
  await clock.advance(5_000)
  expect(await has()).toBe(false)
})

test('/compact puts him in a bulldozer that squashes the bar, in every character', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  const kept = [{ role: 'user', text: 'hi', toolUses: [], toolResults: [] }]
  on('session.compact', { trigger: 'manual' }, () => ({ messages: kept }) as never)
  await $.session.compact({ trigger: 'manual', messages: kept } as never)
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', ...BAND })
  const src = String((await ui.findAll({ type: 'Svg' }))[0]?.props.source)
  expect(src).toContain('c-dozer')
  expect(src).toContain('compacting')
  await ui.unmount()
  for (const c of CHARACTERS) expect(crabSvg('dozer', 0, 0, false, c)).toContain('c-dozer')
})

test('a Remote Control view only idles: no progress, no percent', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  await $.tool.call({ tool: PROGRESS, title: 'Demo', total: 4, done: 3 } as never)
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'mobile', ...BAND })
  const src = String((await ui.findAll({ type: 'Svg' }))[0]?.props.source)
  expect(src).toContain('<rect')
  expect(src).not.toContain('class="fill"')
  expect(src).not.toContain('<text')
  expect(src).not.toContain('class="c-drive')
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

test('the desktop task list (update_plan) sets the bar: 1 of 4 done fills a quarter, advance fills half', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  on('tool.call', async () => ({ result: 'ok' }))
  const alt = async (): Promise<string> => {
    const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', ...BAND })
    const text = JSON.stringify(await ui.findAll({ type: 'Svg' }))
    await ui.unmount()
    return text
  }
  const items = [{ status: 'completed' }, { status: 'in_progress' }, { status: 'pending' }, { status: 'pending' }]
  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', items } as never)
  expect(await alt()).toContain('to{width:174px}')
  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', advance: true } as never)
  expect(await alt()).toContain('to{width:347px}')
})

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

test('without Token Optimizer, Start fresh builds its hand-off from the conversation', () => {
  const msgs: Msg[] = [
    { role: 'user', text: '<system-reminder>not a prompt</system-reminder>', toolUses: [] },
    { role: 'user', text: 'fix the login bug, token=abcdef123456', toolUses: [] },
    {
      role: 'assistant',
      text: 'We decided to keep the old API. Done.',
      toolUses: [
        { tool: 'Edit', input: { file_path: 'src/login.ts' } },
        { tool: 'Read', input: { file_path: 'src/other.ts' } },
      ],
    },
  ]
  const result = handoffFromMessages(msgs, { sessionId: 'abcdef12-3456', cwd: '/p', now: 0 })
  if (!result.ok) throw new Error(result.reason)
  const { text } = result.handoff
  expect(text).toContain('session abcdef12')
  expect(text).toContain('Active task: fix the login bug, token=[redacted]')
  expect(text).not.toContain('abcdef123456')
  expect(text).toContain('- src/login.ts')
  expect(text).not.toContain('src/other.ts')
  expect(text).toContain('- We decided to keep the old API.')
  expect(text).not.toContain('not a prompt')
  expect(result.handoff).toMatchObject({ fromSessionId: 'abcdef12-3456', cwd: '/p', createdAt: 0 })
  expect(result.handoff.checkpointPath).toBe(undefined)
  expect(handoffFromMessages([], { sessionId: 's', cwd: '/p', now: 0 })).toEqual({ ok: false, reason: 'the session had nothing to save' })
})

test('the band reads its grade from Token Optimizer and its savings from measure.py status-bar', async () => {
  resetLauncher()
  const sid = 'abcd1234ef'
  const NOW = 60_000_000
  const install = '/h/.claude/plugins/cache/alexgreensh-token-optimizer/token-optimizer/5.13.73'
  const scripts = `${install}/skills/token-optimizer/scripts`
  const cache = `/h/.claude/plugins/data/token-optimizer-alexgreensh-token-optimizer/token-optimizer/quality-cache-${sid}.json`
  const files: Record<string, string> = {
    '/h/.claude/plugins/installed_plugins.json': JSON.stringify({
      plugins: { 'token-optimizer@alexgreensh-token-optimizer': [{ installPath: install, lastUpdated: '2026-11-20T00:00:00Z' }] },
    }),
    [cache]: JSON.stringify({
      score: 60, grade: 'C', resource_health: 60, resource_health_grade: 'C',
      top_drag: { key: 'stale_reads', label: 'stale file reads', points: 12 },
      tool_calls: 12, compactions: 1, fill_pct: 42, last_checkpoint_epoch: 5000,
    }),
  }
  const mtimes: Record<string, number> = { [cache]: NOW - 3600_000 }
  const exists = new Set([`${scripts}/measure.py`, `${install}/hooks/module_runner.py`])
  const runs: string[][] = []
  const statusJson = JSON.stringify({
    schema: 1, session_id: sid,
    savings: { unit: 'tokens', session_tokens: 900, total_30d_tokens: 4000, daily: [{ date: '2026-11-19', tokens: 3100 }, { date: '2026-11-20', tokens: 900 }] },
    savings_state: 'fresh', savings_reason: null, last_request_epoch: 59_000, cache_lifetime: '1h',
    compactWindow: { tokens: null, source: 'model default' }, last_checkpoint_epoch: 5000, earlier_checkpoint: null, compactions: 1,
  })
  const io = (id: string): DataIo => ({
    now: async () => NOW,
    sessionId: async () => id,
    cwd: async () => '/p',
    envHome: async () => '/h',
    envUserProfile: async () => undefined,
    usage: async () => null,
    list: async path => (path === '/h/.claude/plugins/data' ? [{ name: 'token-optimizer-alexgreensh-token-optimizer' }] : []),
    stat: async path => {
      if (path in files || exists.has(path)) return { kind: 'file', mtimeMs: mtimes[path] ?? NOW }
      throw new Error('ENOENT')
    },
    read: async path => {
      if (path in files) return files[path]!
      throw new Error('ENOENT')
    },
    run: async argv => {
      runs.push(argv)
      if (argv.includes('git')) return { exitCode: 1, stdout: '' }
      return { exitCode: 0, stdout: argv.includes('status-bar') ? statusJson : '' }
    },
  })
  const s = await gather(io(sid), null, { savings: true })
  expect(s.quality).toMatchObject({ score: 60, grade: 'C', drag: 'stale file reads', compactions: 1 })
  expect(s.savings).toMatchObject({ sessionTokens: 900, last30Tokens: 4000 })
  expect(s.savingsState).toBe('fresh')
  expect(s.checkpointEpoch).toBe(5000)
  const call = runs.find(a => a.includes('status-bar'))!
  expect(call.slice(-7)).toEqual([`${install}/hooks/module_runner.py`, scripts, 'measure', 'status-bar', '--session', sid, '--json'])
  // A file caught mid-write keeps what the band knew.
  files[cache] = '{"score": 8'
  expect((await gather(io(sid), s, { savings: true })).quality).toMatchObject({ score: 60, grade: 'C' })
  // A grade written more than 6 hours ago is not shown.
  files[cache] = JSON.stringify({ resource_health: 90, resource_health_grade: 'S' })
  mtimes[cache] = NOW - 7 * 3600_000
  expect((await gather(io(sid), null, { savings: true })).quality).toBe(null)
  mtimes[cache] = NOW - 3600_000
  expect((await gather(io(sid), null, { savings: true })).quality).toMatchObject({ score: 90, grade: 'S' })
  // No cache for this session: no grade.
  expect((await gather(io('ffff0000aa'), null)).quality).toBe(null)
  // measure.py is run only from the installed plugin's own folder: an entry pointing anywhere
  // else, or climbing out with `..`, is never run, and without an install the band says so.
  for (const installPath of ['/elsewhere/token-optimizer', '/h/.claude/plugins/../../evil', '/h/.claude/skills/token-optimizer']) {
    files['/h/.claude/plugins/installed_plugins.json'] = JSON.stringify({ plugins: { 'token-optimizer@m': [{ installPath }] } })
    exists.add(`${installPath}/skills/token-optimizer/scripts/measure.py`)
    expect(await findTokenOptimizerRoot(io(sid), '/h')).toBe(null)
  }
  delete files['/h/.claude/plugins/installed_plugins.json']
  expect((await gather(io(sid), null, { savings: true })).savingsReason).toBe(NOT_FOUND)
  expect(dashboardFailed({ exitCode: 0, stdout: 'Dashboard: /h/x.html' })).toBe(false)
  expect(dashboardFailed({ exitCode: 0, stdout: '  Could not auto-open browser. Open manually:' })).toBe(true)
  expect(dashboardFailed(null)).toBe(true)
})

test("Start fresh uses Token Optimizer's checkpoint and lean resume, and falls back when they fail", async () => {
  const input = { sessionId: 'abcdef12-3456', transcriptPath: '/t.jsonl', cwd: '/p', now: 0 }
  const real = `# Checkpoint\n\n${'Working on the login bug; next step is the token refresh. '.repeat(6)}`
  const ok = (over: Partial<{ capture: string; file: string; lean: string; leanExit: number; throwRun: Error }> = {}) => {
    const runs: { args: string[]; stdin?: string }[] = []
    const port: HandoffPort = {
      run: async (args, stdin) => {
        runs.push({ args, stdin })
        if (over.throwRun) throw over.throwRun
        if (args[0] === 'compact-capture') return { exitCode: 0, stdout: over.capture ?? '[Token Optimizer] Checkpoint saved: /cp/one.md\n' }
        return { exitCode: over.leanExit ?? 0, stdout: over.lean ?? 'Resume: the login bug.\n' }
      },
      read: async () => over.file ?? real,
    }
    return { port, runs }
  }

  expect(checkpointPathFrom('noise\n[Token Optimizer] Checkpoint saved: /cp/one.md  \n')).toBe('/cp/one.md')
  expect(checkpointPathFrom('nothing saved')).toBe(null)
  expect(isStubCheckpoint('# Checkpoint\nNo transcript data available\n')).toBe(true)
  expect(isStubCheckpoint(`${real}\nNo transcript data available`)).toBe(false)
  expect(isStubCheckpoint(real)).toBe(false)

  const good = ok()
  const r = await prepareHandoff(good.port, input)
  expect(r).toEqual({ ok: true, handoff: { fromSessionId: input.sessionId, cwd: '/p', checkpointPath: '/cp/one.md', text: 'Resume: the login bug.', createdAt: 0 } })
  expect(good.runs[0]?.args).toEqual(['compact-capture', '--trigger', 'start-fresh', '--budget-seconds', '25'])
  expect(JSON.parse(good.runs[0]?.stdin ?? '{}')).toEqual({ session_id: input.sessionId, transcript_path: '/t.jsonl' })
  expect(good.runs[1]?.args).toEqual(['resume-lean', input.sessionId, '--print'])
  expect(await prepareHandoff(ok({ capture: 'no path' }).port, input)).toEqual({ ok: false, reason: 'the checkpoint could not be saved' })
  expect(await prepareHandoff(ok({ file: 'No transcript data available' }).port, input)).toEqual({ ok: false, reason: 'the checkpoint came out empty' })
  expect(await prepareHandoff(ok({ leanExit: 1 }).port, input)).toEqual({ ok: false, reason: 'the hand-off text came out empty' })
  const noPython = Object.assign(new Error('python launcher not found'), { name: 'PythonNotFoundError' })
  expect(await prepareHandoff(ok({ throwRun: noPython }).port, input)).toEqual({ ok: false, reason: NO_PYTHON_REASON })

  const msgs: Msg[] = [{ role: 'user', text: 'fix the login bug', toolUses: [] }]
  // Token Optimizer worked: its hand-off, and the messages are never read.
  let read = 0
  const messages = async () => {
    read += 1
    return msgs
  }
  expect(await freshHandoff(ok().port, messages, input)).toMatchObject({ ok: true, handoff: { checkpointPath: '/cp/one.md' } })
  expect(read).toBe(0)
  // Its capture failed: the hand-off is built from the conversation instead.
  const fallback = await freshHandoff(ok({ file: 'No transcript data available' }).port, messages, input)
  if (!fallback.ok) throw new Error(fallback.reason)
  expect(fallback.handoff.checkpointPath).toBe(undefined)
  expect(fallback.handoff.text).toContain('Active task: fix the login bug')
  expect(await freshHandoff(ok({ throwRun: new Error('boom') }).port, messages, input)).toMatchObject({ ok: true })
  // No Python 3 is reported, not papered over.
  expect(await freshHandoff(ok({ throwRun: noPython }).port, messages, input)).toEqual({ ok: false, reason: NO_PYTHON_REASON })
  // Not installed: straight to the messages; unreadable messages stop it.
  expect(await freshHandoff(null, messages, input)).toMatchObject({ ok: true })
  expect(await freshHandoff(null, async () => null, input)).toEqual({ ok: false, reason: 'the conversation could not be read' })
  expect(await freshHandoff(ok({ capture: 'x' }).port, async () => null, input)).toEqual({ ok: false, reason: 'the checkpoint could not be saved' })
})
