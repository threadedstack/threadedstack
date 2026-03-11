import { getSandboxes, setSandboxes } from '@TAF/state/accessors'

export const removeSandbox = (id: string) => {
  const current = getSandboxes() || {}
  const { [id]: _, ...rest } = current
  setSandboxes(rest)
}
