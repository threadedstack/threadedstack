/**
 * -------------------------------------- *
 * IMPORTANT - NOT USED
 * -------------------------------------- *
 */

import type { TKeyHash } from '@TDM/types'

/**
 * `generateKey` uses the Web Crypto API (`crypto.getRandomValues`, `crypto.subtle.digest`,
 * and `btoa`). It may not be available in all environments:
 * - Node.js < 19 without `--experimental-global-webcrypto` flag
 * - Server-side environments where the global `crypto` object lacks `subtle`
 * - Environments where `btoa` is not defined (older Node.js versions)
 *
 * In Node.js server contexts, prefer using the Node.js `crypto` module directly
 * (see `crypto.ts` in this directory). This export is primarily intended for
 * browser/edge runtime usage.
 *
 *
 * Node/Browser helper function to generate a crypto key hash
 * Use if needed in browser, for now only needed on backend, so Node crypto is used
 *
 */
export const generateKey = async (): Promise<TKeyHash> => {
  const keyBytes = new Uint8Array(32)
  crypto.getRandomValues(keyBytes)

  const binaryString = String.fromCharCode(...keyBytes)
  const base64 = btoa(binaryString)
  const base64Url = base64.replace(/\+/g, `-`).replace(/\//g, `_`).replace(/=+$/, ``)

  const key = `tdsk_${base64Url}`

  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest(`SHA-256`, data)

  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hash = hashArray.map((b) => b.toString(16).padStart(2, `0`)).join(``)

  const prefix = key.substring(0, 12)

  return { key, hash, prefix }
}
