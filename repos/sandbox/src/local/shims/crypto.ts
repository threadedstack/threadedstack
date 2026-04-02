import crypto from 'node:crypto'
import type { TShimDefinition } from '@TSB/types'

export const cryptoShim: TShimDefinition = {
  names: [`crypto`, `node:crypto`],

  source: `
    function randomUUID() {
      return _cryptoRandomUUID()
    }

    function randomBytes(size) {
      const hex = _cryptoRandomBytes(size)
      return globalThis.Buffer.from(hex, 'hex')
    }

    function createHash(algorithm) {
      let _data = ''
      return {
        update(data) {
          _data += typeof data === 'string' ? data : data.toString()
          return this
        },
        digest(encoding) {
          return _cryptoHash(algorithm, _data, encoding || 'hex')
        },
      }
    }

    function createHmac(algorithm, key) {
      let _data = ''
      const _key = typeof key === 'string' ? key : key.toString()
      return {
        update(data) {
          _data += typeof data === 'string' ? data : data.toString()
          return this
        },
        digest(encoding) {
          return _cryptoHmac(algorithm, _key, _data, encoding || 'hex')
        },
      }
    }

    function timingSafeEqual(a, b) {
      const aHex = a.toString('hex')
      const bHex = b.toString('hex')
      return _cryptoTimingSafeEqual(aHex, bHex)
    }

    export { randomUUID, randomBytes, createHash, createHmac, timingSafeEqual }
    export default { randomUUID, randomBytes, createHash, createHmac, timingSafeEqual }
  `,

  setupCallbacks: async (jail, ivm) => {
    await jail.set(
      `_cryptoRandomUUID`,
      new ivm.Callback(() => {
        return crypto.randomUUID()
      })
    )

    await jail.set(
      `_cryptoRandomBytes`,
      new ivm.Callback((size: number) => {
        return crypto.randomBytes(size).toString('hex')
      })
    )

    await jail.set(
      `_cryptoHash`,
      new ivm.Callback((algorithm: string, data: string, encoding: string) => {
        return crypto
          .createHash(algorithm)
          .update(data)
          .digest(encoding as any)
      })
    )

    await jail.set(
      `_cryptoHmac`,
      new ivm.Callback(
        (algorithm: string, key: string, data: string, encoding: string) => {
          return crypto
            .createHmac(algorithm, key)
            .update(data)
            .digest(encoding as any)
        }
      )
    )

    await jail.set(
      `_cryptoTimingSafeEqual`,
      new ivm.Callback((a: string, b: string) => {
        const bufA = Buffer.from(a, 'hex')
        const bufB = Buffer.from(b, 'hex')
        if (bufA.length !== bufB.length) return false
        return crypto.timingSafeEqual(bufA, bufB)
      })
    )
  },
}
