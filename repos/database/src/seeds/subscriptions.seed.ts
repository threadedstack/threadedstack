import type { TDBSubscriptionInsert } from '@TDB/types'

import { Subscription } from '@tdsk/domain'
import { UserIds, SubscriptionIds } from '@TDB/seeds/ids.seed'

/**
 * TODO: Update these to align with polar ids
 */
export const subscriptionsSeeds: TDBSubscriptionInsert[] = [
  new Subscription({
    tier: `pro`,
    status: `active`,
    userId: UserIds.owner,
    id: SubscriptionIds.owner,
    cancelAtPeriodEnd: false,
    polarId: `polar_sub_admin_owner_123`,
    polarPriceId: `polar_price_pro_monthly`,
    polarCustomerId: `polar_cus_admin_owner_123`,
    currentPeriodEnd: new Date(`2024-02-01`).toISOString(),
    currentPeriodStart: new Date(`2024-01-01`).toISOString(),
  }),
  new Subscription({
    tier: `developer`,
    status: `active`,
    userId: UserIds.admin,
    cancelAtPeriodEnd: false,
    id: SubscriptionIds.admin,
    polarId: `polar_sub_admin_456`,
    polarCustomerId: `polar_cus_admin_456`,
    polarPriceId: `polar_price_developer_monthly`,
    currentPeriodEnd: new Date(`2024-02-15`).toISOString(),
    currentPeriodStart: new Date(`2024-01-15`).toISOString(),
  }),
  new Subscription({
    tier: `basic`,
    status: `active`,
    userId: UserIds.member,
    cancelAtPeriodEnd: false,
    id: SubscriptionIds.member,
    polarId: `polar_sub_member_789`,
    polarCustomerId: `polar_cus_member_789`,
    polarPriceId: `polar_price_basic_monthly`,
    currentPeriodEnd: new Date(`2024-02-20`).toISOString(),
    currentPeriodStart: new Date(`2024-01-20`).toISOString(),
  }),
  new Subscription({
    tier: `free`,
    status: `active`,
    polarId: undefined,
    userId: UserIds.viewer,
    polarPriceId: undefined,
    cancelAtPeriodEnd: false,
    polarCustomerId: undefined,
    id: SubscriptionIds.viewer,
    currentPeriodEnd: undefined,
    currentPeriodStart: new Date(`2024-01-01`).toISOString(),
  }),
]
