import type { TKeyHash } from '@TDM/types'

import crypto from 'crypto'
import { Buffer } from 'buffer'
import { isStr } from '@keg-hub/jsutils/isStr'
import { ApiKeyPrefix } from '@TDM/constants/values'

let MasterKey: Buffer
const IvLength = 12
const DerivedKeyLength = 32
const Algorithm = `aes-256-gcm`
const KeyDerivationInfo = Buffer.from(`user-secret-key`, `utf-8`)

export type TEncryptVal = {
  iv: Buffer
  authTag: Buffer
  encrypted: Buffer
}

const getMasterKey = (): void => {
  if (MasterKey) return

  const envMasterKey = process.env.TDSK_MASTER_KEY
  if (!envMasterKey) throw new Error(`Required ENV 'TDSK_MASTER_KEY' is missing.`)

  try {
    MasterKey = Buffer.from(envMasterKey, `hex`)
  } catch (e) {
    console.error(`Failed to create Buffer from TDSK_MasterKey (is it valid hex?):`, e)
    throw new Error(
      `Invalid format for TDSK_MasterKey environment variable (must be hex).`
    )
  }

  if (MasterKey.length < 32) {
    throw new Error(
      `TDSK_MasterKey must be at least 64 hex characters (32 bytes) for AES-256. Got ${MasterKey.length} bytes.`
    )
  }
}

/**
 * Derives an encryption key from a user ID and the master key using HKDF (RFC 5869).
 * @param ref_id - The user's unique identifier (used as salt). Must be a non-empty string.
 * @returns A Promise resolving to the derived key as a Node.js Buffer (32 bytes).
 * @throws Error if ref_id is invalid. Rejects promise if HKDF fails.
 */
export const deriveKey = (ref_id: string): Promise<Buffer> => {
  if (!isStr(ref_id) || ref_id.length === 0)
    return Promise.reject(new Error(`Invalid ref_id provided for key derivation.`))

  getMasterKey()

  return new Promise((resolve, reject) => {
    // KNOWN DEVIATION FROM RFC 5869: ref_id is used as salt (param 3) rather than
    // info (param 4). Per RFC 5869, salt should be random/fixed and info contextual.
    // Changing this ordering would invalidate all existing encrypted data.
    crypto.hkdf(
      `sha256`,
      MasterKey,
      ref_id,
      KeyDerivationInfo,
      DerivedKeyLength,
      (err, key) => (err ? reject(err) : resolve(Buffer.from(key)))
    )
  })
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * The resulting 'encrypted' buffer contains the ciphertext combined with the GCM authentication tag.
 * @param derivedKey - The 32-byte encryption key derived via `deriveKey` (must be a Buffer).
 * @param plaintextValue - The string to encrypt.
 * @returns A Promise resolving to an object containing the 'iv' (12 bytes) and 'encrypted' data as Buffers.
 * @throws Error if inputs are invalid types.
 */
export const encryptValue = async (
  derivedKey: Buffer,
  plaintextValue: string
): Promise<TEncryptVal> => {
  if (!Buffer.isBuffer(derivedKey))
    throw new Error(`Derived key must be a Node.js Buffer.`)

  if (derivedKey.length !== DerivedKeyLength)
    throw new Error(`Invalid derived key length: expected ${DerivedKeyLength} bytes.`)

  if (!isStr(plaintextValue)) throw new Error(`Plaintext value must be a string.`)

  const iv = crypto.randomBytes(IvLength)
  const cipher = crypto.createCipheriv(Algorithm, derivedKey, iv)

  const encrypted = Buffer.concat([cipher.update(plaintextValue, `utf8`), cipher.final()])
  const authTag = cipher.getAuthTag()

  return { iv, encrypted, authTag }
}

/**
 * Decrypts data encrypted with `encryptValue` using AES-256-GCM.
 * Automatically verifies the GCM authentication tag appended to the encrypted data.
 * @param derivedKey - The 32-byte encryption key derived via `deriveKey` (must be a Buffer).
 * @param ciphertext - The encrypted data (ciphertext only, must be a Buffer).
 * @param iv - The 12-byte Initialization Vector used during encryption (must be a Buffer).
 * @param authTag - The 16-byte GCM authentication tag (must be a Buffer).
 * @returns A Promise resolving to the original plaintext string.
 * @throws Error if decryption fails (e.g., wrong key, tampered data, invalid IV/Buffer types, auth tag mismatch).
 */
export const decryptValue = async (
  derivedKey: Buffer,
  ciphertext: Buffer,
  iv: Buffer,
  authTag: Buffer
): Promise<string> => {
  if (!Buffer.isBuffer(derivedKey))
    throw new Error(`Derived key must be a Node.js Buffer.`)

  if (derivedKey.length !== DerivedKeyLength)
    throw new Error(`Invalid derived key length: expected ${DerivedKeyLength} bytes.`)

  if (!Buffer.isBuffer(ciphertext))
    throw new Error(`Ciphertext must be a Node.js Buffer.`)

  if (!Buffer.isBuffer(iv)) throw new Error(`IV must be a Node.js Buffer.`)
  if (iv.length !== IvLength)
    throw new Error(`Invalid IV length: expected ${IvLength} bytes.`)

  if (!Buffer.isBuffer(authTag)) throw new Error(`Auth tag must be a Node.js Buffer.`)
  // Node.js crypto GCM auth tags are 16 bytes by default
  if (authTag.length !== 16)
    throw new Error(`Invalid auth tag length. Expected 16 bytes. Got ${authTag.length}.`)

  const decipher = crypto.createDecipheriv(Algorithm, derivedKey, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])

  return decrypted.toString(`utf8`)
}

export const bufferToBytea = (buffer: Buffer): string => {
  if (!Buffer.isBuffer(buffer)) throw new Error(`Input must be a Node.js Buffer.`)
  return `\\x${buffer.toString(`hex`)}`
}

export const byteaToBuffer = (byteaString: string): Buffer => {
  if (!isStr(byteaString) || !byteaString.startsWith(`\\x`))
    throw new Error(
      `Invalid format received, Expected string with '\\x'. Got: "${byteaString}"`
    )

  return Buffer.from(byteaString.substring(2), `hex`)
}

/**
 * NOTE: No version byte in encryption format. Format: [iv:12][authTag:16][ciphertext:N]
 * If algorithm changes, add a version prefix for backward-compatible decryption.
 * Helper to encode encrypted data for storage
 * Combines iv + authTag + encrypted into a single base64 string
 */
export const encodeEncrypted = (
  iv: Buffer,
  authTag: Buffer,
  encrypted: Buffer
): string => {
  return Buffer.concat([iv, authTag, encrypted]).toString(`base64`)
}

/**
 * NOTE: Truncates SHA-256 to 16 hex chars (64 bits). Used for secret name
 * lookup only, not as a security-critical hash.
 * Helper to create a hash key from the secret name for lookup purposes
 */
export const createHashKey = (name: string): string => {
  return hashKey(name).slice(0, 16)
}

/**
 * Hash an API key using SHA-256 for storage and comparison
 * Shared between proxy (validation) and backend (generation)
 */
export const hashKey = (key: string): string => {
  return crypto.createHash(`sha256`).update(key).digest(`hex`)
}

/**
 * Generates a new API key
 * Generate a cryptographically secure random key
 * Create SHA-256 hash for storage and extract prefix for identification
 * Returns the raw key (only shown once) and its hash for storage
 */
export const generateApiKey = (): TKeyHash => {
  const keyBytes = crypto.randomBytes(32)
  const key = `${ApiKeyPrefix}${keyBytes.toString(`base64url`)}`

  const hash = hashKey(key)

  const prefix = key.substring(0, 12)

  return { key, hash, prefix }
}
