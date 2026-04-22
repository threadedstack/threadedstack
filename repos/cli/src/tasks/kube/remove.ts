import type { TTask, TTaskAction } from '@TSCL/types'

import { kubectl } from '@TSCL/utils/kube/kubectl'
import { getCtx } from '@TSCL/utils/config/getCtx'
import { taskError } from '@TSCL/utils/tasks/error'
import { getKubeMeta } from '@TSCL/utils/kube/getKubeMeta'

/**
 * Deletes kubernetes resources
 * For pods, uses label selector to match the deployment (pod names have random suffixes)
 */
const removeAction: TTaskAction = async (args) => {
  const { params } = args
  const ctx = getCtx(args)
  !ctx && taskError(`Build context name is missing or invalid`)

  const { resource } = params
  !resource && taskError(`Resource type is required`)

  const meta = getKubeMeta(args, false)
  const nsArgs = meta.namespace ? [`--namespace`, meta.namespace] : []

  if (resource === `pod`) {
    await kubectl.delete.pod(args, [
      `-l`,
      `app.kubernetes.io/component=${ctx.deployment}`,
      ...nsArgs,
    ])
  } else {
    await kubectl.delete(args, [resource, ctx.deployment, ...nsArgs])
  }
}

export const remove: TTask = {
  name: `remove`,
  alias: [`rm`, `delete`],
  action: removeAction,
  example: `tdsk kube remove --context proxy --env production`,
  description: `Delete kubernetes resources (pods, services, deployments, etc.)`,
  options: {
    context: {
      alias: [`ctx`, `name`, `n`],
      required: true,
      example: `--context proxy`,
      description: `Context of the resource to delete`,
    },
    resource: {
      default: `pod`,
      alias: [`type`, `res`],
      example: `--resource pod`,
      description: `Type of resource to delete`,
    },
    namespace: {
      alias: [`ns`],
      description: `Kubernetes namespace`,
    },
    log: {
      type: `boolean`,
      description: `Log command before it is run`,
    },
  },
}
