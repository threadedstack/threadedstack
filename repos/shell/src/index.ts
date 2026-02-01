// Main Shell class
export { Shell } from './shell'

// Types
export type {
  TShellCfg,
  TShellOptions,
  TExecutionResult,
  TShellStreams,
  TShellState,
} from './types'
export { EPlatform } from './types'

// Utilities
export {
  logger,
  detectPlatform,
  getHomeDir,
  isBrowser,
  isNode,
  isBun,
  createFileSystem,
  validateFileSystem,
  StreamManager,
  createStreamManager,
} from './utils'

// Constants
export * from './constants'
