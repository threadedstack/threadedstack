import type { TTask, TTaskAction } from '@TSCL/types'

import { kubectl } from '@TSCL/utils/kube/kubectl'
import { getKubeMeta } from '@TSCL/utils/kube/getKubeMeta'

/**
 * List kubernetes secrets in the target namespace
 * Filters out helm release secrets by default for cleaner output
 */
const listAction: TTaskAction = async (args) => {
  const { params } = args
  const meta = getKubeMeta(args, false)
  const nsArgs = meta.namespace ? [`--namespace`, meta.namespace] : []

  await kubectl.ensureContext(args, [])

  const getArgs = [`get`, `secrets`, ...nsArgs]
  if (!params.all) getArgs.push(`--field-selector`, `type!=helm.sh/release.v1`)
  if (params.output) getArgs.push(`-o`, params.output)

  await kubectl({ output: true, args: getArgs })
}

export const list: TTask = {
  name: `list`,
  alias: [`ls`, `show`],
  action: listAction,
  example: `pnpm tdsk kube secret list --env production`,
  description: `List kubernetes secrets in the target namespace`,
  options: {
    namespace: {
      alias: [`ns`],
      description: `Kubernetes namespace`,
    },
    output: {
      alias: [`o`, `out`],
      description: `Output format (json, yaml, wide)`,
    },
    all: {
      type: `boolean`,
      description: `Include helm release secrets in output`,
    },
    log: {
      type: `boolean`,
      description: `Log command before it is run`,
    },
  },
}
