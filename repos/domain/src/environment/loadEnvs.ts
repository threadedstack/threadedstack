import '../types/pc.types'
import hq from 'alias-hq'
import { homedir } from 'os'
import path from 'node:path'
import { addToProcess } from './addToProcess'
import { loadConfigs } from '@keg-hub/parse-config'
import { emptyArr } from '@keg-hub/jsutils/emptyArr'
import { omitKeys } from '@keg-hub/jsutils/omitKeys'

const aliases = hq.get(`webpack`)

/**
 * Cache holder for the loaded envs
 * @type {Object}
 */
let __LOADED_ENVS__: Record<string, string>

type TLoadEnvs = {
  env?: string
  name?: string
  force?: boolean
  ignore?: string[]
  override?: boolean
  locations?: string[]
  [key: string]: any
}

export const loadEnvs = (cfg: TLoadEnvs) => {
  const {
    force,
    override,
    name = `tdsk`,
    ignore = emptyArr,
    env = process.env.NODE_ENV || `local`,
    locations = emptyArr,
    ...envOpts
  } = cfg

  __LOADED_ENVS__ =
    (!force && __LOADED_ENVS__) ||
    loadConfigs({
      env,
      name,
      locations: [
        aliases[`@ROOT`],
        path.join(aliases[`@ROOT`], `deploy`),
        path.join(homedir(), `.config/tdsk`),
        ...locations,
      ],
      ...envOpts,
    })

  // Ensure node ENV is set is it doesn't exist
  if (!process.env.NODE_ENV)
    process.env.NODE_ENV = (__LOADED_ENVS__.NODE_ENV || env || `local`) as string

  // Use this as a temporary fix until cli-utils is updated
  const toAdd = ignore?.length ? omitKeys(__LOADED_ENVS__, ignore) : __LOADED_ENVS__

  // Add the loaded envs to process.env if override is set
  // Or env if local, and override is not explicitly set to false
  addToProcess(toAdd, {
    // ignore doesn't currently work, but will be added in next release of cli-utils
    // Adding now so it will work when it's updated
    ignore,
    force: override || (env === 'local' && override !== false),
  })

  return __LOADED_ENVS__
}
