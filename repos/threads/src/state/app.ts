import type { Organization, Project, TRoleType } from '@tdsk/domain'

import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { orgsAtom, projectsAtom } from '@TTH/state/sessions'

export const defSidebarOpen = true
export const sidebarOpenState = atomWithReset<boolean>(defSidebarOpen)

export const defOrgId = ``
export const orgIdState = atomWithReset<string>(defOrgId)

export const defActiveProjectId = ``
export const activeProjectIdState = atomWithReset<string>(defActiveProjectId)

export const defActiveOrgRole: TRoleType | null = null
export const activeOrgRoleState = atomWithReset<TRoleType | null>(defActiveOrgRole)

export const activeOrgState = atom<Organization | undefined>((get) => {
  const orgId = get(orgIdState)
  const orgs = get(orgsAtom)
  return orgId ? orgs.find((o) => o.id === orgId) : undefined
})

export const activeProjectState = atom<Project | undefined>((get) => {
  const projectId = get(activeProjectIdState)
  const projects = get(projectsAtom)
  return projectId ? projects.find((p) => p.id === projectId) : undefined
})
