import type { ISandboxProvider, TSandboxType } from '@tdsk/domain'

import { ESandboxType } from '@tdsk/domain'
import { LocalSandboxProvider } from './local'

const providers = new Map<TSandboxType, () => ISandboxProvider>([
  [ESandboxType.local, () => new LocalSandboxProvider()],
])

/**
 * Create a sandbox provider by type
 * Extensible - add new providers to the map above
 */
export const createSandboxProvider = (type: TSandboxType): ISandboxProvider => {
  const factory = providers.get(type)
  if (!factory) {
    throw new Error(`Unknown sandbox provider: ${type}`)
  }
  return factory()
}
