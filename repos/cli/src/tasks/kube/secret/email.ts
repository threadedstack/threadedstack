import type { TTask, TTaskActionArgs } from '@TSCL/types'

import { Logger } from '@tdsk/logger'
import { taskError } from '@TSCL/utils/tasks/error'
import { cleanColl } from '@keg-hub/jsutils/cleanColl'

/**
 * Add kubernetes email config secret for tdsk-db-cfg
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
const emailAct = async (props: TTaskActionArgs) => {
  const { params, tasks, config } = props
  const secretTask = tasks?.kube?.tasks?.secret
  !secretTask &&
    taskError(
      `The "kube.tasks.secret" task can not be found. Ensure it exists before running this command`
    )

  const { host, type, key, user, pass, port, secure, api, ...secParams } = params

  const cfg = {
    host: host || config.envs.TDSK_EMAIL_HOST || undefined,
    type: type || config.envs.TDSK_EMAIL_TYPE || undefined,
    user: user || config.envs.TDSK_EMAIL_USER || undefined,
    pass: pass || config.envs.TDSK_EMAIL_PASS || undefined,
    port: port || config.envs.TDSK_EMAIL_PORT || undefined,
    key: key || config.envs.TDSK_EMAIL_API_KEY || undefined,
    api: api || config.envs.TDSK_EMAIL_API_HOST || undefined,
    secure: secure || config.envs.TDSK_EMAIL_SECURE || undefined,
  }

  ;(!cfg.type || (!cfg.host && !cfg.api) || (!cfg.pass && !cfg.key)) &&
    taskError(`Missing email configuration`, undefined, cfg)

  params.log && Logger.pair(`Found valid email config values`)

  await secretTask.action({
    ...props,
    params: {
      ...secParams,
      name: config.envs.TDSK_KUBE_SCRT_EMAIL_CFG || `tdsk-email-secret`,
      secrets: Object.entries(cleanColl(cfg))
        .map(([key, value]) => `${key}:${value}`)
        .join(`,`),
    },
  })
}

export const email: TTask = {
  name: `email`,
  alias: [`em`],
  action: emailAct,
  example: `pnpm kube secrets pay <options>`,
  description: `Creates a kubernetes secret for the email config`,
  options: {
    type: {
      env: `TDSK_EMAIL_TYPE`,
      description: `Email processor type`,
    },
    host: {
      env: `TDSK_EMAIL_HOST`,
      description: `Email processor host url`,
    },
    user: {
      env: `TDSK_EMAIL_USER`,
      description: `Email processor auth user`,
    },
    pass: {
      env: `TDSK_EMAIL_PASS`,
      description: `Email processor auth password`,
    },
    api: {
      env: `TDSK_EMAIL_API_HOST`,
      description: `Email processor api url`,
    },
    key: {
      env: `TDSK_EMAIL_API_KEY`,
      description: `Email processor api key`,
    },
    secure: {
      env: `TDSK_EMAIL_SECURE`,
      description: `Use a secure connection when connecting to email processor`,
    },
    port: {
      env: `TDSK_EMAIL_PORT`,
      description: `Port to use when connecting to email processor`,
    },
    log: {
      default: true,
      type: `boolean`,
      description: `Log the task output`,
    },
  },
}
