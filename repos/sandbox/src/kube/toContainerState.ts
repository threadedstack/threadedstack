import { EContainerState } from '@tdsk/domain'
import { ContainerStatesSet } from '@TSB/constants/kube'

export const toContainerState = (phase?: string): EContainerState => {
  if (phase && ContainerStatesSet.has(phase)) return phase as EContainerState
  return EContainerState.Unknown
}
