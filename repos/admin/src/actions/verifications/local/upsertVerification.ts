import type { TVerification } from '@tdsk/domain'
import { getVerifications, setVerifications } from '@TAF/state/accessors'

export const upsertVerification = (verification: TVerification) => {
  const current = getVerifications() || {}
  setVerifications({ ...current, [verification.id]: verification })
}
