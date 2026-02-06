import type { TDBRoleInsert } from '@TDB/types'

import { Role } from '@tdsk/domain'
import { OrgIds, UserIds, RoleIds } from '@TDB/seeds/ids.seed'

export const rolesSeeds: TDBRoleInsert[] = [
  // Acme Corporation roles
  new Role({
    type: `owner`,
    orgId: OrgIds.acme,
    projectId: undefined,
    id: RoleIds.ownerAcme,
    userId: UserIds.owner,
    name: `Organization Owner`,
  }),
  new Role({
    type: `admin`,
    orgId: OrgIds.acme,
    projectId: undefined,
    id: RoleIds.adminAcme,
    userId: UserIds.admin,
    name: `Administrator`,
  }),
  new Role({
    type: `member`,
    name: `Member`,
    orgId: OrgIds.acme,
    projectId: undefined,
    id: RoleIds.memberAcme,
    userId: UserIds.member,
  }),
  new Role({
    type: `viewer`,
    name: `Viewer`,
    orgId: OrgIds.acme,
    projectId: undefined,
    id: RoleIds.viewerAcme,
    userId: UserIds.viewer,
  }),
  // Tech Startup roles
  new Role({
    type: `owner`,
    projectId: undefined,
    userId: UserIds.owner,
    orgId: OrgIds.startup,
    id: RoleIds.ownerStartup,
    name: `Organization Owner`,
  }),
  new Role({
    type: `member`,
    name: `Member`,
    projectId: undefined,
    orgId: OrgIds.startup,
    userId: UserIds.member,
    id: RoleIds.memberStartup,
  }),
  // Personal Organization
  new Role({
    type: `owner`,
    projectId: undefined,
    userId: UserIds.viewer,
    orgId: OrgIds.personal,
    id: RoleIds.ownerPersonal,
    name: `Organization Owner`,
  }),
]
