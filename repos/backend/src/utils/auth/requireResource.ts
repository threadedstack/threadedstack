import { Exception } from '@tdsk/domain'

/**
 * Fetch a resource by ID, throw 404 if not found.
 * Permission checking is handled by authorize() middleware.
 */
export const requireResource = async <T>(
  service: { get: (id: string, opts?: any) => Promise<{ data?: T; error?: any }> },
  id: string,
  label: string
): Promise<T> => {
  const { data, error } = await service.get(id)

  if (error) {
    if (error.message?.toLowerCase().includes(`not found`))
      throw new Exception(404, `${label} not found`)
    throw new Exception(500, error.message)
  }
  if (!data) throw new Exception(404, `${label} not found`)

  return data
}
