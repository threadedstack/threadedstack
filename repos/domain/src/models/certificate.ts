export class Certificate {
  /** **IMPORTANT** - Used only during test, should not be used at runtime */
  _isModel?: boolean

  // Parent directory/path for the object
  parent: string
  // Object name (e.g., certificate file name)
  name: string
  // Whether this is a file (true) or directory (false)
  isFile: boolean
  // File content (only for files, NULL for directories)
  value: Buffer | null
  // Last modification timestamp
  modified: string | Date

  constructor(cert: Partial<Certificate>) {
    Object.assign(this, cert)
  }
}
