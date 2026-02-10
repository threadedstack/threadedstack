import { Buffer } from 'buffer'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

/**
 * The crypto module uses module-level MASTER_KEY state that gets cached on first call.
 * We use dynamic imports to get a fresh module for tests that need to test getMasterKey behavior.
 * For direct function tests (encrypt/decrypt, buffer conversions, hashing), we can use
 * static imports since those functions accept keys as parameters.
 */
import {
  deriveKey,
  encryptValue,
  decryptValue,
  bufferToBytea,
  byteaToBuffer,
  createHashKey,
  encodeEncrypted,
} from './crypto'

// Valid 64-char hex key (32 bytes) for AES-256
const VALID_HEX_KEY = 'a'.repeat(64)
const SHORT_HEX_KEY = 'abcd'

describe(`crypto`, () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env.TDSK_MASTER_KEY
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TDSK_MASTER_KEY = originalEnv
    } else {
      delete process.env.TDSK_MASTER_KEY
    }
  })

  describe(`deriveKey`, () => {
    it(`should return a Buffer for a valid ref_id`, async () => {
      process.env.TDSK_MASTER_KEY = VALID_HEX_KEY
      // Use dynamic import to get fresh module with clean MASTER_KEY state
      const mod = await import('./crypto')
      const key = await mod.deriveKey('test-user-123')
      expect(Buffer.isBuffer(key)).toBe(true)
      expect(key.length).toBe(32)
    })

    it(`should reject with an error for empty ref_id`, async () => {
      process.env.TDSK_MASTER_KEY = VALID_HEX_KEY
      await expect(deriveKey('')).rejects.toThrow(/Invalid ref_id/)
    })

    it(`should reject with an error for non-string ref_id`, async () => {
      process.env.TDSK_MASTER_KEY = VALID_HEX_KEY
      await expect(deriveKey(123 as any)).rejects.toThrow(/Invalid ref_id/)
    })
  })

  describe(`encryptValue and decryptValue round-trip`, () => {
    it(`should encrypt and decrypt back to original plaintext`, async () => {
      process.env.TDSK_MASTER_KEY = VALID_HEX_KEY
      const mod = await import('./crypto')
      const derivedKey = await mod.deriveKey('test-ref-id')
      const plaintext = 'Hello, World! This is a secret message.'

      const { iv, encrypted, authTag } = await encryptValue(derivedKey, plaintext)
      const decrypted = await decryptValue(derivedKey, encrypted, iv, authTag)

      expect(decrypted).toBe(plaintext)
    })

    it(`should produce different ciphertexts for same plaintext (random IV)`, async () => {
      process.env.TDSK_MASTER_KEY = VALID_HEX_KEY
      const mod = await import('./crypto')
      const derivedKey = await mod.deriveKey('test-ref-id')
      const plaintext = 'same input'

      const result1 = await encryptValue(derivedKey, plaintext)
      const result2 = await encryptValue(derivedKey, plaintext)

      expect(result1.encrypted.equals(result2.encrypted)).toBe(false)
    })
  })

  describe(`decryptValue with wrong authTag`, () => {
    it(`should throw when authTag is tampered`, async () => {
      process.env.TDSK_MASTER_KEY = VALID_HEX_KEY
      const mod = await import('./crypto')
      const derivedKey = await mod.deriveKey('test-ref-id')
      const plaintext = 'secret data'

      const { iv, encrypted, authTag } = await encryptValue(derivedKey, plaintext)

      // Tamper with the auth tag
      const badAuthTag = Buffer.alloc(16, 0)

      await expect(decryptValue(derivedKey, encrypted, iv, badAuthTag)).rejects.toThrow()
    })
  })

  describe(`bufferToBytea`, () => {
    it(`should produce a string prefixed with backslash-x`, () => {
      const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef])
      const result = bufferToBytea(buf)
      expect(result).toBe('\\xdeadbeef')
    })

    it(`should throw for non-Buffer input`, () => {
      expect(() => bufferToBytea('not a buffer' as any)).toThrow(
        /must be a Node.js Buffer/
      )
    })
  })

  describe(`byteaToBuffer`, () => {
    it(`should reverse bufferToBytea`, () => {
      const original = Buffer.from([0xca, 0xfe, 0xba, 0xbe])
      const bytea = bufferToBytea(original)
      const result = byteaToBuffer(bytea)
      expect(result.equals(original)).toBe(true)
    })

    it(`should throw for invalid input`, () => {
      expect(() => byteaToBuffer(`no-prefix`)).toThrow(/Invalid format/)
    })
  })

  describe(`encodeEncrypted`, () => {
    it(`should produce a base64 string combining iv + authTag + encrypted`, () => {
      const iv = Buffer.alloc(12, 1)
      const authTag = Buffer.alloc(16, 2)
      const encrypted = Buffer.from(`ciphertext`)

      const result = encodeEncrypted(iv, authTag, encrypted)

      // Should be valid base64
      const decoded = Buffer.from(result, `base64`)
      expect(decoded.length).toBe(12 + 16 + encrypted.length)
    })
  })

  describe(`createHashKey`, () => {
    it(`should return a consistent 16-char hex string for same input`, () => {
      const hash1 = createHashKey(`my-secret`)
      const hash2 = createHashKey(`my-secret`)
      expect(hash1).toBe(hash2)
      expect(hash1.length).toBe(16)
      expect(/^[0-9a-f]{16}$/.test(hash1)).toBe(true)
    })

    it(`should return different hashes for different inputs`, () => {
      const hash1 = createHashKey(`secret-a`)
      const hash2 = createHashKey(`secret-b`)
      expect(hash1).not.toBe(hash2)
    })
  })
})
