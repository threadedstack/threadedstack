import type { EPermAction, EPermResource, ERoleType } from '@tdsk/domain'
import { useMemo } from 'react'
import { canPerform } from '@tdsk/domain'

export const useCanPerform = (
  role: ERoleType | null,
  action: EPermAction,
  resource: EPermResource
): boolean => {
  return useMemo(
    () => canPerform(role, action, resource).allowed,
    [role, action, resource]
  )
}
