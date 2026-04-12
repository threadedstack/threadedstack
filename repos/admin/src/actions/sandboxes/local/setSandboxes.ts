import type { Sandbox } from '@tdsk/domain'
import { setContextSandboxes } from '@TAF/state/accessors'

export const setSandboxes = (contextKey: string, sandboxes: Sandbox[]) => {
  const map = Object.fromEntries(sandboxes.map((s) => [s.id, s])) as Record<
    string,
    Sandbox
  >
  setContextSandboxes(contextKey, map)
}
