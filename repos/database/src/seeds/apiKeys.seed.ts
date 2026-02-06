import type { TDBApiKeyInsert } from '@TDB/types'
import { OrgIds } from '@TDB/seeds/orgs.seed'
import { ProjectIds } from '@TDB/seeds/projects.seed'

/**
 * API Keys Seed Data
 * Note: keyHash should be a hashed value in production
 */

export const API_KEY_IDS = {
  ACME_ORG_KEY: `60000000-0000-0000-0000-000000000001`,
  ACME_API_PROJECT_KEY: `60000000-0000-0000-0000-000000000002`,
  STARTUP_ORG_KEY: `60000000-0000-0000-0000-000000000003`,
  PERSONAL_KEY: `60000000-0000-0000-0000-000000000004`,
} as const

export const apiKeysSeeds: TDBApiKeyInsert[] = [
  {
    id: API_KEY_IDS.ACME_ORG_KEY,
    name: `Acme Org Master Key`,
    keyHash: `hashed_acme_org_master_key_12345`,
    keyPrefix: `tdsk_acme_o`,
    orgId: OrgIds.acme,
    projectId: null,
    scopes: `read,write,admin`,
    active: true,
    rateLimit: 1000,
    expiresAt: new Date(`2025-12-31`),
    lastUsedAt: new Date(`2024-01-25`),
  },
  {
    id: API_KEY_IDS.ACME_API_PROJECT_KEY,
    name: `Acme API Project Key`,
    keyHash: `hashed_acme_api_project_key_67890`,
    keyPrefix: `tdsk_acme_p`,
    orgId: null,
    projectId: ProjectIds.acmeApi,
    scopes: `read,write`,
    active: true,
    rateLimit: 500,
    expiresAt: new Date(`2024-12-31`),
    lastUsedAt: new Date(`2024-01-26`),
  },
  {
    id: API_KEY_IDS.STARTUP_ORG_KEY,
    name: `Startup Org Key`,
    keyHash: `hashed_startup_org_key_abcdef`,
    keyPrefix: `tdsk_stup_o`,
    orgId: OrgIds.startup,
    projectId: null,
    scopes: `read,write`,
    active: true,
    rateLimit: 200,
    expiresAt: new Date(`2024-06-30`),
    lastUsedAt: new Date(`2024-01-20`),
  },
  {
    id: API_KEY_IDS.PERSONAL_KEY,
    name: `Personal Dev Key`,
    keyHash: `hashed_personal_key_xyz123`,
    keyPrefix: `tdsk_pers_o`,
    orgId: OrgIds.personal,
    projectId: null,
    scopes: `read`,
    active: true,
    rateLimit: 50,
    expiresAt: undefined,
    lastUsedAt: undefined,
  },
]
