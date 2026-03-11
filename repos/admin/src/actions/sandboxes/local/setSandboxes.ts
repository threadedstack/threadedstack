import type { Sandbox } from '@tdsk/domain'
import { setSandboxes as setSandboxesState } from '@TAF/state/accessors'

export const setSandboxes = (sandboxes: Sandbox[]) => {
  const map = sandboxes.reduce(
    (acc, s) => {
      acc[s.id] = s
      return acc
    },
    {} as Record<string, Sandbox>
  )

  setSandboxesState(map)
}
