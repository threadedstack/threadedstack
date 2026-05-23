import type { TOpenSession } from '@TTH/types'
import type {
  Sandbox,
  Project,
  Organization,
  TPortsResponse,
  TSandboxSession,
  TSBInstancesResp,
} from '@tdsk/domain'

import { atomWithReset } from 'jotai/utils'

export const projectsAtom = atomWithReset<Project[]>([])
export const sandboxesAtom = atomWithReset<Sandbox[]>([])
export const orgsAtom = atomWithReset<Organization[]>([])
export const activeSessionAtom = atomWithReset<string | null>(null)
export const openSessionsAtom = atomWithReset<Map<string, TOpenSession>>(new Map())
export const sandboxPortsAtom = atomWithReset<Map<string, TPortsResponse>>(new Map())
export const backendSessionsAtom = atomWithReset<Map<string, TSandboxSession[]>>(
  new Map()
)
export const sandboxInstancesAtom = atomWithReset<Map<string, TSBInstancesResp>>(
  new Map()
)
