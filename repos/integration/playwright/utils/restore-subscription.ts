import { loadEnvs } from '../../src/utils/loadEnvs'
import { restoreSeededSubscription, SeededTier } from './billing'

/**
 * Standalone environment repair: restore the seeded user's subscription to
 * the seeded tier (team) via real Stripe API calls + signed webhooks.
 *
 * Run from repos/integration:
 *   pnpm exec tsx playwright/utils/restore-subscription.ts
 *
 * Requires context.json (written by a prior test run's global setup) and the
 * TDSK_PAY_* env vars from values.yaml files.
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = `0`

loadEnvs()

const result = await restoreSeededSubscription()

console.log(
  result.changed
    ? `[billing restore] Subscription restored to seeded tier "${result.tier}" (stripe sub: ${result.stripeSubscriptionId})`
    : `[billing restore] Subscription already at seeded tier "${SeededTier}" — no changes made`
)
