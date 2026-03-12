import type { TTask, TTaskActionArgs } from '@TSCL/types'

import { Logger } from '@tdsk/logger'
import { taskError } from '@TSCL/utils/tasks/error'

/**
 * Log the output of a running kubernetes pod
 * @param {Object} args - arguments passed from the runTask method
 * @param {string} args.command - Root task name
 * @param {Object} args.tasks - All registered tasks of the CLI
 * @param {string} args.task - Task Definition of the task being run
 * @param {Array} args.options - arguments passed from the command line
 * @param {Object} args.globalConfig - Global config object for the keg-cli
 * @param {Object} args.params - Passed in options, converted into an object
 *
 * @returns {void}
 */
const tdskAuthAct = async (props: TTaskActionArgs) => {
  const { params, tasks, config } = props
  const secretTask = tasks?.kube?.tasks?.secret
  !secretTask &&
    taskError(
      `The "kube.tasks.secret" task can not be found. Ensure it exists before running this command`
    )

  const { token: tToken, ...secParams } = params
  const envs = config.envs

  const token = tToken || envs.TDSK_MASTER_KEY
  const hidden = token.slice(0, 2) + '*'.repeat(Math.max(0, token.length - 2))
  token && params.log && Logger.pair(`Found value for token`, hidden)

  if (!token) return taskError(`A token is required to create a tdsk secret`)

  await secretTask.action({
    ...props,
    params: {
      ...secParams,
      secrets: `token:${token}`,
      name: envs.TDSK_KUBE_SCRT_MASTER_KEY || `tdsk-master-key`,
    },
  })
}

export const tdsk: TTask = {
  name: `tdsk`,
  action: tdskAuthAct,
  alias: [`ts`],
  example: `tdsk kube secrets ts <options>`,
  description: `Calls the kubectl create secrets command with the tdsk token`,
  options: {
    token: {
      alias: [`tok`],
      example: `--token ****`,
      description: `Custom tdsk secrets token`,
    },
    log: {
      default: true,
      type: `boolean`,
      description: `Log the task output`,
    },
  },
}
