import type { Sandbox } from '@tdsk/domain'
import { setSandboxes as setSandboxesState } from '@TAF/state/accessors'

export const setSandboxes = (sandboxes: Sandbox[]) => {
  const map = Object.fromEntries(sandboxes.map((s) => [s.id, s])) as Record<
    string,
    Sandbox
  >
  setSandboxesState(map)
}
