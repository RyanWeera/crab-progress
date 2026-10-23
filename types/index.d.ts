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
  | 'drive' // the bar leapt even further: he takes a car
  | 'pant' // ...and stopped: heavy breathing
  | 'park' // between the drive and the victory: the car brakes, smoke, brake lights
  | 'brace' // between a finished task and its victory: crouches while sparks gather
  | 'exitCar' // climbs out of the car and cheers (victory after driving)
  | 'medal' // a medal round his neck (victory after sprinting)
  | 'winCode' // victory after coding: terminal with a green check
  | 'winFix' // victory after fixing: wizard with a firework
  | 'winRead' // victory after reading: closed book held up
  | 'winWrite' // victory after writing: finished page with a check
  | 'frozen' // the prompt cache went cold: frozen in a cube of ice
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
export type Bar = { from: number; to: number; at: number; ref: number; movedAt: number; bigAt: number; bigBy?: number }

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

// ---- Token Optimizer band (merged from token-optimizer's desktop mod) ----

export type TokenOptimizerDesktopLimit = { percentUsed: number; resetsAt: string | null }

export type TokenOptimizerDesktopQuality = {
  score: number
  grade: string
  drag: string | null
  toolCalls: number | null
  compactions: number
  /** Epoch seconds. */
  checkpointEpoch: number | null
  /** Epoch seconds. */
  sessionStartEpoch: number | null
  /** Token Optimizer's own context fill, %. */
  fillPct?: number | null
}

export type TokenOptimizerDesktopSavings = {
  sessionTokens: number | null
  last30Tokens: number | null
  /** 30 entries, oldest first; today last. */
  daily: number[]
}

export type TokenOptimizerDesktopSession = {
  sessionId: string
  /** `$.clock.now()` when these figures were gathered (ms). */
  gatheredAt: number
  quality: TokenOptimizerDesktopQuality | null
  contextPercent: number | null
  contextTokens: number | null
  contextWindow: number | null
  /** A smaller env ceiling invalidates full-window quality-cache fill. */
  contextWindowReduced?: boolean
  /** The model's own window when contextWindowReduced; null otherwise. */
  contextModelWindow?: number | null
  fiveHour: TokenOptimizerDesktopLimit | null
  week: TokenOptimizerDesktopLimit | null
  /** Current git branch; null outside a repository or on a detached HEAD. */
  branch: string | null
  /** Last known savings; kept while a refresh loads or times out. */
  savings: TokenOptimizerDesktopSavings | null
  savingsState: 'fresh' | 'stale' | 'loading' | 'unavailable'
  /** One short reason when savings is null. */
  savingsReason: string | null
  /** Last main-thread request, epoch seconds (the cache clock's anchor). */
  lastRequestEpoch: number | null
  /** Last measured cache lifetime; null while unmeasured. */
  cacheLifetime: '1h' | '5m' | null
  /** The user's compact window from settings or /autocompact, as the status command resolved it. */
  compactWindow?: number | null
  /** When Token Optimizer last saved a checkpoint, epoch seconds. */
  checkpointEpoch: number | null
  /** The earlier session's checkpoint flagged as resumable for this one (epoch seconds). */
  /** A rate limit was reported at least once this session: it runs on a Claude plan. */
  sawLimits?: boolean
  /** When the live session began (ms), from the engine. */
  startedAtMs?: number | null
  /** Main-thread tool calls and compactions the band watched itself: the row never waits on Token Optimizer's quality file. */
  toolCallsSeen?: number
  compactionsSeen?: number
  /** Compactions counted in the transcript by the status command. */
  compactions?: number | null
  earlierCheckpoint?: { epoch: number; about: string | null } | null
  /** The detail row under Clawd is unfolded. */
  sheetOpen: boolean
}

export type TokenOptimizerDesktopState = TokenOptimizerDesktopSession | null

/**
 * Start fresh's hand-off, waiting for the first prompt of a session in the
 * same project that started since it was saved, within 10 minutes.
 */
export type TokenOptimizerDesktopHandoff = {
  fromSessionId: string
  /** The project it was saved in; another project's session never touches it. */
  cwd: string
  checkpointPath: string
  text: string
  /** `$.clock.now()` when it was recorded (ms). */
  createdAt: number
  /** While the save is being stamped: the press time (createdAt is a far-future placeholder). */
  pendingSince?: number
} | null

/** The cache clock's reducer state (src/clock.ts ClockState). */
export type TokenOptimizerDesktopClock = {
  anchor: number | null
  lifetime: '1h' | '5m' | null
  contextTokens: number | null
  working: boolean
  warming: boolean
  lapsed: boolean
}

/** What a button is doing, the last outcome, and the Start fresh arm (src/actions.ts UiState). */
export type TokenOptimizerDesktopUi = {
  busy: 'clean' | 'fresh-capture' | 'fresh-clear' | 'dashboard' | null
  busySince: number | null
  note: string | null
  noteUntil: number
  freshArmedAt: number | null
}

/**
 * The compaction or clear the buttons have running, recorded before the call
 * and cleared when it settles, so a reload mid-call still refuses a second
 * one. A record older than 10 minutes is treated as gone.
 */
export type TokenOptimizerDesktopEngineCall = {
  kind: 'compact' | 'clear'
  /** `$.clock.now()` when the call was recorded (ms). */
  startedAt: number
} | null

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
      'to-session': TokenOptimizerDesktopState
      'to-handoff': TokenOptimizerDesktopHandoff
      'to-clock': TokenOptimizerDesktopClock | null
      'to-ui': TokenOptimizerDesktopUi | null
      'to-engineCall': TokenOptimizerDesktopEngineCall
      'to-frame': number
    }
  }
}
