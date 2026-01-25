# Filesystem Implementations

Browser-compatible filesystem implementations for just-bash.

## IndexedDBFileSystem

Persistent browser storage using IndexedDB. Implements the full `IFileSystem` interface from just-bash.

### Features

- ✅ Full IFileSystem interface implementation
- ✅ Persistent storage across browser sessions
- ✅ Support for files, directories, and symlinks
- ✅ Atomic operations with transaction support
- ✅ Path normalization and validation
- ✅ Multiple encoding support (utf-8, base64, hex, binary)
- ✅ Proper error handling with POSIX error codes
- ✅ Symlink cycle detection
- ✅ Recursive directory operations

### Usage

```typescript
import { IndexedDBFileSystem } from '@tdsk/shell/fs'
import { Bash } from 'just-bash'

// Create and initialize filesystem
const fs = new IndexedDBFileSystem({
  dbName: 'my-app-fs',
  storeName: 'files',
  version: 1
})

await fs.initialize()

// Use with just-bash
const bash = new Bash({ fs })

// Direct filesystem operations
await fs.mkdir('/home/user', { recursive: true })
await fs.writeFile('/home/user/hello.txt', 'Hello, World!')
const content = await fs.readFile('/home/user/hello.txt')
console.log(content) // "Hello, World!"

// Execute bash commands
const result = await bash.exec('ls -la /home/user')
console.log(result.stdout)

// Clean up when done
await fs.close()
```

### API

#### Initialization

```typescript
const fs = new IndexedDBFileSystem(config?: {
  dbName?: string    // Default: 'just-bash-fs'
  storeName?: string // Default: 'files'
  version?: number   // Default: 1
})

await fs.initialize() // Must be called before use
await fs.close()      // Clean up database connection
```

#### File Operations

```typescript
// Read file as string (with encoding)
const text = await fs.readFile('/path/to/file.txt', 'utf-8')

// Read file as binary
const buffer = await fs.readFileBuffer('/path/to/file.dat')

// Write file
await fs.writeFile('/path/to/file.txt', 'content', 'utf-8')
await fs.writeFile('/path/to/file.dat', new Uint8Array([1, 2, 3]))

// Append to file
await fs.appendFile('/path/to/file.txt', 'more content')

// Check existence
const exists = await fs.exists('/path/to/file.txt')

// Get file info
const stats = await fs.stat('/path/to/file.txt')
console.log(stats.isFile, stats.size, stats.mtime)
```

#### Directory Operations

```typescript
// Create directory
await fs.mkdir('/path/to/dir')

// Create nested directories
await fs.mkdir('/path/to/nested/dir', { recursive: true })

// List directory contents
const files = await fs.readdir('/path/to/dir')

// List with type information
const entries = await fs.readdirWithFileTypes('/path/to/dir')
for (const entry of entries) {
  console.log(entry.name, entry.isFile, entry.isDirectory)
}
```

#### Delete Operations

```typescript
// Remove file
await fs.rm('/path/to/file.txt')

// Remove empty directory
await fs.rm('/path/to/dir')

// Remove directory recursively
await fs.rm('/path/to/dir', { recursive: true })

// Force remove (ignore if not exists)
await fs.rm('/path/to/file.txt', { force: true })
```

#### Copy and Move

```typescript
// Copy file
await fs.cp('/source/file.txt', '/dest/file.txt')

// Copy directory recursively
await fs.cp('/source/dir', '/dest/dir', { recursive: true })

// Move/rename
await fs.mv('/old/path.txt', '/new/path.txt')
```

#### Symlinks

```typescript
// Create symlink
await fs.symlink('/target/file.txt', '/link/to/file.txt')

// Read symlink target
const target = await fs.readlink('/link/to/file.txt')

// Get symlink info (without following)
const lstat = await fs.lstat('/link/to/file.txt')
console.log(lstat.isSymbolicLink) // true

// Get target info (following symlink)
const stat = await fs.stat('/link/to/file.txt')
console.log(stat.isFile) // true
```

#### Hard Links

```typescript
// Create hard link (shares same content)
await fs.link('/existing/file.txt', '/link/to/file.txt')
```

#### Permissions

```typescript
// Change file permissions
await fs.chmod('/path/to/file.txt', 0o755)
```

#### Path Resolution

```typescript
// Resolve relative paths
const resolved = fs.resolvePath('/base/dir', '../file.txt')
// Returns: '/base/file.txt'

// Resolve absolute paths
const absolute = fs.resolvePath('/base', '/absolute/path.txt')
// Returns: '/absolute/path.txt'
```

### Encoding Support

Supports multiple encodings for text operations:

- `utf-8` / `utf8` (default)
- `base64`
- `hex`
- `binary`
- `ascii`
- `latin1`

```typescript
// Write base64-encoded file
await fs.writeFile('/data.b64', 'SGVsbG8=', 'base64')

// Read as hex
const hex = await fs.readFile('/data.bin', 'hex')
```

### Error Handling

Throws errors with POSIX error codes:

- `ENOENT` - File or directory not found
- `EEXIST` - File or directory already exists
- `EISDIR` - Path is a directory (expected file)
- `ENOTDIR` - Path is not a directory (expected directory)
- `ENOTEMPTY` - Directory not empty (use recursive)
- `ELOOP` - Too many symbolic links (cycle detected)
- `EINVAL` - Invalid argument

```typescript
try {
  await fs.readFile('/nonexistent.txt')
} catch (error) {
  if (error.message.includes('ENOENT')) {
    console.error('File not found')
  }
}
```

### Storage Structure

IndexedDB stores entries with this structure:

```typescript
{
  path: '/normalized/path',
  data: {
    type: 'file' | 'directory' | 'symlink',
    content?: Uint8Array,  // For files
    target?: string,       // For symlinks
    mode: number,          // Permissions (e.g., 0o644)
    mtime: number,         // Last modified timestamp
    size: number           // Size in bytes
  }
}
```

### Testing

Tests use a mocked IndexedDB for Node.js environments. For browser testing, use real IndexedDB:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { IndexedDBFileSystem } from '@tdsk/shell/fs'

describe('IndexedDBFileSystem', () => {
  let fs: IndexedDBFileSystem

  beforeEach(async () => {
    fs = new IndexedDBFileSystem({ dbName: 'test-fs' })
    await fs.initialize()
  })

  it('should write and read files', async () => {
    await fs.mkdir('/test', { recursive: true })
    await fs.writeFile('/test/file.txt', 'content')
    const result = await fs.readFile('/test/file.txt')
    expect(result).toBe('content')
  })
})
```

### Browser Compatibility

Requires IndexedDB support (all modern browsers):

- Chrome 24+
- Firefox 16+
- Safari 10+
- Edge 79+

Check availability:

```typescript
if (typeof indexedDB === 'undefined') {
  console.error('IndexedDB not supported')
}
```

### Performance Considerations

- All operations are asynchronous (Promise-based)
- Uses transactions for atomic operations
- Parent directory validation may require multiple lookups
- `getAllPaths()` returns empty array (use `readdir` recursively instead)
- Large files should use streaming when possible

### Migration from Other Filesystems

```typescript
// Copy from InMemoryFs to IndexedDB
import { InMemoryFs } from 'just-bash'

const memFs = new InMemoryFs()
const dbFs = new IndexedDBFileSystem()
await dbFs.initialize()

// Recursive copy function
async function copyRecursive(src: IFileSystem, dest: IFileSystem, path: string) {
  const stat = await src.stat(path)

  if (stat.isFile) {
    const content = await src.readFileBuffer(path)
    await dest.writeFile(path, content)
  } else if (stat.isDirectory) {
    await dest.mkdir(path, { recursive: true })
    const entries = await src.readdir(path)
    for (const entry of entries) {
      await copyRecursive(src, dest, `${path}/${entry}`)
    }
  }
}

await copyRecursive(memFs, dbFs, '/')
```
