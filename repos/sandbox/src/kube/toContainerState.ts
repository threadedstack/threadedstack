import type { V1Pod } from '@kubernetes/client-node'
import { EContainerState } from '@tdsk/domain'
import { ContainerStatesSet } from '@TSB/constants/kube'

export const toContainerState = (phase?: string): EContainerState => {
  if (phase && ContainerStatesSet.has(phase)) return phase as EContainerState
  return EContainerState.Unknown
}

export const getTerminationReason = (pod: V1Pod): string | undefined => {
  const statuses = pod.status?.containerStatuses
  if (!statuses?.length) return undefined

  const terminated = statuses[0]?.lastState?.terminated ?? statuses[0]?.state?.terminated
  return terminated?.reason
}
