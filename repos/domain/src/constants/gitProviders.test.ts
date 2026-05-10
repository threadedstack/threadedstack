import { describe, it, expect } from 'vitest'
import { GitProviderTemplates } from './gitProviders'
import { EGitProvider } from '@TDM/types'

describe(`GitProviderTemplates`, () => {
  it(`should have an entry for every EGitProvider member`, () => {
    const brands = Object.values(EGitProvider)
    expect(Object.keys(GitProviderTemplates)).toHaveLength(brands.length)
    for (const brand of brands) {
      expect(GitProviderTemplates[brand]).toBeDefined()
      expect(GitProviderTemplates[brand]!.id).toBe(brand)
    }
  })

  it(`should have required fields on every entry`, () => {
    for (const entry of Object.values(GitProviderTemplates)) {
      expect(entry).toHaveProperty(`id`)
      expect(entry).toHaveProperty(`name`)
      expect(entry).toHaveProperty(`defaultSecretName`)
      expect(entry).toHaveProperty(`tokenPlaceholder`)
      expect(entry).toHaveProperty(`gitDomain`)
      expect(entry).toHaveProperty(`apiUrlBase`)
    }
  })

  it(`should have correct defaults for GitHub`, () => {
    const gh = GitProviderTemplates[EGitProvider.github]!
    expect(gh.name).toBe(`GitHub`)
    expect(gh.gitDomain).toBe(`github.com`)
    expect(gh.apiUrlBase).toBe(`https://api.github.com`)
    expect(gh.defaultSecretName).toBe(`GITHUB_TOKEN`)
    expect(gh.tokenPattern).toBe(`^(ghp_|github_pat_)`)
  })

  it(`should have correct defaults for GitLab`, () => {
    const gl = GitProviderTemplates[EGitProvider.gitlab]!
    expect(gl.name).toBe(`GitLab`)
    expect(gl.gitDomain).toBe(`gitlab.com`)
    expect(gl.tokenPattern).toBe(`^glpat-`)
  })

  it(`should have empty gitDomain for self-hosted providers`, () => {
    expect(GitProviderTemplates[EGitProvider.gitea]!.gitDomain).toBe(``)
    expect(GitProviderTemplates[EGitProvider.custom]!.gitDomain).toBe(``)
  })
})
