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
/** Ordered fallback provider envs (JSON) for in-pod turn failover. Optional. */
export const ResidentProviderFallbacksEnvVar = `TDSK_RESIDENT_PROVIDER_FALLBACKS`

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

/**
 * Upper bound on the SIGTERM graceful-shutdown path (finish in-flight turn +
 * write checkpoint). Without it, shutdown can wait a full turn timeout (~15min)
 * plus a checkpoint turn — far past the pod's termination grace, so K8s SIGKILLs
 * mid-checkpoint anyway. Capping it lets a normal turn finish, then exits 0
 * best-effort. MUST be < the pod's ResidentTerminationGraceSeconds (150s, in
 * repos/sandbox/src/kube/podManifest.ts) so the runtime exits before SIGKILL.
 */
export const DefaultShutdownDeadlineMs = 135_000

/** Wall-clock timeout for a single resident→backend HTTP request (never hang a beat/poll). */
export const ApiRequestTimeoutMs = 30_000

/**
 * Network-level retry for a resident request. A reused-but-dead keep-alive
 * socket through the egress hairpin (pod → public URL → MITM → cluster) throws
 * ECONNRESET/"fetch failed"; a retry opens a FRESH connection. Retried ONLY on a
 * transport throw (never an HTTP error response), so a transient reset can't drop
 * a heartbeat/poll and trip a false watchdog restart.
 */
export const ApiNetworkRetryMax = 2
export const ApiNetworkRetryDelaysMs = [200, 800]

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
 * Resident-local fence: the session authors a Function with
 * ```tdsk-author-function``` — `{ name, description?, language?, content }`
 * (single object or array), POSTed to the R3 author-function endpoint.
 */
export const AuthorFunctionBlockFence = `tdsk-author-function`

/** Language default for authored Functions when the fence omits one. */
export const DefaultAuthorLanguage = `javascript`

/**
 * Resident-local fence: the session authors a proxy Endpoint with
 * ```tdsk-author-endpoint``` — `{ name, path, type?, options, headers?, description? }`
 * (single object or array), POSTed to the R3 author-endpoint endpoint.
 */
export const AuthorEndpointBlockFence = `tdsk-author-endpoint`

/**
 * Resident-local fence: the session stores a credential IT OBTAINED with
 * ```tdsk-author-secret``` — `{ name, value, description? }` (single object or
 * array), POSTed to the R3 author-secret endpoint. The value is NEVER logged.
 */
export const AuthorSecretBlockFence = `tdsk-author-secret`

/**
 * The compaction checkpoint turn — this session's /compact, verbatim in spirit:
 * durable memories out, then a summary that seeds the next session.
 */
export const CheckpointPrompt = [
  `Context threshold reached — checkpoint now.`,
  `1. Emit a \`\`\`tdsk-memories\`\`\` block capturing every durable decision, obligation, and piece of state worth keeping (JSON array of { "text", "importance" }).`,
  `2. Then write a concise session summary: in-flight work, current plans, open questions, and immediate next steps. This summary seeds your next session, so include everything future-you needs to continue seamlessly.`,
].join(`\n`)
