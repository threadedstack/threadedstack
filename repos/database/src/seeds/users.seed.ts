import type { TDBUserInsert } from '@TDB/types'

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
  {
    id: UserIds.owner,
    name: `Lance Tipton`,
    email: `lancetipton04@gmail.com`,
  },
  {
    id: UserIds.admin,
    name: `Test Admin`,
    email: `test.admin@threadedstack.com`,
  },
  {
    id: UserIds.member,
    name: `Test Member`,
    email: `test.member@threadedstack.com`,
  },
  {
    id: UserIds.viewer,
    name: `Test Viewer`,
    email: `test.viewer@threadedstack.com`,
  },
]
