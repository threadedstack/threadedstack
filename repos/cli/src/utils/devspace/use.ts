import type { TTaskActionArgs } from '@TSCL/types'
import { getKubeMeta } from '@TSCL/utils/kube/getKubeMeta'

export const namespace = (props: TTaskActionArgs, throwErr: boolean = true) => {
  const meta = getKubeMeta(props, throwErr)
  return [`use`, `namespace`, meta.namespace]
}

export const context = (props: TTaskActionArgs, throwErr: boolean = true) => {
  const meta = getKubeMeta(props, throwErr)
  return [`use`, `context`, meta.context]
}
