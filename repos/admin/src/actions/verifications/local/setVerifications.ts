import type { TVerification } from '@tdsk/domain'
import { setVerifications as setVerificationsState } from '@TAF/state/accessors'

export const setVerifications = (verifications: TVerification[]) => {
  setVerificationsState(Object.fromEntries(verifications.map((v) => [v.id, v])))
}
