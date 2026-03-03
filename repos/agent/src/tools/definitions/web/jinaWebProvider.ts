import type {
  IWebProvider,
  TFetchResult,
  TSearchResult,
  TJinaProviderOpts,
  TJinaSearchResponse,
  TJinaReaderResponse,
} from '@TAG/types'

const SEARCH_BASE = `https://s.jina.ai/`
const READER_BASE = `https://r.jina.ai/`

export class JinaWebProvider implements IWebProvider {
  #apiKey?: string

  constructor(opts?: TJinaProviderOpts) {
    this.#apiKey = opts?.apiKey
  }

  async search(query: string, maxResults = 5): Promise<TSearchResult[]> {
    const url = `${SEARCH_BASE}?q=${encodeURIComponent(query)}`
    const headers: Record<string, string> = { Accept: `application/json` }
    if (this.#apiKey) headers.Authorization = `Bearer ${this.#apiKey}`

    try {
      const res = await fetch(url, { headers })
      if (!res.ok) return []

      const json = (await res.json()) as TJinaSearchResponse
      return (json.data || []).slice(0, maxResults).map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.description,
      }))
    } catch {
      return []
    }
  }

  async fetch(url: string, opts?: { maxLength?: number }): Promise<TFetchResult> {
    const readerUrl = `${READER_BASE}${url}`
    const headers: Record<string, string> = { Accept: `application/json` }
    if (this.#apiKey) headers.Authorization = `Bearer ${this.#apiKey}`

    const res = await fetch(readerUrl, { headers })
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`)

    const json = (await res.json()) as TJinaReaderResponse
    const data = json.data
    const fullLength = data.content.length
    const maxLength = opts?.maxLength ?? 50000

    let content = data.content
    if (content.length > maxLength) {
      content =
        content.slice(0, maxLength) + `\n\n[Content truncated at ${maxLength} characters]`
    }

    return {
      url: data.url,
      title: data.title,
      content,
      contentLength: fullLength,
    }
  }
}
