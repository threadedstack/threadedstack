import { ERoutePath } from '@TTH/types'

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

  is = (loc: ERoutePath) => window.location.pathname === loc
  not = (loc: ERoutePath) => window.location.pathname !== loc
  has = (loc: ERoutePath) => window.location.pathname.startsWith(loc)
  back = () => history.back()
  home = () => this.not(ERoutePath.Home) && this.to(ERoutePath.Home)
  signin = () => !this.has(ERoutePath.Signin) && this.to(ERoutePath.Signin)
}

export const nav = new NavService()
