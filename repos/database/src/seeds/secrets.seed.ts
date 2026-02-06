import type { TDBSecretInsert } from '@TDB/types'
import { OrgIds } from '@TDB/seeds/orgs.seed'
import { ProjectIds } from '@TDB/seeds/projects.seed'
import { ProviderIds } from '@TDB/seeds/providers.seed'

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
  {
    id: SecretIds.acmeDbPassword,
    name: `Database Password`,
    description: `Production database password`,
    hashKey: `hash_acme_db_pwd`,
    encryptedValue: `encrypted_acme_db_password_value`,
    orgId: OrgIds.acme,
    projectId: null,
    providerId: null,
  },
  {
    id: SecretIds.acmeApiKey,
    name: `External API Key`,
    description: `Third-party service API key`,
    hashKey: `hash_acme_api_key`,
    encryptedValue: `encrypted_acme_api_key_value`,
    orgId: OrgIds.acme,
    projectId: null,
    providerId: null,
  },
  {
    id: SecretIds.acmeProjectSecret,
    name: `JWT Secret`,
    description: `JWT signing secret for API project`,
    hashKey: `hash_acme_jwt`,
    encryptedValue: `encrypted_jwt_secret_value`,
    orgId: null,
    projectId: ProjectIds.acmeApi,
    providerId: null,
  },
  {
    id: SecretIds.startupApiKey,
    name: `Stripe API Key`,
    description: `Payment processor API key`,
    hashKey: `hash_startup_stripe`,
    encryptedValue: `encrypted_stripe_key_value`,
    orgId: OrgIds.startup,
    projectId: null,
    providerId: null,
  },
  {
    id: SecretIds.providerAnthropicKey,
    name: `Anthropic API Key`,
    description: `Anthropic API authentication key`,
    hashKey: `hash_anthropic_key`,
    encryptedValue: `encrypted_anthropic_key_value`,
    orgId: null,
    projectId: ProjectIds.acmeApi,
    providerId: null,
  },
  {
    id: SecretIds.personalToken,
    name: `GitHub Token`,
    description: `Personal GitHub access token`,
    hashKey: `hash_github_token`,
    encryptedValue: `encrypted_github_token_value`,
    orgId: OrgIds.personal,
    projectId: null,
    providerId: null,
  },
]
