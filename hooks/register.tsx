import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRun, Bar, Character, Outfit, Panel, Run, Sess } from '../types'
import { DIG_H, DIG_W, digSvg } from './dig'
import { register as registerTree } from './ft-register'
import type { Dest } from './crab'
import { BAR_H, BAR_Y, CHARACTERS, CRAB_H, CRAB_W, ITEM_COLOR, ITEM_DEST, PX, ROW_H, WIN, codeWindow, crabCss, crabSvg } from './crab'
import { CHANGE_MS, MOVING, autoRatio, isCacheCold, isLong, pickOutfit, roamAt, winPose } from './classify'
import {
  HEADER_H,
  LINE_H,
  ROW_H as AGENT_ROW_H,
  agentLine,
  agentSvg,
  compactSvg,
  costOf,
  taskOutfit,
  ctxBar,
  gridSvg,
  gridTiles,
  headerSvg,
  modelName,
  sameTask,
  summaryOf,
  totals,
  windowOf,
} from './agents'

const BLANK: Sess = { busy: false, startedAt: 0, lastActive: 0, doneAt: 0, tools: 0, edits: 0, prompt: '', lastTool: '', end: '' }
const FLAT: Bar = { from: 0, to: 0, at: 0, ref: 0, movedAt: 0, bigAt: 0 }

const run = atom({ plugin: 'crab-progress', key: 'run' } as const, null)
const sess = atom({ plugin: 'crab-progress', key: 'sess' } as const, BLANK)
const look = atom({ plugin: 'crab-progress', key: 'look' } as const, { outfit: 'idle', since: 0 })
const now = atom({ plugin: 'crab-progress', key: 'now' } as const, 0)
const bar = atom({ plugin: 'crab-progress', key: 'bar' } as const, FLAT)
const char = atom({ plugin: 'crab-progress', key: 'char' } as const, 'claude')
const agents = atom({ plugin: 'crab-progress', key: 'agents' } as const, [])
const panel = atom({ plugin: 'crab-progress', key: 'panel' } as const, { isCompact: false, isDoneCollapsed: false })
const files = atom({ plugin: 'crab-progress', key: 'files' } as const, { at: 0, names: [], paths: [] })

const TOOL = 'mcp__crab-progress__progress'
const STEP_TOOL = 'mcp__crab-progress__step'
const PANE = 'crab-agents'
const MAX_AGENTS = 200
const FILE_TOOLS = new Set(['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Glob', 'Grep'])
const DIG_ACTIVE_MS = 8_000
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const TASK_OUTFITS = new Set<Outfit>(['coding', 'fixing', 'chef', 'working', 'reading', 'writing'])
const HOLD_MS = 15_000
const EASE_MS = 1_200
// A rise of this much at once sends him sprinting; when it stops he pants.
const BIG_JUMP = 0.12
// An even bigger rise and he takes a car instead.
const CAR_JUMP = 0.3
const DRIVE_MS = 3_000
const EXIT_MS = 1_500
const RUN_MS = 1_800
const PANT_MS = 3_500
const SETTLE_MS = 400
const STALL_MS = 5_000
const MAX = 200
const CLAY = '#D97757'
const DONE = '#5fbf8f'
const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif"
const H = ROW_H

const WORD: Record<Outfit, string> = {
  idle: 'idle',
  changing: 'changing',
  run: 'running',
  drive: 'driving',
  exitCar: 'done',
  medal: 'done',
  winCode: 'done',
  winFix: 'done',
  winRead: 'done',
  winWrite: 'done',
  frozen: 'frozen',
  pant: 'panting',
  stroll: 'idle',
  coding: 'coding',
  fixing: 'fixing',
  chef: 'cooking',
  reading: 'reading',
  writing: 'writing',
  sleeping: 'zzz',
  working: 'working',
  done: 'done',
  crown: 'done',
  error: 'error',
  greeting: 'hi',
  walkCool: 'idle',
  walkWizard: 'idle',
  walkChef: 'idle',
  walkCode: 'idle',
  walkCmd: 'idle',
  fly: 'idle',
  sunbathe: 'chilling',
  propeller: 'idle',
  cool: 'idle',
  dance: 'idle',
}

const clean = (n: unknown): number => (Number.isFinite(n) ? Math.min(MAX, Math.max(0, Math.round(n as number))) : 0)

const targetOf = (r: Run | null, s: Sess, at: number): number =>
  r && r.total > 0 ? Math.min(1, r.done / r.total) : autoRatio(s, at)

// Where the eased bar is at time `at`.
const shownAt = (b: Bar, at: number): number => b.from + (b.to - b.from) * Math.min(1, Math.max(0, (at - b.at) / EASE_MS))

const isStalled = (s: Sess, b: Bar, at: number): boolean => s.busy && at - b.movedAt > STALL_MS

// One step of the world: new clock, outfit, and the bar's next ease segment.
async function refresh($: EngineInterface): Promise<void> {
  const at = await $.clock.now()
  const s = await read($, sess)
  const target = targetOf(await read($, run), s, at)
  await update($, now, () => at)
  const b = await update($, bar, prev => {
    // A drop (new prompt, done window over) snaps; a rise eases.
    if (target < prev.to - 0.05) return { from: target, to: target, at, ref: target, movedAt: at, bigAt: 0 }
    const isMoved = Math.abs(target - prev.ref) >= 0.02
    const isChanged = Math.abs(target - prev.to) > 0.0005
    return {
      from: isChanged ? shownAt(prev, at) : prev.from,
      to: isChanged ? target : prev.to,
      at: isChanged ? at : prev.at,
      ref: isMoved ? target : prev.ref,
      movedAt: isMoved ? at : prev.movedAt,
      bigAt: isChanged && target - prev.to >= BIG_JUMP ? at : prev.bigAt,
      bigBy: isChanged && target - prev.to >= BIG_JUMP ? target - prev.to : prev.bigBy,
    }
  })
  // A bar that has stopped moving falls back to the idle animations.
  const want: Outfit = isStalled(s, b ?? FLAT, at) ? 'idle' : pickOutfit(s, at)
  await update($, look, prev => {
    if (prev.outfit === want) return prev
    const isSticky = TASK_OUTFITS.has(prev.outfit) && TASK_OUTFITS.has(want) && at - prev.since < HOLD_MS
    return isSticky ? prev : { outfit: want, since: at }
  })
}

// Opens the agents panel, or closes it when it is up; true when it ends up open.
async function togglePane($: EngineInterface): Promise<boolean> {
  const isOpen = (await $.ui.panes()).some(p => p.id === PANE)
  if (isOpen) {
    await $.ui.close({ id: PANE })
    return false
  }
  await $.ui.open({ id: PANE, title: 'Agents' })
  return true
}

async function switchTo($: EngineInterface, name: Character): Promise<{ text: string }> {
  await update($, char, () => name)
  await $.store.set('mascot', name)
  return { text: name === 'claude' ? 'Mascot is back to the crab.' : `Mascot is now the ${name}.` }
}

// `roam` is set while nothing is happening: he strolls about the empty bar on his own.
// `change` is set during a costume change: he digs the next one out of a pocket.
const rowSvg = (b: Bar, at: number, outfit: Outfit, W: number, isWalking: boolean, roam: { from: number; to: number } | null, character: Character, change?: { item: string; age: number; dest?: Dest }, settle?: number): string => {
  const barW = Math.max(60, W - 58)
  const px = (r: number): number => {
    const w = Math.round(barW * r)
    return w ? Math.max(w, BAR_H) : 0
  }
  const crabAt = (r: number): number => Math.max(0, Math.min(barW - CRAB_W, Math.round(barW * r) - CRAB_W / 2))
  const cur = shownAt(b, at)
  const rem = roam ? 1000 : Math.max(0, b.at + EASE_MS - at)
  const travel = (x: number): number => Math.round((barW - CRAB_W) * x)
  const fromW = px(cur)
  const toW = px(b.to)
  const crabX = roam ? travel(roam.to) : crabAt(b.to)
  const dx = (roam ? travel(roam.from) : crabAt(cur)) - crabX
  const color = WIN.has(outfit) && outfit !== 'crown' ? DONE : CLAY
  const winW = Math.round(40 * PX)
  const codeX = crabX + CRAB_W + winW + 10 > barW ? crabX - winW - 8 : crabX + CRAB_W + 8
  const slide = rem > 0 ? `@keyframes gw{from{width:${fromW}px}to{width:${toW}px}}@keyframes cm{from{transform:translateX(${dx}px)}to{transform:translateX(0)}}.fill{animation:gw ${rem}ms linear forwards}.cm{animation:cm ${rem}ms linear forwards}` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${crabCss(at)}<style>${slide}</style>
<rect class="k" x="0" y="${BAR_Y}" width="${barW}" height="${BAR_H}" rx="${BAR_H / 2}"/>
<rect class="fill" x="0" y="${BAR_Y}" width="${toW}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${color}"/>
${outfit === 'idle' ? codeWindow(Math.round(codeX), BAR_Y - Math.round(19 * PX)) : ''}
<g class="cm">${crabSvg(outfit, crabX, BAR_Y - CRAB_H, isWalking, character, change, settle)}</g>
<text class="m" x="${W}" y="${BAR_Y + BAR_H}" text-anchor="end" font-family="${FONT}" font-size="14" font-variant-numeric="tabular-nums">${Math.round(cur * 100)}%</text>
</svg>`
}

export const register: Register = (on, options) => {
  // The file tree (merged from the filetree mod) registers its own hooks beside ours.
  registerTree(on, options)

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const at = await $.clock.now()
    await update($, sess, s => ({ ...s, lastActive: at }))
    await update($, now, () => at)
    await $.tool.register({
      name: 'progress',
      description:
        "Optional: report the main task's progress to the bar above the prompt. The bar already moves by itself; call with total (planned steps) and done (finished steps) only to show exact step progress.",
      inputSchema: {
        type: 'object',
        properties: {
          done: { type: 'integer', minimum: 0, description: 'Steps finished so far.' },
          total: { type: 'integer', minimum: 1, description: 'Steps planned.' },
          title: { type: 'string', description: 'Few-word name of the task.' },
        },
        required: ['done'],
      },
      isDeferred: false,
    })
    const saved = await $.store.get('mascot')
    if (typeof saved === 'string' && (CHARACTERS as string[]).includes(saved)) await update($, char, () => saved as Character)
    await $.command.register({
      name: 'mascot',
      description: `Change the mascot: /mascot ${CHARACTERS.join(' | ')}, or /mascot list`,
    })
    for (const name of CHARACTERS) {
      if (name !== 'claude') await $.command.register({ name, description: `Turn the mascot into the ${name}` })
    }
    await $.tool.register({
      name: 'step',
      description:
        'For subagents: report progress on your own task to the agents panel. Right after reading the brief, call it with `total` (your plan in 3-8 steps) and `done: 0`; call it again as each step finishes. Cheap and silent: it only draws a bar.',
      inputSchema: {
        type: 'object',
        properties: {
          done: { type: 'integer', minimum: 0, description: 'Steps finished so far.' },
          total: { type: 'integer', minimum: 1, description: 'Steps planned; may change if the plan changes.' },
          note: { type: 'string', description: 'The step in progress, a few words.' },
        },
        required: ['done'],
      },
      isDeferred: false,
    })
    await $.command.register({
      name: 'agents-info',
      description: 'Show or hide the panel of subagents: running and finished, with model, context, cost and time',
    })
    void $.ui.open({ id: PANE, title: 'Agents' })
    $.clock.every(1000, () => void refresh($))
    return started
  })

  on('prompt.submit', async ($, e, next) => {
    const at = await $.clock.now()
    const text = String((e as unknown as { text?: unknown }).text ?? '')
    await update($, sess, () => ({ busy: true, startedAt: at, lastActive: at, doneAt: 0, tools: 0, edits: 0, prompt: text.slice(0, 300), lastTool: '', end: '' }))
    await update($, run, () => null)
    await update($, bar, () => ({ from: 0, to: 0, at, ref: 0, movedAt: at, bigAt: 0 }))
    await refresh($)
    return next(e)
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    if (e.agentId) return { result: 'ignored: only the main session reports' }
    const input = e as unknown as { done?: number; total?: number; title?: string }
    const next = await update($, run, prev => {
      const total = clean(input.total ?? prev?.total)
      return { title: input.title?.trim().slice(0, 120) || prev?.title || 'progress', total, done: Math.min(total || MAX, clean(input.done)) }
    })
    await refresh($)
    return { result: `ok: ${next && next.total ? Math.round((next.done / next.total) * 100) : 0}%` }
  })

  on('tool.call', async ($, e, next) => {
    const at = await $.clock.now()
    if (FILE_TOOLS.has(e.tool)) {
      const input = e as unknown as { file_path?: string; notebook_path?: string; path?: string; pattern?: string }
      const target = input.file_path ?? input.notebook_path ?? input.path ?? input.pattern
      if (typeof target === 'string' && target) {
        const name = target.split(/[\\/]/).filter(Boolean).pop() ?? target
        await update($, files, f => ({ at, names: [name, ...f.names.filter(n => n !== name)].slice(0, 3), paths: [target, ...f.paths.filter(p => p !== target)].slice(0, 3) }))
      }
    }    // A subagent's tool call changes its own row (and costume), not the main session's state.
    if (e.agentId) {
      const agentId = e.agentId
      await update($, agents, list =>
        list.map((a): AgentRun => {
          if (a.agentId !== agentId) return a
          const grown = { ...a, tools: (a.tools ?? 0) + 1, lastTool: e.tool, edits: (a.edits ?? 0) + (EDIT_TOOLS.has(e.tool) ? 1 : 0) }
          const want = taskOutfit(grown, at)
          const held = a.outfit && a.outfitAt !== undefined && at - a.outfitAt < HOLD_MS && TASK_OUTFITS.has(a.outfit) && TASK_OUTFITS.has(want)
          return held ? grown : { ...grown, outfit: want, outfitAt: at }
        }),
      )
      return next(e)
    }    if (e.tool === 'TodoWrite' && !e.agentId) {
      const todos = (e as unknown as { todos?: { status?: string }[] }).todos
      if (Array.isArray(todos) && todos.length > 0) {
        const list = todos.slice(0, MAX)
        await update($, run, () => ({ title: 'todo', total: list.length, done: list.filter(t => t.status === 'completed').length }))
      }
    }
    await update($, sess, s => ({
      ...s,
      busy: true,
      startedAt: s.busy ? s.startedAt : at,
      lastActive: at,
      doneAt: 0,
      tools: s.tools + 1,
      lastTool: e.tool,
      edits: s.edits + (EDIT_TOOLS.has(e.tool) ? 1 : 0),
    }))
    await refresh($)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) {
      const at = await $.clock.now()
      const reason = (e as unknown as { reason?: string }).reason
      await update($, sess, s => ({ ...s, busy: false, lastActive: at, doneAt: at, end: reason !== 'answer' ? 'fail' : isLong(s, at) ? 'long' : 'ok' }))
      await update($, run, () => null)
      await refresh($)
    } else {
      const at = await $.clock.now()
      const agentId = e.agentId
      const reason = (e as unknown as { reason?: string }).reason
      const usage = (e as unknown as { usage?: { model?: string; input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number } }).usage
      await update($, agents, list =>
        list.map((a): AgentRun => {
          if (a.agentId !== agentId) return a
          // A run whose steps went unseen still gets the turn's own sum.
          const fallback = a.steps === 0 && usage
          return {
            ...a,
            status: reason === 'answer' ? 'done' : 'failed',
            endedAt: at,
            ...(fallback && usage
              ? {
                  model: usage.model || a.model,
                  tokens: usage.input_tokens + usage.output_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens,
                  costUsd: costOf(usage.model || a.model, usage, false),
                }
              : {}),
          }
        }),
      )
    }
    return next(e)
  })

  // A worker's own progress: the call runs in the worker's loop, so agentId names it.
  on('tool.call', { tool: STEP_TOOL }, async ($, e) => {
    const input = e as unknown as { done?: number; total?: number; note?: string }
    const agentId = e.agentId
    if (!agentId) return { result: 'ignored: only subagents report steps' }
    let matched = false
    await update($, agents, list =>
      list.map(a => {
        if (a.agentId !== agentId) return a
        matched = true
        const total = Math.max(0, Math.round(input.total ?? a.stepTotal ?? 0))
        const done = Math.max(0, Math.round(input.done ?? a.stepDone ?? 0))
        return { ...a, stepTotal: total, stepDone: total ? Math.min(total, done) : done, stepNote: input.note?.trim() || undefined }
      }),
    )
    return { result: matched ? 'ok' : `ignored: no panel row for agent ${agentId}` }
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny !== undefined) return started
    const at = await $.clock.now()
    await update($, agents, list => {
      const round = 1 + list.filter(a => e.description && sameTask(a.description, e.description)).length
      const run: AgentRun = {
        id: started.agentId ?? e.tool_use_id,
        agentId: started.agentId,
        type: e.subagentType,
        description: e.description,
        model: started.model,
        status: 'running',
        startedAt: at,
        contextTokens: 0,
        contextMax: windowOf(started.model),
        tokens: 0,
        costUsd: 0,
        steps: 0,
        round,
      }
      return [...list.filter(a => a.id !== run.id), run].slice(-MAX_AGENTS)
    })
    return started
  })

  // Each model request of a subagent: live context, tokens and cost.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const agentId = e.agentId
    const usage = result.usage
    if (!agentId || !usage) return result
    const model = usage.model || e.model
    await update($, agents, list =>
      list.map((a): AgentRun => {
        if (a.agentId !== agentId) return a
        const prompt = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0)
        return {
          ...a,
          model,
          effort: typeof e.effort === 'string' ? e.effort : a.effort,
          status: 'running',
          endedAt: undefined,
          contextTokens: prompt + (usage.output_tokens || 0),
          contextMax: windowOf(model),
          tokens: a.tokens + prompt + (usage.output_tokens || 0),
          costUsd: a.costUsd + costOf(model, usage, true),
          steps: a.steps + 1,
        }
      }),
    )
    return result
  })

  on('command.run', { command: 'agents-info' }, async $ => {
    const isOpen = await togglePane($)
    return { text: isOpen ? 'Agents panel opened.' : 'Agents panel closed.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const list = await read($, agents)
    const p: Panel = await read($, panel)
    await read($, now) // redraw on every tick
    const at = await $.clock.now()
    const character = await read($, char)
    const touched = await read($, files)
    const isDigging = touched.at > 0 && at - touched.at <= DIG_ACTIVE_MS
    const running = list.filter(a => a.status === 'running').reverse()
    const finished = list.filter(a => a.status !== 'running').reverse()
    const t = totals(list, at)

    const toggleCompact = (
      <Button key="compact" label={p.isCompact ? 'Expand' : 'Collapse'} plain onPress={() => update($, panel, prev => ({ ...prev, isCompact: !prev.isCompact }))} />
    )
    const toggleDone = (
      <Button
        key="done"
        label={`${p.isDoneCollapsed ? '\u25b8' : '\u25be'} Finished \u00b7 ${finished.length}`}
        plain
        onPress={() => update($, panel, prev => ({ ...prev, isDoneCollapsed: !prev.isDoneCollapsed }))}
      />
    )

    if (e.surface !== 'terminal' && 'Svg' in ui) {
      const { Svg } = ui
      const W = Math.max(240, Math.min(900, (e.props.bodyColumns || 40) * 8 - 8))
      if (list.length > 0 && p.isCompact) {
        return (
          <Box flexDirection="column" gap={1}>
            {isDigging && <Svg source={digSvg(at, touched.names, character)} alt="Claude digging through files" width={DIG_W} height={DIG_H} />}
            <Svg source={compactSvg(W, list, at, t, character)} alt={`${list.length} agents, ${summaryOf(t)}`} width={W} height={40} />
            {toggleCompact}
          </Box>
        )
      }
      const shownDone = p.isDoneCollapsed ? 0 : finished.length
      const lines = 1 + (list.length === 0 ? 1 : 0) + (running.length > 0 ? 1 : 0) + (finished.length > 0 ? 1 : 0)
      const gridH = (isDigging ? DIG_H : 0) + HEADER_H + lines * LINE_H + (running.length + shownDone) * AGENT_ROW_H
      return (
        <Box flexDirection="column">
          {gridTiles(gridH).map((tileH, i) => (
            <Svg key={`grid-${i}`} source={gridSvg(W, tileH)} alt="dotted grid" width={W} height={tileH} />
          ))}
          <Box flexDirection="column" position="absolute" top={0} left={0} right={0}>
            {isDigging && <Svg source={digSvg(at, touched.names, character)} alt="Claude digging through files" width={DIG_W} height={DIG_H} />}
            <Svg source={headerSvg(W, at, t)} alt={summaryOf(t)} width={W} height={HEADER_H} />
            {toggleCompact}
            {list.length === 0 && <Text dimColor>No subagents yet.</Text>}
            {running.length > 0 && <Text dimColor>{`Running \u00b7 ${running.length}`}</Text>}
            {running.map(a => (
              <Svg key={a.id} source={agentSvg(W, a, at, character)} alt={`${a.description}: ${modelName(a.model)}, running`} width={W} height={AGENT_ROW_H} />
            ))}
            {finished.length > 0 && toggleDone}
            {!p.isDoneCollapsed &&
              finished.map(a => (
                <Svg key={a.id} source={agentSvg(W, a, at, character)} alt={`${a.description}: ${modelName(a.model)}, finished`} width={W} height={AGENT_ROW_H} />
              ))}
          </Box>
        </Box>
      )
    }

    // Terminal: the same rows in text.
    const cols = Math.max(24, e.props.bodyColumns || 40)
    const barW = Math.max(6, Math.min(20, cols - 34))
    const row = (a: AgentRun) => {
      const l = agentLine(a, at)
      return (
        <Box key={a.id} flexDirection="column" marginBottom={1}>
          <Text bold wrap="truncate-end">{l.title}</Text>
          <Text dimColor wrap="truncate-end">{l.meta}</Text>
          <Text wrap="truncate-end">
            <Text color="#D97757">{ctxBar(l.progress === null ? l.ctx : l.progress * 100, barW)}</Text>
            <Text dimColor>{` ${l.stats}`}</Text>
          </Text>
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Text dimColor>{summaryOf(t)}</Text>
          {toggleCompact}
        </Box>
        {list.length === 0 && <Text dimColor>No subagents yet.</Text>}
        {!p.isCompact && running.map(row)}
        {finished.length > 0 && toggleDone}
        {!p.isCompact && !p.isDoneCollapsed && finished.map(row)}
      </Box>
    )
  })

  on('command.run', { command: 'mascot' }, async ($, e) => {
    const arg = (e.args ?? '').trim().toLowerCase()
    const list = `Mascots: ${CHARACTERS.join(', ')}. Use /mascot <name>.`
    if (!arg || arg === 'list') return { text: list }
    const name = CHARACTERS.find(c => c === arg)
    return name ? switchTo($, name) : { text: `Unknown mascot "${arg}". ${list}` }
  })

  for (const name of CHARACTERS) {
    if (name !== 'claude') on('command.run', { command: name }, async $ => switchTo($, name))
  }

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const s = await read($, sess)
    const b = await read($, bar)
    await read($, now) // redraw on every tick; the drawing itself uses the real clock
    const at = await $.clock.now()
    const lk = await read($, look)
    const outfit = lk.outfit
    const character = await read($, char)
    const cur = shownAt(b, at)
    const pct = `${Math.round(cur * 100)}%`
    const drawn = await Promise.resolve(next(e)).catch(() => null)
    const below = drawn && typeof drawn === 'object' && (drawn as { type?: string }).type !== 'engine' ? drawn : null
    // keepwarm's cache-tax line says the prompt cache is cold: he is frozen in a cube of ice.
    const isIced = !s.busy && isCacheCold(below)
    const isRoaming = !s.busy && outfit === 'idle' && !isIced
    const roam = isRoaming ? { now: roamAt(at), next: roamAt(at + 1000) } : null
    const isWin = WIN.has(outfit)
    const jumped = b.bigAt > 0 && b.bigAt >= s.startedAt
    // Victory depends on how the turn went: out of the car, a medal, or the task's own pose.
    const pose: Outfit = roam ? roam.now.pose : outfit === 'done' ? winPose(s, b.bigBy ?? 0, jumped) : outfit
    const age = roam ? roam.now.age : at - lk.since
    const item = ITEM_COLOR[pose]
    const jumpAge = b.bigAt > 0 ? at - b.bigAt : Infinity
    const isCar = (b.bigBy ?? 0) >= CAR_JUMP
    const sprintMs = isCar ? DRIVE_MS : RUN_MS
    const isRun = !roam && !isIced && jumpAge < sprintMs
    // After a sprint he pants; after the car he just climbs out. Neither once the turn is won.
    const isPant = !roam && !isIced && !isRun && !isCar && !isWin && jumpAge < sprintMs + PANT_MS
    const isExit = !roam && !isIced && !isRun && isCar && !isWin && jumpAge < sprintMs + EXIT_MS
    const isChanging = !isIced && !isRun && !isPant && !isExit && item !== undefined && age < CHANGE_MS
    const shown: Outfit = isIced ? 'frozen' : isRun ? (isCar ? 'drive' : 'run') : isPant ? 'pant' : isExit ? 'exitCar' : isChanging ? 'changing' : pose
    // Just landed in a new look: a quick squash-and-stretch settle.
    const settle = isIced || isRun || isPant || isExit || isChanging ? undefined : age - (item === undefined ? 0 : CHANGE_MS)
    const isWalking = isIced || isRun || isPant || isExit ? false : roam ? MOVING.has(pose) && pose !== 'fly' : s.busy && !isStalled(s, b, at) && outfit !== 'idle'
    const word = isIced ? 'frozen' : WORD[shown]

    const ui = $.ui.resolve(e)
    const { Box, Text } = ui

    if (e.surface !== 'terminal' && 'Svg' in ui) {
      const { Svg } = ui
      const width = Math.max(180, Math.min(1600, (e.props.bodyColumns || 100) * 8 - 40))
      return (
        <Box flexDirection="column">
          <Svg source={rowSvg(b, at, shown, width, isWalking, roam ? { from: roam.now.x, to: roam.next.x } : null, character, isChanging ? { item, age, dest: ITEM_DEST[pose] } : undefined, settle)} alt={`${word}: ${pct}`} width={width} height={H} />
          {below}
        </Box>
      )
    }

    const width = Math.max(6, Math.min(60, (e.props.bodyColumns || 80) - 24))
    const filled = Math.round(width * cur)
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text color={outfit === 'done' ? DONE : CLAY}>{'█'.repeat(filled) + '░'.repeat(width - filled)}</Text>
          <Text dimColor>{pct}</Text>
          <Text dimColor>{isIced ? 'frozen' : WORD[outfit]}</Text>
        </Box>
        {below}
      </Box>
    )
  })
}
