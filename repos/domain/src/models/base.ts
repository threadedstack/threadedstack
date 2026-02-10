/**
 * Base model class. All fields typed as present but Base has no constructor.
 * Subclasses use Object.assign(this, partialData) which means fields can be
 * undefined at runtime despite type declarations. This is a known trade-off
 * for simpler construction from DB results.
 */
export class Base {
  id: string
  createdAt?: string | Date
  updatedAt?: string | Date
  /** **IMPORTANT** - Used only during test, should not be used at runtime */
  _isModel?: boolean
}
