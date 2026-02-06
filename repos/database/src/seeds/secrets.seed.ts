import type { TDBSecretInsert } from '@TDB/types'

import { Secret } from '@tdsk/domain'
import { OrgIds } from '@TDB/seeds/orgs.seed'
import { ProjectIds } from '@TDB/seeds/projects.seed'

/**
 * Secrets Seed Data
 * Exclusive Arc: orgId OR projectId OR providerId (exactly one)
 * Note: encryptedValue should be actual encrypted data in production
 */

export const SecretIds = {
  acmeDbPassword: `80000000-0000-0000-0000-000000000001`,
  acmeApiKey: `80000000-0000-0000-0000-000000000002`,
  acmeProjectSecret: `80000000-0000-0000-0000-000000000003`,
  startupApiKey: `80000000-0000-0000-0000-000000000004`,
  providerAnthropicKey: `80000000-0000-0000-0000-000000000005`,
  personalToken: `80000000-0000-0000-0000-000000000006`,
} as const

export const secretsSeeds: TDBSecretInsert[] = [
  new Secret({
    orgId: OrgIds.acme,
    projectId: undefined,
    providerId: undefined,
    name: `Database Password`,
    hashKey: `hash_acme_db_pwd`,
    id: SecretIds.acmeDbPassword,
    description: `Production database password`,
    encryptedValue: `encrypted_acme_db_password_value`,
  }),
  new Secret({
    orgId: OrgIds.acme,
    projectId: undefined,
    providerId: undefined,
    name: `External API Key`,
    id: SecretIds.acmeApiKey,
    hashKey: `hash_acme_api_key`,
    description: `Third-party service API key`,
    encryptedValue: `encrypted_acme_api_key_value`,
  }),
  new Secret({
    orgId: undefined,
    name: `JWT Secret`,
    providerId: undefined,
    hashKey: `hash_acme_jwt`,
    projectId: ProjectIds.acmeApi,
    id: SecretIds.acmeProjectSecret,
    encryptedValue: `encrypted_jwt_secret_value`,
    description: `JWT signing secret for API project`,
  }),
  new Secret({
    projectId: undefined,
    providerId: undefined,
    orgId: OrgIds.startup,
    name: `Stripe API Key`,
    id: SecretIds.startupApiKey,
    hashKey: `hash_startup_stripe`,
    description: `Payment processor API key`,
    encryptedValue: `encrypted_stripe_key_value`,
  }),
  new Secret({
    orgId: undefined,
    providerId: undefined,
    name: `Anthropic API Key`,
    projectId: ProjectIds.acmeApi,
    hashKey: `hash_anthropic_key`,
    id: SecretIds.providerAnthropicKey,
    description: `Anthropic API authentication key`,
    encryptedValue: `encrypted_anthropic_key_value`,
  }),
  new Secret({
    name: `GitHub Token`,
    projectId: undefined,
    providerId: undefined,
    orgId: OrgIds.personal,
    id: SecretIds.personalToken,
    hashKey: `hash_github_token`,
    description: `Personal GitHub access token`,
    encryptedValue: `encrypted_github_token_value`,
  }),
]
