import type { V1Pod } from '@kubernetes/client-node'

export type TKubeEventHandlers = {
  added?: (pod: V1Pod) => void
  modified?: (pod: V1Pod) => void
  deleted?: (pod: V1Pod) => void
  bookmark?: (pod: V1Pod) => void
  error?: (err: any) => void
}

export type TKubeClientConfig = {
  namespace?: string
  inCluster?: boolean
}
