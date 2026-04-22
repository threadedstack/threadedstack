import type { TEnvFilter, TEnvObject } from '@TSCL/types'

import { exists } from '@keg-hub/jsutils'

/**
 * Filters ENVs by both adding and remove them based on defined constants
 * Loops through the current process.env Keys, and checks if they should be removed
 * Uses the envFilter constants defined in the tasks/constants folder
 * @returns {TEnvObject}
 */
export const filterEnvs = (filters: TEnvFilter, envs: TEnvObject) => {
  const { starts, contains, ends, exclude } = filters

  return Object.entries(envs).reduce((acc, [key, val]) => {
    if (exclude.includes(key) || !exists(val)) return acc

    starts.map((start) => {
      if (!key.startsWith(start)) return
      acc[key] = envs[key]
    })

    contains.map((contain) => {
      if (!key.includes(contain)) return
      acc[key] = envs[key]
    })

    ends.map((ends) => {
      if (!key.endsWith(ends)) return
      acc[key] = envs[key]
    })

    return acc
  }, {} as TEnvObject)
}
