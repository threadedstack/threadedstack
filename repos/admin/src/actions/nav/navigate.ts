import { nav } from '@TAF/services/nav'
import { ERoutePath } from '@TAF/types'

export const navigate = (to: string | ERoutePath, base?: string) => {
  to === ERoutePath.Home ? nav.home() : nav.to(to, base)
}
