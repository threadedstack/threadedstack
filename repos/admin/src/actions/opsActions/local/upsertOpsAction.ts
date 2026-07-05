import type { TOpsActionRow } from '@tdsk/domain'
import { getOpsActions, setOpsActions } from '@TAF/state/accessors'

export const upsertOpsAction = (action: TOpsActionRow) => {
  const current = getOpsActions() || {}
  setOpsActions({ ...current, [action.id]: action })
}
