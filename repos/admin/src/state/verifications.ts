import type { TVerification } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const verificationsState = atomWithReset<Record<string, TVerification>>(undefined)
export const activeVerificationIdState = atomWithReset<string>(undefined)
