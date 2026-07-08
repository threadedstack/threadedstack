import { Exception } from '@tdsk/domain'

/**
 * Validates an optional `?status=` query filter against a set of valid enum values.
 * Returns the value as-is (for use in a `where` clause) when absent or valid.
 * Throws Exception(400) when present but not a member of `validStatuses`.
 */
export const parseStatusFilter = <T extends string>(
  status: unknown,
  validStatuses: Set<T>
): T | undefined => {
  if (typeof status !== `string`) return undefined

  if (!validStatuses.has(status as T))
    throw new Exception(400, `status must be one of: ${[...validStatuses].join(`, `)}`)

  return status as T
}
