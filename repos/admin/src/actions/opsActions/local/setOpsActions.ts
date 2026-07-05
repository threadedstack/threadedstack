import type { TOpsActionRow } from '@tdsk/domain'
import { setOpsActions as setOpsActionsState } from '@TAF/state/accessors'

export const setOpsActions = (actions: TOpsActionRow[]) => {
  setOpsActionsState(Object.fromEntries(actions.map((a) => [a.id, a])))
}
