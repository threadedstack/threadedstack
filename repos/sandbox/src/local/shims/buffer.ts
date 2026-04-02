import type { TShimDefinition } from '@TSB/types'

export const bufferShim: TShimDefinition = {
  names: [`buffer`, `node:buffer`],

  source: `
    class Buffer {
      constructor(data) {
        this._data = data || []
      }

      static _utf8Encode(str) {
        const bytes = []
        for (let i = 0; i < str.length; i++) {
          let code = str.charCodeAt(i)
          if (code < 0x80) {
            bytes.push(code)
          } else if (code < 0x800) {
            bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
          } else if (code >= 0xd800 && code <= 0xdbff) {
            const hi = code
            const lo = str.charCodeAt(i + 1)
            if (lo >= 0xdc00 && lo <= 0xdfff) {
              i++
              code = ((hi - 0xd800) << 10) + (lo - 0xdc00) + 0x10000
              bytes.push(
                0xf0 | (code >> 18),
                0x80 | ((code >> 12) & 0x3f),
                0x80 | ((code >> 6) & 0x3f),
                0x80 | (code & 0x3f)
              )
            } else {
              bytes.push(0xef, 0xbf, 0xbd)
            }
          } else {
            bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
          }
        }
        return bytes
      }

      static _utf8Decode(bytes) {
        let str = ''
        let i = 0
        while (i < bytes.length) {
          const b = bytes[i]
          if (b < 0x80) {
            str += String.fromCharCode(b)
            i++
          } else if ((b & 0xe0) === 0xc0) {
            str += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f))
            i += 2
          } else if ((b & 0xf0) === 0xe0) {
            str += String.fromCharCode(
              ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
            )
            i += 3
          } else if ((b & 0xf8) === 0xf0) {
            const cp =
              ((b & 0x07) << 18) |
              ((bytes[i + 1] & 0x3f) << 12) |
              ((bytes[i + 2] & 0x3f) << 6) |
              (bytes[i + 3] & 0x3f)
            const offset = cp - 0x10000
            str += String.fromCharCode(0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff))
            i += 4
          } else {
            i++
          }
        }
        return str
      }

      static _hexEncode(bytes) {
        const hex = '0123456789abcdef'
        let out = ''
        for (let i = 0; i < bytes.length; i++) {
          out += hex[(bytes[i] >> 4) & 0xf] + hex[bytes[i] & 0xf]
        }
        return out
      }

      static _hexDecode(hex) {
        const bytes = []
        const len = hex.length - (hex.length % 2)
        for (let i = 0; i < len; i += 2) {
          const byte = parseInt(hex.substring(i, i + 2), 16)
          if (Number.isNaN(byte)) break
          bytes.push(byte)
        }
        return bytes
      }

      static _b64Encode(bytes) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
        let out = ''
        for (let i = 0; i < bytes.length; i += 3) {
          const b0 = bytes[i]
          const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0
          const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0
          out += chars[b0 >> 2]
          out += chars[((b0 & 3) << 4) | (b1 >> 4)]
          out += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '='
          out += i + 2 < bytes.length ? chars[b2 & 63] : '='
        }
        return out
      }

      static _b64Decode(str) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
        const bytes = []
        let buf = 0
        let bits = 0
        for (let i = 0; i < str.length; i++) {
          const c = str[i]
          if (c === '=') break
          const idx = chars.indexOf(c)
          if (idx === -1) continue
          buf = (buf << 6) | idx
          bits += 6
          if (bits >= 8) {
            bits -= 8
            bytes.push((buf >> bits) & 0xff)
          }
        }
        return bytes
      }

      static from(input, encoding) {
        if (input instanceof Buffer) return new Buffer(input._data.slice())
        if (Array.isArray(input)) return new Buffer(input.slice())
        if (typeof input === 'string') {
          const enc = (encoding || 'utf8').toLowerCase()
          if (enc === 'hex') return new Buffer(Buffer._hexDecode(input))
          if (enc === 'base64') return new Buffer(Buffer._b64Decode(input))
          if (enc === 'ascii' || enc === 'latin1' || enc === 'binary') {
            const bytes = []
            for (let i = 0; i < input.length; i++) bytes.push(input.charCodeAt(i) & 0xff)
            return new Buffer(bytes)
          }
          return new Buffer(Buffer._utf8Encode(input))
        }
        return new Buffer([])
      }

      static alloc(size, fill) {
        const arr = new Array(size)
        if (fill !== undefined && typeof fill === 'string') {
          const fillBytes = Buffer._utf8Encode(fill)
          if (fillBytes.length === 0) {
            for (let i = 0; i < size; i++) arr[i] = 0
          } else {
            for (let i = 0; i < size; i++) arr[i] = fillBytes[i % fillBytes.length]
          }
        } else {
          const val = fill !== undefined ? (typeof fill === 'number' ? fill & 0xff : 0) : 0
          for (let i = 0; i < size; i++) arr[i] = val
        }
        return new Buffer(arr)
      }

      static isBuffer(obj) {
        return obj instanceof Buffer
      }

      static concat(list) {
        const result = []
        for (let i = 0; i < list.length; i++) {
          const buf = list[i]
          for (let j = 0; j < buf._data.length; j++) result.push(buf._data[j])
        }
        return new Buffer(result)
      }

      static byteLength(string, encoding) {
        return Buffer.from(string, encoding).length
      }

      get length() {
        return this._data.length
      }

      toString(encoding) {
        const enc = (encoding || 'utf8').toLowerCase()
        if (enc === 'hex') return Buffer._hexEncode(this._data)
        if (enc === 'base64') return Buffer._b64Encode(this._data)
        if (enc === 'ascii' || enc === 'latin1' || enc === 'binary') {
          let out = ''
          for (let i = 0; i < this._data.length; i++) out += String.fromCharCode(this._data[i])
          return out
        }
        return Buffer._utf8Decode(this._data)
      }

      slice(start, end) {
        return new Buffer(this._data.slice(start, end))
      }

      equals(other) {
        if (this._data.length !== other._data.length) return false
        for (let i = 0; i < this._data.length; i++) {
          if (this._data[i] !== other._data[i]) return false
        }
        return true
      }

      toJSON() {
        return { type: 'Buffer', data: this._data.slice() }
      }
    }

    globalThis.Buffer = Buffer

    export { Buffer }
    export default { Buffer }
  `,
}
