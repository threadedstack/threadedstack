export type TJinaSearchItem = {
  title: string
  url: string
  description: string
  content: string
}

export type TJinaSearchResponse = {
  data: TJinaSearchItem[]
}

export type TJinaReaderResponse = {
  data: {
    title: string
    url: string
    content: string
  }
}

export type TJinaProviderOpts = {
  apiKey?: string
}

export type TSearchResult = {
  title: string
  url: string
  snippet: string
}

export type TFetchResult = {
  url: string
  title: string
  content: string
  contentLength: number
}

export interface IWebProvider {
  search(query: string, maxResults?: number): Promise<TSearchResult[]>
  fetch(url: string, opts?: { maxLength?: number }): Promise<TFetchResult>
}
