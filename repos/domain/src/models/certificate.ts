export class Certificate {
  // Parent directory/path for the object
  parent: string
  // Object name (e.g., certificate file name)
  name: string
  // Whether this is a file (true) or directory (false)
  isFile: boolean
  // File content (only for files, NULL for directories)
  value: Buffer
  // Last modification timestamp
  modified: string | Date

  constructor(cert: Partial<Certificate>) {
    Object.assign(this, cert)
  }
}
