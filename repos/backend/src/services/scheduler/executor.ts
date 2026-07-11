import type { TApp } from '@TBE/types'
import type { TDatabase } from '@tdsk/database'
import type { TScheduleExecutor } from '@TBE/services/scheduler/scheduler'
import type {
  Agent,
  Schedule,
  TStreamEvent,
  TSandboxResult,
  TKubeSandboxConfig,
} from '@tdsk/domain'

import { AgentRunner } from '@tdsk/agent'
import { KubeRetryableStatusCodes } from '@tdsk/sandbox'
import { logger } from '@TBE/utils/logger'
import { ExecTimeoutMS, SetupReadyTimeoutMS } from '@TBE/constants/sandbox'
import { RehydrationInterruptMarker } from '@TBE/services/scheduler/rehydrator'
import { ScheduleClaimConflictError } from '@TBE/services/scheduler/scheduler'
import {
  EProvider,
  EMsgType,
  EMemoryKind,
  EAgentBrain,
  EContentType,
  EScheduleType,
  TasksBlockFence,
  MemorySearchTopK,
  EmptyRunDurationMs,
  RunOutcomeInjectMax,
  TaskBacklogInjectMax,
  ESkillProposalStatus,
  ETaskProposalStatus,
  MemoryInjectMaxChars,
  SkillReviewInjectMax,
  TaskPickupsBlockFence,
  RunOutcomeInjectMaxChars,
  TaskBacklogInjectMaxChars,
  SkillReviewInjectMaxChars,
  EEscalationStatus,
  EscalationInjectMax,
  EscalationInjectMaxChars,
  EVerificationStatus,
  VerifyInjectMax,
  VerifyInjectMaxChars,
  VerifyLookbackPrs,
  EOpsActionStatus,
  OpsReviewInjectMax,
  OpsReviewInjectMaxChars,
  CoordinatorInjectMaxChars,
  matchTransientSignal,
  CliMaxTransientRetries,
  CliMaxProviderFailovers,
  isTransientUpstreamFailure,
  CliTransientRetryDelaysMs,
  CliSameProviderRetriesBeforeFailover,
} from '@tdsk/domain'
import { dispatchActions } from '@TBE/utils/agent/dispatchActions'
import { resolveAgentConfig } from '@TBE/utils/agent/resolveAgentConfig'
import { buildBusinessMetricsContext } from '@TBE/utils/agent/businessMetrics'
import { buildContextSourcesSection } from '@TBE/utils/agent/contextSources'
import { parseTasksBlock, parseTaskPickupsBlock } from '@TBE/utils/agent/task'
import { authorTaskProposal, markTaskPromoted } from '@TBE/utils/agent/taskPromotion'
import {
  parseEscalationBlock,
  parseEscalationResolutionsBlock,
} from '@TBE/utils/agent/escalation'
import { openEscalation, resolveEscalation } from '@TBE/utils/agent/escalationPromotion'
import { parseVerifyResultsBlock } from '@TBE/utils/agent/verify'
import { parseOpsReviewsBlock } from '@TBE/utils/agent/opsReview'
import { applyOpsReview } from '@TBE/utils/agent/opsPromotion'
import {
  escapePromptArg,
  foregroundEnvPrefix,
  resolvePromptTemplate,
  substitutePlaceholders,
} from '@TBE/utils/agent/promptCommand'
import { resolveSandboxProviderChain } from '@TBE/utils/sandbox/resolveSandboxChain'
import { parseSkillBlock, parseSkillReviewsBlock } from '@TBE/utils/agent/skill'
import {
  parseAuthorFunctionBlock,
  authorAgentFunctionCore,
} from '@TBE/utils/agent/authorFunction'
import {
  parseAuthorEndpointBlock,
  authorAgentEndpointCore,
} from '@TBE/utils/agent/authorEndpoint'
import {
  parseAuthorSecretBlock,
  authorAgentSecretCore,
} from '@TBE/utils/agent/authorSecret'
import { authorSkillProposal, applySkillReview } from '@TBE/utils/agent/skillPromotion'
import { buildEnvPrefix, parseMemoryBlock } from '@TBE/utils/agent/memory'

/** Max characters of the previous report composed into a CLI-brain prompt (tail-capped) */
const PrevReportMaxChars = 8000

/** Max bytes of stdout buffered in memory for CLI-brain message persistence (tail-capped) */
const StdoutBufferMaxBytes = 256 * 1024

function resolveScheduleCommand(
  schedule: Schedule,
  sandboxConfig: TKubeSandboxConfig
): string {
  if (schedule.type === EScheduleType.shell) {
    if (!schedule.command)
      throw new Error(`Schedule ${schedule.id} has type=shell but no command`)
    return schedule.command
  }

  if (!schedule.prompt)
    throw new Error(`Schedule ${schedule.id} has type=prompt but no prompt`)

  const template = resolvePromptTemplate(sandboxConfig)
  const command = substitutePlaceholders(template, {
    prompt: escapePromptArg(schedule.prompt),
  })

  // Same one-shot guard as buildCliCommand: force the runtime to run every
  // command synchronously so nothing is backgrounded into the doomed pod.
  const prefix = foregroundEnvPrefix(sandboxConfig.runtime)
  return prefix ? `${prefix} ${command}` : command
}

/**
 * Load a sandbox record and resolve its effective config for the schedule's
 * project, warning when the project has no sandbox-specific overrides.
 */
async function resolveEffectiveSandboxConfig(
  db: TDatabase,
  sandboxId: string,
  schedule: Schedule
): Promise<TKubeSandboxConfig> {
  const { data: sandboxRecord } = await db.services.sandbox.get(sandboxId)
  if (!sandboxRecord) throw new Error(`Sandbox config not found: ${sandboxId}`)

  const effective = sandboxRecord.getEffectiveConfig
    ? sandboxRecord.getEffectiveConfig(schedule.projectId)
    : sandboxRecord

  if (effective === sandboxRecord && schedule.projectId)
    logger.warn(
      `[Executor] Schedule ${schedule.id} — no project-specific config for project ${schedule.projectId}; using base sandbox config`
    )

  return effective.config as TKubeSandboxConfig
}

/** Race a promise against the resolved execution timeout (per-schedule override or shared default). */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s`)), ms)
    timer.unref()
  })
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer!))
}

/** Mirrors withKubeRetry.ts's private getStatusCode — same fields, different package. */
const getK8sStatusCode = (err: any): number | undefined =>
  err?.code ?? err?.statusCode ?? err?.response?.statusCode

/**
 * Resolve the durable continuity thread for an agent-backed schedule.
 * Reuses schedule.threadId when set; otherwise creates one and persists it
 * back onto the schedule so subsequent heartbeats share the same episodic thread.
 * A persist failure (error or zero rows matched) throws and fails the run —
 * otherwise every heartbeat would silently orphan a new thread, defeating
 * durable continuity.
 */
async function resolveContinuityThread(
  db: TDatabase,
  schedule: Schedule,
  orgId: string
): Promise<string> {
  if (schedule.threadId) return schedule.threadId

  const { data: thread, error } = await db.services.thread.create({
    orgId,
    userId: schedule.userId as string,
    agentId: schedule.agentId,
    projectId: schedule.projectId,
    name: `Heartbeat ${schedule.id}`,
  })
  if (error || !thread)
    throw new Error(`Failed to create continuity thread: ${error?.message || 'unknown'}`)

  const { data: updated, error: updErr } = await db.services.schedule.update({
    id: schedule.id,
    threadId: thread.id,
  })
  if (updErr || !updated)
    throw new Error(
      `Failed to persist continuity thread ${thread.id} on schedule ${schedule.id}: ${updErr?.message || `schedule not found`}`
    )

  return thread.id
}

/**
 * Agent-brain execution path: resolve the agent's config and run the agent
 * against the durable continuity thread, streaming events to stdout.
 * Returns the started pod name (if any) so the caller can tear it down.
 */
async function runAgentSchedule(
  app: TApp,
  schedule: Schedule,
  onStdout: (chunk: string) => void,
  onPodStart: (instanceId: string) => void
): Promise<{ instanceId?: string }> {
  const { db } = app.locals

  if (!schedule.agentId) throw new Error(`runAgentSchedule called without agentId`)
  if (!schedule.prompt)
    throw new Error(`Schedule ${schedule.id} is agent-backed but has no prompt`)
  // threads.user_id is NOT NULL while schedules.user_id is nullable (onDelete: set null),
  // so a missing user must fail loudly here, not as a raw DB constraint error mid-run.
  if (!schedule.userId)
    throw new Error(`Schedule ${schedule.id} is agent-backed but has no userId`)

  // onPodStart records the pod name in the caller's teardown variable the
  // moment resolveAgentConfig starts it — a later throw (readiness wait,
  // runner init, LLM config) can no longer leak the pod until the idle reaper.
  const config = await resolveAgentConfig(schedule.agentId, db, app, {
    userId: schedule.userId,
    projectId: schedule.projectId,
    onPodStart,
  })

  const threadId = await resolveContinuityThread(db, schedule, config.orgId)

  // Inject roadmap + relevant memories ahead of the prompt (the api brain also
  // has the memory_search/memory_write tools via config.memoryProvider).
  const memoryContext = await buildMemoryContext(app, schedule, schedule.agentId)
  const prompt = memoryContext ? `${memoryContext}${schedule.prompt}` : schedule.prompt

  const handle = await AgentRunner.run({
    prompt,
    userId: schedule.userId,
    agentId: schedule.agentId,
    threadId,
    soul: config.soul,
    db: config.db,
    orgId: config.orgId,
    tools: config.tools,
    skills: config.skills,
    llmConfig: config.llmConfig,
    llmConfigs: config.llmConfigs,
    environment: config.environment,
    sandboxConfig: config.sandboxConfig,
    memoryProvider: config.memoryProvider,
    skillProvider: config.skillProvider,
    taskProvider: config.taskProvider,
    escalationProvider: config.escalationProvider,
    delegateProvider: config.delegateProvider,
    opsProvider: config.opsProvider,
    onExecuteFunction: config.onExecuteFunction,
    customFunctions: config.customFunctions || [],
    onEvent: (event: TStreamEvent) => onStdout(`${JSON.stringify(event)}\n`),
  })

  await handle.waitForIdle()

  return { instanceId: config.sandboxConfig?.options?.podName as string | undefined }
}

/**
 * Fetch the most recent assistant message text from the continuity thread,
 * tail-capped at PrevReportMaxChars. Returns an empty string when the thread
 * has no assistant messages; a load failure only degrades context (logged),
 * it never fails the run.
 */
async function fetchPreviousReport(db: TDatabase, threadId: string): Promise<string> {
  const { data: messages, error } = await db.services.message.listByThread(threadId)
  if (error) {
    logger.error(
      `[Executor] Failed to load previous messages for thread ${threadId}:`,
      error.message
    )
    return ``
  }

  const lastAssistant = [...(messages || [])]
    .reverse()
    .find((message) => message.type === EMsgType.assistant)
  if (!lastAssistant) return ``

  const text = (lastAssistant.content || [])
    .filter(
      (part): part is { type: `text`; text: string } =>
        part?.type === EContentType.text && typeof (part as any).text === `string`
    )
    .map((part) => part.text)
    .join(`\n`)

  return text.length > PrevReportMaxChars ? text.slice(-PrevReportMaxChars) : text
}

/**
 * Build the injected memory context for a schedule's agent: the current roadmap
 * (`## Roadmap`) followed by the top-K recency*importance memories
 * (`## Relevant memories`), capped at MemoryInjectMaxChars. No query is passed,
 * so retrieval is pure recency*importance. Never throws — a failure only
 * degrades context (logged) and returns an empty string.
 */
async function buildMemoryContext(
  app: TApp,
  schedule: Schedule,
  agentId: string
): Promise<string> {
  try {
    const { db } = app.locals
    let out = ``

    const { data: roadmap } = await db.services.memory.getRoadmap(schedule.orgId, agentId)
    if (roadmap?.text) out += `## Roadmap\n${roadmap.text}\n\n`

    const { data: memories } = await db.services.memory.searchScored({
      agentId,
      orgId: schedule.orgId,
      limit: MemorySearchTopK,
    })
    if (memories?.length) {
      const bullets = memories
        .map((mem) => `- [${mem.kind}, importance ${mem.importance}] ${mem.text}`)
        .join(`\n`)
      out += `## Relevant memories\n${bullets}\n\n`
    }

    return out.length > MemoryInjectMaxChars ? out.slice(0, MemoryInjectMaxChars) : out
  } catch (err) {
    logger.error(
      `[Executor] buildMemoryContext failed for agent ${agentId}:`,
      (err as Error).message
    )
    return ``
  }
}

/**
 * Parse and persist any structured-output memory-write block emitted by a
 * successful runtime run. Roadmap entries become a new roadmap row; all other
 * kinds become memories with an embedding backfilled (null-safe) and citation
 * meta ({threadId, scheduleId}). Never throws — a failure never fails the run.
 */
async function persistMemoryWrites(
  app: TApp,
  schedule: Schedule,
  agentId: string,
  threadId: string,
  stdoutText: string
): Promise<void> {
  try {
    const entries = parseMemoryBlock(stdoutText)
    if (!entries.length) return

    const { db, embeddings } = app.locals
    const meta = { threadId, scheduleId: schedule.id }

    for (const entry of entries) {
      if (entry.kind === EMemoryKind.roadmap) {
        const { error } = await db.services.memory.upsertRoadmap(
          schedule.orgId,
          agentId,
          entry.text,
          meta
        )
        if (error)
          logger.error(
            `[Executor] Schedule ${schedule.id} — failed to persist roadmap memory:`,
            error.message
          )
        continue
      }

      const embedding =
        (await embeddings?.embedOne(entry.text, { orgId: schedule.orgId })) ?? null
      const { error } = await db.services.memory.create({
        meta,
        agentId,
        embedding,
        text: entry.text,
        orgId: schedule.orgId,
        importance: entry.importance,
        kind: entry.kind ?? EMemoryKind.fact,
      } as any)
      if (error)
        logger.error(
          `[Executor] Schedule ${schedule.id} — failed to persist memory:`,
          error.message
        )
    }
  } catch (err) {
    logger.debug(
      `[Executor] Schedule ${schedule.id} — memory capture skipped: ${
        (err as Error).message
      }`
    )
  }
}

/**
 * Build the injected skill-proposal review context: the scanned proposals
 * awaiting an auditor decision (`## Skill proposals awaiting review`), capped at
 * SkillReviewInjectMaxChars. Only an auditor/curator-prompted cycle acts on this
 * (by emitting a tdsk-skill-reviews block); other cycles ignore it. Never throws.
 */
async function buildProposalReviewContext(
  app: TApp,
  schedule: Schedule
): Promise<string> {
  try {
    const { db } = app.locals
    const { data: proposals } = await db.services.skillProposal.listByStatus(
      schedule.orgId,
      ESkillProposalStatus.scanned
    )
    if (!proposals?.length) return ``

    const bullets = proposals
      .slice(0, SkillReviewInjectMax)
      .map(
        (p) =>
          `- ${p.id} "${p.name}" (agent ${p.agentId}): ${p.description}\n  tools: ${
            (p.tools || []).join(`, `) || `none`
          }\n  instructions: ${p.instructions.slice(0, 500)}`
      )
      .join(`\n`)
    const out = `## Skill proposals awaiting review\n${bullets}\n\n`
    return out.length > SkillReviewInjectMaxChars
      ? out.slice(0, SkillReviewInjectMaxChars)
      : out
  } catch (err) {
    logger.error(
      `[Executor] buildProposalReviewContext failed for schedule ${schedule.id}:`,
      (err as Error).message
    )
    return ``
  }
}

/**
 * Parse and persist any structured-output skill-proposal block emitted by a
 * successful runtime run: each entry becomes a skill_proposals row that is
 * immediately security-scanned (scanned | rejected). Never throws.
 */
/**
 * Parse and apply any ```tdsk-author-function``` block from a successful run:
 * the agent BUILDS its own tool. Each submission routes through the shared
 * `authorAgentFunctionCore` (fail-closed scan + project scope + authored-by
 * audit — the SAME path the resident endpoint uses), so a scheduled agent can
 * self-extend its capabilities. The authored Function is invokable by its author
 * without an allowlist change (see invokeAction authorship=authorization).
 * Never throws — one bad submission can't abort the run or its siblings.
 */
async function persistAuthoredFunctions(
  app: TApp,
  schedule: Schedule,
  agentId: string,
  stdoutText: string
): Promise<void> {
  try {
    const submissions = parseAuthorFunctionBlock(stdoutText)
    if (!submissions.length) return

    const { db } = app.locals
    for (const sub of submissions) {
      try {
        const result = await authorAgentFunctionCore(db, {
          orgId: schedule.orgId,
          projectId: schedule.projectId,
          agentId,
          name: sub.name,
          content: sub.content,
          description: sub.description,
          language: sub.language,
        })
        if (result.ok) {
          logger.info(
            `[Executor] Schedule ${schedule.id} — agent ${agentId} authored function ${
              result.fn.name
            } (v${result.fn.meta?.version ?? 1})`
          )
        } else {
          logger.warn(
            `[Executor] Schedule ${schedule.id} — authorFunction "${sub.name}" rejected (${result.status}): ${result.error}`
          )
        }
      } catch (err) {
        logger.error(
          `[Executor] Schedule ${schedule.id} — failed to author function "${sub.name}":`,
          (err as Error).message
        )
      }
    }
  } catch (err) {
    logger.debug(
      `[Executor] Schedule ${schedule.id} — author-function capture skipped: ${
        (err as Error).message
      }`
    )
  }
}

/**
 * Capture ```tdsk-author-endpoint``` — a scheduled agent builds its OWN proxy
 * Endpoint (a connector to an external API it found/signed-up-for). Routes
 * through the shared `authorAgentEndpointCore` (SSRF egress guard at author time,
 * injectSecrets refusal, cross-owner secret check, authored-by stamp). The
 * authored endpoint is reachable by its author via context.connect
 * (authorship=authorization) with no allowlist. Never throws.
 */
async function persistAuthoredEndpoints(
  app: TApp,
  schedule: Schedule,
  agentId: string,
  stdoutText: string
): Promise<void> {
  try {
    const submissions = parseAuthorEndpointBlock(stdoutText)
    if (!submissions.length) return
    const { db } = app.locals
    for (const sub of submissions) {
      try {
        const result = await authorAgentEndpointCore(db, {
          orgId: schedule.orgId,
          projectId: schedule.projectId,
          agentId,
          ...sub,
        })
        if (result.ok)
          logger.info(
            `[Executor] Schedule ${schedule.id} — agent ${agentId} authored endpoint ${sub.name}`
          )
        else
          logger.warn(
            `[Executor] Schedule ${schedule.id} — authorEndpoint "${sub.name}" rejected (${result.status}): ${result.error}`
          )
      } catch (err) {
        logger.error(
          `[Executor] Schedule ${schedule.id} — failed to author endpoint "${sub.name}":`,
          (err as Error).message
        )
      }
    }
  } catch (err) {
    logger.debug(
      `[Executor] Schedule ${schedule.id} — author-endpoint capture skipped: ${(err as Error).message}`
    )
  }
}

/**
 * Capture ```tdsk-author-secret``` — a scheduled agent stores a credential IT
 * obtained (e.g. an API key from signing up for a service) as its own encrypted,
 * agent-scoped Secret. Routes through the shared `authorAgentSecretCore` (the
 * value is never scanned/logged/returned). Never throws.
 */
async function persistAuthoredSecrets(
  app: TApp,
  schedule: Schedule,
  agentId: string,
  stdoutText: string
): Promise<void> {
  try {
    const submissions = parseAuthorSecretBlock(stdoutText)
    if (!submissions.length) return
    const { db } = app.locals
    for (const sub of submissions) {
      try {
        const result = await authorAgentSecretCore(db, {
          orgId: schedule.orgId,
          projectId: schedule.projectId,
          agentId,
          name: sub.name,
          value: sub.value,
          description: sub.description,
        })
        if (result.ok)
          logger.info(
            `[Executor] Schedule ${schedule.id} — agent ${agentId} stored secret ${sub.name}`
          )
        else
          logger.warn(
            `[Executor] Schedule ${schedule.id} — authorSecret "${sub.name}" rejected (${result.status}): ${result.error}`
          )
      } catch (err) {
        logger.error(
          `[Executor] Schedule ${schedule.id} — failed to store secret "${sub.name}":`,
          (err as Error).message
        )
      }
    }
  } catch (err) {
    logger.debug(
      `[Executor] Schedule ${schedule.id} — author-secret capture skipped: ${(err as Error).message}`
    )
  }
}

async function persistSkillProposals(
  app: TApp,
  schedule: Schedule,
  agentId: string,
  threadId: string,
  stdoutText: string
): Promise<void> {
  try {
    const entries = parseSkillBlock(stdoutText)
    if (!entries.length) return

    const { db } = app.locals
    const meta = { threadId, scheduleId: schedule.id }
    for (const entry of entries) {
      try {
        await authorSkillProposal(db, schedule.orgId, agentId, entry, meta)
      } catch (err) {
        logger.error(
          `[Executor] Schedule ${schedule.id} — failed to persist skill proposal:`,
          (err as Error).message
        )
      }
    }
  } catch (err) {
    logger.debug(
      `[Executor] Schedule ${schedule.id} — skill-proposal capture skipped: ${
        (err as Error).message
      }`
    )
  }
}

/**
 * Parse and apply any structured-output skill-review block emitted by a
 * successful auditor/curator run. Each decision routes through applySkillReview,
 * which re-runs the security scan (hard gate) before promoting. Never throws.
 */
async function persistSkillReviews(
  app: TApp,
  schedule: Schedule,
  agentId: string,
  stdoutText: string
): Promise<void> {
  try {
    const reviews = parseSkillReviewsBlock(stdoutText)
    if (!reviews.length) return

    const { db } = app.locals
    for (const review of reviews) {
      try {
        await applySkillReview(db, schedule.orgId, review, agentId)
      } catch (err) {
        logger.error(
          `[Executor] Schedule ${schedule.id} — failed to apply skill review:`,
          (err as Error).message
        )
      }
    }
  } catch (err) {
    logger.debug(
      `[Executor] Schedule ${schedule.id} — skill-review capture skipped: ${
        (err as Error).message
      }`
    )
  }
}

/**
 * Marker-gated routing: a runtime cycle only receives (and emits) a faculty's
 * context when its own prompt opts in by embedding that faculty's fenced-block
 * label. This keeps a sensor cycle's context off a work cycle and vice-versa —
 * the same prompt that is told to emit a block is the one given the inputs for it.
 */
export const promptOptsIn = (schedule: Schedule, fence: string): boolean =>
  (schedule.prompt ?? ``).includes(fence)

/**
 * Marker an executive (CEO/CTO board) cycle embeds to consume the read-only
 * `## Business metrics` faculty. Board state itself (Company Strategy + open
 * decision proposals) is injected declaratively via the schedule's
 * `contextSources` (the board runs on the platform primitives — see
 * repos/database/src/seeds/exec-board/); the metrics snapshot is the one
 * computed context that remains a platform helper (spec §6).
 */
export const CompanyStrategyMarker = `<!-- company-strategy -->`

/**
 * A cycle consumes the Business-metrics (revenue) faculty when its prompt
 * carries the explicit company-strategy marker — exactly the CEO + CTO
 * board/strategy cycles (their seeded prompts embed it).
 *
 * Gating is by PROMPT opt-in, never by agentId: the CTO seat reuses the steward
 * agent, so an agentId gate would leak revenue context into the steward work
 * cycle + adversary. Those dev-loop prompts carry no marker, so they opt in to
 * nothing and their assembled context is byte-identical.
 */
export const businessMetricsOptsIn = (schedule: Schedule): boolean =>
  (schedule.prompt ?? ``).includes(CompanyStrategyMarker)

/**
 * Gated `## Business metrics` section for a cycle's assembled context: the
 * rendered read-only revenue/business snapshot when the cycle opts into the
 * executive faculty, otherwise '' (a non-opted-in cycle never even queries the
 * DB). Never throws — delegates to buildBusinessMetricsContext. Mirrors the
 * sensorSection/backlogSection gating.
 */
export async function buildBusinessMetricsSection(
  app: TApp,
  schedule: Schedule
): Promise<string> {
  return businessMetricsOptsIn(schedule)
    ? buildBusinessMetricsContext(app, schedule.orgId)
    : ``
}

/**
 * Build the injected recent-run-outcome context for a SENSOR cycle: the pod
 * cannot reach the DB, so the org's own recent schedule_runs are surfaced as the
 * read-only backend faculty. Only anomalies are listed — errored/timed-out runs
 * (with their message + id + startedAt) and successful runs that finished
 * suspiciously fast (possibly empty / no-op). The currently-`running` row is
 * skipped. When nothing is anomalous, returns '' so no heading is injected.
 * Capped at RunOutcomeInjectMaxChars. Never throws — a failure only degrades
 * context (logged) and returns an empty string.
 */
export async function buildRunOutcomeContext(
  app: TApp,
  schedule: Schedule
): Promise<string> {
  try {
    const { db } = app.locals
    const { data: runs } = await db.services.scheduleRun.listByOrg(schedule.orgId, {
      limit: RunOutcomeInjectMax,
    })
    if (!runs?.length) return ``

    const bullets: string[] = []
    for (const run of runs) {
      if (run.status === `running`) continue
      if (run.status === `error` || run.status === `timeout`) {
        bullets.push(
          `- [${run.status}] ${run.id} @ ${run.startedAt}: ${
            (run.error ?? ``).trim() || `(no error text)`
          }`
        )
      } else if (run.status === `success`) {
        // A run marked `success` by the rehydrator after a backend restart was
        // INTERRUPTED mid-exec (the deploy that restarted the backend severed
        // the exec stream), so it likely produced no deliverable. The rehydrator
        // waits out poll cycles before marking, so such a run's duration is NOT
        // short — the fast-empty check below misses it. Flag it explicitly by
        // its interrupt marker so the sensor can surface the null cycle.
        if ((run.error ?? ``).includes(RehydrationInterruptMarker)) {
          bullets.push(
            `- [success but INTERRUPTED by a backend restart — likely produced no deliverable, treat as a possibly-empty run] ${run.id} @ ${run.startedAt}`
          )
        } else if (run.durationMs != null && run.durationMs < EmptyRunDurationMs) {
          bullets.push(
            `- [success, possibly empty / no-op run] ${run.id} @ ${run.startedAt}: ${run.durationMs}ms`
          )
        }
      }
    }
    if (!bullets.length) return ``

    const out = `## Recent run outcomes\n${bullets.join(`\n`)}\n\n`
    return out.length > RunOutcomeInjectMaxChars
      ? out.slice(0, RunOutcomeInjectMaxChars)
      : out
  } catch (err) {
    logger.error(
      `[Executor] buildRunOutcomeContext failed for schedule ${schedule.id}:`,
      (err as Error).message
    )
    return ``
  }
}

/**
 * Build the injected digest of already-open proposals for a SENSOR cycle so it
 * does not re-sense the same work. Lists every pending + scanned proposal as one
 * line: `- <dedupeKey> [<priority>] <title> (<status>)`. Empty → ''. Never throws.
 */
export async function buildOpenProposalsDigest(
  app: TApp,
  schedule: Schedule
): Promise<string> {
  try {
    const { db } = app.locals
    const [{ data: pending }, { data: scanned }] = await Promise.all([
      db.services.taskProposal.listByStatus(schedule.orgId, ETaskProposalStatus.pending),
      db.services.taskProposal.listByStatus(schedule.orgId, ETaskProposalStatus.scanned),
    ])
    const proposals = [...(pending ?? []), ...(scanned ?? [])]
    if (!proposals.length) return ``

    const lines = proposals
      .map((p) => `- ${p.dedupeKey} [${p.priority}] ${p.title} (${p.status})`)
      .join(`\n`)
    return `## Recently proposed backlog (do not duplicate)\n${lines}\n\n`
  } catch (err) {
    logger.error(
      `[Executor] buildOpenProposalsDigest failed for schedule ${schedule.id}:`,
      (err as Error).message
    )
    return ``
  }
}

/**
 * Build the injected scanned-backlog context for a WORK cycle: the pickup-ready
 * proposals (scanned, priority-ordered P0-first by the service) it may promote
 * by opening a PR. Each entry carries its tp_ id, priority, title, source signal,
 * an evidence excerpt, and a description excerpt. Empty → ''. Capped at
 * TaskBacklogInjectMaxChars. Never throws.
 */
export async function buildTaskBacklogContext(
  app: TApp,
  schedule: Schedule
): Promise<string> {
  try {
    const { db } = app.locals
    const { data: proposals } = await db.services.taskProposal.listBacklog(
      schedule.orgId,
      TaskBacklogInjectMax
    )
    if (!proposals?.length) return ``

    const bullets = proposals
      .map(
        (p) =>
          `- ${p.id} [${p.priority}] ${p.title}\n  signal: ${p.sourceSignal} | evidence: ${(
            p.evidence ?? ``
          ).slice(0, 300)}\n  ${(p.description ?? ``).slice(0, 500)}`
      )
      .join(`\n`)
    const out = `## Proposed backlog (sensor-detected)\n${bullets}\n\n`
    return out.length > TaskBacklogInjectMaxChars
      ? out.slice(0, TaskBacklogInjectMaxChars)
      : out
  } catch (err) {
    logger.error(
      `[Executor] buildTaskBacklogContext failed for schedule ${schedule.id}:`,
      (err as Error).message
    )
    return ``
  }
}

/**
 * Parse and persist any structured-output task-proposal block emitted by a
 * successful SENSOR run: each sensed entry is deduped + security-scanned at
 * authoring time (scanned | rejected) via authorTaskProposal, with citation meta
 * ({threadId, scheduleId}). Never throws — a failure never fails the run.
 */
export async function persistTaskProposals(
  app: TApp,
  schedule: Schedule,
  agentId: string,
  threadId: string,
  stdoutText: string
): Promise<void> {
  try {
    const entries = parseTasksBlock(stdoutText)
    if (!entries.length) return

    const { db } = app.locals
    const meta = { threadId, scheduleId: schedule.id }
    let persisted = 0
    for (const entry of entries) {
      try {
        await authorTaskProposal(db, schedule.orgId, agentId, entry, meta)
        persisted++
      } catch (err) {
        logger.error(
          `[Executor] Schedule ${schedule.id} — failed to persist task proposal:`,
          (err as Error).message
        )
      }
    }
    logger.info(
      `[Executor] Schedule ${schedule.id} — captured ${persisted}/${entries.length} task proposal(s)`
    )
  } catch (err) {
    logger.debug(
      `[Executor] Schedule ${schedule.id} — task-proposal capture skipped: ${
        (err as Error).message
      }`
    )
  }
}

/**
 * Parse and apply any structured-output task-pickup block emitted by a
 * successful WORK run: each pickup marks its scanned proposal promoted
 * (idempotent, no re-scan) via markTaskPromoted. Never throws.
 */
export async function persistTaskPickups(
  app: TApp,
  schedule: Schedule,
  agentId: string,
  stdoutText: string
): Promise<void> {
  try {
    const pickups = parseTaskPickupsBlock(stdoutText)
    if (!pickups.length) return

    const { db } = app.locals
    let promoted = 0
    for (const pickup of pickups) {
      try {
        await markTaskPromoted(db, schedule.orgId, pickup, agentId)
        promoted++
      } catch (err) {
        logger.error(
          `[Executor] Schedule ${schedule.id} — failed to promote task proposal:`,
          (err as Error).message
        )
      }
    }
    logger.info(
      `[Executor] Schedule ${schedule.id} — promoted ${promoted}/${pickups.length} task proposal(s)`
    )
  } catch (err) {
    logger.debug(
      `[Executor] Schedule ${schedule.id} — task-pickup capture skipped: ${
        (err as Error).message
      }`
    )
  }
}

/**
 * Build the injected open-escalations context so a runtime cycle sees all
 * open and routed escalations and does NOT re-raise them. Routed entries are
 * listed first (the steward can act on them), then open ones. Total capped at
 * EscalationInjectMax entries and EscalationInjectMaxChars characters.
 * Never throws — failures only degrade context (logged + returns '').
 */
export async function buildEscalationContext(
  app: TApp,
  schedule: Schedule
): Promise<string> {
  try {
    const { db } = app.locals
    const orgId = schedule.orgId
    const [routedRes, openRes] = await Promise.all([
      db.services.escalation.listByStatus(orgId, EEscalationStatus.routed),
      db.services.escalation.listByStatus(orgId, EEscalationStatus.open),
    ])
    const routed = routedRes.data ?? []
    const open = openRes.data ?? []
    const all = [...routed, ...open].slice(0, EscalationInjectMax)
    if (!all.length) return ``

    const bullets = all
      .map((es) => {
        const excerpt = (es.problem ?? ``).slice(0, 200)
        const patch = es.proposedPatch ? es.proposedPatch.split(`\n`)[0] : `none`
        const issue = es.issueRef ?? `none`
        return `- ${es.id} [${es.status}/${es.target}] "${es.title}": ${excerpt}\n  patch: ${patch}\n  issue: ${issue}`
      })
      .join(`\n`)

    const raw = `## Open escalations (do NOT re-raise; act on routed ones)\n${bullets}\nEmit \`\`\`tdsk-escalation-resolutions\`\`\` when you finish one (id or dedupeKey + status + resolvedRef).\n\n`
    return raw.length > EscalationInjectMaxChars
      ? `${raw.slice(0, EscalationInjectMaxChars)}... (truncated)`
      : raw
  } catch (err) {
    logger.error(
      `[Executor] buildEscalationContext failed for schedule ${schedule.id}:`,
      (err as Error).message
    )
    return ``
  }
}

/**
 * Parse and persist any structured-output escalation blocks emitted by a
 * successful runtime run:
 *  - tdsk-escalations: each entry is opened (or deduped) via openEscalation.
 *  - tdsk-escalation-resolutions: each resolved entry also writes a durable
 *    memory row so the steward does not re-escalate. Never throws.
 */
export async function persistEscalations(
  app: TApp,
  schedule: Schedule,
  agentId: string,
  threadId: string,
  stdoutText: string
): Promise<void> {
  try {
    const { db } = app.locals
    const orgId = schedule.orgId
    const meta = { threadId, scheduleId: schedule.id }

    const inputs = parseEscalationBlock(stdoutText)
    let opened = 0
    for (const input of inputs) {
      try {
        const r = await openEscalation(db, orgId, agentId, input, meta)
        logger.info(
          `[Executor] Schedule ${schedule.id} — escalation ${r.id} status=${r.status} deduped=${r.deduped} routable=${r.routable}`
        )
        opened++
      } catch (e) {
        logger.warn(`[Executor] escalation open failed: ${(e as Error).message}`)
      }
    }
    if (inputs.length)
      logger.info(
        `[Executor] Schedule ${schedule.id} — opened ${opened}/${inputs.length} escalation(s)`
      )

    const resolutions = parseEscalationResolutionsBlock(stdoutText)
    for (const res of resolutions) {
      try {
        const status = await resolveEscalation(db, orgId, res, agentId)
        if (status === `resolved`) {
          // Durable write-back: the steward remembers this was resolved so it
          // does not re-escalate the same issue on the next cycle. Mirrors the
          // memory.create shape used in persistMemoryWrites (text + kind +
          // importance + orgId + agentId + meta, embedding omitted for
          // backfill — same pattern as persistMemoryWrites null-safe path).
          try {
            await (db.services.memory as any).create({
              orgId,
              agentId,
              kind: EMemoryKind.fact,
              importance: 6,
              text: `Escalation resolved: ${res.id ?? res.dedupeKey} → ${res.resolvedRef ?? status}`,
              meta: { threadId, scheduleId: schedule.id, source: `escalation` },
              embedding: null,
            } as any)
          } catch (memErr) {
            logger.warn(
              `[Executor] escalation memory write-back failed: ${(memErr as Error).message}`
            )
          }
        }
      } catch (e) {
        logger.warn(`[Executor] escalation resolve failed: ${(e as Error).message}`)
      }
    }
  } catch (err) {
    logger.debug(
      `[Executor] Schedule ${schedule.id} — escalation capture skipped: ${
        (err as Error).message
      }`
    )
  }
}

/**
 * Build the injected post-merge verification context: pending + verifying rows
 * that still need probing, plus a done-set of terminal (verified | regressed)
 * PR numbers so the cycle does not re-probe already-terminal results.
 * Always injected (mirrors buildEscalationContext — no marker gate).
 * Capped at VerifyInjectMax in-flight entries and VerifyInjectMaxChars chars.
 * Never throws — failures only degrade context (logged + returns '').
 */
export async function buildVerifyContext(app: TApp, schedule: Schedule): Promise<string> {
  try {
    const { db } = app.locals
    const orgId = schedule.orgId

    const [pendingRes, verifyingRes] = await Promise.all([
      db.services.verification.listByStatus(orgId, EVerificationStatus.pending),
      db.services.verification.listByStatus(orgId, EVerificationStatus.verifying),
    ])
    const pending = pendingRes.data ?? []
    const verifying = verifyingRes.data ?? []
    const inFlight = [...pending, ...verifying].slice(0, VerifyInjectMax)

    // Load recent rows for the done-set (already-terminal PRs to skip).
    const recentRes = await db.services.verification.list({
      orgId,
      orderBy: `createdAt`,
      desc: true,
      limit: VerifyLookbackPrs,
    } as any)
    const recent = recentRes.data ?? []
    const donePrNumbers = recent
      .filter(
        (r: any) =>
          r.status === EVerificationStatus.verified ||
          r.status === EVerificationStatus.regressed
      )
      .map((r: any) => r.prNumber as number)

    if (!inFlight.length && !donePrNumbers.length) return ``

    const doneSet = donePrNumbers.length > 0 ? `[${donePrNumbers.join(`, `)}]` : `[]`
    const inFlightCount = inFlight.length

    const raw = `## Post-merge verification
Deployed marker (origin/production) advances after a successful deploy. For each
recently-merged steward PR NOT in the done-set below: read its \`\`\`tdsk-verify\`\`\` block
from the PR body (default {kind:'ci-green'} when absent), run the probe read-only, and
emit ONE \`\`\`tdsk-verify-results\`\`\` block per PR with {prNumber, mergeSha, status:
'verified'|'regressed', detail, revertPrUrl?}. On a regressed result you MUST open a
revert-as-new-commit PR IN-POD, wait for its CI to pass, then SELF-MERGE it (never
\`git revert\`, never rewrite history). \`git show --first-parent\` emits a merge commit's
NET squashed diff, so \`git apply -R\` cleanly reverts a 2-parent merge commit as well as a
squash commit (\`git show\` alone reverts NOTHING on a 2-parent merge). A revert of a PROVEN
regression is an emergency: post-cutover no adversary/pr-response cycle services a
\`steward/revert-*\` PR, so the VERIFY cycle merges it itself — a self-merged revert beats a
live regression:

  BAD=<mergeCommitSha>; N=<prNumber>; SHORT=$(git rev-parse --short "$BAD")
  git fetch origin main
  git checkout -b "steward/revert-pr\${N}-\${SHORT}" origin/main
  git show --first-parent "$BAD" | git apply -R --index --3way
  git commit -m "revert: undo PR #\${N} — P4c post-deploy regression"
  git push -u origin HEAD
  REVERT_URL=$(gh pr create --base main --head "steward/revert-pr\${N}-\${SHORT}" \\
    --title "Revert PR #\${N}: post-deploy regression" \\
    --body "Automated P4c revert. Probe failed after deploy of \${BAD}. <evidence>")
  # wait for the revert PR's CI to go green, then self-merge (squash = single-parent):
  gh pr checks "$REVERT_URL" --watch
  gh pr merge "$REVERT_URL" --admin --squash

Then include REVERT_URL as revertPrUrl in the result entry. The backend will also file a
target:'app' escalation citing that revert PR URL so it is tracked.

Probe execution semantics (all read-only, all in-pod):
  health          — curl -fsS <base><params.url or /_/health>; assert body.status=='ok'.
  ci-green        — gh run list --branch main --limit 5 --json conclusion; latest completed 'success'.
  marker-advanced — git fetch origin main production; git merge-base --is-ancestor <mergeSha> origin/production;
                    regressed if false AFTER the deploy window (allow ~15 min grace via params.graceMinutes).
  assertion       — sh -c "<params.command>"; assert exit 0.

Done-set (skip these PR numbers; already terminal): ${doneSet}
In-flight this list is what needs probing next: ${inFlightCount}
`
    return raw.length > VerifyInjectMaxChars
      ? `${raw.slice(0, VerifyInjectMaxChars)}... (truncated)`
      : raw
  } catch (err) {
    logger.error(
      `[Executor] buildVerifyContext failed for schedule ${schedule.id}:`,
      (err as Error).message
    )
    return ``
  }
}

/**
 * Parse and persist any structured-output tdsk-verify-results block emitted by a
 * successful runtime run. Regressed entries open a target:app escalation (P4b path)
 * citing the revert PR URL; all terminal entries upsert the verification row and
 * write a durable memory row so the cycle is idempotent across restarts.
 * Never throws — individual entries fail independently.
 */
export async function persistVerifications(
  app: TApp,
  schedule: Schedule,
  agentId: string,
  threadId: string,
  stdoutText: string
): Promise<void> {
  const results = parseVerifyResultsBlock(stdoutText)
  if (!results.length) return

  const { db } = app.locals
  for (const r of results) {
    try {
      let escalationId: string | null = null
      if (r.status === `regressed`) {
        // P4c → P4b integration: file a target:app escalation citing the revert PR.
        // Backend NEVER opens the revert PR itself; the steward already opened it
        // in-pod (revertPrUrl carries the URL). The escalation is the audit trail.
        const esc = await openEscalation(
          db,
          schedule.orgId,
          agentId,
          {
            target: `app` as any,
            dedupeKey: `verify-regression-pr${r.prNumber}`,
            title: `Post-deploy regression: PR #${r.prNumber}`,
            problem: r.detail ?? `Declared verify probe failed after deploy.`,
            evidence: [r.mergeSha, r.revertPrUrl].filter(Boolean) as string[],
            issueRef: r.revertPrUrl ?? null,
          },
          { threadId, scheduleId: schedule.id, prNumber: r.prNumber }
        )
        escalationId = esc.id
      }
      await db.services.verification.upsertByPr(schedule.orgId, agentId, r.prNumber, {
        status: r.status,
        detail: r.detail ?? null,
        mergeSha: r.mergeSha ?? null,
        revertPrUrl: r.revertPrUrl ?? null,
        escalationId,
      } as any)
      // Durable memory write-back on terminal — the loop is idempotent across cycles.
      // Match the persistEscalations memory shape (kind:fact, importance:6, embedding:null).
      await (db.services.memory as any).create({
        orgId: schedule.orgId,
        agentId,
        kind: EMemoryKind.fact,
        importance: 6,
        text: `PR #${r.prNumber} verify ${r.status}${r.revertPrUrl ? ` → revert ${r.revertPrUrl}` : ``}`,
        meta: {
          threadId,
          scheduleId: schedule.id,
          source: `verify`,
          prNumber: r.prNumber,
        },
        embedding: null,
      } as any)
    } catch (e) {
      logger.warn(
        `[Executor] persistVerifications: entry pr#${r.prNumber} failed: ${(e as Error).message}`
      )
    }
  }
}

/**
 * Build the injected ops-action context for a cycle that may act as the
 * adversary approval gate: surfaces all dryRun-status rows so the adversary
 * cycle can emit approve/reject verdicts via the tdsk-ops-reviews block.
 * Always injected (mirrors buildEscalationContext — no marker gate); cycles
 * whose prompt does not mention ops reviews simply ignore it.
 * Capped at OpsReviewInjectMax entries and OpsReviewInjectMaxChars chars.
 * Never throws — failures only degrade context (logged + returns '').
 */
export async function buildOpsReviewContext(
  app: TApp,
  schedule: Schedule
): Promise<string> {
  try {
    const { db } = app.locals
    const orgId = schedule.orgId
    const { data: rows } = await db.services.opsAction.listByStatus(
      orgId,
      EOpsActionStatus.dryRun
    )
    if (!rows?.length) return ``

    const capped = rows.slice(0, OpsReviewInjectMax)
    const bullets = capped
      .map((row: any) => {
        const paramsStr = JSON.stringify(row.params ?? {}).slice(0, 300)
        const planStr = JSON.stringify(row.dryRunResult?.data ?? {}).slice(0, 300)
        const rb = row.rollback
        const rollbackStr = rb
          ? `${rb.kind}${rb.prevRevision ? ` prevRevision=${rb.prevRevision}` : ``}${rb.prevSha ? ` prevSha=${rb.prevSha}` : ``}${rb.prevConfig ? ` prevConfig=<object>` : ``}`
          : `none`
        const scan = row.scanResult
        const scanStr = scan
          ? `passed=${scan.passed}, findings=${JSON.stringify(scan.findings ?? [])}`
          : `none`
        return `- ${row.id} [${row.action}] agent=${row.agentId}\n    params: ${paramsStr}\n    dry-run plan: ${planStr}\n    rollback: ${rollbackStr}\n    scan: ${scanStr}`
      })
      .join(`\n`)

    const raw = `## Ops actions awaiting review (adversary approval gate)\n${bullets}\n    Emit \`\`\`tdsk-ops-reviews\`\`\`{opsActionId,approve,reason} to approve or reject.\n\nRULES: approve ONLY if the action is (a) in the allowlist (podStatus/podLogs/deployState/quotaUsage/triggerRedeploy/restartDeployment/applySandboxConfig), (b) targets an allowlisted deployment/field, (c) the reason is concrete + reasonable, (d) the rollback data is present. Reject anything ambiguous — rejection is cheap; a bad write is not. The server RE-SCANS on approve as a hard gate, so an approval that would fail the scan cannot execute.\n\n`
    return raw.length > OpsReviewInjectMaxChars
      ? `${raw.slice(0, OpsReviewInjectMaxChars)}... (truncated)`
      : raw
  } catch (err) {
    logger.error(
      `[Executor] buildOpsReviewContext failed for schedule ${schedule.id}:`,
      (err as Error).message
    )
    return ``
  }
}

/**
 * Resolve the coordinator's active initiative for an `auto` marker. Instead of a
 * hard-coded initiative name, read the agent's roadmap (maintained by the
 * planning cycle) and extract its `Current initiative:` line. Returns '' when
 * there is no agent, no roadmap, or no such line — the caller then injects the
 * "select and declare one" kickoff note. Never throws.
 */
async function resolveAutoInitiative(app: TApp, schedule: Schedule): Promise<string> {
  try {
    const agentId = schedule.agentId
    if (!agentId) return ``
    const { db } = app.locals
    const { data: roadmap } = await db.services.memory.getRoadmap(schedule.orgId, agentId)
    const text = roadmap?.text ?? ``
    const m = text.match(/current\s+initiative\s*:\s*([^\n\r]+)/i)
    return m?.[1]?.trim() ?? ``
  } catch {
    return ``
  }
}

/** Injected when an `auto` coordinator has no `Current initiative:` in its roadmap. */
const AutoInitiativeUnsetNote =
  `## Initiative: (none set)\n` +
  `Your roadmap does not yet name a "Current initiative:". Choose the single highest-leverage ` +
  `strategic theme from the "## Roadmap" above, give it a short stable name, and BEGIN it: file ONE ` +
  `parent tdsk-tasks proposal with initiative:"<name>" and parentId omitted. Next cycle its ledger ` +
  `appears here and you decompose it. Do nothing else this cycle.\n`

/** Injected when an `auto` coordinator's resolved initiative has no rows yet. */
const autoKickoffLedger = (initiative: string): string =>
  `## Initiative: ${initiative}\n` +
  `Coordinator ledger is EMPTY — this is the kickoff for this initiative. Decompose it into 1-3 ` +
  `bounded parent tasks and delegate their children per your instructions. Emit tdsk-tasks with ` +
  `initiative:"${initiative}".\n`

/**
 * Build the injected coordinator ledger for a COORDINATOR cycle: surfaces the
 * current state of a named initiative (parents + children + statuses + PR URLs)
 * so the coordinator can decompose bounded child tasks and delegate them.
 *
 * Marker-gated: only injected when the schedule prompt contains
 * `<!-- coordinator-initiative: <name> -->`. The marker value `auto` resolves
 * the initiative dynamically from the roadmap's `Current initiative:` line
 * instead of a hard-coded name. When the marker is absent, or a literal
 * initiative has no rows yet, returns '' (nothing injected). Read-only — never
 * throws; a failure only degrades context (logged + returns '').
 */
export async function buildCoordinatorContext(
  app: TApp,
  schedule: Schedule
): Promise<string> {
  try {
    const m = (schedule.prompt ?? ``).match(
      /<!--\s*coordinator-initiative:\s*([^\s>][^-]*?)\s*-->/i
    )
    const marker = m?.[1]?.trim()
    if (!marker) return ``

    const { db } = app.locals

    // `auto` marker: resolve the initiative from the roadmap instead of a
    // hard-coded name. An unresolved auto initiative injects the kickoff note.
    const isAuto = marker.toLowerCase() === `auto`
    const initiative = isAuto ? await resolveAutoInitiative(app, schedule) : marker
    if (!initiative) return AutoInitiativeUnsetNote

    const { data: rows } = await db.services.taskProposal.listByInitiative(
      schedule.orgId,
      initiative
    )
    // Empty ledger: the literal-marker path keeps its historical '' contract; the
    // auto path names the initiative so the coordinator can kick it off.
    if (!rows?.length) return isAuto ? autoKickoffLedger(initiative) : ``

    // Build a set of parent ids within this initiative for quick lookup.
    const parentIds = new Set(
      rows.filter((r: any) => r.parentId === null).map((r: any) => r.id)
    )

    const parents = rows.filter((r: any) => r.parentId === null)
    const children = rows.filter((r: any) => r.parentId !== null)

    // Group children by their parentId.
    const childrenByParent = new Map<string, typeof children>()
    const orphans: typeof children = []
    for (const child of children) {
      if (parentIds.has(child.parentId)) {
        const bucket = childrenByParent.get(child.parentId!) ?? []
        bucket.push(child)
        childrenByParent.set(child.parentId!, bucket)
      } else {
        orphans.push(child)
      }
    }

    const fmt = (p: any) =>
      `- ${p.id} [${p.priority ?? `?`}] ${p.title}  status=${p.status}  pr=${p.prUrl ?? `none`}`

    let out = `## Initiative: ${initiative}\n`
    out += `Coordinator ledger — you own this initiative. Decompose into ≤3 bounded child tasks per cycle,\n`
    out += `each self-contained enough for delegateTask to finish in one child run.\n\n`

    if (parents.length) {
      out += `Parents:\n`
      for (const p of parents) out += `  ${fmt(p)}\n`
      out += `\n`
    }

    if (childrenByParent.size) {
      out += `Children (grouped by parent):\n`
      for (const [pid, kids] of childrenByParent.entries()) {
        const parentRow = parents.find((p: any) => p.id === pid)
        const parentTitle = parentRow ? `"${parentRow.title}"` : pid
        out += `  ${pid} ${parentTitle}:\n`
        for (const kid of kids) out += `    ${fmt(kid)}\n`
      }
      out += `\n`
    }

    if (orphans.length) {
      out += `Orphans (children whose parent is not in this initiative):\n`
      for (const o of orphans)
        out += `  - ${o.id} parentId=${o.parentId} [${o.priority ?? `?`}] ${o.title}  status=${o.status}\n`
      out += `\n`
    }

    out += `Emit \`tdsk-tasks\` blocks that link children to this initiative via {initiative:"${initiative}", parentId:"<tp_parent_id>"}\n`
    out += `so persistTaskProposals threads them into this ledger next cycle. Delegate each unclaimed child via\n`
    out += `delegateTask (depth cap 1, concurrency cap 3, critic). When all children are \`promoted\` with a \`prUrl\` and\n`
    out += `the linked P4c verifications are \`verified\`, write a durable memory marking the initiative complete.\n`

    return out.length > CoordinatorInjectMaxChars
      ? `${out.slice(0, CoordinatorInjectMaxChars)}... (truncated)`
      : out
  } catch (err) {
    logger.error(
      `[Executor] buildCoordinatorContext failed for schedule ${schedule.id}:`,
      (err as Error).message
    )
    return ``
  }
}

/**
 * Parse and apply any structured-output ops-review block emitted by a
 * successful adversary run. Each decision routes through applyOpsReview,
 * which re-runs the security scan (hard gate) before executing. Never throws.
 */
export async function persistOpsReviews(
  app: TApp,
  schedule: Schedule,
  agentId: string,
  stdoutText: string
): Promise<void> {
  const reviews = parseOpsReviewsBlock(stdoutText)
  if (!reviews.length) return

  const { db } = app.locals
  for (const r of reviews) {
    try {
      const result = await applyOpsReview(app, db, schedule.orgId, r, agentId)
      logger.info(
        `[Executor] ops-review ${r.opsActionId} → ${result?.status ?? 'skipped'}`
      )
    } catch (e) {
      logger.warn(
        `[Executor] ops-review ${r.opsActionId} failed: ${(e as Error).message}`
      )
    }
  }
}

/**
 * Compose the CLI-brain shell command from the runtime's prompt template.
 * The soul is substituted into a {soul} placeholder when the template has one,
 * otherwise prepended to the prompt payload. Payload order is soul (fallback
 * branch only), then memory context, then previous report, then the prompt.
 */
function buildCliCommand(
  schedule: Schedule,
  agent: Agent,
  sandboxConfig: TKubeSandboxConfig,
  previousReport: string,
  memorySection: string
): string {
  const template = resolvePromptTemplate(sandboxConfig)
  const reportSection = previousReport
    ? `## Your previous report\n${previousReport}\n\n`
    : ``

  const command = template.includes(`{soul}`)
    ? substitutePlaceholders(template, {
        soul: escapePromptArg(agent.soul || ``),
        prompt: escapePromptArg(`${memorySection}${reportSection}${schedule.prompt}`),
      })
    : substitutePlaceholders(template, {
        prompt: escapePromptArg(
          `${agent.soul ? `${agent.soul}\n\n` : ``}${memorySection}${reportSection}${schedule.prompt}`
        ),
      })

  // Force the one-shot runtime to run every command synchronously — a
  // backgrounded command dies with the disposable pod, losing all work.
  const prefix = foregroundEnvPrefix(sandboxConfig.runtime)
  return prefix ? `${prefix} ${command}` : command
}

type TCliRunHooks = {
  onPodStart: (instanceId: string) => void
  onStdout: (chunk: string | Buffer) => void
  onStderr: (chunk: string | Buffer) => void
}

/**
 * Runtime-brain execution path: run the schedule prompt through the CLI AI tool
 * in the agent's body sandbox pod (via the runtime's promptCommand) and persist
 * the tool's output into the durable continuity thread. Deliberately avoids
 * resolveAgentConfig — runtime-brain agents may have zero agent providers; their
 * credentials ride on the body sandbox's provider links.
 *
 * `runId` (the schedule_runs row claimed for this execution) is a stable,
 * run-scoped idempotency token exposed to the pod as `TDSK_IDEMPOTENCY_KEY` —
 * every same-provider retry AND every provider-failover attempt within THIS
 * run carries the same token, so a command that performs a caller-visible
 * side effect (an external POST/webhook) has something durable to dedupe on.
 * A NEW run (a fresh schedule_runs row) always gets a fresh token. This does
 * not make arbitrary shell commands idempotent by itself — it only threads
 * the key through so a command that already supports one can use it.
 */
async function runCliAgentSchedule(
  app: TApp,
  schedule: Schedule,
  agent: Agent,
  hooks: TCliRunHooks,
  runId: string
): Promise<TSandboxResult> {
  const { db, sandbox } = app.locals

  if (!schedule.agentId) throw new Error(`runCliAgentSchedule called without agentId`)
  if (!schedule.prompt)
    throw new Error(`Schedule ${schedule.id} is agent-backed but has no prompt`)
  // threads.user_id is NOT NULL while schedules.user_id is nullable (onDelete: set null),
  // so a missing user must fail loudly here, not as a raw DB constraint error mid-run.
  if (!schedule.userId)
    throw new Error(`Schedule ${schedule.id} is agent-backed but has no userId`)

  const bodySandboxId = agent.environment?.sandboxId || schedule.sandboxId
  if (!bodySandboxId)
    throw new Error(
      `Schedule ${schedule.id} agent has runtime brain but no body sandbox — set agent.environment.sandboxId or schedule.sandboxId`
    )

  const threadId = await resolveContinuityThread(db, schedule, schedule.orgId)
  const previousReport = await fetchPreviousReport(db, threadId)

  // Resolve the effective sandbox + ai-provider failover chain BEFORE startPod.
  // The primary (priority-0) provider's env becomes the pod default; every
  // provider's (domain-scoped) placeholder is injected so egress can swap
  // whichever token a fallback attempt uses. A misconfigured provider throws
  // here, exactly as startPod would refuse to launch.
  const { sandboxConfig, chain } = await resolveSandboxProviderChain(db, {
    orgId: schedule.orgId,
    sandboxId: bodySandboxId,
    projectId: schedule.projectId,
    logContext: `[Executor] Schedule ${schedule.id} —`,
  })

  const instanceId = await sandbox!.startPod({
    orgId: schedule.orgId,
    userId: schedule.userId,
    sandboxId: bodySandboxId,
    projectId: schedule.projectId,
    egressOpts: app.locals.config.egress,
    providerChain: {
      primaryEnv: chain.primaryEnv,
      placeholders: chain.placeholders,
    },
  })
  // Recorded immediately via hook so the caller's finally block always reaps the pod,
  // even when a later step throws
  hooks.onPodStart(instanceId)

  logger.info(`[Executor] Schedule ${schedule.id} — CLI-brain pod started: ${instanceId}`)

  // The pod is created asynchronously (and clones repos before the entrypoint
  // command runs) — exec'ing before it is ready fails with "not running".
  // instanceId is already recorded via onPodStart, so the caller's finally
  // block still reaps the pod when this wait throws.
  await sandbox!.waitForPodReady(instanceId, {
    cloneCheck: true,
    timeoutMs: SetupReadyTimeoutMS,
  })

  const memorySection = await buildMemoryContext(app, schedule, agent.id)
  const reviewSection = await buildProposalReviewContext(app, schedule)
  // Always injected (mirrors reviewSection): surfaces open + routed escalations
  // so the steward does not re-raise already-tracked needs.
  const escalationSection = await buildEscalationContext(app, schedule)
  // Always injected (mirrors escalationSection): surfaces pending verifications
  // and the done-set so the steward knows which merged PRs still need probing.
  const verifySection = await buildVerifyContext(app, schedule)
  // Always injected (mirrors reviewSection/escalationSection): surfaces dryRun
  // ops-action rows awaiting adversary approval. The adversary cycle emits a
  // tdsk-ops-reviews block; other cycles ignore it silently.
  const opsReviewSection = await buildOpsReviewContext(app, schedule)
  // Marker-gated coordinator section: a COORDINATOR cycle (its prompt embeds
  // <!-- coordinator-initiative: <name> -->) receives the current initiative
  // ledger (parents + children + statuses + PR URLs) so it can decompose and
  // delegate bounded child tasks. Other cycles pay for no query.
  const coordinatorSection = await buildCoordinatorContext(app, schedule)
  // Marker-gated sensor faculties: a SENSOR cycle (its prompt emits a
  // tdsk-tasks block) gets its own recent run outcomes + a digest of open
  // proposals; a WORK cycle (its prompt emits a tdsk-task-picked block) gets the
  // scanned backlog. Cycles that opt into neither pay for neither query.
  const sensorSection = promptOptsIn(schedule, TasksBlockFence)
    ? (await buildRunOutcomeContext(app, schedule)) +
      (await buildOpenProposalsDigest(app, schedule))
    : ``
  const backlogSection = promptOptsIn(schedule, TaskPickupsBlockFence)
    ? await buildTaskBacklogContext(app, schedule)
    : ``
  // Gated executive faculty (read-only): a CEO/CTO board cycle (its prompt
  // carries the company-strategy marker) receives the company-wide
  // `## Business metrics` snapshot (revenue / signups / churn / engagement) so
  // it can ground decisions in real data. Dev-loop prompts carry no marker, so
  // they pay for no query. Board state (Company Strategy + open decisions) is
  // injected declaratively via the contextSources section below.
  const businessMetricsSection = await buildBusinessMetricsSection(app, schedule)
  // Declarative, config-driven injection: each `contextSources` entry on the
  // schedule is run via record.query (scoped to the schedule's project) and
  // rendered under its `## <as>` heading. Gated on presence — a schedule without
  // contextSources adds nothing and runs no query, so its assembled context is
  // byte-identical (the 11 live self-development schedules have none).
  const contextSourcesSection = await buildContextSourcesSection(app, schedule)
  const baseCommand = buildCliCommand(
    schedule,
    agent,
    sandboxConfig,
    previousReport,
    memorySection +
      reviewSection +
      escalationSection +
      verifySection +
      opsReviewSection +
      coordinatorSection +
      sensorSection +
      backlogSection +
      businessMetricsSection +
      contextSourcesSection
  )

  // Accumulate raw Buffers with byte accounting and decode ONCE at the end.
  // Decoding each chunk individually corrupts multibyte characters split
  // across chunk boundaries (U+FFFD), and capping by string length counts
  // UTF-16 code units instead of bytes. Trimming from the FRONT keeps the
  // tail; a leading partial character after a byte-boundary trim is acceptable.
  const stdoutChunks: Buffer[] = []
  let stdoutBytes = 0
  const bufferStdout = (chunk: string | Buffer) => {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    stdoutChunks.push(buf)
    stdoutBytes += buf.length
    while (stdoutBytes > StdoutBufferMaxBytes) {
      const excess = stdoutBytes - StdoutBufferMaxBytes
      const head = stdoutChunks[0]
      if (head.length <= excess) {
        stdoutChunks.shift()
        stdoutBytes -= head.length
      } else {
        stdoutChunks[0] = head.subarray(excess)
        stdoutBytes -= excess
      }
    }
  }

  const sbInstance = await sandbox!.getSandbox(instanceId)

  // Run a single CLI-brain command against the live pod. The stdout buffer is
  // reset before each attempt so only the final attempt's output is persisted.
  const execOnce = (command: string) =>
    sbInstance.execStreaming
      ? sbInstance.execStreaming(command, [], {
          onStdout: (chunk: Buffer) => {
            bufferStdout(chunk)
            hooks.onStdout(chunk)
          },
          onStderr: (chunk: Buffer) => hooks.onStderr(chunk),
        })
      : sbInstance.exec(command).then((r) => {
          if (r.output) {
            bufferStdout(r.output)
            hooks.onStdout(r.output)
          }
          return r
        })

  const resetStdout = () => {
    stdoutChunks.length = 0
    stdoutBytes = 0
  }

  // Capture the transient signal (if any) across the buffered stdout + the
  // command's own error string.
  const transientSignal = (res: TSandboxResult): string | undefined => {
    const stdoutSoFar = Buffer.concat(stdoutChunks).toString(`utf8`)
    return matchTransientSignal(stdoutSoFar) ?? matchTransientSignal(res.error ?? ``)
  }

  // A connection-level rejection (e.g. the K8s apiserver's own
  // --request-timeout firing as a 504 before any stdout/stderr is captured —
  // see kubeClient.ts's runInPod) bypasses transientSignal() entirely, since
  // that only ever inspects a RESOLVED result. Classify it here: a retryable
  // apiserver status resolves as a failed TSandboxResult so it flows into the
  // existing same-provider-retry loop unchanged; anything else rethrows,
  // preserving current behavior for non-transient rejections.
  const execAttempt = async (command: string): Promise<TSandboxResult> => {
    try {
      return await withTimeout(execOnce(command), schedule.timeoutMs ?? ExecTimeoutMS)
    } catch (err: any) {
      const code = getK8sStatusCode(err)
      if (!KubeRetryableStatusCodes.has(code as number)) throw err
      return { success: false, exitCode: 1, output: ``, error: err.message }
    }
  }

  // Run one provider's command with same-provider transient retries. A
  // non-transient failure breaks immediately (never worth retrying); a
  // transient failure retries in the SAME pod after a short backoff up to
  // `maxRetries`. Only the final attempt's stdout survives in the buffer.
  const runProvider = async (
    command: string,
    maxRetries: number
  ): Promise<TSandboxResult> => {
    resetStdout()
    let res = await execAttempt(command)
    for (let attempt = 0; !res.success && attempt < maxRetries; attempt++) {
      if (!transientSignal(res)) break
      const delay =
        CliTransientRetryDelaysMs[attempt] ??
        CliTransientRetryDelaysMs[CliTransientRetryDelaysMs.length - 1]
      logger.warn(
        `[Executor] Schedule ${schedule.id} — transient upstream failure, same-provider retry ${
          attempt + 1
        }/${maxRetries} in ${delay}ms`
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
      resetStdout()
      res = await execAttempt(command)
    }
    return res
  }

  // Ordered provider attempts: the primary runs with just the idempotency env
  // (pod-default provider env); each fallback ALSO prefixes its OWN env inline
  // so ANTHROPIC_AUTH_TOKEN + ANTHROPIC_BASE_URL override the pod defaults for
  // that single invocation. ANTHROPIC_AUTH_TOKEN takes precedence over
  // CLAUDE_CODE_OAUTH_TOKEN, so a ZAI/OpenRouter fallback cleanly overrides an
  // Anthropic-OAuth primary with no unset needed. Each fallback token stays
  // domain-scoped, so egress can only ever swap it into a request to that
  // provider's own domains. TDSK_IDEMPOTENCY_KEY rides on every attempt (see
  // this function's doc comment) — same token across every same-provider
  // retry and every provider failover within this run.
  const idempotencyEnv = { TDSK_IDEMPOTENCY_KEY: runId }
  const cappedFallbacks = chain.fallbacks.slice(0, CliMaxProviderFailovers)
  const providerAttempts: Array<{ brand: string; command: string }> = [
    {
      brand: chain.primaryBrand || sandboxConfig.runtime || `primary`,
      command: `${buildEnvPrefix(idempotencyEnv)} ${baseCommand}`,
    },
    ...cappedFallbacks.map((fb) => ({
      brand: fb.brand,
      command: `${buildEnvPrefix({ ...idempotencyEnv, ...fb.env })} ${baseCommand}`,
    })),
  ]

  // The runtime brain (claude -p) can fail mid-run on a transient upstream
  // error (Anthropic 529/Overloaded, rate limits, upstream 5xx). On such a
  // failure, fail over to the next priority provider (after a brief
  // same-provider retry). Non-transient failures never fail over; only the
  // final attempt is persisted.
  let result!: TSandboxResult
  for (let p = 0; p < providerAttempts.length; p++) {
    const hasNext = p < providerAttempts.length - 1
    // Keep a brief same-provider retry while a fallback remains; the terminal
    // provider exhausts the full transient-retry budget (Wave B semantics).
    const maxRetries = hasNext
      ? CliSameProviderRetriesBeforeFailover
      : CliMaxTransientRetries
    result = await runProvider(providerAttempts[p].command, maxRetries)

    if (result.success) break

    const signal = transientSignal(result)
    // Non-transient failures return immediately — no other provider will help.
    if (!signal) break
    // Transient failure with a fallback remaining → advance to the next provider.
    if (hasNext) {
      logger.warn(
        `[Executor] Schedule ${schedule.id} — provider failover ${
          providerAttempts[p].brand
        } → ${providerAttempts[p + 1].brand} (attempt ${p + 1}/${
          providerAttempts.length
        }); transient upstream signal: ${signal}`
      )
    }
  }

  // Only successful runs feed the continuity thread — never poison it with garbage.
  // Persistence failures are logged, not fatal: the report is still in S3.
  if (result.success) {
    const stdoutText = Buffer.concat(stdoutChunks).toString(`utf8`)
    const { error: userErr } = await db.services.message.create({
      threadId,
      type: EMsgType.user,
      orgId: schedule.orgId,
      content: [{ type: EContentType.text, text: schedule.prompt }],
    })
    const { error: assistantErr } = await db.services.message.create({
      threadId,
      type: EMsgType.assistant,
      orgId: schedule.orgId,
      content: [{ type: EContentType.text, text: stdoutText }],
    })
    if (userErr || assistantErr)
      logger.error(
        `[Executor] Schedule ${schedule.id} — failed to persist CLI-brain messages to thread ${threadId}:`,
        (userErr || assistantErr)?.message
      )

    // Capture any structured-output memory-write block from the final stdout
    await persistMemoryWrites(app, schedule, agent.id, threadId, stdoutText)
    // Capture self-authored skill proposals (scanned server-side) and any
    // auditor review decisions (promoted/rejected through the hard scan gate).
    await persistSkillProposals(app, schedule, agent.id, threadId, stdoutText)
    await persistSkillReviews(app, schedule, agent.id, stdoutText)
    // Capture self-sensed task proposals (SENSOR cycle) and any work-cycle
    // pickups that promote a scanned proposal once its PR opens.
    await persistTaskProposals(app, schedule, agent.id, threadId, stdoutText)
    await persistTaskPickups(app, schedule, agent.id, stdoutText)
    // Capture escalations opened by the steward and resolutions it emits once
    // a fix PR merges; resolutions also write a durable memory row.
    await persistEscalations(app, schedule, agent.id, threadId, stdoutText)
    // Capture post-merge verify results: upsert verification rows and open a
    // target:app escalation for any regressed probe (revert PR already opened in-pod).
    await persistVerifications(app, schedule, agent.id, threadId, stdoutText)
    // Capture adversary ops-review verdicts (approve/reject per dryRun row).
    // applyOpsReview re-scans before executing — the hard gate is server-side.
    await persistOpsReviews(app, schedule, agent.id, stdoutText)

    // Self-authored tools (tdsk-author-function): the agent BUILDS a Function it
    // needs, scanned server-side. BEFORE dispatchActions so a Function authored
    // this run is already present + invokable (by its author) when this run's
    // own ```tdsk-actions``` block dispatches.
    // Self-provisioning: store obtained credentials, then build connectors that
    // reference them, then author Functions — all BEFORE actions dispatch so a
    // same-turn author-secret → author-endpoint → connect chain works.
    await persistAuthoredSecrets(app, schedule, agent.id, stdoutText)
    await persistAuthoredEndpoints(app, schedule, agent.id, stdoutText)
    await persistAuthoredFunctions(app, schedule, agent.id, stdoutText)

    // Generic effect surface (generalization ②): dispatch a ```tdsk-actions```
    // block to consumer Functions. No-op unless this schedule opts in via
    // `actions`. Runs AFTER the 8 hard-coded dev-loop persist* handlers above.
    // The executive board runs entirely through here on the platform primitives
    // (Collections + Functions — see repos/database/src/seeds/exec-board/); the
    // dev-loop's own migration to this surface is ⑤b.
    await dispatchActions(app, schedule, agent.id, stdoutText)
  }

  return result
}

export function createScheduleExecutor(app: TApp): TScheduleExecutor {
  return async (schedule: Schedule) => {
    const { db, sandbox, s3 } = app.locals
    if (!sandbox)
      throw new Error(
        `Sandbox service not available — cannot execute schedule ${schedule.id}`
      )

    const start = Date.now()
    // Per-schedule override with the shared execution timeout as the fallback
    const timeoutMs = schedule.timeoutMs ?? ExecTimeoutMS

    // Agent-backed schedules validate userId inside runAgentSchedule so the
    // failure is recorded on the run; pod schedules fail fast before pod start
    if (!schedule.agentId && !schedule.userId)
      throw new Error(
        `Schedule ${schedule.id} has no userId — cannot start pod without ownership`
      )

    // Atomic cross-replica claim (see ScheduleRun.claimRunning) — two backend
    // replicas can both reach here for the same due schedule after both pass
    // the best-effort hasRunning() check in scheduler.ts; the partial unique
    // index on schedule_runs(schedule_id) WHERE status='running' means only
    // one INSERT wins. The loser gets conflict:true, throws, and is skipped
    // cleanly by #processSchedule's catch — before any pod is started.
    const {
      data: run,
      error: runErr,
      conflict,
    } = await db.services.scheduleRun.claimRunning({
      orgId: schedule.orgId,
      startedAt: new Date(),
      scheduleId: schedule.id,
      projectId: schedule.projectId,
    })

    if (conflict) {
      logger.info(
        `[Executor] Schedule ${schedule.id} — another replica already claimed the running slot; skipping cleanly`
      )
      throw new ScheduleClaimConflictError(schedule.id)
    }

    if (runErr || !run) {
      logger.error(`[Executor] Failed to create schedule run record:`, runErr?.message)
      throw new Error(`Failed to create schedule run: ${runErr?.message || 'unknown'}`)
    }

    const stdoutKey = `${schedule.orgId}/runs/${run.id}/stdout`
    const stderrKey = `${schedule.orgId}/runs/${run.id}/stderr`
    const stdoutUpload = s3.createUploadStream(stdoutKey)
    const stderrUpload = s3.createUploadStream(stderrKey)

    let instanceId: string | undefined
    let markedComplete = false

    // Persist the pod name to the DB the moment startPod returns. Without this
    // the row stays instance_id=NULL until `complete()`, which makes any mid-run
    // backend restart look like a pre-pod orphan to the rehydrator — the same
    // false-positive the rehydrator was written to eliminate. Failure to persist
    // is non-fatal (the run keeps executing) but is logged.
    const captureInstanceId = (id: string) => {
      instanceId = id
      db.services.scheduleRun.setInstance(run.id, id).then(({ error: setErr }) => {
        if (setErr)
          logger.warn(
            `[Executor] Failed to persist instanceId ${id} on run ${run.id}: ${setErr.message}`
          )
      })
    }

    const finalizeUploads = async (): Promise<boolean> => {
      stdoutUpload?.stream.end()
      stderrUpload?.stream.end()
      try {
        await Promise.all([stdoutUpload?.done(), stderrUpload?.done()])
        return true
      } catch (uploadErr) {
        logger.error(
          `[Executor] Schedule ${schedule.id} — S3 upload failed:`,
          (uploadErr as Error).message
        )
        return false
      }
    }

    try {
      if (schedule.agentId) {
        const { data: scheduleAgent, error: agentErr } = await db.services.agent.get(
          schedule.agentId
        )
        if (agentErr)
          throw new Error(`Failed to load agent ${schedule.agentId}: ${agentErr.message}`)
        if (!scheduleAgent) throw new Error(`Agent not found: ${schedule.agentId}`)

        if (scheduleAgent.brain === EAgentBrain.runtime) {
          // Runtime-brain runs used to be un-timed here while the API-brain path
          // below wrapped runAgentSchedule in withTimeout — a runtime cycle
          // could pin the pod for hours past the schedule's budget. Same wrap
          // now applies to both brains.
          const result = await withTimeout(
            runCliAgentSchedule(
              app,
              schedule,
              scheduleAgent,
              {
                onPodStart: captureInstanceId,
                onStdout: (chunk) => stdoutUpload?.stream.write(chunk),
                onStderr: (chunk) => stderrUpload?.stream.write(chunk),
              },
              run.id
            ),
            timeoutMs
          )

          const uploadOk = await finalizeUploads()
          // Persist the SAME fallback message used below for the thrown error —
          // otherwise a failure with no result.error (e.g. bare non-zero exit,
          // no stderr captured) writes a blank schedule_runs.error, and the
          // fallback text only ever reaches the log, never the DB row.
          const errorMessage = result.success
            ? undefined
            : result.error || `Command exited with non-zero code ${result.exitCode}`
          const { error: completeErr } = await db.services.scheduleRun.complete(run.id, {
            instanceId,
            error: errorMessage,
            durationMs: Date.now() - start,
            status: result.success ? `success` : `error`,
            ...(uploadOk && { stdoutKey, stderrKey }),
          })
          completeErr
            ? logger.error(
                `[Executor] Failed to write completion record for run ${run.id} (schedule ${schedule.id}): ${completeErr.message}`
              )
            : (markedComplete = true)

          if (!result.success) throw new Error(errorMessage)

          logger.info(
            `[Executor] Schedule ${schedule.id} — CLI-brain run completed in ${Date.now() - start}ms`
          )
          return
        }

        const agentRun = await withTimeout(
          runAgentSchedule(
            app,
            schedule,
            (chunk) => stdoutUpload?.stream.write(chunk),
            // Captured immediately after startPod so the finally block reaps
            // the pod even when a later step throws before the run returns.
            // Uses captureInstanceId so the pod name is also persisted to the
            // schedule_run row for the rehydrator to find on backend restart.
            captureInstanceId
          ),
          timeoutMs
        )
        // Preserves teardown for agents whose podName came from a pre-existing
        // environment.instanceId (no startPod, so onPodStart never fires).
        // Also persist that instanceId if we discovered it here rather than via
        // captureInstanceId so the row is complete for the rehydrator.
        if (agentRun.instanceId && agentRun.instanceId !== instanceId)
          captureInstanceId(agentRun.instanceId)

        const uploadOk = await finalizeUploads()
        const { error: completeErr } = await db.services.scheduleRun.complete(run.id, {
          instanceId,
          durationMs: Date.now() - start,
          status: `success`,
          ...(uploadOk && { stdoutKey, stderrKey }),
        })
        completeErr
          ? logger.error(
              `[Executor] Failed to write completion record for run ${run.id} (schedule ${schedule.id}): ${completeErr.message}`
            )
          : (markedComplete = true)

        logger.info(
          `[Executor] Schedule ${schedule.id} — agent run completed in ${Date.now() - start}ms`
        )
        return
      }

      const startedPodName = await sandbox.startPod({
        orgId: schedule.orgId,
        userId: schedule.userId,
        sandboxId: schedule.sandboxId,
        projectId: schedule.projectId,
        egressOpts: app.locals.config.egress,
      })
      captureInstanceId(startedPodName)

      logger.info(`[Executor] Schedule ${schedule.id} — pod started: ${instanceId}`)

      // instanceId is already assigned, so the finally block still reaps the
      // pod when the readiness wait throws (Failed pod, timeout, etc.)
      await sandbox.waitForPodReady(instanceId, {
        cloneCheck: true,
        timeoutMs: SetupReadyTimeoutMS,
      })

      const sandboxConfig = await resolveEffectiveSandboxConfig(
        db,
        schedule.sandboxId,
        schedule
      )
      const command = resolveScheduleCommand(schedule, sandboxConfig)

      const sbInstance = await sandbox.getSandbox(instanceId)

      const sbExecPromise = sbInstance.execStreaming
        ? sbInstance.execStreaming(command, [], {
            onStdout: (chunk) => stdoutUpload?.stream.write(chunk),
            onStderr: (chunk) => stderrUpload?.stream.write(chunk),
          })
        : sbInstance.exec(command).then((r) => {
            if (r.output) stdoutUpload?.stream.write(r.output)
            return r
          })

      let execTimer: ReturnType<typeof setTimeout>
      const timeoutPromise = new Promise<never>((_, reject) => {
        execTimer = setTimeout(
          () => reject(new Error(`Timed out after ${timeoutMs / 1000}s`)),
          timeoutMs
        )
        execTimer.unref()
      })

      let result
      try {
        result = await Promise.race([sbExecPromise, timeoutPromise])
      } finally {
        clearTimeout(execTimer!)
      }

      const uploadOk = await finalizeUploads()

      // Persist the SAME fallback message used below for the thrown error —
      // otherwise a failure with no result.error (e.g. bare non-zero exit, no
      // stderr captured) writes a blank schedule_runs.error, and the fallback
      // text only ever reaches the log, never the DB row.
      const errorMessage = result.success
        ? undefined
        : result.error || `Command exited with non-zero code ${result.exitCode}`
      const { error: completeErr } = await db.services.scheduleRun.complete(run.id, {
        instanceId,
        error: errorMessage,
        durationMs: Date.now() - start,
        status: result.success ? `success` : `error`,
        ...(uploadOk && { stdoutKey, stderrKey }),
      })

      completeErr
        ? logger.error(
            `[Executor] Failed to write completion record for run ${run.id} (schedule ${schedule.id}): ${completeErr.message}`
          )
        : (markedComplete = true)

      if (!result.success) throw new Error(errorMessage)

      logger.info(
        `[Executor] Schedule ${schedule.id} — completed successfully in ${Date.now() - start}ms`
      )
    } catch (err: any) {
      if (!markedComplete) {
        const uploadOk = await finalizeUploads()

        const isTimeout = err?.message?.includes(`Timed out`)
        await db.services.scheduleRun
          .complete(run.id, {
            instanceId,
            durationMs: Date.now() - start,
            error: err?.message || String(err),
            status: isTimeout ? `timeout` : `error`,
            ...(uploadOk && { stdoutKey, stderrKey }),
          })
          .catch((e: any) =>
            logger.error(
              `[Executor] Failed to mark run ${run.id} (schedule ${schedule.id}) as error:`,
              e
            )
          )
      }

      logger.error(`[Executor] Schedule ${schedule.id} failed:`, err?.message || err)
      throw err
    } finally {
      if (instanceId) {
        try {
          await sandbox.stopPod(instanceId)
          logger.info(`[Executor] Schedule ${schedule.id} — pod stopped: ${instanceId}`)
        } catch (stopErr: any) {
          logger.error(`[Executor] Failed to stop pod ${instanceId}:`, stopErr?.message)
        }
      }
    }
  }
}
