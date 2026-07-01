import type { TTaskActionArgs } from '@TSCL/types'

import { Logger } from '@tdsk/logger'
import { capture } from '@TSCL/utils/proc/capture'
import { taskError } from '@TSCL/utils/tasks/error'
import { getKubeMeta } from '@TSCL/utils/kube/getKubeMeta'

export type TPreflightOpts = {
  /** Whether the DB schema push step will run this deploy */
  db?: boolean
  /** Whether Firebase frontend deploys are part of this run */
  firebase?: boolean
}

/**
 * ENVs the LOCAL release flow reads directly. Everything else (master key,
 * JWT, service role, payments, email) lives in the already-created K8s secrets
 * and does not need to be present in ~/.config/tdsk/values.yaml for an update
 * deploy. The essential K8s secrets check below verifies the cluster side.
 */
const DB_PUSH_ENVS = [`TDSK_DB_URL`, `TDSK_DB_USER`, `TDSK_DB_PASS`]

/** K8s secrets the deployment cannot start without (master key, DB, image pull) */
const essentialSecrets = (config: TTaskActionArgs[`config`]): string[] => [
  config.envs.TDSK_KUBE_SCRT_MASTER_KEY || `tdsk-master-key`,
  config.envs.TDSK_KUBE_SCRT_DB_CFG || `tdsk-db-cfg`,
  config.envs.TDSK_KUBE_SCRT_DOC_PULL || `docker-auth-pull`,
]

/**
 * Fails fast (before any cluster mutation) when deploy prerequisites are
 * missing: an unreachable kube-context, absent secret ENVs, missing essential
 * K8s secrets, or (when deploying frontends) no firebase CLI. Aggregates all
 * problems into a single actionable error.
 */
export const preflight = async (
  props: TTaskActionArgs,
  opts: TPreflightOpts = {}
): Promise<void> => {
  const { config } = props
  const meta = getKubeMeta(props, false)
  const namespace = meta.namespace || `tdsk-production`
  const errors: string[] = []

  Logger.pair(`[preflight]`, `Checking deploy prerequisites...`)

  // 1. Kube-context can reach the target namespace
  const nsCheck = await capture(`kubectl`, [
    ...(meta.context ? [`--context`, meta.context] : []),
    `get`,
    `ns`,
    namespace,
  ])
  if (nsCheck.code !== 0)
    errors.push(
      [
        `Kube-context "${meta.context}" cannot reach namespace "${namespace}".`,
        `    Merge the cluster kubeconfig, e.g.:`,
        `      KUBECONFIG=~/.kube/config:.temp/civo-tdsk-kubeconfig.yaml \\`,
        `        kubectl config view --flatten > ~/.kube/config.merged && \\`,
        `        mv ~/.kube/config.merged ~/.kube/config`,
        `    then verify:  kubectl --context ${meta.context} get ns ${namespace}`,
      ].join(`\n`)
    )

  // 2. ENVs the LOCAL release reads (only checked when actually needed)
  if (opts.db) {
    const missingEnvs = DB_PUSH_ENVS.filter((key) => !config.envs[key])
    if (missingEnvs.length)
      errors.push(
        `Missing DB connection ENVs in ~/.config/tdsk/values.yaml (needed to push schema): ${missingEnvs.join(`, `)}`
      )
  }

  // 3. Essential K8s secrets exist (only checkable when the context is reachable)
  if (nsCheck.code === 0) {
    for (const name of essentialSecrets(config)) {
      const { code } = await capture(`kubectl`, [
        ...(meta.context ? [`--context`, meta.context] : []),
        ...(meta.namespace ? [`-n`, meta.namespace] : []),
        `get`,
        `secret`,
        name,
      ])
      if (code !== 0)
        errors.push(
          `Kubernetes secret "${name}" is missing in ${namespace}. Create secrets with:` +
            ` tdsk kube secret <preset> --env ${process.env.NODE_ENV || `production`}`
        )
    }
  }

  // 4. Firebase CLI available when frontends are in scope
  if (opts.firebase) {
    const fb = await capture(`firebase`, [`--version`])
    if (fb.code !== 0)
      errors.push(
        `The "firebase" CLI is required to deploy frontends but was not found on PATH.` +
          ` Install it (npm i -g firebase-tools) and run "firebase login".`
      )
  }

  if (errors.length)
    taskError(`Preflight checks failed:\n\n  - ${errors.join(`\n\n  - `)}\n`)

  Logger.success(`  Preflight checks passed.`)
}
