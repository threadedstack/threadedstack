import { ERoutePath } from '@TTH/types'
import { getOrgId } from '@TTH/state/accessors'

export type TNavState = {
  sandboxId?: string
  projectId?: string
}

export type TNavOptions = {
  replace?: boolean
  state?: TNavState
}

export class NavService {
  readonly base: string

  readonly path = {
    org: (orgId: string) => `/orgs/${orgId}`,
    orgs: () => `/orgs`,
    projects: (orgId: string) => `/orgs/${orgId}/projects`,
    project: (orgId: string, projectId: string) => `/orgs/${orgId}/projects/${projectId}`,
    sandbox: (orgId: string, projectId: string, sandboxId: string) =>
      `/orgs/${orgId}/projects/${projectId}/sandbox/${sandboxId}`,
    session: (orgId: string, projectId: string, sessionId: string) =>
      `/orgs/${orgId}/projects/${projectId}/session/${sessionId}`,
    settings: () => `/settings`,
  }

  constructor(base?: string) {
    this.base = (base ?? window.location.origin).replace(/^\//, ``)
  }

  to = (to: string, opts?: TNavOptions) => {
    if (!to) {
      console.warn(`[NavService] to() called with falsy path:`, to)
      return
    }

    const location = to === ERoutePath.Home ? to : `${this.base}/${to.replace(/^\//, ``)}`
    const url = `${location}${window.location.search}`

    // React Router reads user state from history.state.usr
    const historyState: Record<string, unknown> = opts?.state
      ? { usr: opts.state, key: Math.random().toString(36).slice(2, 10) }
      : {}

    try {
      opts?.replace
        ? history.replaceState(historyState, ``, url)
        : history.pushState(historyState, ``, url)

      window.dispatchEvent(new PopStateEvent(`popstate`))
    } catch (err) {
      console.error(`[NavService] navigation to "${to}" failed`, err)
      if (opts?.replace) {
        window.location.replace(url)
      } else {
        window.location.assign(url)
      }
    }
  }

  back = () => history.back()
  is = (loc: string) => window.location.pathname === loc
  not = (loc: string) => window.location.pathname !== loc
  has = (loc: string) => window.location.pathname.startsWith(loc)
  signin = () => !this.has(ERoutePath.Signin) && this.to(ERoutePath.Signin)

  orgs = (opts?: TNavOptions) => this.to(this.path.orgs(), opts)

  org = (orgId: string, opts?: TNavOptions) => this.to(this.path.org(orgId), opts)

  projects = (orgId: string, opts?: TNavOptions) =>
    this.to(this.path.projects(orgId), opts)

  project = (orgId: string, projectId: string, opts?: TNavOptions) =>
    this.to(this.path.project(orgId, projectId), opts)

  sandbox = (orgId: string, projectId: string, sandboxId: string, opts?: TNavOptions) =>
    this.to(this.path.sandbox(orgId, projectId, sandboxId), opts)

  session = (orgId: string, projectId: string, sessionId: string, opts?: TNavOptions) =>
    this.to(this.path.session(orgId, projectId, sessionId), opts)

  settings = (opts?: TNavOptions) => this.to(this.path.settings(), opts)

  home = () => {
    if (this.is(ERoutePath.Home)) return
    const orgId = getOrgId()
    orgId ? this.projects(orgId) : this.orgs()
  }
}

export const nav = new NavService()
