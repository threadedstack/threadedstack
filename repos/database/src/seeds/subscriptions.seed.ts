import type { TDBSubscriptionInsert } from '@TDB/types'
import { UserIds } from '@TDB/seeds/users.seed'
/**
 * Subscriptions Seed Data
 * Each user can have only ONE subscription (unique userId constraint)
 */

export const SubscriptionIds = {
  owner: `30000000-0000-0000-0000-000000000001`,
  admin: `30000000-0000-0000-0000-000000000002`,
  member: `30000000-0000-0000-0000-000000000003`,
  viewer: `30000000-0000-0000-0000-000000000004`,
} as const

export const subscriptionsSeeds: TDBSubscriptionInsert[] = [
  {
    id: SubscriptionIds.owner,
    userId: UserIds.owner,
    tier: `pro`,
    status: `active`,
    polarId: `polar_sub_admin_owner_123`,
    polarCustomerId: `polar_cus_admin_owner_123`,
    polarPriceId: `polar_price_pro_monthly`,
    currentPeriodStart: new Date(`2024-01-01`).toISOString(),
    currentPeriodEnd: new Date(`2024-02-01`).toISOString(),
    cancelAtPeriodEnd: false,
    seats: 10,
  },
  {
    id: SubscriptionIds.admin,
    userId: UserIds.admin,
    tier: `developer`,
    status: `active`,
    polarId: `polar_sub_admin_456`,
    polarCustomerId: `polar_cus_admin_456`,
    polarPriceId: `polar_price_developer_monthly`,
    currentPeriodStart: new Date(`2024-01-15`).toISOString(),
    currentPeriodEnd: new Date(`2024-02-15`).toISOString(),
    cancelAtPeriodEnd: false,
    seats: 5,
  },
  {
    id: SubscriptionIds.member,
    userId: UserIds.member,
    tier: `basic`,
    status: `active`,
    polarId: `polar_sub_member_789`,
    polarCustomerId: `polar_cus_member_789`,
    polarPriceId: `polar_price_basic_monthly`,
    currentPeriodStart: new Date(`2024-01-20`).toISOString(),
    currentPeriodEnd: new Date(`2024-02-20`).toISOString(),
    cancelAtPeriodEnd: false,
    seats: 2,
  },
  {
    id: SubscriptionIds.viewer,
    userId: UserIds.viewer,
    tier: `free`,
    status: `active`,
    polarId: null,
    polarCustomerId: null,
    polarPriceId: null,
    currentPeriodStart: new Date(`2024-01-01`).toISOString(),
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    seats: 1,
  },
]
