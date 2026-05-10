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
  openai: [`api.openai.com`],
  mistral: [`api.mistral.ai`],
  openrouter: [`openrouter.ai`],
  anthropic: [`api.anthropic.com`],
  [`kimi-coding`]: [`api.moonshot.cn`],
  [`google-vertex`]: [`*.googleapis.com`],
  [`amazon-bedrock`]: [`*.amazonaws.com`],
  google: [`generativelanguage.googleapis.com`],
  [`github-copilot`]: [`api.githubcopilot.com`],
  huggingface: [`api-inference.huggingface.co`],
  [`google-gemini-cli`]: [`generativelanguage.googleapis.com`],
  github: [`github.com`, `api.github.com`],
  gitlab: [`gitlab.com`],
  bitbucket: [`bitbucket.org`, `api.bitbucket.org`],
  [`azure-devops`]: [`dev.azure.com`],
}
