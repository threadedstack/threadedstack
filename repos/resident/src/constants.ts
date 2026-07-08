/**
 * Resident runtime constants. Delegation/output caps come from @tdsk/domain so
 * in-pod sub-agents keep the exact semantics of the platform's delegation path.
 */

/** Env var names — the pod-start injection contract (podManifest + R3 token injection). */
export const ResidentAgentIdEnvVar = `TDSK_RESIDENT_AGENT_ID`
export const ResidentTokenEnvVar = `TDSK_RESIDENT_TOKEN`
export const ResidentBackendUrlEnvVar = `TDSK_BACKEND_URL`
export const ResidentOrgIdEnvVar = `TDSK_RESIDENT_ORG_ID`
export const ResidentProjectIdEnvVar = `TDSK_RESIDENT_PROJECT_ID`
export const ResidentStateDirEnvVar = `TDSK_RESIDENT_STATE_DIR`
export const ResidentWorkdirEnvVar = `TDSK_RESIDENT_WORKDIR`
export const ResidentConfigEnvVar = `TDSK_RESIDENT_CONFIG`

/** On-disk session state home (the workspace volume survives container restarts). */
export const DefaultStateDir = `/workspace/.tdsk-resident`
export const DefaultWorkdir = `/workspace`
export const SessionStateFile = `session`

/** The resident config collection queried by agentId. */
export const ResidentConfigCollection = `resident_configs`

/** Default inbox collection (spec §2 — agent_messages). */
export const DefaultInboxCollection = `agent_messages`

/**
 * Hard cap on actions per dispatch call — MUST match the backend endpoint's
 * MaxDispatchActions (repos/backend/src/endpoints/agents/dispatchAgentActions.ts).
 */
export const DispatchMaxActionsPerCall = 20

/** Dispatch retry policy: total attempts and backoff before each retry. */
export const DispatchMaxAttempts = 3
export const DispatchRetryDelaysMs = [1000, 5000]

/** Loop cadences. */
export const ScanIntervalMs = 1000
export const DefaultInboxPollMs = 15_000
export const DefaultWatchPollMs = 30_000
export const DefaultWatchDebounceMs = 60_000
export const DefaultMinIdleMs = 60_000
export const HeartbeatIntervalMs = 30_000
export const ConfigRefreshMs = 60_000

/** Inbox scan page size + the remembered-message cap (refire protection). */
export const InboxQueryLimit = 50
export const SeenMessagesMax = 500

/** Compaction defaults (turn count / cumulative in+out bytes per session). */
export const DefaultMaxTurns = 40
export const DefaultMaxBytes = 400_000

/** Caps on captured/forwarded text. */
export const TurnOutputMaxChars = 200_000
export const CheckpointSummaryMaxChars = 8000
export const TranscriptFieldMaxChars = 20_000
export const WatchRecordsMaxChars = 8000

/** Wall-clock default for a single resident session turn. */
export const DefaultTurnTimeoutMs = 15 * 60_000

/** Grace between SIGTERM and SIGKILL when a turn times out. */
export const ChildKillGraceMs = 5000

/** Default sub-agent concurrency (domain's DelegationConcurrencyCap mirrors this). */
export const DefaultSubAgentMaxConcurrent = 3

/** Resident-local fence: the session requests sub-agents with ```tdsk-spawn```. */
export const SpawnBlockFence = `tdsk-spawn`

/**
 * The compaction checkpoint turn — this session's /compact, verbatim in spirit:
 * durable memories out, then a summary that seeds the next session.
 */
export const CheckpointPrompt = [
  `Context threshold reached — checkpoint now.`,
  `1. Emit a \`\`\`tdsk-memories\`\`\` block capturing every durable decision, obligation, and piece of state worth keeping (JSON array of { "text", "importance" }).`,
  `2. Then write a concise session summary: in-flight work, current plans, open questions, and immediate next steps. This summary seeds your next session, so include everything future-you needs to continue seamlessly.`,
].join(`\n`)
