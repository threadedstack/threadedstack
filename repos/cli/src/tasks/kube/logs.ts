import type { TTask, TTaskAction } from '@TSCL/types'

import { kubectl } from '@TSCL/utils/kube/kubectl'
import { getCtx } from '@TSCL/utils/config/getCtx'
import { taskError } from '@TSCL/utils/tasks/error'
import { getKubeMeta } from '@TSCL/utils/kube/getKubeMeta'

/**
 * View logs for a kubernetes pod by context or name
 */
const logsAction: TTaskAction = async (args) => {
  const { params } = args
  const meta = getKubeMeta(args, false)
  const nsArgs = meta.namespace ? [`--namespace`, meta.namespace] : []

  const logArgs: string[] = []
  if (params.follow) logArgs.push(`--follow`)
  if (params.tail) logArgs.push(`--tail`, `${params.tail}`)
  if (params.previous) logArgs.push(`--previous`)

  if (params.name) {
    await kubectl.ensureContext(args, [])
    await kubectl({ output: true, args: [`logs`, params.name, ...nsArgs, ...logArgs] })
  } else {
    const ctx = getCtx(args)
    !ctx && taskError(`Either 'context' or 'name' parameter is required`)
    await kubectl.ensureContext(args, [])
    await kubectl({
      output: true,
      args: [`logs`, `deploy/${ctx.deployment}`, ...nsArgs, ...logArgs],
    })
  }
}

export const logs: TTask = {
  name: `logs`,
  alias: [`log`, `lg`],
  action: logsAction,
  example: `pnpm tdsk kube logs --context proxy --env production`,
  description: `View logs for a kubernetes pod by context or name`,
  options: {
    context: {
      alias: [`ctx`],
      example: `--context proxy`,
      description: `Context to resolve the deployment (proxy, backend, caddy)`,
    },
    name: {
      alias: [`n`, `pod`],
      example: `--name tdsk-proxy-abc123`,
      description: `Exact pod name to view logs for`,
    },
    namespace: {
      alias: [`ns`],
      description: `Kubernetes namespace`,
    },
    follow: {
      type: `boolean`,
      alias: [`f`],
      description: `Stream logs in real time`,
    },
    tail: {
      alias: [`t`, `lines`],
      default: `50`,
      description: `Number of recent log lines to show`,
    },
    previous: {
      type: `boolean`,
      alias: [`prev`, `p`],
      description: `Show logs from the previous container instance (useful for crash debugging)`,
    },
    log: {
      type: `boolean`,
      description: `Log command before it is run`,
    },
  },
}
