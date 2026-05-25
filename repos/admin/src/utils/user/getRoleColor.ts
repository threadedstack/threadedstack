import type { TRoleType } from '@tdsk/domain'
import { ERoleType } from '@tdsk/domain'

export const getRoleColor = (role?: TRoleType) => {
  switch (role) {
    case ERoleType.super:
      return `error`
    case ERoleType.owner:
      return `warning`
    case ERoleType.admin:
    case ERoleType.member:
      return `info`
    default:
      return `default`
  }
}
