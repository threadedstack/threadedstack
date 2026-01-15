import type { TRoleType } from '@tdsk/domain'
import { ERoleType } from '@tdsk/domain'

export const getRoleColor = (role?: TRoleType) => {
  switch (role) {
    case ERoleType.super:
      return `error`
    case ERoleType.admin:
      return `warning`
    case ERoleType.basic:
    default:
      return `default`
  }
}
