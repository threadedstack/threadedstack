import type { ISandboxProvider, TSandboxProviderType } from '@tdsk/domain'

import { E2bSandboxProvider } from './e2b'
import { LocalSandboxProvider } from './local'

const providers = new Map<TSandboxProviderType, () => ISandboxProvider>([
  [`e2b`, () => new E2bSandboxProvider()],
  [`local`, () => new LocalSandboxProvider()],
])

/**
 * Create a sandbox provider by type
 * Extensible - add new providers to the map above
 */
export const createSandboxProvider = (type: TSandboxProviderType): ISandboxProvider => {
  const factory = providers.get(type)
  if (!factory) {
    throw new Error(`Unknown sandbox provider: ${type}`)
  }
  return factory()
}
