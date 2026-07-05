import type { TEscalation } from '@tdsk/domain'
import { setEscalations as setEscalationsState } from '@TAF/state/accessors'

export const setEscalations = (escalations: TEscalation[]) => {
  setEscalationsState(Object.fromEntries(escalations.map((e) => [e.id, e])))
}
