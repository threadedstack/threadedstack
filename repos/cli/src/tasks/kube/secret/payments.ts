import type { TTask, TTaskActionArgs } from '@TSCL/types'

import { Logger } from '@tdsk/logger'
import { taskError } from '@TSCL/utils/tasks/error'
import { cleanColl } from '@keg-hub/jsutils/cleanColl'

/**
 * Add kubernetes payments config secret for tdsk-db-cfg
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
const paymentsAct = async (props: TTaskActionArgs) => {
  const { params, tasks, config } = props
  const secretTask = tasks?.kube?.tasks?.secret
  !secretTask &&
    taskError(
      `The "kube.tasks.secret" task can not be found. Ensure it exists before running this command`
    )

  const { url, type, token, webhook, plans, ...secParams } = params

  const cfg = {
    url: url || config.envs.TDSK_PAY_URL || `unknown`,
    type: type || config.envs.TDSK_PAY_TYPE || undefined,
    plans: plans || config.envs.TDSK_PAY_PLANS || undefined,
    token: token || config.envs.TDSK_PAY_ACCESS_TOKEN || undefined,
    webhook: webhook || config.envs.TDSK_PAY_WEBHOOK_SECRET || undefined,
  }

  const isProd = process.env.NODE_ENV === `production`
  ;(!cfg.url || !cfg.type || !cfg.token || !cfg.plans || (isProd && !cfg.webhook)) &&
    taskError(`Missing payments configuration`, undefined, cfg)

  params.log && Logger.pair(`Found valid payments config values`)

  if (!secretTask?.action) return taskError(`Secret task could not be loaded!`)

  await secretTask.action({
    ...props,
    params: {
      ...secParams,
      separator: `||`,
      name: config.envs.TDSK_KUBE_SCRT_PAY_CFG || `tdsk-payments-secret`,
      secrets: Object.entries(cleanColl(cfg))
        .map(([key, value]) => `${key}:${value}`)
        .join(`||`),
    },
  })
}

export const payments: TTask = {
  name: `payments`,
  alias: [`pay`],
  action: paymentsAct,
  example: `pnpm kube secrets pay <options>`,
  description: `Creates a kubernetes secret for the payments config`,
  options: {
    type: {
      env: `TDSK_PAY_TYPE`,
      description: `Payment processor type`,
    },
    url: {
      env: `TDSK_PAY_URL`,
      description: `Payment processor url`,
    },
    plans: {
      env: `TDSK_PAY_PLANS`,
      description: `Keyvalue pair of payment plans separated by comma`,
    },
    token: {
      env: `TDSK_PAY_ACCESS_TOKEN`,
      description: `Payment processor access token`,
    },
    webhook: {
      env: `TDSK_PAY_WEBHOOK_SECRET`,
      description: `Webhook secret for validating processor webhooks`,
    },
    log: {
      default: true,
      type: `boolean`,
      description: `Log the task output`,
    },
  },
}
