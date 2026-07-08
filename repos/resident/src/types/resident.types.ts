import type { TAgentAction, TContextSource, TRecordQuery } from '@tdsk/domain'

/**
 * Resident runtime types. The client-side shape of the `resident_configs`
 * record (spec §2) is defined HERE — the collection itself is data (created in
 * R3); the runtime types are deliberately local to the resident package.
 */

/** The env contract injected at resident pod start (podManifest + token minting). */
export type TResidentEnv = {
  /** TDSK_RESIDENT_AGENT_ID — the agent this pod embodies. */
  agentId: string
  /** TDSK_RESIDENT_TOKEN — the pod-scoped api key (Bearer). */
  token: string
  /** TDSK_BACKEND_URL — the PUBLIC proxy URL (backend reached via the MITM). */
  backendUrl: string
  /** TDSK_RESIDENT_ORG_ID — org owning the agent (records/dispatch URL scope). */
  orgId: string
  /** TDSK_RESIDENT_PROJECT_ID — project the agent operates in. */
  projectId: string
  /** TDSK_RESIDENT_STATE_DIR — on-disk session state home. */
  stateDir: string
  /** TDSK_RESIDENT_WORKDIR — cwd for claude child processes. */
  workdir: string
  /** TDSK_RESIDENT_CONFIG — the resident_configs record JSON injected at pod start (network-free boot). */
  configJson?: string
}

/** A mandatory recurring agenda item — regular work as data. */
export type TResidentAgendaItem = {
  key: string
  /** 5-field cron expression (same parser as the platform scheduler). */
  cron: string
  prompt: string
}

/** A records-query watch — fires a turn when the matched set changes. */
export type TResidentWatch = {
  key: string
  collection: string
  query: TRecordQuery
  prompt: string
  /** Minimum ms between fired turns for this watch. */
  debounceMs?: number
  /** Poll cadence override for this watch. */
  pollMs?: number
}

/**
 * Platform Function names the runtime dispatches its own housekeeping through.
 * ALL are optional and config-driven — an unconfigured surface is skipped with
 * a log line, never assumed to exist on the platform.
 */
export type TResidentFunctions = {
  /** Receives `{ text, importance?, kind?, meta? }` per tdsk-memories entry. */
  writeMemory?: string
  /** Receives the resident status object every heartbeat interval. */
  heartbeat?: string
  /** Receives `{ event, input, output, at }` after every turn. */
  appendTranscript?: string
  /** Receives `{ id }` per consumed inbox message (read receipt). */
  markMessageRead?: string
}

/** The client shape of a `resident_configs` record's `data` document. */
export type TResidentConfig = {
  agentId: string
  /** Org/project scope — only read from the env-fallback JSON (URLs need them before any fetch). */
  orgId?: string
  projectId?: string
  agenda: TResidentAgendaItem[]
  watches: TResidentWatch[]
  inbox: {
    pollMs: number
    /** Inbox collection name (default agent_messages). */
    collection: string
  }
  compaction: {
    maxTurns: number
    maxBytes: number
  }
  session: {
    /** The soul/identity seed prepended to the first turn of every session. */
    seedPrompt?: string
    standingDirectives?: string
    /** Fresh context fetched + rendered into every turn (`## <as>` sections). */
    contextSources?: TContextSource[]
    /** Wall-clock cap for a single claude turn. */
    turnTimeoutMs?: number
  }
  subAgents: {
    maxConcurrent: number
  }
  selfDirected: {
    prompt: string
    /** Queue must be empty this long before a self-directed turn fires. */
    minIdleMs: number
  }
  functions: TResidentFunctions
}

/** Event kinds, in priority order (lower = runs first). */
export enum EResidentEventKind {
  agenda = `agenda`,
  inbox = `inbox`,
  /** Internal events (sub-agent completions) share inbox priority. */
  internal = `internal`,
  watch = `watch`,
  selfDirected = `self-directed`,
}

/** An inbox message document (id + the record's data payload). */
export type TInboxMessage = {
  id: string
  data: Record<string, unknown>
}

/** A queued turn trigger. */
export type TResidentEvent = {
  kind: EResidentEventKind
  key: string
  prompt?: string
  /** Inbox events carry the unread messages they represent. */
  messages?: TInboxMessage[]
  /** Watch events carry the matched records for the turn framing. */
  records?: Array<Record<string, unknown>>
  /** Internal events carry the completed sub-agent result summary. */
  detail?: string
  enqueuedAt: number
  seq: number
}

/** Result of one claude turn (session or sub-agent child). */
export type TTurnResult = {
  ok: boolean
  /** The assistant result text (extracted from the CLI JSON envelope). */
  output: string
  sessionId?: string
  exitCode?: number
  timedOut: boolean
  durationMs: number
  error?: string
}

/** Persisted session state (survives pod restarts on the workspace volume). */
export type TSessionState = {
  sessionId?: string
  turnCount: number
  totalBytes: number
  /** Compaction summary awaiting the next session's first-turn seed. */
  checkpointSummary?: string
}

/** Per-action dispatch result (mirror of the backend's TInvokeResult). */
export type TDispatchResult = {
  ok: boolean
  data?: unknown
  error?: string
}

/** Uniform HTTP-boundary result — the client never throws. */
export type TApiResult<T> = {
  ok: boolean
  status: number
  data?: T
  error?: string
}

/** A record document returned by the records query API. */
export type TResidentRecord = {
  id: string
  data: Record<string, unknown>
}

/** A self-authored Function submission (parsed from a ```tdsk-author-function``` block). */
export type TAuthorFunctionRequest = {
  name: string
  description?: string
  language: string
  content: string
}

/** The authored Function row returned by the author-function endpoint. */
export type TAuthoredFunction = {
  id: string
  name: string
}

/** The resident API client — the ONLY HTTP boundary in the runtime. */
export type TResidentApi = {
  queryRecords: (
    collection: string,
    query: TRecordQuery
  ) => Promise<TApiResult<TResidentRecord[]>>
  upsertRecord: (
    collection: string,
    record: { id?: string; data: Record<string, unknown> }
  ) => Promise<TApiResult<TResidentRecord>>
  dispatch: (actions: TAgentAction[]) => Promise<TApiResult<TDispatchResult[]>>
  /** POST a self-authored Function to the R3 author-function endpoint (spec §5.1). */
  authorFunction: (
    request: TAuthorFunctionRequest
  ) => Promise<TApiResult<TAuthoredFunction>>
}

/** Heartbeat status payload. */
export type TResidentStatus = {
  sessionId?: string
  queueDepth: number
  currentActivity: string
  lastTurnAt?: string
  turnCount: number
}

/** A sub-agent spawn request (parsed from a ```tdsk-spawn``` block). */
export type TSpawnRequest = {
  key?: string
  prompt: string
  timeoutMs?: number
}

/** A completed sub-agent run, enqueued back into the loop as an internal event. */
export type TSubAgentResult = {
  key: string
  ok: boolean
  output: string
  exitCode?: number
  timedOut: boolean
  durationMs: number
}

/** Pump outcome counters for one turn's output. */
export type TPumpReport = {
  total: number
  dispatched: number
  failed: number
  allowlistRejected: number
  memoriesSkipped: number
  /** ```tdsk-author-function``` submissions accepted by the platform. */
  functionsAuthored: number
  /** ```tdsk-author-function``` submissions rejected (scan/validation/collision). */
  functionsRejected: number
}
