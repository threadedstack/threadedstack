import { nav } from '@TAF/services/nav'
import { AuthHeaders } from '@tdsk/domain'
import { apiService } from '@TAF/services/api'
import { resetActiveOrgId } from '@TAF/state/accessors'
import { unsetActiveProject } from '@TAF/actions/projects/local/unsetActiveProject'

export const unsetActiveOrg = () => {
  unsetActiveProject()
  resetActiveOrgId()
  apiService.headers({ [AuthHeaders[`user.orgId`]]: undefined })
  nav.home()
}
