import type { Sandbox } from '@tdsk/domain'
import { getSandboxes, setSandboxes } from '@TAF/state/accessors'

export const upsertSandbox = (sandbox: Sandbox) => {
  const current = getSandboxes() || {}
  setSandboxes({ ...current, [sandbox.id]: sandbox })
}
