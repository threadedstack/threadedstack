import type { Message } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const messagesState = atomWithReset<Record<string, Message>>(undefined)
export const activeMessageIdState = atomWithReset<string>(undefined)
