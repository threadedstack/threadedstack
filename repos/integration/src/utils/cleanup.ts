import { del } from './api-client'

/**
 * Best-effort resource deletion. Ignores errors — resources may already
 * be gone or the endpoint may not exist yet.
 */
export const tryDelete = async (path: string): Promise<void> => {
  try {
    await del(path)
  } catch (err: any) {
    console.warn('[cleanup] tryDelete failed for %s —', path, err?.message || err)
  }
}
