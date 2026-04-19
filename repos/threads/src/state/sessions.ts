import type { Sandbox, Organization, Project } from '@tdsk/domain'
import type { TOpenSession } from '@TTH/types'
import { atomWithReset } from 'jotai/utils'

export const openSessionsAtom = atomWithReset<Map<string, TOpenSession>>(new Map())
export const activeSessionAtom = atomWithReset<string | null>(null)
export const sandboxesAtom = atomWithReset<Sandbox[]>([])
export const orgsAtom = atomWithReset<Organization[]>([])
export const projectsAtom = atomWithReset<Project[]>([])
