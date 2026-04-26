import { ERoutePath } from '@TTH/types'
import { getOrgId } from '@TTH/state/accessors'

export class NavService {
  base: string

  constructor(base?: string) {
    this.base = (base ?? window.location.origin).replace(/^\//, ``)
  }

  to = (to: string, base: string = undefined) => {
    if (!to) return

    base = base || this.base
    const location = to === ERoutePath.Home ? to : `${base}/${to.replace(/^\//, ``)}`
    history.pushState({}, ``, `${location}${window.location.search}`)
    window.dispatchEvent(new PopStateEvent(`popstate`))
  }

  is = (loc: string) => window.location.pathname === loc
  not = (loc: string) => window.location.pathname !== loc
  has = (loc: string) => window.location.pathname.startsWith(loc)
  back = () => history.back()
  signin = () => !this.has(ERoutePath.Signin) && this.to(ERoutePath.Signin)

  // --- URL builders ---

  orgs = () => this.to(`/orgs`)

  org = (orgId: string) => this.to(`/orgs/${orgId}`)

  projects = (orgId: string) => this.to(`/orgs/${orgId}/projects`)

  project = (orgId: string, projectId: string) =>
    this.to(`/orgs/${orgId}/projects/${projectId}`)

  sandbox = (orgId: string, projectId: string, sandboxId: string) =>
    this.to(`/orgs/${orgId}/projects/${projectId}/sandbox/${sandboxId}`)

  session = (orgId: string, projectId: string, sessionId: string) =>
    this.to(`/orgs/${orgId}/projects/${projectId}/session/${sessionId}`)

  home = () => {
    if (this.is(ERoutePath.Home)) return
    const orgId = getOrgId()
    orgId ? this.projects(orgId) : this.orgs()
  }
}

export const nav = new NavService()
