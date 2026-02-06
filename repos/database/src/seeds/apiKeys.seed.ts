import type { TDBApiKeyInsert } from '@TDB/types'

import { ApiKey } from '@tdsk/domain'
import { OrgIds, ApiKeyIds, ProjectIds } from '@TDB/seeds/ids.seed'

export const apiKeysSeeds: TDBApiKeyInsert[] = [
  new ApiKey({
    active: true,
    rateLimit: 1000,
    orgId: OrgIds.acme,
    projectId: undefined,
    keyPrefix: `tdsk_acme_o`,
    scopes: `read,write,admin`,
    name: `Acme Org Master Key`,
    id: ApiKeyIds.acmeOrgKey,
    expiresAt: new Date(`2025-12-31`),
    lastUsedAt: new Date(`2024-01-25`),
    keyHash: `hashed_acme_org_master_key_12345`,
  }),
  new ApiKey({
    active: true,
    rateLimit: 500,
    orgId: undefined,
    scopes: `read,write`,
    keyPrefix: `tdsk_acme_p`,
    name: `Acme API Project Key`,
    projectId: ProjectIds.acmeApi,
    expiresAt: new Date(`2024-12-31`),
    lastUsedAt: new Date(`2024-01-26`),
    id: ApiKeyIds.acmeApiProjectKey,
    keyHash: `hashed_acme_api_project_key_67890`,
  }),
  new ApiKey({
    active: true,
    rateLimit: 200,
    projectId: undefined,
    scopes: `read,write`,
    orgId: OrgIds.startup,
    name: `Startup Org Key`,
    keyPrefix: `tdsk_stup_o`,
    id: ApiKeyIds.startupOrgKey,
    expiresAt: new Date(`2024-06-30`),
    lastUsedAt: new Date(`2024-01-20`),
    keyHash: `hashed_startup_org_key_abcdef`,
  }),
  new ApiKey({
    active: true,
    rateLimit: 50,
    scopes: `read`,
    projectId: undefined,
    expiresAt: undefined,
    lastUsedAt: undefined,
    orgId: OrgIds.personal,
    name: `Personal Dev Key`,
    keyPrefix: `tdsk_pers_o`,
    id: ApiKeyIds.personalKey,
    keyHash: `hashed_personal_key_xyz123`,
  }),
]
