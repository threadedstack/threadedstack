import type { TDBUserInsert } from '@TDB/types'

import { User } from '@tdsk/domain'
import { UserIds } from '@TDB/seeds/ids.seed'

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
