import { exists } from '@keg-hub/jsutils/exists'
import { emptyObj } from '@keg-hub/jsutils/emptyObj'
import { emptyArr } from '@keg-hub/jsutils/emptyArr'

export type TAddProcOpts = {
  force?: boolean
  ignore?: string[]
}

/**
 * Loop over the passed in ENVs, and add them to the current process
 * Add them to the process.env if they don't already exist
 * @function
 * @param {Object} addEnvs - Envs to add to the current process
 * @param {Object} options - Configure out the envs are added
 * @param {Object} options.force - Force add the env, even if it already exists
 *
 * @returns {Void}
 */
export const addToProcess = (
  addEnvs: Record<string, any>,
  opts: TAddProcOpts = emptyObj
) => {
  const { force, ignore = emptyArr } = opts

  for (const [key, value] of Object.entries(addEnvs)) {
    if (!exists(value) || ignore.includes(key)) continue
    if (force || !exists(process.env[key])) process.env[key] = value
  }
}
