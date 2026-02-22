import type { Message } from '@tdsk/domain'
import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { activeThreadIdState } from '@TAF/state/threads'

// Keyed by threadId
export const messagesState =
  atomWithReset<Record<string, Record<string, Message>>>(undefined)
export const activeMessageIdState = atomWithReset<string>(undefined)

// Derived: auto-filters to active thread
export const threadMessagesState = atom((get) => {
  const threadId = get(activeThreadIdState)
  return threadId ? get(messagesState)?.[threadId] : undefined
})
