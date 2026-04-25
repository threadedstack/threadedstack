import type { TTask, TTaskAction } from '@TSCL/types'

import { kubectl } from '@TSCL/utils/kube/kubectl'
import { taskError } from '@TSCL/utils/tasks/error'

/**
 * Describes a Kubernetes pod based on the passed context
 * @function
 * @public
 * @returns {Void}
 */
const podAction: TTaskAction = async (args) => {
  const { params } = args
  const { context, name, namespace, output } = params

  const describeArgs: string[] = []
  namespace && describeArgs.push(`--namespace`, namespace)
  output && describeArgs.push(`--output`, output)

  if (name) await kubectl.describePod(args, [name, ...describeArgs])
  else if (context) {
    const pod = await kubectl.getPod(args, context)
    !pod && console.error(`No pod found matching context: ${context}`)

    const podName = pod?.metadata?.name
    !podName && console.error(`Could not determine pod name from context`)

    await kubectl.describePod(args, [podName, ...describeArgs])
  } else {
    taskError(`Either 'name' or 'context' parameter is required`)
  }
}

export const pod: TTask = {
  name: `pod`,
  alias: [`pods`, `po`, `describe`],
  action: podAction,
  example: `tdsk kube pod <options>`,
  description: `Describes a Kubernetes pod based on the passed context or name`,
  options: {
    context: {
      example: `--context my-app`,
      alias: [`ctx`, `label`, `match`],
      description: `Context/label to find the pod (searches pod labels)`,
    },
    name: {
      alias: [`n`, `pod`],
      example: `--name my-pod`,
      description: `Name of the pod to describe`,
    },
    namespace: {
      alias: [`ns`],
      description: `Namespace of the pod`,
      example: `--namespace my-namespace`,
    },
    output: {
      description: `Output format (json, yaml, wide)`,
      example: `--output json`,
      alias: [`o`],
    },
    log: {
      type: `boolean`,
      description: `Log command before it is run`,
    },
  },
}
