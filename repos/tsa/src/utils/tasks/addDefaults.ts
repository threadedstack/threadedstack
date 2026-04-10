import type { TTask, TTsaConfig } from '@TSA/types'

/**
 * Inject config defaults into task option definitions
 * argsParse uses each option's `default` as the fallback when the flag is absent
 */
export const addDefaults = (task: TTask, config: TTsaConfig) => {
  const options = { ...task.options }
  if (config) {
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined && options[key])
        options[key] = { ...options[key], default: value }
    }
  }

  return options
}
