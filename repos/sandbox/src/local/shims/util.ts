import type { TShimDefinition } from '@TSB/types'

export const utilShim: TShimDefinition = {
  names: [`util`, `node:util`],

  source: `
    function format(fmt, ...args) {
      if (typeof fmt !== 'string') {
        const parts = []
        parts.push(inspect(fmt))
        for (let i = 0; i < args.length; i++) parts.push(inspect(args[i]))
        return parts.join(' ')
      }
      let idx = 0
      let result = fmt.replace(/%[sdjoO%]/g, (match) => {
        if (match === '%%') return '%'
        if (idx >= args.length) return match
        const val = args[idx++]
        switch (match) {
          case '%s': return String(val)
          case '%d': return Number(val).toString()
          case '%j':
            try { return JSON.stringify(val) }
            catch (e) { return '[Circular]' }
          case '%o':
          case '%O':
            return inspect(val)
          default: return match
        }
      })
      while (idx < args.length) {
        result += ' ' + inspect(args[idx++])
      }
      return result
    }

    function inspect(obj, opts) {
      const seen = new WeakSet()
      const depth = (opts && typeof opts === 'object' && opts.depth !== undefined) ? opts.depth : 2
      function _inspect(val, currentDepth) {
        if (val === null) return 'null'
        if (val === undefined) return 'undefined'
        if (typeof val === 'string') return "'" + val + "'"
        if (typeof val === 'number' || typeof val === 'boolean') return String(val)
        if (typeof val === 'function') return '[Function: ' + (val.name || 'anonymous') + ']'
        if (typeof val === 'symbol') return val.toString()
        if (val instanceof Date) return val.toISOString()
        if (val instanceof RegExp) return val.toString()
        if (typeof val === 'object') {
          if (seen.has(val)) return '[Circular]'
          seen.add(val)
          if (currentDepth > depth) return Array.isArray(val) ? '[Array]' : '[Object]'
          if (Array.isArray(val)) {
            const items = val.map(v => _inspect(v, currentDepth + 1))
            return '[ ' + items.join(', ') + ' ]'
          }
          const keys = Object.keys(val)
          const pairs = keys.map(k => k + ': ' + _inspect(val[k], currentDepth + 1))
          return '{ ' + pairs.join(', ') + ' }'
        }
        return String(val)
      }
      return _inspect(obj, 0)
    }

    function promisify(fn) {
      return function(...args) {
        return new Promise((resolve, reject) => {
          fn(...args, (err, result) => {
            if (err) reject(err)
            else resolve(result)
          })
        })
      }
    }

    const types = {
      isDate(val) { return val instanceof Date },
      isRegExp(val) { return val instanceof RegExp },
      isArray(val) { return Array.isArray(val) },
      isPromise(val) { return val instanceof Promise },
      isMap(val) { return val instanceof Map },
      isSet(val) { return val instanceof Set },
    }

    function inherits(ctor, superCtor) {
      ctor.super_ = superCtor
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: { value: ctor, enumerable: false, writable: true, configurable: true },
      })
    }

    const _deprecatedWarnings = new Set()
    function deprecate(fn, msg) {
      return function(...args) {
        if (!_deprecatedWarnings.has(msg)) {
          _deprecatedWarnings.add(msg)
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('DeprecationWarning: ' + msg)
          }
        }
        return fn.apply(this, args)
      }
    }

    const TextEncoder = globalThis.TextEncoder
    const TextDecoder = globalThis.TextDecoder

    export {
      format, inspect, promisify, types,
      inherits, deprecate, TextEncoder, TextDecoder,
    }
    export default {
      format, inspect, promisify, types,
      inherits, deprecate, TextEncoder, TextDecoder,
    }
  `,
}
