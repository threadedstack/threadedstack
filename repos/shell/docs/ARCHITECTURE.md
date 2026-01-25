# Universal Virtual Shell Architecture

## Executive Summary

The Universal Virtual Shell is a cross-platform shell execution environment that runs identically in browsers (Web Worker), Node.js, and Bun.js. It uses just-bash as the execution kernel with platform-specific filesystem adapters and WHATWG Streams for I/O.

## Core Architecture

### 1. Class Hierarchy

```
Shell (Main API)
  ├── PlatformDetector (singleton)
  │   └── Detects: Browser | Node | Bun
  ├── IFileSystem (interface)
  │   ├── IndexedDBFileSystem (Browser)
  │   ├── NodeFileSystem (Node.js)
  │   └── BunFileSystem (Bun.js)
  ├── StreamManager
  │   ├── ReadableStreamAdapter
  │   ├── WritableStreamAdapter
  │   └── TransformStreamAdapter
  ├── WorkerBridge (Browser only)
  │   ├── MainThread Controller
  │   └── Worker Thread Handler
  └── BashKernel (just-bash wrapper)
      ├── Command Parser
      ├── Execution Engine
      └── Mount Manager
```

### 2. Component Responsibilities

#### 2.1 Shell Class (Main API)
- Platform detection and initialization
- Filesystem adapter selection
- Command execution interface
- Stream management
- Lifecycle management (init, destroy)

**Public API:**
```typescript
class Shell {
  static create(config: ShellConfig): Promise<Shell>
  exec(command: string, options?: ExecOptions): Promise<ExecResult>
  pipe(command: string, target: WritableStream): Promise<void>
  mount(path: string, fs: IFileSystem): Promise<void>
  unmount(path: string): Promise<void>
  getStreams(): { stdin: WritableStream, stdout: ReadableStream, stderr: ReadableStream }
  destroy(): Promise<void>
}
```

#### 2.2 PlatformDetector
- Runtime environment detection
- Feature capability detection
- Platform-specific configuration

**Detection Strategy:**
```typescript
class PlatformDetector {
  static detect(): Platform {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') return 'browser'
    if (typeof Bun !== 'undefined') return 'bun'
    if (typeof process !== 'undefined') return 'node'
    throw new Error('Unknown platform')
  }

  static getCapabilities(): PlatformCapabilities {
    return {
      hasWorker: typeof Worker !== 'undefined',
      hasIndexedDB: typeof indexedDB !== 'undefined',
      hasNativeFS: typeof process !== 'undefined' || typeof Bun !== 'undefined',
      hasWASM: typeof WebAssembly !== 'undefined'
    }
  }
}
```

#### 2.3 IFileSystem Interface
Unified filesystem abstraction across platforms.

**Interface Definition:**
```typescript
interface IFileSystem {
  // Core operations
  readFile(path: string): Promise<Uint8Array>
  writeFile(path: string, data: Uint8Array): Promise<void>
  deleteFile(path: string): Promise<void>

  // Directory operations
  readdir(path: string): Promise<string[]>
  mkdir(path: string, options?: { recursive: boolean }): Promise<void>
  rmdir(path: string, options?: { recursive: boolean }): Promise<void>

  // Metadata
  stat(path: string): Promise<FileStats>
  exists(path: string): Promise<boolean>

  // Streams (WHATWG Streams)
  createReadStream(path: string): ReadableStream<Uint8Array>
  createWriteStream(path: string): WritableStream<Uint8Array>

  // Lifecycle
  initialize(): Promise<void>
  destroy(): Promise<void>
}
```

**Implementation: IndexedDBFileSystem (Browser)**
```typescript
class IndexedDBFileSystem implements IFileSystem {
  private db: IDBDatabase
  private storeName = 'shell-fs'

  async initialize(): Promise<void> {
    // Open IndexedDB with version management
    // Create object stores: files, metadata
    // Set up indexes for path-based queries
  }

  async readFile(path: string): Promise<Uint8Array> {
    // Transaction: readonly on 'files' store
    // Query by path key
    // Return blob data as Uint8Array
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    // Transaction: readwrite on 'files' store
    // Store blob with path as key
    // Update metadata (size, mtime)
  }

  createReadStream(path: string): ReadableStream<Uint8Array> {
    // Return WHATWG ReadableStream
    // Chunk file data in 64KB blocks
    // Handle backpressure
  }

  createWriteStream(path: string): WritableStream<Uint8Array> {
    // Return WHATWG WritableStream
    // Buffer writes for batch commits
    // Handle abort/error scenarios
  }
}
```

**Implementation: NodeFileSystem (Node.js)**
```typescript
class NodeFileSystem implements IFileSystem {
  private basePath: string

  async readFile(path: string): Promise<Uint8Array> {
    return await fs.promises.readFile(this.resolve(path))
  }

  createReadStream(path: string): ReadableStream<Uint8Array> {
    // Wrap Node.js fs.createReadStream
    // Convert to WHATWG ReadableStream
    const nodeStream = fs.createReadStream(this.resolve(path))
    return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>
  }

  createWriteStream(path: string): WritableStream<Uint8Array> {
    // Wrap Node.js fs.createWriteStream
    // Convert to WHATWG WritableStream
    const nodeStream = fs.createWriteStream(this.resolve(path))
    return Writable.toWeb(nodeStream) as WritableStream<Uint8Array>
  }
}
```

**Implementation: BunFileSystem (Bun.js)**
```typescript
class BunFileSystem implements IFileSystem {
  private basePath: string

  async readFile(path: string): Promise<Uint8Array> {
    const file = Bun.file(this.resolve(path))
    return new Uint8Array(await file.arrayBuffer())
  }

  createReadStream(path: string): ReadableStream<Uint8Array> {
    // Use Bun's native stream API
    const file = Bun.file(this.resolve(path))
    return file.stream()
  }

  createWriteStream(path: string): WritableStream<Uint8Array> {
    // Use Bun's native stream API
    return Bun.write(this.resolve(path)).stream()
  }
}
```

#### 2.4 StreamManager
Manages WHATWG Streams for stdin/stdout/stderr.

**Architecture:**
```typescript
class StreamManager {
  private stdin: WritableStream<string>
  private stdout: ReadableStream<string>
  private stderr: ReadableStream<string>

  constructor() {
    // Create transform streams for I/O
    const { readable: stdoutReadable, writable: stdoutWritable } = new TransformStream()
    const { readable: stderrReadable, writable: stderrWritable } = new TransformStream()
    const { readable: stdinReadable, writable: stdinWritable } = new TransformStream()

    this.stdout = stdoutReadable
    this.stderr = stderrReadable
    this.stdin = stdinWritable
  }

  // Pipe to external targets (xterm.js, WebSocket)
  pipe(stream: ReadableStream, target: WritableStream): Promise<void> {
    return stream.pipeTo(target)
  }

  // Tee for multiple consumers
  tee(stream: ReadableStream): [ReadableStream, ReadableStream] {
    return stream.tee()
  }

  // Create buffered reader
  createBufferedReader(stream: ReadableStream): AsyncIterator<string> {
    const reader = stream.getReader()
    return {
      async next() {
        const { done, value } = await reader.read()
        return { done, value }
      }
    }
  }
}
```

#### 2.5 WorkerBridge (Browser Only)
Manages Web Worker communication for browser isolation.

**Architecture:**
```typescript
// Main Thread
class WorkerBridge {
  private worker: Worker
  private messageId = 0
  private pending = new Map<number, { resolve, reject }>()

  async initialize(workerUrl: string): Promise<void> {
    this.worker = new Worker(workerUrl, { type: 'module' })
    this.worker.onmessage = (e) => this.handleMessage(e.data)
  }

  async exec(command: string): Promise<ExecResult> {
    const id = this.messageId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ type: 'exec', id, command })
    })
  }

  streamOutput(onStdout: (data: string) => void, onStderr: (data: string) => void) {
    this.worker.onmessage = (e) => {
      if (e.data.type === 'stdout') onStdout(e.data.data)
      if (e.data.type === 'stderr') onStderr(e.data.data)
    }
  }
}

// Worker Thread
self.onmessage = async (e) => {
  const { type, id, command } = e.data

  if (type === 'exec') {
    try {
      const result = await bashKernel.exec(command)
      self.postMessage({ type: 'result', id, result })
    } catch (error) {
      self.postMessage({ type: 'error', id, error: error.message })
    }
  }
}
```

#### 2.6 BashKernel (just-bash wrapper)
Core execution engine using just-bash.

**Architecture:**
```typescript
import { createBashEngine } from 'just-bash'

class BashKernel {
  private engine: any
  private mounts = new Map<string, IFileSystem>()

  async initialize(config: BashConfig): Promise<void> {
    this.engine = await createBashEngine({
      env: config.env || {},
      cwd: config.cwd || '/home',
      fs: this.createVirtualFS()
    })
  }

  async exec(command: string): Promise<ExecResult> {
    const result = await this.engine.run(command)
    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      signal: result.signal
    }
  }

  mount(path: string, fs: IFileSystem): void {
    this.mounts.set(path, fs)
    this.engine.mount(path, this.createFSAdapter(fs))
  }

  private createVirtualFS(): any {
    // Adapt IFileSystem to just-bash FS interface
    return {
      readFileSync: (path: string) => {
        const fs = this.resolveMountedFS(path)
        return fs.readFile(path) // Synchronous wrapper
      },
      writeFileSync: (path: string, data: Uint8Array) => {
        const fs = this.resolveMountedFS(path)
        return fs.writeFile(path, data)
      },
      // ... other FS methods
    }
  }
}
```

## Data Flow Diagrams

### 3.1 Platform Initialization Flow

```
┌─────────────────┐
│  Shell.create() │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ PlatformDetector    │
│ .detect()           │
└────────┬────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐  ┌───────────┐  ┌─────────┐
│Browser │  │   Node    │  │   Bun   │
└───┬────┘  └─────┬─────┘  └────┬────┘
    │             │              │
    ▼             ▼              ▼
┌───────────┐ ┌──────────┐ ┌───────────┐
│IndexedDB  │ │NodeFS    │ │BunFS      │
│FileSystem │ │          │ │           │
└─────┬─────┘ └────┬─────┘ └─────┬─────┘
      │            │             │
      └────────────┴─────────────┘
                   │
                   ▼
            ┌──────────────┐
            │  BashKernel  │
            │  (just-bash) │
            └──────────────┘
```

### 3.2 Command Execution Flow (Browser)

```
┌──────────┐
│  Client  │
└────┬─────┘
     │ shell.exec('ls -la')
     ▼
┌──────────────┐
│ Shell (Main  │
│   Thread)    │
└────┬─────────┘
     │ postMessage
     ▼
┌──────────────┐
│ WorkerBridge │
└────┬─────────┘
     │
     ▼
┌──────────────────┐
│  Web Worker      │
│  ┌────────────┐  │
│  │ BashKernel │  │
│  └──────┬─────┘  │
│         │        │
│         ▼        │
│  ┌────────────┐  │
│  │  just-bash │  │
│  └──────┬─────┘  │
│         │        │
│         ▼        │
│  ┌────────────┐  │
│  │IndexedDBFS │  │
│  └────────────┘  │
└──────────────────┘
     │ result
     ▼
┌──────────────┐
│ StreamManager│
│ (stdout)     │
└──────────────┘
     │
     ▼
┌──────────────┐
│  xterm.js or │
│  Consumer    │
└──────────────┘
```

### 3.3 Command Execution Flow (Node/Bun)

```
┌──────────┐
│  Client  │
└────┬─────┘
     │ shell.exec('ls -la')
     ▼
┌──────────────┐
│    Shell     │
└────┬─────────┘
     │ direct call (no worker)
     ▼
┌──────────────┐
│ BashKernel   │
└────┬─────────┘
     │
     ▼
┌──────────────┐
│  just-bash   │
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ NodeFS/BunFS │
│ (native FS)  │
└──────────────┘
     │
     ▼
┌──────────────┐
│ StreamManager│
│ (stdout)     │
└──────────────┘
```

### 3.4 Stream Piping Architecture

```
┌────────────┐
│ BashKernel │
│  stdout    │
└─────┬──────┘
      │
      ▼
┌─────────────────────┐
│ ReadableStream      │
│ (WHATWG Streams)    │
└──────┬──────────────┘
       │
       ├──────────────┐
       │              │
       ▼              ▼
┌──────────┐   ┌──────────────┐
│ xterm.js │   │  WebSocket   │
│ Terminal │   │  Server      │
└──────────┘   └──────────────┘
       │              │
       ▼              ▼
┌──────────┐   ┌──────────────┐
│ Browser  │   │  Remote      │
│   DOM    │   │  Client      │
└──────────┘   └──────────────┘
```

### 3.5 Filesystem Mount Architecture

```
┌──────────────────────────┐
│      BashKernel          │
│  Virtual Filesystem      │
│                          │
│  /  (root)               │
│  ├─ /home (IndexedDB)    │
│  │   ├─ /home/user       │
│  │   └─ /home/projects   │
│  ├─ /tmp (Memory)        │
│  └─ /mnt (Custom)        │
│      └─ /mnt/s3          │
└────┬─────────────────────┘
     │
     ├────────────────┐
     │                 │
     ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ IndexedDBFS  │  │  CustomFS    │
│ (/home)      │  │  (/mnt/s3)   │
└──────────────┘  └──────────────┘
```

## Platform-Specific Initialization Paths

### 4.1 Browser Initialization

```typescript
// Browser initialization sequence
async function initializeBrowser(config: ShellConfig): Promise<Shell> {
  // 1. Detect browser capabilities
  const caps = PlatformDetector.getCapabilities()
  if (!caps.hasIndexedDB) throw new Error('IndexedDB required')
  if (!caps.hasWorker) throw new Error('Web Worker required')

  // 2. Initialize IndexedDB filesystem
  const fs = new IndexedDBFileSystem({
    dbName: config.dbName || 'shell-db',
    version: 1
  })
  await fs.initialize()

  // 3. Create and initialize worker
  const workerUrl = config.workerUrl || '/shell-worker.js'
  const workerBridge = new WorkerBridge()
  await workerBridge.initialize(workerUrl)

  // 4. Setup stream manager
  const streamManager = new StreamManager()

  // 5. Configure bash kernel in worker
  await workerBridge.configure({
    mounts: [{ path: '/home', fs }],
    env: config.env || {},
    cwd: '/home'
  })

  // 6. Create shell instance
  return new Shell({
    platform: 'browser',
    fs,
    workerBridge,
    streamManager
  })
}
```

### 4.2 Node.js Initialization

```typescript
// Node.js initialization sequence
async function initializeNode(config: ShellConfig): Promise<Shell> {
  // 1. Detect Node.js version and features
  const nodeVersion = process.versions.node
  if (parseInt(nodeVersion) < 18) throw new Error('Node.js 18+ required')

  // 2. Initialize native filesystem
  const homeDir = config.homeDir || path.join(os.homedir(), '.shell')
  const fs = new NodeFileSystem({ basePath: homeDir })
  await fs.initialize()

  // 3. Setup stream manager (no worker needed)
  const streamManager = new StreamManager()

  // 4. Initialize bash kernel (main thread)
  const bashKernel = new BashKernel()
  await bashKernel.initialize({
    mounts: [{ path: '/home', fs }],
    env: { ...process.env, ...config.env },
    cwd: '/home'
  })

  // 5. Create shell instance
  return new Shell({
    platform: 'node',
    fs,
    bashKernel,
    streamManager
  })
}
```

### 4.3 Bun.js Initialization

```typescript
// Bun.js initialization sequence
async function initializeBun(config: ShellConfig): Promise<Shell> {
  // 1. Detect Bun version
  const bunVersion = Bun.version

  // 2. Initialize native filesystem with Bun optimizations
  const homeDir = config.homeDir || path.join(os.homedir(), '.shell')
  const fs = new BunFileSystem({ basePath: homeDir })
  await fs.initialize()

  // 3. Setup stream manager with Bun's native streams
  const streamManager = new StreamManager()

  // 4. Initialize bash kernel with Bun optimizations
  const bashKernel = new BashKernel()
  await bashKernel.initialize({
    mounts: [{ path: '/home', fs }],
    env: { ...Bun.env, ...config.env },
    cwd: '/home'
  })

  // 5. Create shell instance
  return new Shell({
    platform: 'bun',
    fs,
    bashKernel,
    streamManager
  })
}
```

## I/O Streaming Architecture

### 5.1 WHATWG Streams Integration

```typescript
// Unified stream interface
interface ShellStreams {
  stdin: WritableStream<string>
  stdout: ReadableStream<string>
  stderr: ReadableStream<string>
}

// Stream creation
class Shell {
  private streams: ShellStreams

  constructor() {
    // Create transform streams for I/O
    const stdoutTransform = new TransformStream<Uint8Array, string>({
      transform(chunk, controller) {
        controller.enqueue(new TextDecoder().decode(chunk))
      }
    })

    const stderrTransform = new TransformStream<Uint8Array, string>({
      transform(chunk, controller) {
        controller.enqueue(new TextDecoder().decode(chunk))
      }
    })

    const stdinTransform = new TransformStream<string, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(new TextEncoder().encode(chunk))
      }
    })

    this.streams = {
      stdin: stdinTransform.writable,
      stdout: stdoutTransform.readable,
      stderr: stderrTransform.readable
    }
  }

  // Pipe to external targets
  async pipeTo(target: 'xterm' | 'socket', options: PipeOptions): Promise<void> {
    const { stdout, stderr } = this.streams

    if (target === 'xterm') {
      // Merge stdout and stderr for terminal display
      const merged = mergeStreams([stdout, stderr])
      await merged.pipeTo(options.terminal.writable)
    }

    if (target === 'socket') {
      // Send stdout and stderr separately
      await Promise.all([
        stdout.pipeTo(options.socket.stdoutWritable),
        stderr.pipeTo(options.socket.stderrWritable)
      ])
    }
  }
}

// Helper: Merge multiple ReadableStreams
function mergeStreams(streams: ReadableStream<string>[]): ReadableStream<string> {
  return new ReadableStream({
    async start(controller) {
      await Promise.all(
        streams.map(async (stream) => {
          const reader = stream.getReader()
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              controller.enqueue(value)
            }
          } finally {
            reader.releaseLock()
          }
        })
      )
      controller.close()
    }
  })
}
```

### 5.2 xterm.js Integration Example

```typescript
import { Terminal } from 'xterm'
import { Shell } from '@tdsk/shell'

// Setup terminal
const term = new Terminal()
term.open(document.getElementById('terminal'))

// Create shell
const shell = await Shell.create({
  platform: 'browser',
  workerUrl: '/shell-worker.js'
})

// Get streams
const { stdin, stdout, stderr } = shell.getStreams()

// Pipe shell output to terminal
const reader = stdout.getReader()
const decoder = new TextDecoder()

;(async () => {
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    term.write(value)
  }
})()

// Pipe terminal input to shell
term.onData(async (data) => {
  const writer = stdin.getWriter()
  await writer.write(data)
  writer.releaseLock()
})

// Execute commands
await shell.exec('echo "Hello from shell!"')
```

### 5.3 WebSocket Server Integration Example

```typescript
import { WebSocketServer } from 'ws'
import { Shell } from '@tdsk/shell'

const wss = new WebSocketServer({ port: 8080 })

wss.on('connection', async (ws) => {
  // Create shell instance for this connection
  const shell = await Shell.create({
    platform: 'node',
    homeDir: `/tmp/shell-${Date.now()}`
  })

  // Get streams
  const { stdin, stdout, stderr } = shell.getStreams()

  // Pipe stdout to WebSocket
  const stdoutReader = stdout.getReader()
  ;(async () => {
    while (true) {
      const { done, value } = await stdoutReader.read()
      if (done) break
      ws.send(JSON.stringify({ type: 'stdout', data: value }))
    }
  })()

  // Pipe stderr to WebSocket
  const stderrReader = stderr.getReader()
  ;(async () => {
    while (true) {
      const { done, value } = await stderrReader.read()
      if (done) break
      ws.send(JSON.stringify({ type: 'stderr', data: value }))
    }
  })()

  // Pipe WebSocket input to stdin
  ws.on('message', async (data) => {
    const message = JSON.parse(data.toString())
    if (message.type === 'stdin') {
      const writer = stdin.getWriter()
      await writer.write(message.data)
      writer.releaseLock()
    }
    if (message.type === 'exec') {
      await shell.exec(message.command)
    }
  })

  // Cleanup on disconnect
  ws.on('close', async () => {
    await shell.destroy()
  })
})
```

## Configuration and Options

### 6.1 Shell Configuration

```typescript
interface ShellConfig {
  // Platform override (auto-detected if not provided)
  platform?: 'browser' | 'node' | 'bun'

  // Browser-specific
  workerUrl?: string
  dbName?: string

  // Node/Bun-specific
  homeDir?: string

  // Common
  env?: Record<string, string>
  cwd?: string

  // Filesystem mounts
  mounts?: Array<{
    path: string
    fs: IFileSystem
  }>

  // Stream options
  streams?: {
    stdoutBufferSize?: number
    stderrBufferSize?: number
  }
}
```

### 6.2 Execution Options

```typescript
interface ExecOptions {
  // Working directory
  cwd?: string

  // Environment variables (merged with shell env)
  env?: Record<string, string>

  // Timeout in milliseconds
  timeout?: number

  // Capture output (default: true)
  capture?: boolean

  // Stream output in real-time (default: false)
  streaming?: boolean

  // Input data for stdin
  stdin?: string | ReadableStream<string>
}

interface ExecResult {
  exitCode: number
  stdout: string
  stderr: string
  signal?: string
  duration: number
}
```

## Error Handling and Recovery

### 7.1 Error Types

```typescript
enum ShellErrorCode {
  PLATFORM_NOT_SUPPORTED = 'PLATFORM_NOT_SUPPORTED',
  FILESYSTEM_ERROR = 'FILESYSTEM_ERROR',
  WORKER_ERROR = 'WORKER_ERROR',
  EXECUTION_ERROR = 'EXECUTION_ERROR',
  STREAM_ERROR = 'STREAM_ERROR',
  MOUNT_ERROR = 'MOUNT_ERROR'
}

class ShellError extends Error {
  constructor(
    public code: ShellErrorCode,
    message: string,
    public cause?: Error
  ) {
    super(message)
    this.name = 'ShellError'
  }
}
```

### 7.2 Recovery Strategies

```typescript
class Shell {
  private retryConfig = {
    maxRetries: 3,
    backoff: 1000
  }

  async exec(command: string, options?: ExecOptions): Promise<ExecResult> {
    let lastError: Error

    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        return await this.executeCommand(command, options)
      } catch (error) {
        lastError = error

        // Only retry on transient errors
        if (error.code === ShellErrorCode.FILESYSTEM_ERROR) {
          await this.sleep(this.retryConfig.backoff * (attempt + 1))
          continue
        }

        // Don't retry on permanent errors
        throw error
      }
    }

    throw new ShellError(
      ShellErrorCode.EXECUTION_ERROR,
      `Command failed after ${this.retryConfig.maxRetries} attempts`,
      lastError
    )
  }
}
```

## Performance Considerations

### 8.1 Browser Optimizations

- **IndexedDB Batching**: Group multiple file operations into single transactions
- **Worker Pool**: Use multiple workers for parallel command execution
- **Stream Chunking**: Use 64KB chunks for optimal IndexedDB performance
- **Lazy Loading**: Load just-bash WASM on-demand

### 8.2 Memory Management

```typescript
class Shell {
  private maxMemory = 100 * 1024 * 1024 // 100MB

  async checkMemory(): Promise<void> {
    if (this.platform === 'browser') {
      const estimate = await navigator.storage.estimate()
      if (estimate.usage > this.maxMemory) {
        await this.cleanup()
      }
    }
  }

  async cleanup(): Promise<void> {
    // Clear /tmp directory
    await this.fs.rmdir('/tmp', { recursive: true })
    await this.fs.mkdir('/tmp')

    // Compact IndexedDB (browser only)
    if (this.platform === 'browser') {
      await this.fs.compact()
    }
  }
}
```

## Security Considerations

### 9.1 Browser Security

- **Worker Isolation**: Execute commands in Web Worker sandbox
- **CSP Compliance**: All code loads via ES modules
- **Origin Isolation**: IndexedDB isolated per origin
- **Command Validation**: Sanitize user input before execution

### 9.2 Command Sanitization

```typescript
class Shell {
  private dangerousCommands = ['rm -rf /', 'mkfs', 'dd']

  private validateCommand(command: string): void {
    // Check for dangerous commands
    for (const dangerous of this.dangerousCommands) {
      if (command.includes(dangerous)) {
        throw new ShellError(
          ShellErrorCode.EXECUTION_ERROR,
          `Dangerous command blocked: ${dangerous}`
        )
      }
    }

    // Check for path traversal
    if (command.includes('..')) {
      throw new ShellError(
        ShellErrorCode.EXECUTION_ERROR,
        'Path traversal not allowed'
      )
    }
  }

  async exec(command: string, options?: ExecOptions): Promise<ExecResult> {
    this.validateCommand(command)
    return await this.executeCommand(command, options)
  }
}
```

## Testing Strategy

### 10.1 Unit Tests

- Test each filesystem implementation independently
- Mock platform detection for cross-platform tests
- Test stream transformations and piping
- Test error handling and recovery

### 10.2 Integration Tests

- Test full command execution flow on each platform
- Test filesystem persistence (IndexedDB)
- Test worker communication (browser)
- Test stream piping to external targets

### 10.3 Example Test

```typescript
import { describe, it, expect } from 'vitest'
import { Shell } from '@tdsk/shell'

describe('Shell', () => {
  it('should execute basic commands', async () => {
    const shell = await Shell.create({ platform: 'node' })

    const result = await shell.exec('echo "Hello World"')

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Hello World')
  })

  it('should persist files to IndexedDB', async () => {
    const shell = await Shell.create({ platform: 'browser' })

    await shell.exec('echo "test" > /home/test.txt')
    const result = await shell.exec('cat /home/test.txt')

    expect(result.stdout).toContain('test')
  })

  it('should stream output to xterm.js', async () => {
    const shell = await Shell.create({ platform: 'browser' })
    const output: string[] = []

    const { stdout } = shell.getStreams()
    const reader = stdout.getReader()

    // Collect output
    const readerPromise = (async () => {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        output.push(value)
      }
    })()

    // Execute command
    await shell.exec('echo "line 1" && echo "line 2"')
    await readerPromise

    expect(output).toEqual(['line 1\n', 'line 2\n'])
  })
})
```

## Implementation Roadmap

### Phase 1: Core Infrastructure
1. PlatformDetector implementation
2. IFileSystem interface definition
3. StreamManager with WHATWG Streams
4. Basic Shell class with platform detection

### Phase 2: Filesystem Implementations
1. IndexedDBFileSystem (browser)
2. NodeFileSystem (Node.js)
3. BunFileSystem (Bun.js)
4. Stream adapters for each platform

### Phase 3: Execution Engine
1. BashKernel wrapper for just-bash
2. Mount management
3. WorkerBridge for browser isolation
4. Command execution with streaming

### Phase 4: Integration
1. xterm.js integration example
2. WebSocket server integration
3. Error handling and recovery
4. Performance optimizations

### Phase 5: Testing and Documentation
1. Unit tests for all components
2. Integration tests for each platform
3. API documentation
4. Usage examples and tutorials

## Conclusion

This architecture provides a unified, cross-platform shell execution environment with:

- **Platform Abstraction**: Single API works across browser, Node.js, and Bun.js
- **Persistent Storage**: IndexedDB in browser, native filesystem in Node/Bun
- **WHATWG Streams**: Standard streaming interface for I/O
- **Worker Isolation**: Secure execution in browser via Web Workers
- **just-bash Integration**: Full bash compatibility via just-bash kernel
- **Flexible Mounting**: Custom filesystem adapters for any storage backend
- **Stream Piping**: Easy integration with xterm.js, WebSockets, etc.

The modular design allows each component to be tested and optimized independently while maintaining a consistent API across all platforms.
