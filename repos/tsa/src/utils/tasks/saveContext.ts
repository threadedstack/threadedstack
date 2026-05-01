import type { TTsaConfig } from '@TSA/types'

import { ConfigService } from '@TSA/services/config'

export const saveContext = (
  config: TTsaConfig,
  orgId: string,
  projectId: string,
  sandboxId?: string,
  agentId?: string
): void => {
  const updates: Partial<TTsaConfig> = {}

  if (orgId !== config.org) {
    updates.org = orgId
    updates.agent = agentId
    updates.project = projectId
    updates.sandbox = sandboxId
  } else if (projectId !== config.project) {
    updates.agent = agentId
    updates.project = projectId
    updates.sandbox = sandboxId
  }

  if (sandboxId && sandboxId !== config.sandbox) updates.sandbox = sandboxId

  if (agentId && agentId !== config.agent) updates.agent = agentId

  if (Object.keys(updates).length === 0) return

  try {
    ConfigService.saveGlobal({ ...config, ...updates })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`Warning: failed to save config: ${msg}\n`)
  }
}
