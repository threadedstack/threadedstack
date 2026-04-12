import { getSandboxes, setSandboxes } from '@TAF/state/accessors'

export const removeSandbox = (id: string) => {
  const all = getSandboxes() || {}
  const updated: typeof all = {}
  for (const [key, scope] of Object.entries(all)) {
    const { [id]: _, ...rest } = scope
    updated[key] = rest
  }
  setSandboxes(updated)
}
