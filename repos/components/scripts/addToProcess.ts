import { isNum } from '@keg-hub/jsutils/isNum'
import { isStr } from '@keg-hub/jsutils/isStr'
import { exists } from '@keg-hub/jsutils/exists'

/**
 * Loop over the passed in ENVs, and add them to the current process
 * Add them to the process.env if they don't already exist or force argument is true
 * @param {Object} addEnvs - Envs to add to the current process
 * @param {Boolean} force - Force add the env, even if it already exists
 *
 * @returns {Void}
 */
export const addToProcess = (addEnvs: Record<string, unknown>, force?: boolean): void => {
  Object.entries(addEnvs).map(([key, value]) => {
    if (!exists(value) || (exists(process.env[key]) && !force)) return

    process.env[key] = <string>(
      (isStr(value) || isNum(value) ? value : JSON.stringify(value))
    )
  })
}
