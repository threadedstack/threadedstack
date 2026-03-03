import type {
  IWebProvider,
  TFetchResult,
  TSearchResult,
  TJinaProviderOpts,
  TJinaSearchResponse,
  TJinaReaderResponse,
} from '@TAG/types'

import { logger } from '@TAG/utils/logger'
import {
  SearchBase,
  ReaderBase,
  AllowedProtocols,
  RequestTimeoutMS,
  BlockedHostnamePatterns,
} from '@TAG/tools/definitions/web/jinaValues'

export const validateFetchUrl = (url: string): void => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Invalid URL: ${url}`)
  }
  if (!AllowedProtocols.includes(parsed.protocol)) {
    throw new Error(`Blocked URL protocol: ${parsed.protocol}`)
  }
  if (BlockedHostnamePatterns.some((p) => p.test(parsed.hostname))) {
    throw new Error(`Blocked URL host: ${parsed.hostname}`)
  }
}

export class JinaWebProvider implements IWebProvider {
  readonly type = `jina` as const
  #apiKey?: string

  constructor(opts?: TJinaProviderOpts) {
    this.#apiKey = opts?.apiKey
  }

  async search(query: string, maxResults = 5): Promise<TSearchResult[]> {
    const url = `${SearchBase}?q=${encodeURIComponent(query)}`
    const headers: Record<string, string> = { Accept: `application/json` }
    if (this.#apiKey) headers.Authorization = `Bearer ${this.#apiKey}`

    try {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(RequestTimeoutMS),
      })
      if (!res.ok) {
        logger.warn(`Jina search failed: ${res.status} ${res.statusText}`)
        return []
      }

      const json = (await res.json()) as TJinaSearchResponse
      return (json.data || []).slice(0, maxResults).map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.description,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.warn(`Jina search error: ${message}`)
      return []
    }
  }

  async fetch(url: string, opts?: { maxLength?: number }): Promise<TFetchResult> {
    validateFetchUrl(url)

    const readerUrl = `${ReaderBase}${url}`
    const headers: Record<string, string> = { Accept: `application/json` }
    if (this.#apiKey) headers.Authorization = `Bearer ${this.#apiKey}`

    const res = await fetch(readerUrl, {
      headers,
      signal: AbortSignal.timeout(RequestTimeoutMS),
    })
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`)

    const json = (await res.json()) as TJinaReaderResponse
    const data = json?.data
    if (!data?.content) {
      throw new Error(`Jina reader returned no content for: ${url}`)
    }

    const fullLength = data.content.length
    const maxLength = opts?.maxLength ?? 50000

    let content = data.content
    if (content.length > maxLength) {
      content =
        content.slice(0, maxLength) + `\n\n[Content truncated at ${maxLength} characters]`
    }

    return {
      url: data.url ?? url,
      title: data.title ?? ``,
      content,
      contentLength: fullLength,
    }
  }
}
