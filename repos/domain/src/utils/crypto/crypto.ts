import crypto from 'crypto'
import { Buffer } from 'buffer'
import { isStr } from '@keg-hub/jsutils/isStr'

let MASTER_KEY: Buffer
const IV_LENGTH = 12
const DERIVED_KEY_LENGTH = 32
const ALGORITHM = `aes-256-gcm`
const KEY_DERIVATION_INFO = Buffer.from(`user-secret-key`, `utf-8`)

export type TEncryptVal = {
  iv: Buffer
  authTag: Buffer
  encrypted: Buffer
}

const getMasterKey = () => {
  if (MASTER_KEY) return

  const envMasterKey = process.env.TDSK_MASTER_KEY
  if (!envMasterKey) throw new Error(`Required ENV 'TDSK_MASTER_KEY' is missing.`)

  try {
    MASTER_KEY = Buffer.from(envMasterKey, `hex`)
  } catch (e) {
    console.error(`Failed to create Buffer from TDSK_MASTER_KEY (is it valid hex?):`, e)
    throw new Error(
      `Invalid format for TDSK_MASTER_KEY environment variable (must be hex).`
    )
  }
}

/**
 * Derives an encryption key from a user ID and the master key using HKDF (RFC 5869).
 * @param ref_id - The user's unique identifier (used as salt). Must be a non-empty string.
 * @returns A Promise resolving to the derived key as a Node.js Buffer (32 bytes).
 * @throws Error if ref_id is invalid. Rejects promise if HKDF fails.
 */
export const deriveKey = (ref_id: string): Promise<Buffer<ArrayBufferLike>> => {
  if (!isStr(ref_id) || ref_id.length === 0)
    return Promise.reject(new Error(`Invalid ref_id provided for key derivation.`))

  getMasterKey()

  return new Promise((resolve, reject) => {
    crypto.hkdf(
      `sha256`,
      MASTER_KEY,
      ref_id,
      KEY_DERIVATION_INFO,
      DERIVED_KEY_LENGTH,
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

  if (derivedKey.length !== DERIVED_KEY_LENGTH)
    throw new Error(`Invalid derived key length: expected ${DERIVED_KEY_LENGTH} bytes.`)

  if (!isStr(plaintextValue)) throw new Error(`Plaintext value must be a string.`)

  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv)

  const encryptedChunks: Buffer[] = []
  encryptedChunks.push(cipher.update(plaintextValue, `utf8`))
  encryptedChunks.push(cipher.final())

  const encrypted = Buffer.concat(encryptedChunks)
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

  if (derivedKey.length !== DERIVED_KEY_LENGTH)
    throw new Error(`Invalid derived key length: expected ${DERIVED_KEY_LENGTH} bytes.`)

  if (!Buffer.isBuffer(ciphertext))
    throw new Error(`Ciphertext must be a Node.js Buffer.`)

  if (!Buffer.isBuffer(iv)) throw new Error(`IV must be a Node.js Buffer.`)
  if (iv.length !== IV_LENGTH)
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes.`)

  if (!Buffer.isBuffer(authTag)) throw new Error(`Auth tag must be a Node.js Buffer.`)
  // Node.js crypto GCM auth tags are 16 bytes by default
  if (authTag.length !== 16)
    throw new Error(`Invalid auth tag length. Expected 16 bytes. Got ${authTag.length}.`)

  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(ciphertext)

  decrypted = Buffer.concat([decrypted, decipher.final()])

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
 * Helper to create a hash key from the secret name for lookup purposes
 */
export const createHashKey = (name: string): string => {
  return crypto.createHash(`sha256`).update(name).digest(`hex`).slice(0, 16)
}
