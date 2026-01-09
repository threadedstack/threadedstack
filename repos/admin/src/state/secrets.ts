import type { Secret } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const secretsState = atomWithReset<Record<string, Secret>>(undefined)
export const activeSecretIdState = atomWithReset<string>(undefined)
