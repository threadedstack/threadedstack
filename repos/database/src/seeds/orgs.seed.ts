import type { TDBOrgInsert } from '@TDB/types'

import { Organization } from '@tdsk/domain'
import { OrgIds } from '@TDB/seeds/ids.seed'

export const orgsSeeds: TDBOrgInsert[] = [
  new Organization({
    id: OrgIds.tdsk,
    name: `Threaded Stack`,
    description: `Developer platform that offers AI Agent management, functions as a service and API request proxying including secure dynamic secret injection`,
  }),
  new Organization({
    id: OrgIds.acme,
    name: `Acme Corporation`,
    description: `Enterprise organization with multiple teams and projects`,
  }),
  new Organization({
    id: OrgIds.startup,
    name: `Tech Startup Inc`,
    description: `Fast-growing startup focused on AI and automation`,
  }),
  new Organization({
    id: OrgIds.personal,
    name: `Personal Workspace`,
    description: `Personal development and experimentation workspace`,
  }),
]
