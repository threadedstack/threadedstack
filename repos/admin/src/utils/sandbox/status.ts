import { ESBState } from '@tdsk/domain'

export const statusColor = (state?: ESBState | string) => {
  switch (state) {
    case ESBState.Running:
      return `success`
    case ESBState.Starting:
      return `warning`
    case ESBState.Error:
      return `error`
    default:
      return `default`
  }
}
