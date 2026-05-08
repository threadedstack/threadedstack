import type { SecretResolver } from '@TBE/services/secrets/secretResolver'

import { DockerRegistryDefaults, EDockerProviderBrand } from '@tdsk/domain'

type TProviderWithSecret = {
  id: string
  brand: string
  secretId?: string
  options?: Record<string, unknown>
}

type TDockerProviderLink = {
  provider: TProviderWithSecret
}

type TDockerCredential = {
  registry: string
  username: string
  password: string
  providerId: string
}

type TResolveResult = {
  errors: string[]
  credentials: TDockerCredential[]
}

const validBrands = new Set(Object.values(EDockerProviderBrand) as string[])

export async function resolveDockerPullSecrets(
  dockerLinks: TDockerProviderLink[],
  secretResolver: SecretResolver,
  orgId: string
): Promise<TResolveResult> {
  const credentials: TDockerCredential[] = []
  const errors: string[] = []

  for (const link of dockerLinks) {
    const { provider } = link

    let registry = (provider.options?.registry as string) || ``
    if (!registry && validBrands.has(provider.brand))
      registry =
        DockerRegistryDefaults[provider.brand as EDockerProviderBrand]?.registry || ``

    const username = (provider.options?.username as string) || ``

    if (!registry) {
      errors.push(`Docker provider '${provider.brand}' is missing registry URL`)
      continue
    }
    if (!username) {
      errors.push(`Docker provider '${provider.brand}' is missing username`)
      continue
    }
    if (!provider.secretId) {
      errors.push(`Docker provider '${provider.brand}' has no secret configured`)
      continue
    }

    let password: string | undefined
    try {
      password = await secretResolver.resolveApiKey({ orgId }, provider)
    } catch (err) {
      errors.push(
        `Secret resolution error for docker provider '${provider.brand}': ${(err as Error).message}`
      )
      continue
    }
    if (!password) {
      errors.push(
        `Failed to decrypt registry password for docker provider '${provider.brand}'`
      )
      continue
    }

    credentials.push({ registry, username, password, providerId: provider.id })
  }

  return { credentials, errors }
}
