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
    expect(result.placeholders[tokens[0]]).toEqual({
      secretId: `sec-1`,
      allowedDomains: [`github.com`, `api.github.com`],
    })
  })

  it(`scopes each git token placeholder to its own repo hostname`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-gh`,
          brand: `github`,
          secretId: `sec-gh`,
          options: { repoUrl: `https://github.com/org/a` },
        },
      },
      {
        priority: 1,
        provider: {
          id: `prov-gl`,
          brand: `gitlab`,
          secretId: `sec-gl`,
          options: { repoUrl: `https://gitlab.example.io/org/b` },
        },
      },
    ])

    expect(result.errors).toEqual([])
    const entries = Object.values(result.placeholders)
    expect(entries).toHaveLength(2)
    expect(entries).toContainEqual({
      secretId: `sec-gh`,
      allowedDomains: [`github.com`, `api.github.com`],
    })
    expect(entries).toContainEqual({
      secretId: `sec-gl`,
      allowedDomains: [`gitlab.example.io`],
    })
  })

  it(`defaults github.com scoping to include api.github.com`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-gh`,
          brand: `github`,
          secretId: `sec-gh`,
          options: { repoUrl: `https://github.com/org/repo` },
        },
      },
    ])

    expect(result.errors).toEqual([])
    const entries = Object.values(result.placeholders)
    expect(entries).toHaveLength(1)
    expect(entries[0].allowedDomains).toEqual([`github.com`, `api.github.com`])
  })

  it(`keeps non-github hosts scoped to the repo host only`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-ghe`,
          brand: `github`,
          secretId: `sec-ghe`,
          options: { repoUrl: `https://github.mycorp.dev/org/repo` },
        },
      },
    ])

    expect(result.errors).toEqual([])
    const entries = Object.values(result.placeholders)
    expect(entries).toHaveLength(1)
    expect(entries[0].allowedDomains).toEqual([`github.mycorp.dev`])
  })

  it(`honors an explicit options.allowedDomains override verbatim`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-gh`,
          brand: `github`,
          secretId: `sec-gh`,
          options: {
            repoUrl: `https://github.com/org/repo`,
            allowedDomains: [`github.com`, `uploads.github.com`],
          },
        },
      },
    ])

    expect(result.errors).toEqual([])
    const entries = Object.values(result.placeholders)
    expect(entries).toHaveLength(1)
    expect(entries[0].allowedDomains).toEqual([`github.com`, `uploads.github.com`])
  })

  it(`uses a valid narrowing override verbatim (may omit api.github.com)`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-gh`,
          brand: `github`,
          secretId: `sec-gh`,
          options: {
            repoUrl: `https://github.com/org/repo`,
            allowedDomains: [`github.com`],
          },
        },
      },
    ])

    expect(result.errors).toEqual([])
    const entries = Object.values(result.placeholders)
    expect(entries).toHaveLength(1)
    expect(entries[0].allowedDomains).toEqual([`github.com`])
    expect(result.extraEnv.TDSK_GIT_0_TOKEN).toMatch(/^tdsk_ph_/)
    expect(result.extraEnv.TDSK_GIT_COUNT).toBe(`1`)
  })

  it(`fails closed when the override redirects away from the repo host`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-gh`,
          brand: `github`,
          secretId: `sec-gh`,
          options: {
            repoUrl: `https://github.com/org/repo`,
            allowedDomains: [`attacker.com`],
          },
        },
      },
    ])

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain(`does not include the repo host 'github.com'`)
    expect(result.extraEnv.TDSK_GIT_0_REPO).toBeUndefined()
    expect(result.extraEnv.TDSK_GIT_0_TOKEN).toBeUndefined()
    expect(result.extraEnv.GH_TOKEN).toBeUndefined()
    expect(Object.keys(result.placeholders)).toHaveLength(0)
    expect(result.extraEnv.TDSK_GIT_COUNT).toBe(`0`)
  })

  it(`fails closed when the override lists other hosts but omits the repo host`, async () => {
    // An override with extra hosts is valid only when the repo host itself is
    // present — here it is absent, so the provider is skipped
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-gl`,
          brand: `gitlab`,
          secretId: `sec-gl`,
          options: {
            repoUrl: `https://gitlab.example.io/org/b`,
            allowedDomains: [`api.gitlab.example.io`, `attacker.com`],
          },
        },
      },
    ])

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain(
      `does not include the repo host 'gitlab.example.io'`
    )
    expect(Object.keys(result.placeholders)).toHaveLength(0)
    expect(result.extraEnv.TDSK_GIT_COUNT).toBe(`0`)
  })

  it(`ignores an options.allowedDomains override with no valid strings`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-gh`,
          brand: `github`,
          secretId: `sec-gh`,
          options: {
            repoUrl: `https://github.com/org/repo`,
            allowedDomains: [``, 42, null],
          },
        },
      },
    ])

    expect(result.errors).toEqual([])
    const entries = Object.values(result.placeholders)
    expect(entries).toHaveLength(1)
    expect(entries[0].allowedDomains).toEqual([`github.com`, `api.github.com`])
  })

  it(`exports GH_TOKEN set to the github provider's placeholder token`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-gh`,
          brand: `github`,
          secretId: `sec-gh`,
          options: { repoUrl: `https://github.com/org/repo` },
        },
      },
    ])

    expect(result.errors).toEqual([])
    expect(result.extraEnv.GH_TOKEN).toBe(result.extraEnv.TDSK_GIT_0_TOKEN)
    expect(result.extraEnv.GH_TOKEN).toMatch(/^tdsk_ph_/)
  })

  it(`exports GH_TOKEN exactly once, for the highest-priority github provider`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 5,
        provider: {
          id: `prov-gh-low`,
          brand: `github`,
          secretId: `sec-gh-low`,
          options: { repoUrl: `https://github.com/org/low` },
        },
      },
      {
        priority: 1,
        provider: {
          id: `prov-gh-high`,
          brand: `github`,
          secretId: `sec-gh-high`,
          options: { repoUrl: `https://github.com/org/high` },
        },
      },
    ])

    expect(result.errors).toEqual([])
    // prov-gh-high (priority 1) sorts first and owns GH_TOKEN
    expect(result.extraEnv.TDSK_GIT_0_REPO).toBe(`https://github.com/org/high`)
    expect(result.extraEnv.GH_TOKEN).toBe(result.extraEnv.TDSK_GIT_0_TOKEN)
    expect(result.extraEnv.GH_TOKEN).not.toBe(result.extraEnv.TDSK_GIT_1_TOKEN)
    expect(result.placeholders[result.extraEnv.GH_TOKEN]).toEqual({
      secretId: `sec-gh-high`,
      allowedDomains: [`github.com`, `api.github.com`],
    })
  })

  it(`omits GH_TOKEN when no github-brand provider is linked`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-gl`,
          brand: `gitlab`,
          secretId: `sec-gl`,
          options: { repoUrl: `https://gitlab.com/org/repo` },
        },
      },
    ])

    expect(result.errors).toEqual([])
    expect(result.extraEnv.TDSK_GIT_0_TOKEN).toMatch(/^tdsk_ph_/)
    expect(result.extraEnv.GH_TOKEN).toBeUndefined()
  })

  it(`omits GH_TOKEN when the github provider has no token placeholder`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-gh-public`,
          brand: `github`,
          options: { repoUrl: `https://github.com/org/repo` },
        },
      },
    ])

    expect(result.errors).toEqual([])
    expect(result.extraEnv.TDSK_GIT_0_TOKEN).toBeUndefined()
    expect(result.extraEnv.GH_TOKEN).toBeUndefined()
  })

  it(`fails closed when repoUrl is unparseable and provider has a secretId`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-ssh`,
          brand: `github`,
          secretId: `sec-1`,
          options: { repoUrl: `git@github.com:org/repo.git` },
        },
      },
    ])

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain(`unparseable repoUrl`)
    expect(result.extraEnv.TDSK_GIT_0_REPO).toBeUndefined()
    expect(result.extraEnv.TDSK_GIT_0_TOKEN).toBeUndefined()
    expect(Object.keys(result.placeholders)).toHaveLength(0)
    expect(result.extraEnv.TDSK_GIT_COUNT).toBe(`0`)
  })

  it(`allows unparseable repoUrl when provider has no secretId (no placeholder needed)`, async () => {
    const result = await resolveGitProviderEnv([
      {
        priority: 0,
        provider: {
          id: `prov-public`,
          brand: `github`,
          options: { repoUrl: `git@github.com:org/repo.git` },
        },
      },
    ])

    expect(result.errors).toEqual([])
    expect(result.extraEnv.TDSK_GIT_0_REPO).toBe(`git@github.com:org/repo.git`)
    expect(result.extraEnv.TDSK_GIT_0_TOKEN).toBeUndefined()
    expect(Object.keys(result.placeholders)).toHaveLength(0)
    expect(result.extraEnv.TDSK_GIT_COUNT).toBe(`1`)
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
