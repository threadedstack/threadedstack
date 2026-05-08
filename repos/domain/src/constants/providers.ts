import type { TProviderTemplate, TDockerProviderTemplate } from '@TDM/types'
import { ELLMProviderBrand, EDockerProviderBrand } from '@TDM/types'

/**
 * Ollama API URL for live model discovery (user-installed models).
 * Only Ollama needs this — all other providers use pi-mono's static registry.
 */
export const DefProviderModelUrls = {
  ollamaUrl: `http://localhost:11434/api/tags`,
}

export const DockerRegistryDefaults: Record<
  EDockerProviderBrand,
  TDockerProviderTemplate
> = {
  [EDockerProviderBrand.ghcr]: {
    id: EDockerProviderBrand.ghcr,
    name: `GitHub Container Registry`,
    registry: `ghcr.io`,
    defaultSecretName: `GHCR_TOKEN`,
  },
  [EDockerProviderBrand.gitlab]: {
    id: EDockerProviderBrand.gitlab,
    name: `GitLab Container Registry`,
    registry: `registry.gitlab.com`,
    defaultSecretName: `GITLAB_DEPLOY_TOKEN`,
  },
  [EDockerProviderBrand.quay]: {
    id: EDockerProviderBrand.quay,
    name: `Quay.io`,
    registry: `quay.io`,
    defaultSecretName: `QUAY_TOKEN`,
  },
  [EDockerProviderBrand.dockerhub]: {
    id: EDockerProviderBrand.dockerhub,
    name: `Docker Hub`,
    registry: `https://index.docker.io/v1/`,
    defaultSecretName: `DOCKERHUB_TOKEN`,
  },
  [EDockerProviderBrand.custom]: {
    id: EDockerProviderBrand.custom,
    name: `Custom Registry`,
    registry: ``,
    defaultSecretName: `REGISTRY_TOKEN`,
  },
}

/**
 * Provider configuration templates — auth/connection config only.
 * Model catalogs are sourced from pi-mono's registry via the
 * `GET /providers/:brand/models` endpoint.
 */
export const LLMProviderTemplates: Partial<Record<ELLMProviderBrand, TProviderTemplate>> =
  {
    [ELLMProviderBrand.anthropic]: {
      id: ELLMProviderBrand.anthropic,
      name: `Anthropic`,
      baseUrl: `https://api.anthropic.com`,
      defaultSecretName: `ANTHROPIC_API_KEY`,
      apiKeyPlaceholder: `sk-ant-api03-...`,
      apiKeyPattern: `^sk-ant-`,
    },
    [ELLMProviderBrand.openai]: {
      id: ELLMProviderBrand.openai,
      name: `OpenAI`,
      baseUrl: `https://api.openai.com/v1`,
      defaultSecretName: `OPENAI_API_KEY`,
      apiKeyPlaceholder: `sk-...`,
      apiKeyPattern: `^sk-`,
    },
    [ELLMProviderBrand.google]: {
      id: ELLMProviderBrand.google,
      name: `Google AI`,
      baseUrl: `https://generativelanguage.googleapis.com/v1`,
      defaultSecretName: `GOOGLE_AI_API_KEY`,
      apiKeyPlaceholder: `AIza...`,
      apiKeyPattern: `^AIza`,
    },
    [ELLMProviderBrand.zai]: {
      id: ELLMProviderBrand.zai,
      name: `Z.AI`,
      baseUrl: `https://api.z.ai/api/paas/v4`,
      defaultSecretName: `ZAI_API_KEY`,
      apiKeyPlaceholder: `Enter your Z.AI API key...`,
      apiKeyPattern: ``,
    },
    [ELLMProviderBrand.openrouter]: {
      id: ELLMProviderBrand.openrouter,
      name: `OpenRouter`,
      baseUrl: `https://openrouter.ai/api/v1`,
      defaultSecretName: `OPENROUTER_API_KEY`,
      apiKeyPlaceholder: `sk-or-v1-...`,
      apiKeyPattern: `^sk-or-`,
    },
    [ELLMProviderBrand.ollama]: {
      id: ELLMProviderBrand.ollama,
      name: `Ollama`,
      baseUrl: `http://localhost:11434/v1`,
      defaultSecretName: `OLLAMA_API_KEY`,
      apiKeyPlaceholder: `Optional — Ollama typically runs without auth`,
      apiKeyPattern: ``,
    },
    [ELLMProviderBrand.custom]: {
      id: ELLMProviderBrand.custom,
      name: `Custom Provider`,
      baseUrl: ``,
      defaultSecretName: `PROVIDER_API_KEY`,
      apiKeyPlaceholder: `Enter your API key...`,
    },
  }
