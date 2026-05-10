import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveGitProviderEnv } from './resolveGitProviderEnv'

vi.mock(`nanoid`, () => {
  let counter = 0
  return {
    nanoid: () => `mock_nanoid_${counter++}`,
  }
})

describe(`resolveGitProviderEnv`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`returns TDSK_GIT_COUNT=0 and no errors for empty links`, async () => {
    const result = await resolveGitProviderEnv([])
    expect(result.errors).toEqual([])
    expect(result.extraEnv).toEqual({ TDSK_GIT_COUNT: `0` })
    expect(result.placeholders).toEqual({})
  })

  it(`resolves a single git provider with repoUrl, branch, brand, and secretId`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-1`,
          brand: `github`,
          secretId: `sec-1`,
          options: { repoUrl: `https://github.com/org/repo`, branch: `develop` },
        },
      },
    ])

    expect(result.errors).toEqual([])
    expect(result.extraEnv.TDSK_GIT_0_REPO).toBe(`https://github.com/org/repo`)
    expect(result.extraEnv.TDSK_GIT_0_BRANCH).toBe(`develop`)
    expect(result.extraEnv.TDSK_GIT_0_BRAND).toBe(`github`)
    expect(result.extraEnv.TDSK_GIT_0_TOKEN).toMatch(/^tdsk_ph_/)
    expect(result.extraEnv.TDSK_GIT_COUNT).toBe(`1`)

    const tokens = Object.keys(result.placeholders)
    expect(tokens).toHaveLength(1)
    expect(result.placeholders[tokens[0]]).toEqual({ secretId: `sec-1` })
  })

  it(`sorts multiple providers by priority and indexes correctly`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 5,
        provider: {
          id: `prov-b`,
          brand: `gitlab`,
          secretId: `sec-b`,
          options: { repoUrl: `https://gitlab.com/org/b`, branch: `staging` },
        },
      },
      {
        priority: 1,
        provider: {
          id: `prov-a`,
          brand: `github`,
          secretId: `sec-a`,
          options: { repoUrl: `https://github.com/org/a`, branch: `main` },
        },
      },
    ])

    expect(result.errors).toEqual([])
    // prov-a (priority 1) should be index 0
    expect(result.extraEnv.TDSK_GIT_0_REPO).toBe(`https://github.com/org/a`)
    expect(result.extraEnv.TDSK_GIT_0_BRAND).toBe(`github`)
    // prov-b (priority 5) should be index 1
    expect(result.extraEnv.TDSK_GIT_1_REPO).toBe(`https://gitlab.com/org/b`)
    expect(result.extraEnv.TDSK_GIT_1_BRAND).toBe(`gitlab`)
    expect(result.extraEnv.TDSK_GIT_COUNT).toBe(`2`)
  })

  it(`collects an error and skips provider when repoUrl is missing`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-1`,
          brand: `github`,
          secretId: `sec-1`,
          options: {},
        },
      },
    ])

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain(`github`)
    expect(result.errors[0]).toContain(`no repoUrl`)
    expect(result.extraEnv.TDSK_GIT_COUNT).toBe(`0`)
    expect(result.extraEnv.TDSK_GIT_0_REPO).toBeUndefined()
  })

  it(`uses provider.id in error message when brand is missing`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-no-brand`,
          options: {},
        },
      },
    ])

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain(`prov-no-brand`)
    expect(result.errors[0]).toContain(`no repoUrl`)
  })

  it(`omits TOKEN env var and placeholder when provider has no secretId`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-1`,
          brand: `github`,
          options: { repoUrl: `https://github.com/org/repo` },
        },
      },
    ])

    expect(result.errors).toEqual([])
    expect(result.extraEnv.TDSK_GIT_0_REPO).toBe(`https://github.com/org/repo`)
    expect(result.extraEnv.TDSK_GIT_0_TOKEN).toBeUndefined()
    expect(Object.keys(result.placeholders)).toHaveLength(0)
    expect(result.extraEnv.TDSK_GIT_COUNT).toBe(`1`)
  })

  it(`omits BRAND env var when provider has no brand`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-1`,
          options: { repoUrl: `https://github.com/org/repo` },
        },
      },
    ])

    expect(result.errors).toEqual([])
    expect(result.extraEnv.TDSK_GIT_0_BRAND).toBeUndefined()
    expect(result.extraEnv.TDSK_GIT_0_REPO).toBe(`https://github.com/org/repo`)
    expect(result.extraEnv.TDSK_GIT_COUNT).toBe(`1`)
  })

  it(`defaults branch to 'main' when not specified`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-1`,
          brand: `github`,
          options: { repoUrl: `https://github.com/org/repo` },
        },
      },
    ])

    expect(result.extraEnv.TDSK_GIT_0_BRANCH).toBe(`main`)
  })

  it(`TDSK_GIT_COUNT matches valid providers, not total input count`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-good`,
          brand: `github`,
          options: { repoUrl: `https://github.com/org/good` },
        },
      },
      {
        priority: 1,
        provider: {
          id: `prov-bad`,
          brand: `gitlab`,
          options: {},
        },
      },
      {
        priority: 2,
        provider: {
          id: `prov-also-good`,
          brand: `bitbucket`,
          options: { repoUrl: `https://bitbucket.org/org/also-good`, branch: `dev` },
        },
      },
    ])

    expect(result.errors).toHaveLength(1)
    expect(result.extraEnv.TDSK_GIT_COUNT).toBe(`2`)
    // First valid provider is index 0
    expect(result.extraEnv.TDSK_GIT_0_REPO).toBe(`https://github.com/org/good`)
    // Second valid provider is index 1 (not 2)
    expect(result.extraEnv.TDSK_GIT_1_REPO).toBe(`https://bitbucket.org/org/also-good`)
    expect(result.extraEnv.TDSK_GIT_1_BRANCH).toBe(`dev`)
  })

  it(`handles null brand and null secretId gracefully`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-1`,
          brand: null,
          secretId: null,
          options: { repoUrl: `https://github.com/org/repo` },
        },
      },
    ])

    expect(result.errors).toEqual([])
    expect(result.extraEnv.TDSK_GIT_0_REPO).toBe(`https://github.com/org/repo`)
    expect(result.extraEnv.TDSK_GIT_0_BRANCH).toBe(`main`)
    expect(result.extraEnv.TDSK_GIT_0_BRAND).toBeUndefined()
    expect(result.extraEnv.TDSK_GIT_0_TOKEN).toBeUndefined()
    expect(result.extraEnv.TDSK_GIT_COUNT).toBe(`1`)
  })

  it(`handles provider with null options`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-null-opts`,
          brand: `github`,
          options: null,
        },
      },
    ])

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain(`no repoUrl`)
    expect(result.extraEnv.TDSK_GIT_COUNT).toBe(`0`)
  })
})
