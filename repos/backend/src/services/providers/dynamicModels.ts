import { DefProviderModelUrls } from '@tdsk/domain'

export type TDynamicModels = {
  zaiUrl: string
  openAiUrl: string
  ollamaUrl: string
  googleUrl: string
  openRouterUrl: string
}

export class DynamicModels {
  zaiUrl: string
  openAiUrl: string
  ollamaUrl: string
  googleUrl: string
  openRouterUrl: string

  constructor(opts: Partial<TDynamicModels> = {}) {
    Object.assign(this, { ...DefProviderModelUrls, ...opts })
  }

  /**
   * Fetch models from the OpenAI API (requires API key)
   */
  openAI = async (apiKey: string) => {
    const resp = await fetch(this.openAiUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!resp.ok) throw new Error(`OpenAI API returned ${resp.status}`)

    const json = await resp.json()
    return (json.data || [])
      .filter((m: any) => m.id.startsWith(`gpt-`) || m.id.startsWith(`o`))
      .map((m: any) => ({
        id: m.id,
        name: m.id,
      }))
      .sort((a: any, b: any) => a.id.localeCompare(b.id))
  }

  /**
   * Fetch models from an Ollama instance (no auth required)
   */
  ollama = async (baseUrl: string) => {
    const ollamaUrl = baseUrl
      ? `${baseUrl.replace(/\/v1\/?$/, ``)}/api/tags`
      : this.ollamaUrl

    const resp = await fetch(ollamaUrl)
    if (!resp.ok) throw new Error(`Ollama API returned ${resp.status}`)

    const json = await resp.json()
    return (json.models || []).map((m: any) => ({
      id: m.name,
      name: m.name,
    }))
  }

  /**
   * Fetch models from the OpenRouter API (no auth required)
   */
  openRouter = async () => {
    const resp = await fetch(this.openRouterUrl)
    if (!resp.ok) throw new Error(`OpenRouter API returned ${resp.status}`)

    const json = await resp.json()
    return (json.data || []).map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      maxTokens: m.top_provider?.max_completion_tokens || undefined,
      contextWindow: m.context_length || undefined,
      description: m.description?.slice(0, 200) || undefined,
    }))
  }

  /**
   * Fetch models from the Google Generative AI API (requires API key)
   */
  google = async (apiKey: string) => {
    const resp = await fetch(`${this.googleUrl}?key=${apiKey}`)
    if (!resp.ok) throw new Error(`Google API returned ${resp.status}`)

    const json = await resp.json()
    return (json.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes(`generateContent`))
      .map((m: any) => ({
        id: (m.name || ``).replace(/^models\//, ``),
        name: m.displayName || m.name,
        maxTokens: m.maxOutputTokens || undefined,
        contextWindow: m.inputTokenLimit || undefined,
        description: m.description?.slice(0, 200) || undefined,
      }))
  }

  /**
   * Fetch models from the ZAI API (requires API key)
   */
  zai = async (apiKey: string) => {
    const resp = await fetch(this.zaiUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!resp.ok) throw new Error(`ZAI API returned ${resp.status}`)

    const json = await resp.json()
    return (json.data || [])
      .filter((m: any) => m.id.startsWith(`gpt-`) || m.id.startsWith(`o`))
      .map((m: any) => ({
        id: m.id,
        name: m.id,
      }))
      .sort((a: any, b: any) => a.id.localeCompare(b.id))
  }
}
