import type { TShimDefinition } from '@TSB/types'

export const querystringShim: TShimDefinition = {
  names: [`querystring`, `node:querystring`],

  source: `
    function escape(str) {
      return encodeURIComponent(str)
    }

    function unescape(str) {
      try {
        return decodeURIComponent(str.replace(/\\+/g, ' '))
      } catch {
        return str
      }
    }

    function parse(str, sep, eq) {
      sep = sep || '&'
      eq = eq || '='
      const result = {}
      if (typeof str !== 'string' || str.length === 0) return result
      const pairs = str.split(sep)
      for (let i = 0; i < pairs.length; i++) {
        const idx = pairs[i].indexOf(eq)
        let key, val
        if (idx >= 0) {
          key = unescape(pairs[i].substring(0, idx))
          val = unescape(pairs[i].substring(idx + eq.length))
        } else {
          key = unescape(pairs[i])
          val = ''
        }
        if (result[key] !== undefined) {
          if (Array.isArray(result[key])) {
            result[key].push(val)
          } else {
            result[key] = [result[key], val]
          }
        } else {
          result[key] = val
        }
      }
      return result
    }

    function stringify(obj, sep, eq) {
      sep = sep || '&'
      eq = eq || '='
      if (!obj || typeof obj !== 'object') return ''
      const parts = []
      const keys = Object.keys(obj)
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]
        const v = obj[k]
        const ek = escape(k)
        if (Array.isArray(v)) {
          for (let j = 0; j < v.length; j++) {
            parts.push(ek + eq + escape(String(v[j])))
          }
        } else {
          parts.push(ek + eq + escape(String(v)))
        }
      }
      return parts.join(sep)
    }

    export { parse, stringify, escape, unescape }
    export default { parse, stringify, escape, unescape }
  `,
}
