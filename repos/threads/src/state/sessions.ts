import type { Sandbox, Organization, Project } from '@tdsk/domain'
import type { TOpenSession } from '@TTH/types'
import { atomWithReset } from 'jotai/utils'
import type { TParsedEvent, TToolState, TJsonComponentTree } from '@tdsk/domain'

export const sessionEventsAtom = atomWithReset<Map<string, TParsedEvent[]>>(new Map())
export const sessionToolStateAtom = atomWithReset<Map<string, TToolState>>(new Map())
export const openSessionsAtom = atomWithReset<Map<string, TOpenSession>>(new Map())
export const activeSessionAtom = atomWithReset<string | null>(null)
export const sandboxesAtom = atomWithReset<Sandbox[]>([])
export const orgsAtom = atomWithReset<Organization[]>([])
export const projectsAtom = atomWithReset<Project[]>([])
export const sessionUpgradesAtom = atomWithReset<
  Map<string, Map<string, TJsonComponentTree>>
>(new Map())
