import type { User } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const defUser: User = undefined
export const userState = atomWithReset<User>(defUser)
