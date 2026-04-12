import type { Sandbox } from '@tdsk/domain'
import { getContextSandboxes, setContextSandboxes } from '@TAF/state/accessors'

export const upsertSandbox = (contextKey: string, sandbox: Sandbox) => {
  const current = getContextSandboxes(contextKey) || {}
  setContextSandboxes(contextKey, { ...current, [sandbox.id]: sandbox })
}
