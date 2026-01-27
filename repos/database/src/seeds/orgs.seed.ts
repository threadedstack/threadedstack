import type { TDBOrgInsert } from '@TDB/types'

/**
 * Organizations Seed Data
 */

export const OrgIds = {
  acme: `10000000-0000-0000-0000-000000000001`,
  startup: `10000000-0000-0000-0000-000000000002`,
  personal: `10000000-0000-0000-0000-000000000003`,
} as const

export const orgsSeeds: TDBOrgInsert[] = [
  {
    id: OrgIds.acme,
    name: `Acme Corporation`,
    description: `Enterprise organization with multiple teams and projects`,
  },
  {
    id: OrgIds.startup,
    name: `Tech Startup Inc`,
    description: `Fast-growing startup focused on AI and automation`,
  },
  {
    id: OrgIds.personal,
    name: `Personal Workspace`,
    description: `Personal development and experimentation workspace`,
  },
]
