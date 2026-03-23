import hq from 'alias-hq'
import path from 'node:path'
import { homedir } from 'node:os'
import { addToProcess } from './addToProcess'
import { loadConfigs } from '@keg-hub/parse-config'

const { NODE_ENV } = process.env

const nodeEnv = NODE_ENV || `local`
const aliases = hq.get(`webpack`)

export type TLoadEnvs = {
  name?: string
  env?: string
  force?: boolean
  noEnv?: boolean
  processAdd?: boolean
  locations?: string[]
}

export const loadEnvs = (args: TLoadEnvs) => {
  const { force, processAdd, name = `tdsk`, locations = [], env = nodeEnv } = args

  const envs = loadConfigs({
    env,
    name,
    locations: [
      ...locations,
      /*
       * Use `webpack` because it returns the full resolved path un-modified
       * Allows searching for envs form the repo root directory
       * **NOT** the `repos/backend` directory
       * This allows loading the `<root>/deploy/value.yml` file
       */
      aliases[`@ROOT`],
      path.join(aliases[`@ROOT`], `deploy`),
      path.join(homedir(), `.config/tdsk`),
    ],
  })

  /*
   * Load the config files from `<root>/configs` directory, then add to the process.
   */
  processAdd !== false && addToProcess(envs, force)

  return envs
}
