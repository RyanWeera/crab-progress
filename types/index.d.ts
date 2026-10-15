export type Outfit =
  | 'idle' // magnifying glass + code
  | 'stroll' // plain walking, used when roaming the bar
  | 'coding' // sunglasses + terminal
  | 'fixing' // wizard
  | 'chef' // long tasks
  | 'reading' // book, while he reads files / searches
  | 'writing' // book + pencil, documents
  | 'sleeping' // nightcap
  | 'working' // thinking dots
  | 'done' // claws up
  | 'crown' // finished a long task
  | 'error' // turn ended badly
  | 'greeting' // waving
  | 'propeller' // propeller cap
  | 'cool' // sunglasses
  | 'dance'
  | 'sunbathe' // deck chair and umbrella, in the idle loop
  | 'walkCool' // strolling variants, used while roaming
  | 'walkWizard'
  | 'walkChef'
  | 'walkCode'
  | 'walkCmd'
  | 'fly'
  | 'run' // the bar just jumped: sprinting
  | 'pant' // ...and stopped: heavy breathing
  | 'changing' // quick-change: pulls the next costume from a pocket and puts it on

// Who is drawn: the crab by default; `/mascot <name>` swaps him.
export type Character = 'claude' | 'frog' | 'creeper' | 'slime' | 'robot' | 'cat'

// Explicit progress, from the `progress` tool or TodoWrite.
export type Run = { title: string; done: number; total: number }

// What the main session is doing, kept from prompt.submit / tool.call / turn.complete.
export type Sess = {
  busy: boolean
  startedAt: number
  lastActive: number
  doneAt: number
  tools: number
  edits: number
  prompt: string
  lastTool: string
  end: '' | 'ok' | 'long' | 'fail'
}

export type Look = { outfit: Outfit; since: number }

// The last files an agent or the main session touched, for the side-panel dig scene.
export type Files = { at: number; names: string[]; paths: string[] }

// The drawn bar eases from `from` to `to`, starting at `at`. `ref`/`movedAt` mark the last
// real advance (2% or more), so a bar that stops moving can be told from one that is slow.
export type Bar = { from: number; to: number; at: number; ref: number; movedAt: number; bigAt: number }

export type AgentStatus = 'running' | 'done' | 'failed'

// One subagent, for the agents panel.
export type AgentRun = {
  id: string
  agentId?: string
  type: string
  description: string
  model: string
  effort?: string
  status: AgentStatus
  startedAt: number
  endedAt?: number
  contextTokens: number
  contextMax: number
  tokens: number
  costUsd: number
  steps: number
  round: number
  /** What it is doing now, from its tool calls: drives its costume. */
  tools?: number
  edits?: number
  lastTool?: string
  outfit?: Outfit
  outfitAt?: number
  /** Self-reported by the worker through the `step` tool. */
  stepDone?: number
  stepTotal?: number
  stepNote?: string
}

export type Panel = { isCompact: boolean; isDoneCollapsed: boolean }

// --- file tree (merged from the filetree mod, MIT, data-goblin/claude-code-filetree) ---

export type FileNode = {
  id: string
  parent: string
  name: string
  kind: 'dir' | 'file' | 'link'
  hidden: boolean
  mtime: number
  size: number
  loaded: boolean
}

export type Branch = { head: string; upstream: string; ahead: number; behind: number }

export type Activity = {
  id: number
  kind: string
  label: string
  state: 'running' | 'done' | 'failed'
  detail: string
  at: number
  tone: string
  nerd: string
  plain: string
}

export type FileTree = {
  root: string
  nodes: FileNode[]
  expanded: string[]
  cursor: string
  selected: string
  query: string
  showHidden: boolean
  showSize: boolean
  dirSizes: Record<string, number>
  git: Record<string, string>
  diff: Record<string, [number, number]>
  ignored: string[]
  untrackedDirs: string[]
  top: string
  prefix: string
  branch: Branch | null
  counts: Record<string, [number, number, number]>
  flash: string[]
  flashDim: string[]
  flashOn: boolean
  flashTones: Record<string, string>
  scroll: number | null
  preview: string
  previewTop: number
}

export type Theme = { fg: string; accent: string; muted: string; urgent: string; selection: string; bg: string }

declare module 'claude-code' {
  interface PluginState {
    'crab-progress': {
      run: Run | null
      sess: Sess
      look: Look
      now: number
      bar: Bar
      char: Character
      agents: AgentRun[]
      panel: Panel
      files: Files
      tree: FileTree
      theme: Theme
      activity: Activity[]
    }
  }
}
