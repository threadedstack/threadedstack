import type { TDatabase } from '@tdsk/database'
import type { IScheduleCapability, TScheduleCreateInput } from '@tdsk/domain'

import { MinScheduleTimeoutMS, MaxScheduleTimeoutMS } from '@TBE/constants/sandbox'
import { Schedule, isValidCron, parseNextRun, EScheduleType } from '@tdsk/domain'

/** Bridge-callback name exposed to the isolate for the schedule capability. */
export const ScheduleBridge = {
  create: `schedule.create`,
} as const

/**
 * Resolve the sandbox a new schedule should run on from the Function's OWN
 * trusted caller identity — never from isolate input. An agent-invoked
 * Function inherits the sandbox configured on that agent's environment; a
 * schedule-invoked Function inherits the SAME sandbox the current schedule
 * cycle is already running on. Returns `null` when neither identity resolves
 * a sandbox, in which case schedule creation is refused (fail-closed).
 */
const resolveSandboxId = async (
  db: TDatabase,
  projectId: string,
  caller?: { agentId?: string; scheduleId?: string }
): Promise<string | null> => {
  if (caller?.agentId) {
    const { data: agent } = await db.services.agent.get(caller.agentId)
    if (agent?.environment?.sandboxId) return agent.environment.sandboxId
  }
  if (caller?.scheduleId) {
    const { data: schedule } = await db.services.schedule.get(caller.scheduleId)
    if (schedule && schedule.projectId === projectId) return schedule.sandboxId
  }
  return null
}

/**
 * Build the schedule-creation capability. The isolate supplies only
 * `cronExpression`/`prompt`/`type`/`timeoutMs`; every scope field
 * (orgId/projectId/agentId/sandboxId) is resolved and bound host-side from the
 * Function's own project and trusted caller identity, mirroring
 * `createSchedule.ts`'s validation and insert shape exactly.
 */
export const createScheduleCapability = (
  db: TDatabase,
  projectId: string,
  caller?: { agentId?: string; scheduleId?: string }
): IScheduleCapability => ({
  create: async (input: TScheduleCreateInput) => {
    const { cronExpression, prompt, type = EScheduleType.prompt, timeoutMs } = input

    if (!cronExpression)
      throw new Error(`schedule.create failed: cronExpression is required`)
    if (!isValidCron(cronExpression))
      throw new Error(`schedule.create failed: invalid cron expression`)
    if (!Object.values(EScheduleType).includes(type))
      throw new Error(`schedule.create failed: invalid schedule type: ${String(type)}`)
    if (
      timeoutMs !== undefined &&
      timeoutMs !== null &&
      (!Number.isInteger(timeoutMs) ||
        timeoutMs < MinScheduleTimeoutMS ||
        timeoutMs > MaxScheduleTimeoutMS)
    )
      throw new Error(
        `schedule.create failed: timeoutMs must be an integer between ${MinScheduleTimeoutMS} and ${MaxScheduleTimeoutMS}`
      )

    const { data: project, error: projectErr } = await db.services.project.get(projectId)
    if (projectErr || !project)
      throw new Error(
        `schedule.create failed: ${projectErr?.message ?? `project not found`}`
      )

    const sandboxId = await resolveSandboxId(db, projectId, caller)
    if (!sandboxId)
      throw new Error(
        `schedule.create failed: no sandbox could be resolved for this Function's caller`
      )

    let nextRunAt: Date
    try {
      nextRunAt = parseNextRun(cronExpression)
    } catch (err) {
      throw new Error(
        `schedule.create failed: invalid cron expression: ${(err as Error).message}`
      )
    }

    const schedule = new Schedule({
      type,
      prompt,
      timeoutMs,
      nextRunAt,
      sandboxId,
      cronExpression,
      projectId,
      orgId: project.orgId,
      agentId: caller?.agentId,
    })

    const { data, error } = await db.services.schedule.create(schedule)
    if (error || !data)
      throw new Error(`schedule.create failed: ${error?.message ?? `unknown`}`)

    return {
      id: data.id,
      cronExpression: data.cronExpression,
      nextRunAt: new Date(data.nextRunAt as Date).toISOString(),
    }
  },
})

/**
 * Wrap the schedule capability as a JSON-marshalling host bridge. Only the JSON
 * input and JSON result cross the isolate boundary — never the db handle or the
 * live capability object. Mirrors `buildConnectorBridges`'s fail-closed gating:
 * returns an empty map (schedule unavailable) unless the caller is an agent or
 * a schedule the executor can resolve a sandbox from.
 */
export const buildScheduleBridges = (
  db: TDatabase,
  projectId: string,
  caller?: { agentId?: string; scheduleId?: string }
): Record<string, (argsJson: string) => Promise<string>> => {
  if (!caller?.agentId && !caller?.scheduleId) return {}
  const schedule = createScheduleCapability(db, projectId, caller)
  return {
    [ScheduleBridge.create]: async (argsJson) => {
      const [input] = JSON.parse(argsJson) as [TScheduleCreateInput]
      return JSON.stringify(await schedule.create(input))
    },
  }
}

/**
 * Reconstruct `context.schedule` inside the isolate from the `__hostCall`
 * bridge — same marshalling shape as `context.connect`. Only emitted when the
 * schedule bridge is present.
 */
export const scheduleContextCode = `context.schedule = (() => {
  const call = (name, args) => __hostCall(name, JSON.stringify(args)).then((r) => JSON.parse(r));
  return {
    create: (input) => call('${ScheduleBridge.create}', [input]),
  };
})();`
