import type { Provider } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const providersState = atomWithReset<Record<string, Provider>>(undefined)
