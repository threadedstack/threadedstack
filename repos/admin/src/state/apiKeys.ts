import type { ApiKey } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const apiKeysState = atomWithReset<Record<string, ApiKey>>(undefined)
