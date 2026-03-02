import { Exception } from '@tdsk/domain'

export type TArcField = {
  name: string
  value: any
}

/**
 * Validates the exclusive arc pattern: exactly one field must be present.
 * Throws Exception(400) if zero or more than one field has a value.
 *
 * @param fields - Array of { name, value } pairs to check
 * @param entityName - Name of the entity for error messages (e.g., "Secret", "Config")
 * @returns The single present field's { name, value }
 */
export const validateExclusiveArc = (
  fields: TArcField[],
  entityName: string
): TArcField => {
  const present = fields.filter(
    (f) => f.value !== undefined && f.value !== null && f.value !== ''
  )
  const names = fields.map((f) => f.name).join(', ')

  if (present.length === 0)
    throw new Exception(400, `${entityName} must belong to one of: ${names}`)

  if (present.length > 1)
    throw new Exception(
      400,
      `${entityName} can only belong to one of: ${names} (exclusive arc)`
    )

  return present[0]
}
