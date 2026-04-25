import type { TTask, TTaskAction } from '@TSCL/types'
import { kubectl } from '@TSCL/utils/kube/kubectl'
import { getKubeMeta } from '@TSCL/utils/kube/getKubeMeta'

/**
 * Sets the active kubernetes context
 * @function
 * @public
 * @returns {Void}
 */
const setAction: TTaskAction = async (args) => {
  const { params } = args
  const { context } = params
  const meta = getKubeMeta({ ...args, params: { ...params, kubeContext: context } })

  !meta.context && console.error(`Kubernetes context is required`)

  await kubectl.setContext(args, [meta.context, `--namespace`, meta.namespace])
}

export const set: TTask = {
  name: `set`,
  alias: [`use`],
  action: setAction,
  example: `tdsk kube set <options>`,
  description: `Sets the active kubernetes context`,
  options: {
    context: {
      alias: [`ctx`, `name`],
      example: `--context my-context`,
      description: `Context name to set as active`,
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
