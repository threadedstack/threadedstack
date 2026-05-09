import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveDockerPullSecrets } from './resolveDockerPullSecrets'

const mockSecretResolver = {
  resolveApiKey: vi.fn().mockResolvedValue(`decrypted-password`),
} as any

describe(`resolveDockerPullSecrets`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSecretResolver.resolveApiKey.mockResolvedValue(`decrypted-password`)
  })

  it(`should resolve credentials from provider options and decrypted secret`, async () => {
    const result = await resolveDockerPullSecrets(
      [
        {
          provider: {
            id: `p1`,
            brand: `ghcr`,
            secretId: `sec_1`,
            options: { registry: `ghcr.io`, username: `my-user` },
          },
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.credentials).toHaveLength(1)
    expect(result.credentials[0]).toEqual({
      registry: `ghcr.io`,
      username: `my-user`,
      password: `decrypted-password`,
      providerId: `p1`,
    })
    expect(result.errors).toEqual([])
    expect(mockSecretResolver.resolveApiKey).toHaveBeenCalledWith(
      { orgId: `org_1` },
      expect.objectContaining({ id: `p1`, secretId: `sec_1` })
    )
  })

  it(`should apply DockerRegistryDefaults when registry is empty`, async () => {
    const result = await resolveDockerPullSecrets(
      [
        {
          provider: {
            id: `p1`,
            brand: `ghcr`,
            secretId: `sec_1`,
            options: { username: `my-user` },
          },
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.credentials).toHaveLength(1)
    expect(result.credentials[0].registry).toBe(`ghcr.io`)
    expect(result.errors).toEqual([])
  })

  it(`should return error when registry is missing and brand has no default`, async () => {
    const result = await resolveDockerPullSecrets(
      [
        {
          provider: {
            id: `p1`,
            brand: `custom`,
            secretId: `sec_1`,
            options: { username: `my-user` },
          },
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.credentials).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain(`missing registry URL`)
  })

  it(`should return error when username is missing`, async () => {
    const result = await resolveDockerPullSecrets(
      [
        {
          provider: {
            id: `p1`,
            brand: `ghcr`,
            secretId: `sec_1`,
            options: { registry: `ghcr.io` },
          },
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.credentials).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain(`missing username`)
  })

  it(`should return error when secretId is missing`, async () => {
    const result = await resolveDockerPullSecrets(
      [
        {
          provider: {
            id: `p1`,
            brand: `ghcr`,
            options: { registry: `ghcr.io`, username: `my-user` },
          },
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.credentials).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain(`no secret configured`)
  })

  it(`should return error when secret decryption fails`, async () => {
    mockSecretResolver.resolveApiKey.mockResolvedValue(``)
    const result = await resolveDockerPullSecrets(
      [
        {
          provider: {
            id: `p1`,
            brand: `ghcr`,
            secretId: `sec_1`,
            options: { registry: `ghcr.io`, username: `my-user` },
          },
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.credentials).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain(`Failed to decrypt`)
  })

  it(`should collect error when resolveApiKey throws`, async () => {
    mockSecretResolver.resolveApiKey.mockRejectedValue(new Error(`DB connection lost`))
    const result = await resolveDockerPullSecrets(
      [
        {
          provider: {
            id: `p1`,
            brand: `ghcr`,
            secretId: `sec_1`,
            options: { registry: `ghcr.io`, username: `my-user` },
          },
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.credentials).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain(`Secret resolution error`)
    expect(result.errors[0]).toContain(`DB connection lost`)
  })

  it(`should handle multiple docker providers`, async () => {
    const result = await resolveDockerPullSecrets(
      [
        {
          provider: {
            id: `p1`,
            brand: `ghcr`,
            secretId: `sec_1`,
            options: { registry: `ghcr.io`, username: `user-1` },
          },
        },
        {
          provider: {
            id: `p2`,
            brand: `dockerhub`,
            secretId: `sec_2`,
            options: { registry: `https://index.docker.io/v1/`, username: `user-2` },
          },
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.credentials).toHaveLength(2)
    expect(result.credentials[0].providerId).toBe(`p1`)
    expect(result.credentials[0].registry).toBe(`ghcr.io`)
    expect(result.credentials[0].username).toBe(`user-1`)
    expect(result.credentials[1].providerId).toBe(`p2`)
    expect(result.credentials[1].registry).toBe(`https://index.docker.io/v1/`)
    expect(result.credentials[1].username).toBe(`user-2`)
    expect(result.errors).toEqual([])
    expect(mockSecretResolver.resolveApiKey).toHaveBeenCalledTimes(2)
  })
})
