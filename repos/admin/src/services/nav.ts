import type { TNavCtx } from '@TAF/types'
import { ERoutePath } from '@TAF/types'
import { buildRoute } from '@TAF/utils/nav/buildRoute'
import {
  getOrgs,
  getAgents,
  getProjects,
  getActiveOrgId,
  getActiveAgentId,
  getActiveProjectId,
} from '@TAF/state/accessors'

export class NavService {
  base: string

  constructor(base?: string) {
    this.base = (base ?? window.location.origin).replace(/^\//, ``)
  }

  context = (ctx?: TNavCtx): TNavCtx => {
    const orgs = getOrgs()
    const agents = getAgents()
    const projects = getProjects()
    const orgId = ctx?.orgId || getActiveOrgId()
    const agentId = ctx?.agentId || getActiveAgentId()
    const projectId = ctx?.projectId || getActiveProjectId()
    return {
      orgId,
      agentId,
      projectId,
      org: orgs?.[orgId],
      project: projects?.[projectId],
      agents: agents || undefined,
    }
  }

  route = (route: ERoutePath, ctx?: Partial<TNavCtx>) => {
    const to = buildRoute(route)(this.context(ctx))
    this.to(to)
  }

  to = (to: string, base: string = undefined) => {
    if (!to) return

    base = base || this.base
    const location = to === ERoutePath.Home ? to : `${base}/${to.replace(/^\//, ``)}`
    history.pushState({}, ``, `${location}${window.location.search}`)
    window.dispatchEvent(new PopStateEvent(`popstate`))
  }

  is = (loc: ERoutePath) => window.location.pathname === loc
  not = (loc: ERoutePath) => window.location.pathname !== loc
  has = (loc: ERoutePath) => window.location.pathname.startsWith(loc)
  back = () => history.back()
  home = () => this.not(ERoutePath.Home) && this.to(ERoutePath.Home)
  signin = () => !this.has(ERoutePath.Signin) && this.to(ERoutePath.Signin)
}

export const nav = new NavService()
