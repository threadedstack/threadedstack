import type { Invoice } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const invoicesState = atomWithReset<Invoice[] | undefined>(undefined)
