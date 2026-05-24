import type { TTask, TTaskAction } from '@TSCL/types'

import { spawn } from '@TSCL/utils/proc/spawn'

const DefaultEvents = [
  `checkout.session.completed`,
  `customer.subscription.updated`,
  `customer.subscription.deleted`,
  `invoice.paid`,
  `invoice.payment_failed`,
].join(`,`)

const forwardAct: TTaskAction = async ({ params, config }) => {
  const host = config.envs.TDSK_HOST_DOMAIN || `threadedstack.app`
  const defaultUrl = `https://local.${host}/_/payments/webhooks`
  const url = params.url || defaultUrl
  const events = params.events || DefaultEvents
  const args = [`listen`, `--forward-to`, url, `--events`, events]

  try {
    const code = await spawn({ cmd: `stripe`, args, stdio: `inherit` })
    if (code !== 0) {
      throw new Error(`stripe listen exited with code ${code}`)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes(`ENOENT`)) {
      throw new Error(
        `The Stripe CLI is not installed or not in PATH.\n` +
          `Install it with: brew install stripe/stripe-cli/stripe\n` +
          `See: https://docs.stripe.com/stripe-cli`
      )
    }
    throw err
  }
}

export const forward: TTask = {
  name: `forward`,
  alias: [`fwd`, `listen`],
  action: forwardAct,
  example: `tdsk stripe forward <options>`,
  description: `Runs stripe listen and forwards webhooks to the local backend`,
  options: {
    url: {
      description: `Override the webhook forwarding URL`,
    },
    events: {
      description: `Comma-separated list of Stripe events to listen for`,
    },
  },
}
