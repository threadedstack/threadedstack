/**
 * IndexedDB-based filesystem implementation for just-bash
 * Provides persistent browser storage for file operations
 */

import type {
  IFileSystem,
  FsStat,
  FileContent,
  BufferEncoding,
  MkdirOptions,
  RmOptions,
  CpOptions,
} from 'just-bash'

/**
 * Types that aren't exported by just-bash but are inferred from usage
 */
interface ReadFileOptions {
  encoding?: BufferEncoding | null
}

interface WriteFileOptions {
  encoding?: BufferEncoding | null
  mode?: number
}

interface DirentEntry {
  name: string
  isFile: boolean
  isDirectory: boolean
  isSymbolicLink: boolean
}

/**
 * Internal storage structure for file entries
 */
interface StoredEntry {
  type: 'file' | 'directory' | 'symlink'
  content?: Uint8Array // For files
  target?: string // For symlinks
  mode: number
  mtime: number // Store as timestamp for JSON serialization
  size: number
}

/**
 * IndexedDB configuration
 */
interface IndexedDBConfig {
  dbName?: string
  storeName?: string
  version?: number
}

/**
 * Default file permissions
 */
const DEFAULT_FILE_MODE = 0o644 // rw-r--r--
const DEFAULT_DIR_MODE = 0o755 // rwxr-xr-x
const DEFAULT_SYMLINK_MODE = 0o777 // rwxrwxrwx

/**
 * IndexedDBFileSystem - Persistent browser filesystem using IndexedDB
 *
 * Features:
 * - Full IFileSystem interface implementation
 * - Persistent storage across browser sessions
 * - Support for files, directories, and symlinks
 * - Atomic operations with transaction support
 * - Path normalization and validation
 *
 * @example
 * ```typescript
 * const fs = new IndexedDBFileSystem()
 * await fs.initialize()
 * await fs.writeFile('/home/user/file.txt', 'Hello World')
 * const content = await fs.readFile('/home/user/file.txt')
 * ```
 */
export class IndexedDBFileSystem implements IFileSystem {
  private db: IDBDatabase | null = null
  private readonly dbName: string
  private readonly storeName: string
  private readonly version: number
  private initialized = false

  /**
   * Create a new IndexedDBFileSystem instance
   * Note: Must call initialize() before use
   */
  constructor(config: IndexedDBConfig = {}) {
    this.dbName = config.dbName ?? 'just-bash-fs'
    this.storeName = config.storeName ?? 'files'
    this.version = config.version ?? 1
  }

  /**
   * Initialize the IndexedDB database
   * Must be called before any filesystem operations
   *
   * @throws Error if IndexedDB is not available or initialization fails
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB is not available in this environment')
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`))
      }

      request.onsuccess = () => {
        this.db = request.result
        this.initialized = true
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'path' })
        }
      }
    })
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initialized = false
    }
  }

  /**
   * Ensure the database is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new Error('IndexedDBFileSystem not initialized. Call initialize() first.')
    }
  }

  /**
   * Normalize a path (remove trailing slashes, resolve . and ..)
   */
  private normalizePath(path: string): string {
    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = `/${path}`
    }

    // Split into parts and resolve . and ..
    const parts = path.split('/').filter((p) => p.length > 0)
    const resolved: string[] = []

    for (const part of parts) {
      if (part === '.') {
        continue // Skip current directory
      }
      if (part === '..') {
        resolved.pop() // Go up one level
        continue
      }
      resolved.push(part)
    }

    // Root directory
    if (resolved.length === 0) {
      return '/'
    }

    return `/${resolved.join('/')}`
  }

  /**
   * Get parent directory path
   */
  private getParentPath(path: string): string {
    const normalized = this.normalizePath(path)
    if (normalized === '/') {
      return '/'
    }
    const lastSlash = normalized.lastIndexOf('/')
    return lastSlash === 0 ? '/' : normalized.slice(0, lastSlash)
  }

  /**
   * Get entry name from path
   */
  private getEntryName(path: string): string {
    const normalized = this.normalizePath(path)
    if (normalized === '/') {
      return ''
    }
    return normalized.split('/').pop() ?? ''
  }

  /**
   * Execute an IndexedDB transaction
   */
  private async transaction<T>(
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, mode)
      const store = tx.objectStore(this.storeName)
      const request = callback(store)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () =>
        reject(new Error(`Transaction failed: ${request.error?.message}`))
    })
  }

  /**
   * Get a stored entry by path
   */
  private async getEntry(path: string): Promise<StoredEntry | null> {
    const normalized = this.normalizePath(path)

    try {
      const entry = await this.transaction('readonly', (store) => store.get(normalized))
      return entry?.data ?? null
    } catch {
      return null
    }
  }

  /**
   * Store an entry
   */
  private async putEntry(path: string, entry: StoredEntry): Promise<void> {
    const normalized = this.normalizePath(path)

    await this.transaction('readwrite', (store) =>
      store.put({ path: normalized, data: entry })
    )
  }

  /**
   * Delete an entry
   */
  private async deleteEntry(path: string): Promise<void> {
    const normalized = this.normalizePath(path)

    await this.transaction('readwrite', (store) => store.delete(normalized))
  }

  /**
   * Get all entries (for getAllPaths)
   */
  private async getAllEntries(): Promise<Map<string, StoredEntry>> {
    this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readonly')
      const store = tx.objectStore(this.storeName)
      const request = store.openCursor()
      const entries = new Map<string, StoredEntry>()

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          entries.set(cursor.value.path, cursor.value.data)
          cursor.continue()
        } else {
          resolve(entries)
        }
      }

      request.onerror = () => {
        reject(new Error(`Failed to read entries: ${request.error?.message}`))
      }
    })
  }

  /**
   * Ensure parent directory exists
   */
  private async ensureParentExists(path: string): Promise<void> {
    const parent = this.getParentPath(path)

    if (parent === '/') {
      return // Root always exists
    }

    const parentEntry = await this.getEntry(parent)

    if (!parentEntry) {
      throw new Error(`ENOENT: Parent directory does not exist: ${parent}`)
    }

    if (parentEntry.type !== 'directory') {
      throw new Error(`ENOTDIR: Parent is not a directory: ${parent}`)
    }
  }

  /**
   * Resolve symlinks in a path
   */
  private async resolveSymlink(
    path: string,
    visited = new Set<string>()
  ): Promise<string> {
    const normalized = this.normalizePath(path)

    if (visited.has(normalized)) {
      throw new Error(`ELOOP: Too many symbolic links: ${path}`)
    }

    const entry = await this.getEntry(normalized)

    if (!entry || entry.type !== 'symlink') {
      return normalized
    }

    visited.add(normalized)

    // Resolve target relative to symlink's parent
    const target = entry.target!
    const resolvedTarget = this.resolvePath(this.getParentPath(normalized), target)

    return this.resolveSymlink(resolvedTarget, visited)
  }

  /**
   * Convert encoding string to TextDecoder/TextEncoder encoding
   */
  private getEncoding(encoding?: BufferEncoding | null): string {
    if (!encoding || encoding === 'utf8' || encoding === 'utf-8') {
      return 'utf-8'
    }
    return encoding
  }

  /**
   * Decode buffer to string
   */
  private decodeBuffer(buffer: Uint8Array, encoding: string): string {
    if (encoding === 'utf-8') {
      return new TextDecoder('utf-8').decode(buffer)
    }
    if (encoding === 'base64') {
      // Convert Uint8Array to base64 string
      let binary = ''
      for (let i = 0; i < buffer.length; i++) {
        binary += String.fromCharCode(buffer[i])
      }
      return btoa(binary)
    }
    if (encoding === 'hex') {
      return Array.from(buffer)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    }
    // For binary, ascii, latin1 - convert directly
    return Array.from(buffer)
      .map((b) => String.fromCharCode(b))
      .join('')
  }

  /**
   * Encode string to buffer
   */
  private encodeString(content: string, encoding: string): Uint8Array {
    if (encoding === 'utf-8') {
      return new TextEncoder().encode(content)
    }
    if (encoding === 'base64') {
      const binary = atob(content)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      return bytes
    }
    if (encoding === 'hex') {
      const bytes = new Uint8Array(content.length / 2)
      for (let i = 0; i < content.length; i += 2) {
        bytes[i / 2] = Number.parseInt(content.slice(i, i + 2), 16)
      }
      return bytes
    }
    // For binary, ascii, latin1 - convert directly
    const bytes = new Uint8Array(content.length)
    for (let i = 0; i < content.length; i++) {
      bytes[i] = content.charCodeAt(i)
    }
    return bytes
  }

  // ========================================================================
  // IFileSystem Implementation
  // ========================================================================

  async readFile(
    path: string,
    options?: ReadFileOptions | BufferEncoding
  ): Promise<string> {
    const resolvedPath = await this.resolveSymlink(path)
    const entry = await this.getEntry(resolvedPath)

    if (!entry) {
      throw new Error(`ENOENT: File not found: ${path}`)
    }

    if (entry.type !== 'file') {
      throw new Error(`EISDIR: Path is a directory: ${path}`)
    }

    const encoding =
      typeof options === 'string'
        ? this.getEncoding(options)
        : this.getEncoding(options?.encoding)

    return this.decodeBuffer(entry.content!, encoding)
  }

  async readFileBuffer(path: string): Promise<Uint8Array> {
    const resolvedPath = await this.resolveSymlink(path)
    const entry = await this.getEntry(resolvedPath)

    if (!entry) {
      throw new Error(`ENOENT: File not found: ${path}`)
    }

    if (entry.type !== 'file') {
      throw new Error(`EISDIR: Path is a directory: ${path}`)
    }

    return entry.content!
  }

  async writeFile(
    path: string,
    content: FileContent,
    options?: WriteFileOptions | BufferEncoding
  ): Promise<void> {
    const normalized = this.normalizePath(path)

    // Ensure parent directory exists
    await this.ensureParentExists(normalized)

    const encoding =
      typeof options === 'string'
        ? this.getEncoding(options)
        : this.getEncoding(options?.encoding)

    const buffer =
      typeof content === 'string' ? this.encodeString(content, encoding) : content

    const entry: StoredEntry = {
      type: 'file',
      content: buffer,
      mode: DEFAULT_FILE_MODE,
      mtime: Date.now(),
      size: buffer.length,
    }

    await this.putEntry(normalized, entry)
  }

  async appendFile(
    path: string,
    content: FileContent,
    options?: WriteFileOptions | BufferEncoding
  ): Promise<void> {
    const normalized = this.normalizePath(path)
    const existing = await this.getEntry(normalized)

    const encoding =
      typeof options === 'string'
        ? this.getEncoding(options)
        : this.getEncoding(options?.encoding)

    const newContent =
      typeof content === 'string' ? this.encodeString(content, encoding) : content

    let finalContent: Uint8Array

    if (existing && existing.type === 'file') {
      // Append to existing file
      const combined = new Uint8Array(existing.content!.length + newContent.length)
      combined.set(existing.content!)
      combined.set(newContent, existing.content!.length)
      finalContent = combined
    } else if (!existing) {
      // Create new file with parent check
      await this.ensureParentExists(normalized)
      finalContent = newContent
    } else {
      throw new Error(`EISDIR: Path is a directory: ${path}`)
    }

    const entry: StoredEntry = {
      type: 'file',
      content: finalContent,
      mode: existing?.mode ?? DEFAULT_FILE_MODE,
      mtime: Date.now(),
      size: finalContent.length,
    }

    await this.putEntry(normalized, entry)
  }

  async exists(path: string): Promise<boolean> {
    const normalized = this.normalizePath(path)

    if (normalized === '/') {
      return true // Root always exists
    }

    const entry = await this.getEntry(normalized)
    return entry !== null
  }

  async stat(path: string): Promise<FsStat> {
    const resolvedPath = await this.resolveSymlink(path)
    const entry = await this.getEntry(resolvedPath)

    if (!entry) {
      throw new Error(`ENOENT: Path not found: ${path}`)
    }

    return {
      isFile: entry.type === 'file',
      isDirectory: entry.type === 'directory',
      isSymbolicLink: false, // After resolving, it's never a symlink
      mode: entry.mode,
      size: entry.size,
      mtime: new Date(entry.mtime),
    }
  }

  async lstat(path: string): Promise<FsStat> {
    const normalized = this.normalizePath(path)
    const entry = await this.getEntry(normalized)

    if (!entry) {
      throw new Error(`ENOENT: Path not found: ${path}`)
    }

    return {
      isFile: entry.type === 'file',
      isDirectory: entry.type === 'directory',
      isSymbolicLink: entry.type === 'symlink',
      mode: entry.mode,
      size: entry.size,
      mtime: new Date(entry.mtime),
    }
  }

  async mkdir(path: string, options?: MkdirOptions): Promise<void> {
    const normalized = this.normalizePath(path)

    // Check if already exists
    const existing = await this.getEntry(normalized)
    if (existing) {
      throw new Error(`EEXIST: Path already exists: ${path}`)
    }

    // Handle recursive creation
    if (options?.recursive) {
      const parts = normalized.split('/').filter((p) => p.length > 0)
      let currentPath = ''

      for (const part of parts) {
        currentPath += `/${part}`
        const entry = await this.getEntry(currentPath)

        if (!entry) {
          const dirEntry: StoredEntry = {
            type: 'directory',
            mode: DEFAULT_DIR_MODE,
            mtime: Date.now(),
            size: 0,
          }
          await this.putEntry(currentPath, dirEntry)
        } else if (entry.type !== 'directory') {
          throw new Error(`ENOTDIR: Path exists but is not a directory: ${currentPath}`)
        }
      }
    } else {
      // Non-recursive: parent must exist
      await this.ensureParentExists(normalized)

      const entry: StoredEntry = {
        type: 'directory',
        mode: DEFAULT_DIR_MODE,
        mtime: Date.now(),
        size: 0,
      }

      await this.putEntry(normalized, entry)
    }
  }

  async readdir(path: string): Promise<string[]> {
    const resolvedPath = await this.resolveSymlink(path)
    const normalized = this.normalizePath(resolvedPath)

    if (normalized === '/') {
      // Special case: list root directory
      const allEntries = await this.getAllEntries()
      const rootEntries = new Set<string>()

      for (const entryPath of allEntries.keys()) {
        if (entryPath === '/') continue
        const parts = entryPath.split('/').filter((p) => p.length > 0)
        if (parts.length > 0) {
          rootEntries.add(parts[0])
        }
      }

      return Array.from(rootEntries).sort()
    }

    const entry = await this.getEntry(normalized)

    if (!entry) {
      throw new Error(`ENOENT: Directory not found: ${path}`)
    }

    if (entry.type !== 'directory') {
      throw new Error(`ENOTDIR: Path is not a directory: ${path}`)
    }

    // Find all entries that are direct children
    const allEntries = await this.getAllEntries()
    const children = new Set<string>()
    const prefix = normalized === '/' ? '/' : `${normalized}/`

    for (const entryPath of allEntries.keys()) {
      if (entryPath.startsWith(prefix)) {
        const relative = entryPath.slice(prefix.length)
        const parts = relative.split('/')

        if (parts.length > 0 && parts[0]) {
          children.add(parts[0])
        }
      }
    }

    return Array.from(children).sort()
  }

  async readdirWithFileTypes(path: string): Promise<DirentEntry[]> {
    const names = await this.readdir(path)
    const normalized = this.normalizePath(path)
    const entries: DirentEntry[] = []

    for (const name of names) {
      const childPath = normalized === '/' ? `/${name}` : `${normalized}/${name}`
      const entry = await this.getEntry(childPath)

      if (entry) {
        entries.push({
          name,
          isFile: entry.type === 'file',
          isDirectory: entry.type === 'directory',
          isSymbolicLink: entry.type === 'symlink',
        })
      }
    }

    return entries
  }

  async rm(path: string, options?: RmOptions): Promise<void> {
    const normalized = this.normalizePath(path)
    const entry = await this.getEntry(normalized)

    if (!entry) {
      if (options?.force) {
        return // Silently succeed if force is true
      }
      throw new Error(`ENOENT: Path not found: ${path}`)
    }

    if (entry.type === 'directory') {
      // Check if directory is empty
      const children = await this.readdir(normalized)

      if (children.length > 0 && !options?.recursive) {
        throw new Error(`ENOTEMPTY: Directory not empty: ${path}`)
      }

      // Remove all children recursively
      if (options?.recursive) {
        for (const child of children) {
          const childPath = normalized === '/' ? `/${child}` : `${normalized}/${child}`
          await this.rm(childPath, { recursive: true, force: true })
        }
      }
    }

    await this.deleteEntry(normalized)
  }

  async cp(src: string, dest: string, options?: CpOptions): Promise<void> {
    const srcResolved = await this.resolveSymlink(src)
    const srcEntry = await this.getEntry(srcResolved)

    if (!srcEntry) {
      throw new Error(`ENOENT: Source not found: ${src}`)
    }

    if (srcEntry.type === 'directory' && !options?.recursive) {
      throw new Error(`EISDIR: Source is a directory (use recursive): ${src}`)
    }

    const destNormalized = this.normalizePath(dest)
    await this.ensureParentExists(destNormalized)

    if (srcEntry.type === 'file') {
      // Copy file
      const newEntry: StoredEntry = {
        type: 'file',
        content: new Uint8Array(srcEntry.content!), // Clone buffer
        mode: srcEntry.mode,
        mtime: Date.now(),
        size: srcEntry.size,
      }
      await this.putEntry(destNormalized, newEntry)
    } else if (srcEntry.type === 'directory') {
      // Create destination directory
      await this.mkdir(destNormalized, { recursive: false })

      // Copy children
      const children = await this.readdir(srcResolved)
      for (const child of children) {
        const childSrc = `${srcResolved}/${child}`
        const childDest = `${destNormalized}/${child}`
        await this.cp(childSrc, childDest, { recursive: true })
      }
    }
  }

  async mv(src: string, dest: string): Promise<void> {
    const srcNormalized = this.normalizePath(src)
    const destNormalized = this.normalizePath(dest)
    const srcEntry = await this.getEntry(srcNormalized)

    if (!srcEntry) {
      throw new Error(`ENOENT: Source not found: ${src}`)
    }

    await this.ensureParentExists(destNormalized)

    // Copy entry to new location
    await this.putEntry(destNormalized, srcEntry)

    // Remove from old location
    await this.deleteEntry(srcNormalized)
  }

  resolvePath(base: string, path: string): string {
    // If path is absolute, return it normalized
    if (path.startsWith('/')) {
      return this.normalizePath(path)
    }

    // Otherwise, resolve relative to base
    const baseNormalized = this.normalizePath(base)
    const combined = baseNormalized === '/' ? `/${path}` : `${baseNormalized}/${path}`

    return this.normalizePath(combined)
  }

  getAllPaths(): string[] {
    // This is synchronous in the interface, but IndexedDB is async
    // Return empty array - most implementations don't need this
    // For full support, would need to maintain a cache
    return []
  }

  async chmod(path: string, mode: number): Promise<void> {
    const normalized = this.normalizePath(path)
    const entry = await this.getEntry(normalized)

    if (!entry) {
      throw new Error(`ENOENT: Path not found: ${path}`)
    }

    entry.mode = mode
    entry.mtime = Date.now()

    await this.putEntry(normalized, entry)
  }

  async symlink(target: string, linkPath: string): Promise<void> {
    const normalized = this.normalizePath(linkPath)
    const existing = await this.getEntry(normalized)

    if (existing) {
      throw new Error(`EEXIST: Path already exists: ${linkPath}`)
    }

    await this.ensureParentExists(normalized)

    const entry: StoredEntry = {
      type: 'symlink',
      target,
      mode: DEFAULT_SYMLINK_MODE,
      mtime: Date.now(),
      size: 0,
    }

    await this.putEntry(normalized, entry)
  }

  async link(existingPath: string, newPath: string): Promise<void> {
    const existingResolved = await this.resolveSymlink(existingPath)
    const existingEntry = await this.getEntry(existingResolved)

    if (!existingEntry || existingEntry.type !== 'file') {
      throw new Error(`ENOENT: Existing path not found or not a file: ${existingPath}`)
    }

    const newNormalized = this.normalizePath(newPath)
    const newExisting = await this.getEntry(newNormalized)

    if (newExisting) {
      throw new Error(`EEXIST: Path already exists: ${newPath}`)
    }

    await this.ensureParentExists(newNormalized)

    // Create a new entry with the same content (hard link simulation)
    const newEntry: StoredEntry = {
      type: 'file',
      content: existingEntry.content, // Share the same buffer
      mode: existingEntry.mode,
      mtime: Date.now(),
      size: existingEntry.size,
    }

    await this.putEntry(newNormalized, newEntry)
  }

  async readlink(path: string): Promise<string> {
    const normalized = this.normalizePath(path)
    const entry = await this.getEntry(normalized)

    if (!entry) {
      throw new Error(`ENOENT: Path not found: ${path}`)
    }

    if (entry.type !== 'symlink') {
      throw new Error(`EINVAL: Path is not a symlink: ${path}`)
    }

    return entry.target!
  }
}
