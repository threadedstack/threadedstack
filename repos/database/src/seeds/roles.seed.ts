import type { TDBRoleInsert } from '@TDB/types'
import { OrgIds } from '@TDB/seeds/orgs.seed'
import { UserIds } from '@TDB/seeds/users.seed'

export const RoleIds = {
  ownerAcme: `20000000-0000-0000-0000-000000000001`,
  adminAcme: `20000000-0000-0000-0000-000000000002`,
  memberAcme: `20000000-0000-0000-0000-000000000003`,
  viewerAcme: `20000000-0000-0000-0000-000000000004`,
  ownerStartup: `20000000-0000-0000-0000-000000000005`,
  memberStartup: `20000000-0000-0000-0000-000000000006`,
  ownerPersonal: `20000000-0000-0000-0000-000000000007`,
} as const

export const rolesSeeds: TDBRoleInsert[] = [
  // Acme Corporation roles
  {
    id: RoleIds.ownerAcme,
    userId: UserIds.owner,
    orgId: OrgIds.acme,
    projectId: null,
    type: `owner`,
    name: `Organization Owner`,
  },
  {
    id: RoleIds.adminAcme,
    userId: UserIds.admin,
    orgId: OrgIds.acme,
    projectId: null,
    type: `admin`,
    name: `Administrator`,
  },
  {
    id: RoleIds.memberAcme,
    userId: UserIds.member,
    orgId: OrgIds.acme,
    projectId: null,
    type: `member`,
    name: `Member`,
  },
  {
    id: RoleIds.viewerAcme,
    userId: UserIds.viewer,
    orgId: OrgIds.acme,
    projectId: null,
    type: `viewer`,
    name: `Viewer`,
  },
  // Tech Startup roles
  {
    id: RoleIds.ownerStartup,
    userId: UserIds.owner,
    orgId: OrgIds.startup,
    projectId: null,
    type: `owner`,
    name: `Organization Owner`,
  },
  {
    id: RoleIds.memberStartup,
    userId: UserIds.member,
    orgId: OrgIds.startup,
    projectId: null,
    type: `member`,
    name: `Member`,
  },
  // Personal Organization
  {
    id: RoleIds.ownerPersonal,
    userId: UserIds.viewer,
    orgId: OrgIds.personal,
    projectId: null,
    type: `owner`,
    name: `Organization Owner`,
  },
]
