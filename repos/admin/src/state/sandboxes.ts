import type { Sandbox } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const sandboxesState = atomWithReset<Record<string, Sandbox>>(undefined)
