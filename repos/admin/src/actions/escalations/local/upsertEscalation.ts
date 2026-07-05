import type { TEscalation } from '@tdsk/domain'
import { getEscalations, setEscalations } from '@TAF/state/accessors'

export const upsertEscalation = (escalation: TEscalation) => {
  const current = getEscalations() || {}
  setEscalations({ ...current, [escalation.id]: escalation })
}
