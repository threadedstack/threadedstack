import type { TShimDefinition } from '@TSB/types'

export const urlShim: TShimDefinition = {
  names: [`url`, `node:url`],

  source: `
    const URL = globalThis.URL
    const URLSearchParams = globalThis.URLSearchParams

    function parse(urlString, parseQueryString) {
      try {
        const u = new URL(urlString)
        const result = {
          protocol: u.protocol,
          slashes: u.protocol ? true : null,
          auth: u.username ? (u.password ? u.username + ':' + u.password : u.username) : null,
          host: u.host,
          port: u.port || null,
          hostname: u.hostname,
          hash: u.hash || null,
          search: u.search || null,
          query: parseQueryString ? Object.fromEntries(u.searchParams) : (u.search ? u.search.slice(1) : null),
          pathname: u.pathname,
          path: u.pathname + (u.search || ''),
          href: u.href,
        }
        return result
      } catch (e) {
        return {
          protocol: null, slashes: null, auth: null, host: null,
          port: null, hostname: null, hash: null, search: null,
          query: null, pathname: urlString, path: urlString, href: urlString,
        }
      }
    }

    function format(urlObj) {
      if (typeof urlObj === 'string') return urlObj
      let result = ''
      if (urlObj.protocol) {
        result += urlObj.protocol
        if (urlObj.slashes) result += '//'
      }
      if (urlObj.auth) result += urlObj.auth + '@'
      if (urlObj.hostname) result += urlObj.hostname
      if (urlObj.port) result += ':' + urlObj.port
      if (urlObj.pathname) result += urlObj.pathname
      if (urlObj.search) result += urlObj.search
      else if (urlObj.query) {
        const q = typeof urlObj.query === 'string'
          ? urlObj.query
          : new URLSearchParams(urlObj.query).toString()
        if (q) result += '?' + q
      }
      if (urlObj.hash) result += urlObj.hash
      return result
    }

    function resolve(from, to) {
      return new URL(to, from).href
    }

    export { URL, URLSearchParams, parse, format, resolve }
    export default { URL, URLSearchParams, parse, format, resolve }
  `,
}
