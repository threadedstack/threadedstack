import { describe, it, expect } from 'vitest'
import { AIProviderTemplates, DockerRegistryDefaults } from './providers'
import { EAIProviderBrand, EDockerProviderBrand } from '@TDM/types'

describe(`AIProviderTemplates`, () => {
  it(`should have templates for configured providers only`, () => {
    const configuredBrands = Object.keys(AIProviderTemplates) as EAIProviderBrand[]
    for (const brand of configuredBrands) {
      expect(AIProviderTemplates[brand]).toBeDefined()
      expect(AIProviderTemplates[brand]!.id).toBe(brand)
    }
  })

  it(`should have 7 provider entries`, () => {
    expect(Object.keys(AIProviderTemplates)).toHaveLength(7)
  })

  it(`should be config-only templates (no models or defaultModel)`, () => {
    for (const tmpl of Object.values(AIProviderTemplates)) {
      expect(tmpl).not.toHaveProperty(`models`)
      expect(tmpl).not.toHaveProperty(`defaultModel`)
      expect(tmpl).toHaveProperty(`id`)
      expect(tmpl).toHaveProperty(`name`)
      expect(tmpl).toHaveProperty(`baseUrl`)
      expect(tmpl).toHaveProperty(`defaultSecretName`)
      expect(tmpl).toHaveProperty(`apiKeyPlaceholder`)
    }
  })

  describe(`OpenRouter template`, () => {
    const tmpl = AIProviderTemplates[EAIProviderBrand.openrouter]

    it(`should have correct id and name`, () => {
      expect(tmpl.id).toBe(`openrouter`)
      expect(tmpl.name).toBe(`OpenRouter`)
    })

    it(`should have correct baseUrl`, () => {
      expect(tmpl.baseUrl).toBe(`https://openrouter.ai/api/v1`)
    })

    it(`should have correct apiKeyPattern`, () => {
      expect(tmpl.apiKeyPattern).toBe(`^sk-or-`)
    })
  })

  describe(`Ollama template`, () => {
    const tmpl = AIProviderTemplates[EAIProviderBrand.ollama]

    it(`should have correct id and name`, () => {
      expect(tmpl.id).toBe(`ollama`)
      expect(tmpl.name).toBe(`Ollama`)
    })

    it(`should have correct baseUrl`, () => {
      expect(tmpl.baseUrl).toBe(`http://localhost:11434/v1`)
    })

    it(`should have empty apiKeyPattern`, () => {
      expect(tmpl.apiKeyPattern).toBe(``)
    })
  })

  describe(`Provider baseUrls`, () => {
    it(`should have Anthropic with correct baseUrl`, () => {
      expect(AIProviderTemplates[EAIProviderBrand.anthropic].baseUrl).toBe(
        `https://api.anthropic.com`
      )
    })

    it(`should have OpenAI with correct baseUrl`, () => {
      expect(AIProviderTemplates[EAIProviderBrand.openai].baseUrl).toBe(
        `https://api.openai.com/v1`
      )
    })

    it(`should have Custom with empty baseUrl`, () => {
      expect(AIProviderTemplates[EAIProviderBrand.custom].baseUrl).toBe(``)
    })
  })
})

describe(`DockerRegistryDefaults`, () => {
  it(`should have an entry for every EDockerProviderBrand member`, () => {
    const brands = Object.values(EDockerProviderBrand)
    expect(Object.keys(DockerRegistryDefaults)).toHaveLength(brands.length)
    for (const brand of brands) {
      expect(DockerRegistryDefaults[brand]).toBeDefined()
      expect(DockerRegistryDefaults[brand].id).toBe(brand)
    }
  })

  it(`should have required fields on every entry`, () => {
    for (const entry of Object.values(DockerRegistryDefaults)) {
      expect(entry).toHaveProperty(`id`)
      expect(entry).toHaveProperty(`name`)
      expect(entry).toHaveProperty(`registry`)
      expect(entry).toHaveProperty(`defaultSecretName`)
    }
  })

  it(`should have correct registry defaults for known brands`, () => {
    expect(DockerRegistryDefaults[EDockerProviderBrand.ghcr].registry).toBe(`ghcr.io`)
    expect(DockerRegistryDefaults[EDockerProviderBrand.gitlab].registry).toBe(
      `registry.gitlab.com`
    )
    expect(DockerRegistryDefaults[EDockerProviderBrand.quay].registry).toBe(`quay.io`)
    expect(DockerRegistryDefaults[EDockerProviderBrand.dockerhub].registry).toBe(
      `https://index.docker.io/v1/`
    )
    expect(DockerRegistryDefaults[EDockerProviderBrand.custom].registry).toBe(``)
  })

  it(`should not contain ecr`, () => {
    expect(Object.keys(DockerRegistryDefaults)).not.toContain(`ecr`)
  })
})
