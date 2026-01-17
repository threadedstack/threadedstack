import { nav } from '@TAF/services/nav'
import { setActiveOrgId } from '@TAF/state/accessors'

export const unsetActiveOrg = () => {
  setActiveOrgId(undefined)
  nav.home()
}
