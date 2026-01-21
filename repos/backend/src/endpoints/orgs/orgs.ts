import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getOrg } from '@TBE/endpoints/orgs/getOrg'
import { listOrgs } from '@TBE/endpoints/orgs/listOrgs'
import { createOrg } from '@TBE/endpoints/orgs/createOrg'
import { updateOrg } from '@TBE/endpoints/orgs/updateOrg'
import { deleteOrg } from '@TBE/endpoints/orgs/deleteOrg'
import { addOrgMember } from '@TBE/endpoints/orgs/addOrgMember'
import { inviteOrgUser } from '@TBE/endpoints/orgs/inviteOrgUser'
import { updateOrgRole } from '@TBE/endpoints/orgs/updateOrgRole'
import { deleteOrgRole } from '@TBE/endpoints/orgs/deleteOrgRole'
import { listOrgMembers } from '@TBE/endpoints/orgs/listOrgMembers'
import { removeOrgMember } from '@TBE/endpoints/orgs/removeOrgMember'
import { updateMemberRole } from '@TBE/endpoints/orgs/updateMemberRole'

export const orgs: TEndpointConfig = {
  path: `/orgs`,
  method: EPMethod.Use,
  endpoints: {
    listOrgs,
    getOrg,
    createOrg,
    updateOrg,
    deleteOrg,
    addOrgMember,
    inviteOrgUser,
    updateOrgRole,
    deleteOrgRole,
    listOrgMembers,
    removeOrgMember,
    updateMemberRole,
  },
}
