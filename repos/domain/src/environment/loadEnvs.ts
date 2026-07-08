import hq from 'alias-hq'
import { homedir } from 'os'
import path from 'node:path'
import { addToProcess } from './addToProcess'
import { loadConfigs } from '@keg-hub/parse-config'
import { emptyArr } from '@keg-hub/jsutils/emptyArr'
import { omitKeys } from '@keg-hub/jsutils/omitKeys'

/**
 * Alias map resolved lazily on first use — a top-level `hq.get()` call is a
 * module side effect that (a) reads the filesystem at import time and (b)
 * defeats bundler tree-shaking for every consumer of the domain barrel that
 * never calls loadEnvs (e.g. the self-contained resident runtime bundle).
 */
let __ALIASES__: Record<string, string>
const getAliases = () => {
  __ALIASES__ ??= hq.get(`webpack`)
  return __ALIASES__
}

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
        getAliases()[`@ROOT`],
        path.join(getAliases()[`@ROOT`], `deploy`),
        path.join(homedir(), `.config/tdsk`),
        ...locations,
      ],
      ...envOpts,
    })

  // Ensure node ENV is set is it doesn't exist
  if (!process.env.NODE_ENV)
    process.env.NODE_ENV = (__LOADED_ENVS__.NODE_ENV || env || `local`) as string

  const toAdd = ignore?.length ? omitKeys(__LOADED_ENVS__, ignore) : __LOADED_ENVS__

  addToProcess(toAdd, {
    ignore,
    force: override || (env === 'local' && override !== false),
  })

  return __LOADED_ENVS__
}
