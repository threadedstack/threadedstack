import type { TPermission } from '@TDM/types'
import { ERoleType, EPermScope, EPermResource } from '@TDM/types'

/**
 * Prefix for Threaded stack API keys
 */
export const ApiKeyPrefix = `tdsk_`

/**
 * Secret template reference patterns for {{ name:id }} format.
 * SecretRefTest - quick boolean check (no capture groups).
 * SecretRefPattern - global match with capture groups: [1]=name, [2]=entity ID (prefix + nanoid, 10 chars total).
 */
export const SecretRefTest = /\{\{\s*.+?:[A-Za-z0-9_-]{10}\s*\}\}/
export const SecretRefPattern = /\{\{\s*(.+?):([A-Za-z0-9_-]{10})\s*\}\}/g
export const DomainRegex =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/

export const AuthHeaders = Object.freeze({
  [`user.userId`]: `X-User-Id`,
  [`user.email`]: `X-User-Email`,
  [`user.orgId`]: `X-User-Org-Id`,
  [`user.projectId`]: `X-User-Project-Id`,
  [`user.apiKeyId`]: `X-User-Api-Key-Id`,
})

/**
 * Role hierarchy - higher index = more permissions
 * Each role inherits all permissions from roles below it
 */
export const RoleHierarchy: ERoleType[] = [
  ERoleType.member,
  ERoleType.admin,
  ERoleType.owner,
  ERoleType.super,
]

/**
 * Role templates define the permissions each role level adds.
 * Higher roles inherit all permissions from lower roles via buildRolePermissions().
 * Super admins bypass all permission checks entirely, so they are excluded.
 */
export const RoleTemplates: Record<Exclude<ERoleType, 'super'>, TPermission[]> = {
  [ERoleType.member]: [
    `org:read`,
    `user:read`,
    `role:read`,
    `agent:read`,
    `agent:exec`,
    `secret:read`,
    `domain:read`,
    `apiKey:read`,
    `asset:read`,
    `asset:create`,
    `asset:update`,
    `skill:read`,
    `skill:create`,
    `skill:update`,
    `skillProposal:read`,
    `memory:read`,
    `memory:create`,
    `memory:update`,
    `quota:read`,
    `thread:read`,
    `message:read`,
    `sandbox:read`,
    `sandbox:exec`,
    `project:read`,
    `agent:create`,
    `agent:update`,
    `schedule:exec`,
    `apiKey:create`,
    `function:read`,
    `function:exec`,
    `endpoint:read`,
    `provider:read`,
    `thread:create`,
    `thread:update`,
    `message:create`,
    `message:update`,
    `project:create`,
    `project:update`,
    `sandbox:connect`,
    `schedule:read`,
    `schedule:create`,
    `schedule:update`,
    `function:create`,
    `function:update`,
    `endpoint:create`,
    `endpoint:update`,
    `adminPanel:read`,
    `invitation:read`,
    `sandboxSession:read`,
    `sandboxSession:create`,
  ],
  [ERoleType.admin]: [
    `org:update`,
    `org:manage`,
    `user:create`,
    `user:update`,
    `user:manage`,
    `role:create`,
    `role:update`,
    `role:manage`,
    `asset:delete`,
    `asset:manage`,
    `skill:delete`,
    `skill:manage`,
    `skillProposal:update`,
    `skillProposal:delete`,
    `skillProposal:manage`,
    `memory:delete`,
    `memory:manage`,
    `agent:delete`,
    `agent:manage`,
    `quota:update`,
    `quota:manage`,
    `secret:create`,
    `secret:update`,
    `secret:delete`,
    `secret:manage`,
    `apiKey:update`,
    `apiKey:delete`,
    `apiKey:manage`,
    `domain:create`,
    `domain:update`,
    `domain:delete`,
    `domain:manage`,
    `thread:delete`,
    `thread:manage`,
    `sandbox:create`,
    `sandbox:update`,
    `sandbox:delete`,
    `sandbox:manage`,
    `project:delete`,
    `project:manage`,
    `message:delete`,
    `message:manage`,
    `endpoint:delete`,
    `endpoint:manage`,
    `provider:create`,
    `provider:update`,
    `provider:delete`,
    `provider:manage`,
    `schedule:delete`,
    `schedule:manage`,
    `function:delete`,
    `function:manage`,
    `invitation:create`,
    `invitation:update`,
    `invitation:delete`,
    `invitation:manage`,
    `sandboxSession:manage`,
  ],
  [ERoleType.owner]: [
    `org:delete`,
    `org:transfer`,
    `user:delete`,
    `role:delete`,
    `quota:create`,
    `quota:delete`,
  ],
}

export const ResourceScope: Record<EPermResource, EPermScope> = {
  [EPermResource.asset]: EPermScope.project,
  [EPermResource.skill]: EPermScope.project,
  [EPermResource.skillProposal]: EPermScope.project,
  [EPermResource.memory]: EPermScope.project,
  [EPermResource.agent]: EPermScope.project,
  [EPermResource.secret]: EPermScope.project,
  [EPermResource.domain]: EPermScope.project,
  [EPermResource.apiKey]: EPermScope.project,
  [EPermResource.thread]: EPermScope.project,
  [EPermResource.message]: EPermScope.project,
  [EPermResource.project]: EPermScope.project,
  [EPermResource.sandbox]: EPermScope.project,
  [EPermResource.endpoint]: EPermScope.project,
  [EPermResource.function]: EPermScope.project,
  [EPermResource.schedule]: EPermScope.project,
  [EPermResource.provider]: EPermScope.project,
  [EPermResource.sandboxSession]: EPermScope.project,

  [EPermResource.org]: EPermScope.org,
  [EPermResource.user]: EPermScope.org,
  [EPermResource.role]: EPermScope.org,
  [EPermResource.quota]: EPermScope.org,
  [EPermResource.invitation]: EPermScope.org,
  [EPermResource.adminPanel]: EPermScope.org,
  [EPermResource.subscription]: EPermScope.org,
}
