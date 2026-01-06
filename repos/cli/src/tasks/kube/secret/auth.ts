import type { TTask, TTaskActionArgs } from '@TSCL/types'

import { Logger } from '@tdsk/logger'
import { taskError } from '@TSCL/utils/tasks/error'
import { auth as docAuth } from '@TSCL/utils/docker/auth'

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
const docAuthAct = async (props: TTaskActionArgs) => {
  const { params, tasks, config } = props
  const secretTask = tasks?.kube?.tasks?.secret
  !secretTask &&
    taskError(
      `The "kube.tasks.secret" task can not be found. Ensure it exists before running this command`
    )

  const { token: pToken, user: pUser, ...secParams } = params

  const creds = docAuth(props)
  // Get the user name in the same way docker and devspace do
  const envs = config.envs
  const user = pUser || creds.user
  user && params.log && Logger.pair(`Found value for secret user`, user)

  // Get the auth token in the same way docker and devspace do
  const token = pToken || creds.password
  const hidden = `${token.slice(0, 2 - token.length)}${token
    .slice(2, token.length)
    .split('')
    .map(() => '*')
    .join('')}`
  token && params.log && Logger.pair(`Found value for secret token`, hidden)

  if (!token || !user)
    return taskError(
      `A user name and password is required to create a docker auth secret`
    )

  await secretTask.action({
    ...props,
    params: {
      ...secParams,
      secrets: `user:${user},password:${token}`,
      name: envs.TDSK_KUBE_SCRT_DOC_AUTH || `docker-auth`,
    },
  })
}

export const auth: TTask = {
  name: `auth`,
  action: docAuthAct,
  alias: [`auth`, `doc`, `docauth`, `docAuth`, `da`],
  example: `pnpm kube secrets auth <options>`,
  description: `Calls the kubectl create secrets command with the docker-authentication`,
  options: {
    token: {
      alias: [`tok`],
      example: `--token ****`,
      description: `Custom login token for the active git user, defaults to resolved NPM token`,
    },
    log: {
      default: true,
      type: `boolean`,
      description: `Log the task output`,
    },
  },
}
