import type { Sandbox, Organization, Project, TSandboxSession } from '@tdsk/domain'
import type { TOpenSession } from '@TTH/types'
import { atomWithReset } from 'jotai/utils'

export const projectsAtom = atomWithReset<Project[]>([])
export const sandboxesAtom = atomWithReset<Sandbox[]>([])
export const orgsAtom = atomWithReset<Organization[]>([])
export const activeSessionAtom = atomWithReset<string | null>(null)
export const openSessionsAtom = atomWithReset<Map<string, TOpenSession>>(new Map())
export const backendSessionsAtom = atomWithReset<Map<string, TSandboxSession[]>>(
  new Map()
)
