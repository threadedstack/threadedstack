import { loadConfigs } from '@keg-hub/parse-config'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

let __loaded: Record<string, string> | undefined

/**
 * Load environment variables from values.yaml files and add to process.env.
 * Same pattern as domain/src/environment/loadEnvs.ts but without alias-hq dependency.
 *
 * Config loading order (later overrides earlier):
 *   1. <root>/values.yaml
 *   2. <root>/deploy/values.yaml
 *   3. <root>/deploy/values.local.yaml (when NODE_ENV=local)
 *   4. ~/.config/tdsk/values.yaml
 */
export const loadEnvs = (opts?: { force?: boolean }) => {
  if (__loaded && !opts?.force) return __loaded

  const root = resolve(process.cwd(), '../..')

  __loaded = loadConfigs({
    env: process.env.NODE_ENV || 'local',
    name: 'tdsk',
    locations: [
      root,
      join(root, 'deploy'),
      join(homedir(), '.config/tdsk'),
    ],
  })

  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = __loaded.NODE_ENV || 'local'
  }

  // Add to process.env — don't override existing values
  for (const [key, value] of Object.entries(__loaded)) {
    if (value != null && !process.env[key]) {
      process.env[key] = String(value)
    }
  }

  return __loaded
}
