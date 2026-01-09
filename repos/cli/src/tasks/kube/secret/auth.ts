import type { TTask, TTaskActionArgs } from '@TSCL/types'

import { Logger } from '@tdsk/logger'
import { taskError } from '@TSCL/utils/tasks/error'

/**
 * Add kubernetes auth config secret for tdsk-auth-cfg
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
const authAct = async (props: TTaskActionArgs) => {
  const { params, tasks, config } = props
  const secretTask = tasks?.kube?.tasks?.secret
  !secretTask &&
    taskError(
      `The "kube.tasks.secret" task can not be found. Ensure it exists before running this command`
    )

  const { clientId, clientSecret, ...secParams } = params

  const cfg = {
    clientId: clientId || config.envs.TDSK_AUTH_CLIENT_ID,
    clientSecret: clientSecret || config.envs.TDSK_AUTH_CLIENT_SECRET,
  }

  ;(!cfg.clientId || !cfg.clientSecret) &&
    taskError(`An auth clientId and clientSecret are required!`)

  params.log && Logger.pair(`Found valid auth config values`)

  await secretTask.action({
    ...props,
    params: {
      ...secParams,
      name: config.envs.TDSK_KUBE_SCRT_AUTH_CFG || `tdsk-auth-cfg`,
      secrets: Object.entries(cfg)
        .map(([key, value]) => `${key}:${value}`)
        .join(`,`),
    },
  })
}

export const auth: TTask = {
  name: `auth`,
  alias: [`au`],
  action: authAct,
  example: `pnpm kube secrets auth <options>`,
  description: `Creates a kubernetes secret for the auth config`,
  options: {
    id: {
      alias: [`clientId`],
      env: `TDSK_AUTH_CLIENT_ID`,
      description: `Auth client ID`,
    },
    secret: {
      alias: [`clientSecret`, `sec`],
      env: `TDSK_AUTH_CLIENT_SECRET`,
      description: `Auth client secret`,
    },
    log: {
      default: true,
      type: `boolean`,
      description: `Log the task output`,
    },
  },
}
