import type { TPaySubscriptionState } from '@TBE/types'

import type { Subscription } from '@tdsk/domain'

/**
 * Check whether local subscription state has drifted from the payment provider.
 * Returns the update payload if reconciliation is needed, or null if in sync.
 */
const normalizeTs = (v?: string | null): number => (v ? new Date(v).getTime() : 0)

export const reconcileSubscription = (
  local: Subscription,
  remote: TPaySubscriptionState
): Record<string, unknown> | null => {
  const updates: Record<string, unknown> = {}

  if (local.tier !== remote.tier) updates.tier = remote.tier
  if (local.status !== remote.status) updates.status = remote.status

  if (local.stripePriceId !== remote.stripePriceId)
    updates.stripePriceId = remote.stripePriceId

  if (Boolean(local.cancelAtPeriodEnd) !== remote.cancelAtPeriodEnd)
    updates.cancelAtPeriodEnd = remote.cancelAtPeriodEnd

  if (
    remote.currentPeriodStart &&
    normalizeTs(local.currentPeriodStart) !== normalizeTs(remote.currentPeriodStart)
  )
    updates.currentPeriodStart = remote.currentPeriodStart

  if (
    remote.currentPeriodEnd &&
    normalizeTs(local.currentPeriodEnd) !== normalizeTs(remote.currentPeriodEnd)
  )
    updates.currentPeriodEnd = remote.currentPeriodEnd

  return Object.keys(updates).length > 0 ? updates : null
}
