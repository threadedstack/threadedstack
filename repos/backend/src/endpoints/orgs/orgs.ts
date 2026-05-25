import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getOrg } from '@TBE/endpoints/orgs/getOrg'
import { orgCli } from '@TBE/endpoints/orgs/orgCli'
import { listOrgs } from '@TBE/endpoints/orgs/listOrgs'
import { createOrg } from '@TBE/endpoints/orgs/createOrg'
import { updateOrg } from '@TBE/endpoints/orgs/updateOrg'
import { deleteOrg } from '@TBE/endpoints/orgs/deleteOrg'
import { orgQuotas } from '@TBE/endpoints/orgs/orgQuotas'
import { orgAgents } from '@TBE/endpoints/orgs/orgAgents'
import { orgSkills } from '@TBE/endpoints/orgs/orgSkills'
import { orgApiKeys } from '@TBE/endpoints/orgs/orgApiKeys'
import { orgDomains } from '@TBE/endpoints/orgs/orgDomains'
import { orgSecrets } from '@TBE/endpoints/orgs/orgSecrets'
import { orgProjects } from '@TBE/endpoints/orgs/orgProjects'
import { orgProviders } from '@TBE/endpoints/orgs/orgProviders'
import { orgSandboxes } from '@TBE/endpoints/orgs/orgSandboxes'
import { orgOverrides } from '@TBE/endpoints/orgs/orgOverrides'
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
    orgCli,
    orgSkills,
    orgQuotas,
    orgAgents,
    orgApiKeys,
    orgDomains,
    orgSecrets,
    orgProjects,
    orgProviders,
    orgSandboxes,
    orgOverrides,
  },
}
