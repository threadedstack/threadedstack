export type TSnippetFormat = 'curl' | 'fetch' | 'axios' | 'httpie'

export type TSnippetOpts = {
  url: string
  method: string
  headers?: Record<string, string>
  body?: string
}

const escapeShell = (str: string) => str.replace(/'/g, `'\\''`)

const generateCurl = (opts: TSnippetOpts): string => {
  const { url, method, headers = {}, body } = opts
  const parts = [`curl -X ${method.toUpperCase()}`]

  for (const [key, value] of Object.entries(headers)) {
    parts.push(`  -H '${escapeShell(key)}: ${escapeShell(value)}'`)
  }

  if (body) parts.push(`  -d '${escapeShell(body)}'`)

  parts.push(`  '${escapeShell(url)}'`)

  return parts.join(` \\\n`)
}

const generateFetch = (opts: TSnippetOpts): string => {
  const { url, method, headers = {}, body } = opts
  const options: string[] = []

  options.push(`  method: '${method.toUpperCase()}'`)

  const headerEntries = Object.entries(headers)
  if (headerEntries.length) {
    const headerLines = headerEntries.map(([k, v]) => `    '${k}': '${v}'`).join(`,\n`)
    options.push(`  headers: {\n${headerLines}\n  }`)
  }

  if (body) options.push(`  body: ${JSON.stringify(body)}`)

  return `fetch('${url}', {\n${options.join(`,\n`)}\n})`
}

const generateAxios = (opts: TSnippetOpts): string => {
  const { url, method, headers = {}, body } = opts
  const config: string[] = []

  config.push(`  method: '${method.toLowerCase()}'`)
  config.push(`  url: '${url}'`)

  const headerEntries = Object.entries(headers)
  if (headerEntries.length) {
    const headerLines = headerEntries.map(([k, v]) => `    '${k}': '${v}'`).join(`,\n`)
    config.push(`  headers: {\n${headerLines}\n  }`)
  }

  if (body) config.push(`  data: ${JSON.stringify(body)}`)

  return `axios({\n${config.join(`,\n`)}\n})`
}

const generateHttpie = (opts: TSnippetOpts): string => {
  const { url, method, headers = {}, body } = opts
  const parts = [`http ${method.toUpperCase()} '${escapeShell(url)}'`]

  for (const [key, value] of Object.entries(headers)) {
    parts.push(`  '${escapeShell(key)}:${escapeShell(value)}'`)
  }

  if (body) {
    try {
      const parsed = JSON.parse(body)
      for (const [key, value] of Object.entries(parsed)) {
        const val = typeof value === 'string' ? value : JSON.stringify(value)
        parts.push(`  ${escapeShell(key)}=${escapeShell(val)}`)
      }
    } catch {
      parts.push(`  --raw '${escapeShell(body)}'`)
    }
  }

  return parts.join(` \\\n`)
}

const generators: Record<TSnippetFormat, (opts: TSnippetOpts) => string> = {
  curl: generateCurl,
  fetch: generateFetch,
  axios: generateAxios,
  httpie: generateHttpie,
}

export const generateSnippet = (format: TSnippetFormat, opts: TSnippetOpts): string => {
  return generators[format](opts)
}
