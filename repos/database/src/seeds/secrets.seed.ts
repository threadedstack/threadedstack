import { Secret } from '@tdsk/domain'
import { encryptSecret } from '@TDB/utils/crypto'
import { OrgIds, ProjectIds, SecretIds } from '@TDB/seeds/ids.seed'

// Generate encrypted secrets
const acmeDbPassword = await encryptSecret(
  `Database Password`,
  `SuperSecureDbPassword123!`,
  OrgIds.acme
)

const acmeApiKey = await encryptSecret(
  `External API Key`,
  `test_external_api_key_12345`,
  OrgIds.acme
)

const jwtSecret = await encryptSecret(
  `JWT Secret`,
  `super_secret_jwt_signing_key`,
  ProjectIds.acmeApi
)

const stripeApiKey = await encryptSecret(
  `Stripe API Key`,
  `sk_test_stripe_api_key`,
  OrgIds.startup
)

const anthropicApiKey = await encryptSecret(
  `Anthropic API Key`,
  `sk-ant-test-anthropic-key`,
  ProjectIds.acmeApi
)

const githubToken = await encryptSecret(
  `GitHub Token`,
  `ghp_test_github_token`,
  OrgIds.personal
)

export const secretsSeeds: Secret[] = [
  new Secret({
    orgId: OrgIds.acme,
    projectId: undefined,
    providerId: undefined,
    name: `Database Password`,
    hashKey: acmeDbPassword.hashKey,
    id: SecretIds.acmeDbPassword,
    description: `Production database password`,
    encryptedValue: acmeDbPassword.encryptedValue,
  }),
  new Secret({
    orgId: OrgIds.acme,
    projectId: undefined,
    providerId: undefined,
    name: `External API Key`,
    id: SecretIds.acmeApiKey,
    hashKey: acmeApiKey.hashKey,
    description: `Third-party service API key`,
    encryptedValue: acmeApiKey.encryptedValue,
  }),
  new Secret({
    orgId: undefined,
    name: `JWT Secret`,
    providerId: undefined,
    hashKey: jwtSecret.hashKey,
    projectId: ProjectIds.acmeApi,
    id: SecretIds.acmeProjectSecret,
    encryptedValue: jwtSecret.encryptedValue,
    description: `JWT signing secret for API project`,
  }),
  new Secret({
    projectId: undefined,
    providerId: undefined,
    orgId: OrgIds.startup,
    name: `Stripe API Key`,
    id: SecretIds.startupApiKey,
    hashKey: stripeApiKey.hashKey,
    description: `Payment processor API key`,
    encryptedValue: stripeApiKey.encryptedValue,
  }),
  new Secret({
    orgId: undefined,
    providerId: undefined,
    name: `Anthropic API Key`,
    projectId: ProjectIds.acmeApi,
    hashKey: anthropicApiKey.hashKey,
    id: SecretIds.providerAnthropicKey,
    description: `Anthropic API authentication key`,
    encryptedValue: anthropicApiKey.encryptedValue,
  }),
  new Secret({
    name: `GitHub Token`,
    projectId: undefined,
    providerId: undefined,
    orgId: OrgIds.personal,
    id: SecretIds.githubToken,
    hashKey: githubToken.hashKey,
    description: `Personal GitHub access token`,
    encryptedValue: githubToken.encryptedValue,
  }),
]
