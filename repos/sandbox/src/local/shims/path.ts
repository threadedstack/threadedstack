import type { TShimDefinition } from '@TSB/types'

export const pathShim: TShimDefinition = {
  names: [`path`, `node:path`],

  source: `
    export const join = (...parts) => parts.join('/').replace(/\\/\\/+/g, '/')
    export const resolve = (...parts) => {
      let resolved = ''
      for (const p of parts) {
        resolved = p.startsWith('/') ? p : (resolved ? resolved + '/' + p : p)
      }
      return resolved.replace(/\\/\\/+/g, '/')
    }
    export const dirname = (p) => {
      const parts = p.split('/')
      parts.pop()
      return parts.join('/') || '/'
    }
    export const basename = (p, ext) => {
      const b = p.split('/').pop() || ''
      return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b
    }
    export const extname = (p) => {
      const m = p.match(/\\.[^.]+$/)
      return m ? m[0] : ''
    }
    export const normalize = (p) => p.replace(/\\/\\/+/g, '/')
    export const sep = '/'
    export const posix = { sep: '/' }
    export default { join, resolve, dirname, basename, extname, normalize, sep, posix }
  `,
}
