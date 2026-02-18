import { Organization } from '@tdsk/domain'
import { Ids, OrgIds } from '@TDB/seeds/ids.seed'

export const orgsSeeds: Organization[] = [
  new Organization({
    id: OrgIds.tdsk,
    name: `Threaded Stack`,
    ownerId: Ids.super.user,
    description: `Developer platform that offers AI Agent management, functions as a service and API request proxying including secure dynamic secret injection`,
  }),
  new Organization({
    id: OrgIds.acme,
    name: `Acme Corporation`,
    ownerId: Ids.super.user,
    description: `Enterprise organization with multiple teams and projects`,
  }),
  new Organization({
    id: OrgIds.startup,
    name: `Tech Startup Inc`,
    ownerId: Ids.super.user,
    description: `Fast-growing startup focused on AI and automation`,
  }),
  new Organization({
    id: OrgIds.personal,
    name: `Personal Workspace`,
    ownerId: Ids.user.viewer,
    description: `Personal development and experimentation workspace`,
  }),
]
