import type { TDBUserInsert } from '@TDB/types'

import { User } from '@tdsk/domain'

/**
 * User Seed Data
 */
export const UserIds = {
  owner: `00000000-0000-0000-0000-000000000000`,
  admin: `00000000-0000-0000-0000-000000000001`,
  member: `00000000-0000-0000-0000-000000000002`,
  viewer: `00000000-0000-0000-0000-000000000003`,
} as const

export const userSeeds: TDBUserInsert[] = [
  new User({
    id: UserIds.owner,
    name: `Lance Tipton`,
    banExpires: undefined,
    email: `lancetipton04@gmail.com`,
  }),
  new User({
    id: UserIds.admin,
    name: `Test Admin`,
    email: `test.admin@threadedstack.com`,
  }),
  new User({
    id: UserIds.member,
    name: `Test Member`,
    email: `test.member@threadedstack.com`,
  }),
  new User({
    id: UserIds.viewer,
    name: `Test Viewer`,
    email: `test.viewer@threadedstack.com`,
  }),
]
