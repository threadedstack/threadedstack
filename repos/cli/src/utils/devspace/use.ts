import type { TTaskActionArgs } from '@TSCL/types'
import { taskError } from '@TSCL/utils/tasks/error'
import { getKubeMeta } from '@TSCL/utils/kube/getKubeMeta'

export const namespace = (props: TTaskActionArgs, throwErr: boolean = true) => {
  const meta = getKubeMeta(props, throwErr)
  if (!meta.namespace) {
    taskError(`Kubernetes namespace could not be resolved!`)
    return []
  }

  return [`use`, `namespace`, meta.namespace]
}

export const context = (props: TTaskActionArgs, throwErr: boolean = true) => {
  const meta = getKubeMeta(props, throwErr)
  if (!meta.context) {
    taskError(`Kubernetes context could not be resolved!`)
    return []
  }

  return [`use`, `context`, meta.context]
}
