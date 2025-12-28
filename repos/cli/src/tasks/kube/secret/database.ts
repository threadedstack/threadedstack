import type { TTask, TTaskActionArgs } from '@TSCL/types'

import { Logger } from '@tdsk/logger'
import { taskError } from '@TSCL/utils/tasks/error'

/**
 * Add kubernetes database config secret for tdsk-db-cfg
 * @param {Object} props - arguments passed from the runTask method
 * @param {string} props.command - Root task name
 * @param {Object} props.tasks - All registered tasks of the CLI
 * @param {string} props.task - Task Definition of the task being run
 * @param {Array} props.options - arguments passed from the command line
 * @param {Object} props.globalConfig - Global config object for the keg-cli
 * @param {Object} props.params - Passed in options, converted into an object
 *
 * @returns {void}
 */
const databaseAct = async (props:TTaskActionArgs) => {
  const { params, tasks, config } = props
  const secretTask = tasks?.kube?.tasks?.secret
  !secretTask &&
    taskError(`The "kube.tasks.secret" task can not be found. Ensure it exists before running this command`)

  const {
    url,
    name,
    key,
    jwt,
    role,
    type,
    ...secParams
  } = params
  

  const cfg = {
    url: url || config.envs.TDSK_DB_URL,
    type: type || config.envs.TDSK_DB_TYPE,
    name: name || config.envs.TDSK_DB_NAME,
    key: key || config.envs.TDSK_DB_PUBLIC_KEY,
    jwt: jwt || config.envs.TDSK_DB_JWT_SCRT,
    role: role || config.envs.TDSK_DB_SRV_ROLE,
  }

  ;(!cfg.url || !cfg.name || !cfg.key || !cfg.jwt || !cfg.role)
    && taskError(`The path to a firebase service-account JSON file is required`)

  params.log && Logger.pair(`Found valid database config values`)

  await secretTask.action({
    ...props,
    params: {
      ...secParams,
      name: config.envs.TDSK_KUBE_SCRT_DB_CFG || `tdsk-db-cfg`,
      secrets: Object.entries(cfg)
        .map(([key, value]) => `${key}:${value}`)
        .join(`,`)
    }
  })
}

export const database:TTask = {
  name: `database`,
  alias: [`db`],
  action: databaseAct,
  example: `pnpm kube secrets db <options>`,
  description: `Creates a kubernetes secret for the database config`,
  options: {
    type: {
      env: `TDSK_DB_TYPE`,
      description: `Database type`,
    },
    url: {
      env: `TDSK_DB_URL`,
      description: `Database url`,
    },
    name: {
      env: `TDSK_DB_NAME`,
      description: `Name of the database`,
    },
    key: {
      env: `TDSK_DB_PUBLIC_KEY`,
      description: `Public key used for connecting to the database`,
    },
    jwt: {
      env: `TDSK_DB_JWT_SCRT`,
      description: `JWT authentication token`,
    },
    role: {
      env: `TDSK_DB_SRV_ROLE`,
      description: `Service role authentication token`,
    },
    log: {
      default: true,
      type: `boolean`,
      description: `Log the task output`,
    },
  },
}
