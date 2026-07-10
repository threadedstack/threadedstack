import type { TTaskActionArgs } from '@TSCL/types'

import fs from 'node:fs'
import { Logger } from '@tdsk/logger'
import { capture } from '@TSCL/utils/proc/capture'
import { getCtx } from '@TSCL/utils/config/getCtx'
import { taskError } from '@TSCL/utils/tasks/error'
import { getKubeMeta } from '@TSCL/utils/kube/getKubeMeta'

/** In-cluster services that are health-checked and rolled back as a unit */
const SERVICE_CONTEXTS = [`caddy`, `proxy`, `backend`, `egress`]

/** Rollback attempts before declaring the deploy unrecoverable */
const ROLLBACK_ATTEMPTS = 2

type TService = { ctx: string; deployment: string }

export type TPreviousImages = Record<string, string>

/** Resolves the deployment name for each in-cluster service context */
const services = (props: TTaskActionArgs): TService[] =>
  SERVICE_CONTEXTS.map((ctx) => ({
    ctx,
    deployment: getCtx({ ...props, params: { ...props.params, context: ctx } })
      .deployment,
  })).filter((service): service is TService => Boolean(service.deployment))

/** Prefixes kubectl args with the target context + namespace */
const kctl = (props: TTaskActionArgs, args: string[]): string[] => {
  const meta = getKubeMeta(props, false)
  return [
    ...(meta.context ? [`--context`, meta.context] : []),
    ...(meta.namespace ? [`-n`, meta.namespace] : []),
    ...args,
  ]
}

/** Reads the current image of each service (rollback baseline) */
export const recordPreviousImages = async (
  props: TTaskActionArgs
): Promise<TPreviousImages> => {
  const previous: TPreviousImages = {}

  for (const { ctx, deployment } of services(props)) {
    const { code, output } = await capture(
      `kubectl`,
      kctl(props, [
        `get`,
        `deployment`,
        deployment,
        `-o`,
        `jsonpath={.spec.template.spec.containers[0].image}`,
      ])
    )

    if (code === 0 && output) previous[ctx] = output
    else
      Logger.warn(
        `  Could not read current image for ${deployment} — rollback will skip this service`
      )
  }

  return previous
}

/** Waits for every service deployment to finish rolling out */
export const waitForRollout = async (
  props: TTaskActionArgs,
  timeout: string = `120s`
): Promise<boolean> => {
  let ok = true

  for (const { deployment } of services(props)) {
    Logger.pair(`  Waiting for rollout`, deployment)
    const { code } = await capture(
      `kubectl`,
      kctl(props, [
        `rollout`,
        `status`,
        `deployment/${deployment}`,
        `--timeout=${timeout}`,
      ])
    )
    if (code !== 0) {
      ok = false
      Logger.warn(`  Rollout did not complete within ${timeout}: ${deployment}`)
    }
  }

  return ok
}

/** Returns the HTTP status code for a URL (0 on connection failure) */
const httpStatus = async (url: string, retry: boolean): Promise<number> => {
  const args = [
    `-s`,
    `-o`,
    `/dev/null`,
    `-w`,
    `%{http_code}`,
    ...(retry
      ? [`--retry`, `5`, `--retry-delay`, `10`, `--retry-all-errors`]
      : [`--max-time`, `10`]),
    url,
  ]

  const { output } = await capture(`curl`, args)
  return Number.parseInt(output.trim(), 10) || 0
}

/**
 * Checks proxy + backend health through the public URL.
 * Proxy `/health` must return 200; backend `/_/health` returns 200 or 401
 * (401 = reachable but auth-gated, which is healthy).
 */
export const healthCheck = async (
  props: TTaskActionArgs,
  retry: boolean = true
): Promise<boolean> => {
  const base = props.config.envs.TDSK_PX_URL
  if (!base) {
    Logger.warn(`  TDSK_PX_URL is not set — skipping HTTP health checks`)
    return true
  }

  const proxyCode = await httpStatus(`${base}/health`, retry)
  const proxyOk = proxyCode === 200
  Logger.pair(
    `  Proxy health`,
    `${base}/health → ${proxyCode} ${proxyOk ? `OK` : `FAIL`}`
  )

  const beCode = await httpStatus(`${base}/_/health`, retry)
  const beOk = beCode === 200 || beCode === 401
  Logger.pair(`  Backend health`, `${base}/_/health → ${beCode} ${beOk ? `OK` : `FAIL`}`)

  return proxyOk && beOk
}

/** Dumps pod status + recent logs for every service (on failure) */
export const captureLogs = async (props: TTaskActionArgs) => {
  Logger.header(`Pod status`)
  const pods = await capture(`kubectl`, kctl(props, [`get`, `pods`, `-o`, `wide`]))
  Logger.stdout(`${pods.output || pods.error || `(none)`}\n`)

  for (const { deployment } of services(props)) {
    Logger.header(`${deployment} logs (last 50 lines)`)
    const { output, error } = await capture(
      `kubectl`,
      kctl(props, [`logs`, `deployment/${deployment}`, `--tail=50`])
    )
    Logger.stdout(`${output || error || `(no logs)`}\n`)
  }
}

/**
 * Restores each service to its previously recorded image and re-verifies.
 * A rollback can fail transiently (the same class of flakiness that failed
 * the initial rollout) so it is retried up to `attempts` times before being
 * declared unrecoverable.
 */
export const rollback = async (
  props: TTaskActionArgs,
  previous: TPreviousImages,
  attempts: number = ROLLBACK_ATTEMPTS
): Promise<boolean> => {
  if (!previous || !Object.keys(previous).length) {
    Logger.error(
      `  No previous image data available — cannot roll back automatically. Manual intervention required.`
    )
    return false
  }

  for (let attempt = 1; attempt <= attempts; attempt++) {
    for (const { ctx, deployment } of services(props)) {
      const image = previous[ctx]
      if (!image) continue
      Logger.pair(`  Rolling back`, `${deployment} → ${image}`)
      await capture(
        `kubectl`,
        kctl(props, [
          `set`,
          `image`,
          `deployment/${deployment}`,
          `${deployment}=${image}`,
        ])
      )
    }

    const rolled = await waitForRollout(props)
    const healthy = await healthCheck(props, true)

    if (rolled && healthy) return true

    if (attempt < attempts)
      Logger.warn(
        `  Rollback attempt ${attempt}/${attempts} did not recover — retrying...`
      )
  }

  return false
}

/**
 * Records whether the rollback fully recovered as a `rollback_failed` GitHub
 * Actions step output, so the deploy workflow can escalate (open a health
 * issue) when the automatic rollback itself did not restore service. A no-op
 * outside of Actions (`GITHUB_OUTPUT` unset) or if the file can't be written —
 * this is a best-effort signal and must never fail the deploy itself.
 */
export const writeRollbackOutcome = (recovered: boolean): void => {
  const outputPath = process.env.GITHUB_OUTPUT
  if (!outputPath) return

  try {
    fs.appendFileSync(outputPath, `rollback_failed=${recovered ? `false` : `true`}\n`)
  } catch (err) {
    Logger.warn(`  Could not write rollback outcome to GITHUB_OUTPUT: ${err}`)
  }
}

/**
 * Waits for rollout + runs health checks. On failure, captures logs, rolls
 * back to `previous` images, and aborts the deploy with a non-zero exit.
 */
export const verifyOrRollback = async (
  props: TTaskActionArgs,
  previous: TPreviousImages
): Promise<void> => {
  const rolled = await waitForRollout(props)
  const healthy = rolled && (await healthCheck(props, true))

  if (healthy) {
    Logger.success(`  Health checks passed.`)
    return
  }

  Logger.error(`  Health checks FAILED — capturing logs and rolling back...`)
  await captureLogs(props)

  const recovered = await rollback(props, previous)
  writeRollbackOutcome(recovered)
  recovered
    ? Logger.warn(
        `  Rolled back to the previous release. Investigate the failure before redeploying.`
      )
    : Logger.error(`  Rollback did not fully recover — manual intervention required.`)

  taskError(`Deployment failed health checks (rolled back). See logs above.`)
}
