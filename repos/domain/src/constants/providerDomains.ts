import type { TProviderBrand } from '@TDM/types'

/**
 * Default allowed API domains per provider brand.
 * Used to pre-fill the allowedDomains field when creating providers
 * and to scope MITM secret swapping to known API endpoints.
 */
export const ProviderBrandDomains: Partial<Record<TProviderBrand, string[]>> = {
  ollama: [],
  zai: [`api.z.ai`],
  xai: [`api.x.ai`],
  groq: [`api.groq.com`],
  gitlab: [`gitlab.com`],
  openai: [`api.openai.com`],
  mistral: [`api.mistral.ai`],
  openrouter: [`openrouter.ai`],
  anthropic: [`api.anthropic.com`],
  [`azure-devops`]: [`dev.azure.com`],
  [`kimi-coding`]: [`api.moonshot.cn`],
  [`google-vertex`]: [`*.googleapis.com`],
  [`amazon-bedrock`]: [`*.amazonaws.com`],
  github: [`github.com`, `api.github.com`],
  google: [`generativelanguage.googleapis.com`],
  [`github-copilot`]: [`api.githubcopilot.com`],
  huggingface: [`api-inference.huggingface.co`],
  bitbucket: [`bitbucket.org`, `api.bitbucket.org`],
  [`google-antigravity`]: [`generativelanguage.googleapis.com`],
}
