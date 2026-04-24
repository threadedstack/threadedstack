import type { TTask, TTaskAction } from '@TSCL/types'

import { kubectl } from '@TSCL/utils/kube/kubectl'
import { sharedOpts } from '@TSCL/utils/tasks/options'
import { getKubeMeta } from '@TSCL/utils/kube/getKubeMeta'

const statusAct: TTaskAction = async (args) => {
  const { params } = args
  const meta = getKubeMeta(args)

  const nsArgs = meta.namespace ? [`--namespace`, meta.namespace] : []

  await kubectl.ensureContext(args, [])

  const output = params?.output || `wide`
  await kubectl({
    log: params?.log,
    output: true,
    args: [`get`, `pods,svc`, `-o`, output, ...nsArgs],
  })
}

export const status: TTask = {
  name: `status`,
  alias: [`st`, `stat`],
  action: statusAct,
  example: `tdsk deploy status --env production`,
  description: `Show pod and service status for the target Kubernetes cluster`,
  options: {
    log: sharedOpts.shared.log,
    namespace: sharedOpts.devspace.namespace,
    kubeContext: sharedOpts.devspace.kubeContext,
    output: {
      alias: [`out`, `o`],
      default: `wide`,
      example: `--output json`,
      description: `Output format passed to kubectl (wide, json, yaml)`,
    },
  },
}
