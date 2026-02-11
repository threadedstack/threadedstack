import { nav } from '@TAF/services/nav'
import { resetActiveOrgId } from '@TAF/state/accessors'
import { unsetActiveProject } from '@TAF/actions/projects/local/unsetActiveProject'

export const unsetActiveOrg = () => {
  unsetActiveProject()
  resetActiveOrgId()
  nav.home()
}
