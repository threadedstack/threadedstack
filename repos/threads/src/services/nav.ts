import type { TSessionLocationState } from '@TTH/types'

import { ERoutePath } from '@TTH/types'
import { getOrgId } from '@TTH/state/accessors'

type TNavOptions = {
  replace?: boolean
  state?: TSessionLocationState
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
    instance: (orgId: string, projectId: string, sandboxId: string, instanceId: string) =>
      `/orgs/${orgId}/projects/${projectId}/sandbox/${sandboxId}/instance/${instanceId}`,
    session: (orgId: string, projectId: string, instanceId: string, sessionId: string) =>
      `/orgs/${orgId}/projects/${projectId}/instances/${instanceId}/session/${sessionId}`,
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

  settings = (opts?: TNavOptions) => this.to(this.path.settings(), opts)

  orgs = (opts?: TNavOptions) => this.to(this.path.orgs(), opts)

  org = (orgId: string, opts?: TNavOptions) => this.to(this.path.org(orgId), opts)

  projects = (orgId: string, opts?: TNavOptions) =>
    this.to(this.path.projects(orgId), opts)

  project = (orgId: string, projectId: string, opts?: TNavOptions) =>
    this.to(this.path.project(orgId, projectId), opts)

  sandbox = (orgId: string, projectId: string, sandboxId: string, opts?: TNavOptions) =>
    this.to(this.path.sandbox(orgId, projectId, sandboxId), opts)

  instance = (
    orgId: string,
    projectId: string,
    sandboxId: string,
    instanceId: string,
    opts?: TNavOptions
  ) => this.to(this.path.instance(orgId, projectId, sandboxId, instanceId), opts)

  session = (
    orgId: string,
    projectId: string,
    instanceId: string,
    sessionId: string,
    opts?: TNavOptions
  ) => this.to(this.path.session(orgId, projectId, instanceId, sessionId), opts)

  home = () => {
    if (this.is(ERoutePath.Home)) return
    const orgId = getOrgId()
    orgId ? this.projects(orgId) : this.orgs()
  }
}

export const nav = new NavService()
