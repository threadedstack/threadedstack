import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pkg = require('../../package.json')

export const TDSK_REPL_VERSION = pkg.version

// Keep backward-compatible alias
export const Version = pkg.version

// Paths
export const CONFIG_DIR = join(process.env.HOME || '~', '.config', 'tdsk', 'repl')
export const CONFIG_PATH = join(CONFIG_DIR, 'config.yaml')
export const HISTORY_PATH = join(CONFIG_DIR, 'history')

// Project context
export const PROJECT_DIR = '.tdsk'
export const PROJECT_CONFIG = '.tdsk/config.yaml'
export const CONTEXT_DIR = '.tdsk/context'
export const AGENTS_FILE = 'AGENTS.md'

// Defaults
export const DEFAULT_PROXY_URL = 'https://px.local.threadedstack.app'
export const DEFAULT_MAX_STEPS = 10
export const DEFAULT_MAX_HISTORY = 50
export const DEFAULT_SANDBOX_TIMEOUT = 300000
export const DEFAULT_THEME = 'dark' as const

// Retry
export const MAX_RETRIES = 3
export const RETRY_DELAYS = [1000, 3000, 9000]
