# just-bash API Research Findings

**Research Date**: 2025-01-25
**Package Version**: 2.5.5
**Repository**: https://github.com/vercel-labs/just-bash
**Researcher**: Research Agent

---

## Executive Summary

just-bash provides a secure, sandboxed bash environment with virtual filesystem support. It uses an AST-based architecture (Parser → AST → Interpreter) and provides 4 filesystem implementations with a common `IFileSystem` interface. The library is platform-agnostic (Node.js and browser), supports 70+ built-in commands, custom commands via TypeScript, and optional network access with URL allowlists.

---

## 1. IFileSystem Interface Requirements

### Core Interface

The `IFileSystem` interface defines the contract for all filesystem implementations:

```typescript
interface IFileSystem {
  // File Operations (18 required methods)
  readFile(path: string, options?: ReadFileOptions | BufferEncoding): Promise<string>
  readFileBuffer(path: string): Promise<Uint8Array>
  writeFile(path: string, content: FileContent, options?: WriteFileOptions | BufferEncoding): Promise<void>
  appendFile(path: string, content: FileContent, options?: WriteFileOptions | BufferEncoding): Promise<void>

  // Metadata Operations
  exists(path: string): Promise<boolean>
  stat(path: string): Promise<FsStat>  // Follows symlinks
  lstat(path: string): Promise<FsStat>  // Does NOT follow symlinks

  // Directory Operations
  mkdir(path: string, options?: MkdirOptions): Promise<void>
  readdir(path: string): Promise<string[]>
  readdirWithFileTypes?(path: string): Promise<DirentEntry[]>  // Optional - more efficient

  // File Manipulation
  rm(path: string, options?: RmOptions): Promise<void>
  cp(src: string, dest: string, options?: CpOptions): Promise<void>
  mv(src: string, dest: string): Promise<void>

  // Permissions & Links
  chmod(path: string, mode: number): Promise<void>
  symlink(target: string, linkPath: string): Promise<void>
  link(existingPath: string, newPath: string): Promise<void>
  readlink(path: string): Promise<string>

  // Path Utilities
  resolvePath(base: string, path: string): string  // Synchronous
  getAllPaths(): string[]  // Synchronous - for glob matching
}
```

### Key Types

```typescript
type FileContent = string | Uint8Array
type BufferEncoding = "utf8" | "utf-8" | "ascii" | "binary" | "base64" | "hex" | "latin1"

interface FsStat {
  isFile: boolean
  isDirectory: boolean
  isSymbolicLink: boolean
  mode: number
  size: number
  mtime: Date
}

interface DirentEntry {
  name: string
  isFile: boolean
  isDirectory: boolean
  isSymbolicLink: boolean
}

interface MkdirOptions { recursive?: boolean }
interface RmOptions { recursive?: boolean; force?: boolean }
interface CpOptions { recursive?: boolean }
```

### Key Characteristics

- **All methods are async** except `resolvePath()` and `getAllPaths()`
- **Error handling**: Methods throw errors for invalid operations (e.g., file not found, permission denied)
- **Path normalization**: Implementations must handle `.`, `..`, and absolute paths
- **Symlink handling**: `stat()` follows symlinks, `lstat()` does not

---

## 2. Filesystem Implementations

### 2.1 InMemoryFs (Default)

**Description**: Pure in-memory filesystem with complete isolation from real disk.

**Constructor**:
```typescript
new InMemoryFs(initialFiles?: InitialFiles)
```

**Features**:
- ✅ Complete POSIX-like filesystem in memory
- ✅ Supports symlinks and hard links
- ✅ Full permission system (chmod)
- ✅ Fast operations (no disk I/O)
- ✅ Synchronous helpers: `writeFileSync()`, `mkdirSync()`
- ✅ Works in browser and Node.js

**Use Cases**:
- AI agents with no disk access needs
- Testing and sandboxing
- Browser environments
- Isolated command execution

**Example**:
```typescript
import { Bash } from "just-bash"

// Default - automatically creates InMemoryFs
const bash = new Bash()

// With initial files
const bash = new Bash({
  files: {
    "/data/config.json": '{"key": "value"}',
    "/app/script.sh": "echo hello"
  }
})
```

---

### 2.2 ReadWriteFs

**Description**: Direct read-write access to a real directory on disk.

**Constructor**:
```typescript
new ReadWriteFs({ root: string })
```

**Features**:
- ✅ All operations go directly to Node.js `fs` module
- ✅ True read-write filesystem
- ✅ No overlay or sandboxing
- ✅ Paths are relative to root directory
- ⚠️ Writes persist to disk - use with caution

**Key Methods**:
- `toRealPath(virtualPath)` - Converts virtual path to real filesystem path
- `normalizePath(path)` - Handles `.`, `..`, and ensures starts with `/`

**Use Cases**:
- When agent needs to persist changes to disk
- Direct file manipulation
- Build scripts that create artifacts

**Example**:
```typescript
import { Bash, ReadWriteFs } from "just-bash"

const rwfs = new ReadWriteFs({ root: "/path/to/sandbox" })
const bash = new Bash({ fs: rwfs })

await bash.exec('echo "hello" > file.txt')  // Writes to real filesystem
```

**Security Note**: Use with caution - writes directly to disk without sandboxing.

---

### 2.3 OverlayFs

**Description**: Copy-on-write filesystem over a real directory. Reads come from disk, writes stay in memory.

**Constructor**:
```typescript
new OverlayFs({
  root: string,            // Real directory path
  mountPoint?: string,     // Default: "/home/user/project"
  readOnly?: boolean       // Default: false
})
```

**Features**:
- ✅ Reads come from real filesystem
- ✅ Writes go to in-memory layer
- ✅ Changes don't persist to disk
- ✅ Cannot escape root directory
- ✅ Optional read-only mode (all writes throw errors)
- ✅ Synchronous initialization: `writeFileSync()`, `mkdirSync()`

**Key Methods**:
- `getMountPoint()` - Returns the virtual mount point path
- `writeFileSync(path, content)` - Sync write for initialization
- `mkdirSync(path, options?)` - Sync mkdir for initialization

**Use Cases**:
- CLI execution (used by `just-bash` binary)
- Read-only knowledge bases
- Safe experimentation on real projects
- Testing without modifying source files

**Example**:
```typescript
import { Bash } from "just-bash"
import { OverlayFs } from "just-bash/fs/overlay-fs"

const overlay = new OverlayFs({
  root: "/path/to/project",
  mountPoint: "/project",
  readOnly: false  // Allow writes (they stay in memory)
})

const bash = new Bash({ fs: overlay, cwd: overlay.getMountPoint() })

await bash.exec("cat package.json")  // Reads from disk
await bash.exec('echo "modified" > package.json')  // Stays in memory
```

**Default Mount Point**: `/home/user/project`

---

### 2.4 MountableFs

**Description**: Mount multiple filesystems at different paths into a unified namespace.

**Constructor**:
```typescript
new MountableFs({
  base?: IFileSystem,     // Default: new InMemoryFs()
  mounts?: MountConfig[]  // Initial mounts
})

interface MountConfig {
  mountPoint: string
  filesystem: IFileSystem
}
```

**Features**:
- ✅ Combines read-only and read-write filesystems
- ✅ Base filesystem for unmounted paths
- ✅ Mount validation (no mounting at root or inside existing mounts)
- ✅ Cross-mount copy operations
- ✅ Dynamic mount/unmount support

**Key Methods**:
```typescript
mount(mountPoint: string, filesystem: IFileSystem): void
unmount(mountPoint: string): void
getMounts(): ReadonlyArray<{ mountPoint: string, filesystem: IFileSystem }>
isMountPoint(path: string): boolean
```

**Use Cases**:
- Combining knowledge base (read-only) + workspace (read-write)
- Multi-directory projects
- Complex filesystem hierarchies
- Separate temp directories

**Example**:
```typescript
import { Bash, MountableFs, InMemoryFs } from "just-bash"
import { OverlayFs } from "just-bash/fs/overlay-fs"
import { ReadWriteFs } from "just-bash/fs/read-write-fs"

const fs = new MountableFs({ base: new InMemoryFs() })

// Mount read-only knowledge base
fs.mount("/mnt/knowledge", new OverlayFs({
  root: "/path/to/knowledge",
  readOnly: true
}))

// Mount read-write workspace
fs.mount("/home/agent", new ReadWriteFs({
  root: "/path/to/workspace"
}))

const bash = new Bash({ fs, cwd: "/home/agent" })

await bash.exec("ls /mnt/knowledge")  // Reads from knowledge base
await bash.exec("cp /mnt/knowledge/doc.txt ./")  // Cross-mount copy
await bash.exec('echo "notes" > notes.txt')  // Writes to workspace
```

**Constructor Shorthand**:
```typescript
const fs = new MountableFs({
  base: new InMemoryFs(),
  mounts: [
    { mountPoint: "/data", filesystem: new OverlayFs({ root: "/shared/data" }) },
    { mountPoint: "/workspace", filesystem: new ReadWriteFs({ root: "/tmp/work" }) }
  ]
})
```

---

## 3. Shell Initialization API

### 3.1 Basic Usage

```typescript
import { Bash } from "just-bash"

// Simple initialization (uses InMemoryFs)
const bash = new Bash()
const result = await bash.exec('echo "Hello World"')
console.log(result.stdout)  // "Hello World\n"
console.log(result.exitCode)  // 0
```

### 3.2 BashOptions

```typescript
interface BashOptions {
  // Initial Filesystem State
  files?: InitialFiles  // Record<string, FileContent | FileInit>

  // Initial Environment
  env?: Record<string, string>
  cwd?: string  // Default: "/home/user"

  // Custom Filesystem
  fs?: IFileSystem

  // Execution Limits
  executionLimits?: {
    maxCallDepth?: number         // Default: 100
    maxCommandCount?: number      // Default: 10000
    maxLoopIterations?: number    // Default: 10000
    maxAwkIterations?: number     // Default: 10000
    maxSedIterations?: number     // Default: 10000
  }

  // Network Configuration
  network?: NetworkConfig  // Disabled by default

  // Command Restrictions
  commands?: CommandName[]  // Whitelist specific commands

  // Custom Commands
  customCommands?: CustomCommand[]

  // Debugging & Profiling
  logger?: BashLogger  // { info(), debug() }
  trace?: TraceCallback  // Performance profiling

  // Testing Support
  sleep?: (ms: number) => Promise<void>
}
```

### 3.3 Exec Method

```typescript
async exec(
  commandLine: string,
  options?: ExecOptions
): Promise<BashExecResult>

interface ExecOptions {
  env?: Record<string, string>  // Merged with current env
  cwd?: string                  // Temporary cwd (restored after)
  rawScript?: boolean           // Skip normalization (default: false)
}

interface BashExecResult {
  stdout: string
  stderr: string
  exitCode: number
  env: Record<string, string>  // Final environment after execution
}
```

**Key Characteristics**:
- **Isolation**: Each `exec()` is isolated - env vars, functions, and cwd don't persist across calls
- **Filesystem persistence**: Filesystem changes DO persist across calls
- **Per-exec overrides**: Use `options.env` and `options.cwd` for temporary changes

**Example**:
```typescript
const bash = new Bash({
  files: { "/data/file.txt": "content" },
  env: { MY_VAR: "value" },
  cwd: "/app"
})

// Per-exec override
await bash.exec("echo $TEMP", {
  env: { TEMP: "temporary value" },
  cwd: "/tmp"
})

// Original env and cwd are restored
```

### 3.4 Default Filesystem Layout

When created without options, Bash provides a Unix-like directory structure:

```
/home/user    # Default working directory and $HOME
/bin          # Contains stubs for all built-in commands
/usr/bin      # Additional binary directory
/tmp          # Temporary files directory
```

Commands can be invoked by path (`/bin/ls`) or by name (`ls`).

---

## 4. Stream I/O Patterns

### 4.1 Standard I/O in CommandContext

Commands receive I/O through the `CommandContext`:

```typescript
interface CommandContext {
  stdin: string    // Input content
  // ... other fields
}

// Commands return ExecResult
interface ExecResult {
  stdout: string   // Standard output
  stderr: string   // Error output
  exitCode: number
}
```

### 4.2 Bash Pipes and Redirections

Full bash pipe and redirection support:

```bash
# Pipes
cmd1 | cmd2                    # Pipe stdout of cmd1 to stdin of cmd2

# Redirections
command > file                 # Redirect stdout to file
command >> file                # Append stdout to file
command 2> file                # Redirect stderr to file
command 2>&1                   # Redirect stderr to stdout
command < file                 # Read stdin from file

# Command Chaining
cmd1 && cmd2                   # Run cmd2 only if cmd1 succeeds (exitCode 0)
cmd1 || cmd2                   # Run cmd2 only if cmd1 fails (exitCode != 0)
cmd1 ; cmd2                    # Run cmd2 after cmd1 regardless
```

### 4.3 Sandbox API - Streaming Commands

Vercel Sandbox compatible API for streaming command output:

```typescript
import { Sandbox } from "just-bash"

const sandbox = await Sandbox.create({ cwd: "/app" })

// Write files
await sandbox.writeFiles({
  "/app/script.sh": 'echo "Hello World"',
  "/app/data.json": '{"key": "value"}'
})

// Run command and stream output
const cmd = await sandbox.runCommand("bash /app/script.sh")

// Stream logs as they arrive
for await (const msg of cmd.logs()) {
  console.log(`[${msg.type}] ${msg.data}`)
  // msg.timestamp available for timing
}

// Wait for completion
const result = await cmd.wait()
console.log(`Exit code: ${result.exitCode}`)

// Or get final outputs directly
const stdout = await cmd.stdout()
const stderr = await cmd.stderr()
const combined = await cmd.output()
```

**Command Class Methods**:
```typescript
class Command {
  logs(): AsyncGenerator<OutputMessage>  // Stream stdout/stderr
  wait(): Promise<CommandFinished>       // Wait for completion
  stdout(): Promise<string>              // Get final stdout
  stderr(): Promise<string>              // Get final stderr
  output(): Promise<string>              // Get combined output
  kill(): Promise<void>                  // Kill running command
}

interface OutputMessage {
  type: "stdout" | "stderr"
  data: string
  timestamp: Date
}
```

### 4.4 Custom Command I/O

Custom commands have full access to I/O through CommandContext:

```typescript
import { defineCommand } from "just-bash"

const upper = defineCommand("upper", async (args, ctx) => {
  // Read from stdin
  const input = ctx.stdin

  // Process and return via stdout
  return {
    stdout: input.toUpperCase(),
    stderr: "",
    exitCode: 0
  }
})

const bash = new Bash({ customCommands: [upper] })
await bash.exec("echo 'hello' | upper")  // Output: "HELLO\n"
```

---

## 5. Platform Detection Capabilities

### 5.1 Platform Agnostic Design

just-bash is **platform-agnostic** - it works in both Node.js and browser environments:

- ✅ No dependency on `process.platform` or `os.platform()`
- ✅ Pure TypeScript implementation
- ✅ Platform-specific code isolated in `ReadWriteFs` (uses Node.js `fs` module)
- ✅ Browser-compatible with InMemoryFs

### 5.2 Environment Variables

Fully customizable via `env` option:

```typescript
const bash = new Bash({
  env: {
    USER: "agent",
    HOME: "/home/agent",
    PATH: "/bin:/usr/bin",
    SHELL: "/bin/bash",
    PWD: "/home/agent"
  }
})
```

### 5.3 Hostname Command

The `hostname` command always returns `"localhost"` in the sandboxed environment:

```typescript
const result = await bash.exec("hostname")
console.log(result.stdout)  // "localhost\n"
```

### 5.4 Platform Detection Strategy

**For Threaded Stack Integration**:

Since just-bash doesn't expose platform detection, you should:

1. **Detect platform in your wrapper code**:
   ```typescript
   const platform = process.platform  // 'darwin', 'linux', 'win32'
   const isWindows = platform === 'win32'
   ```

2. **Configure environment variables accordingly**:
   ```typescript
   const bash = new Bash({
     env: {
       PLATFORM: platform,
       IS_WINDOWS: isWindows ? '1' : '0',
       // ... other platform-specific vars
     }
   })
   ```

3. **Use custom commands for platform-specific operations**:
   ```typescript
   const platformInfo = defineCommand("platform-info", async (args, ctx) => {
     const info = {
       platform: process.platform,
       arch: process.arch,
       node: process.version
     }
     return {
       stdout: JSON.stringify(info, null, 2),
       stderr: "",
       exitCode: 0
     }
   })
   ```

---

## 6. Network Support

### 6.1 Default Behavior

Network access is **disabled by default** for security. The `curl` command only exists when network is configured.

### 6.2 Network Configuration

```typescript
interface NetworkConfig {
  // Option 1: Specific URL prefixes (RECOMMENDED)
  allowedUrlPrefixes?: string[]
  allowedMethods?: string[]  // Default: ["GET", "HEAD"]

  // Option 2: Full internet access (USE WITH CAUTION)
  dangerouslyAllowFullInternetAccess?: boolean
}
```

**Examples**:

```typescript
// Safest: Allow specific URLs with GET/HEAD only
const bash = new Bash({
  network: {
    allowedUrlPrefixes: [
      "https://api.github.com/repos/myorg/",
      "https://api.example.com"
    ]
  }
})

// Allow specific URLs with additional methods
const bash = new Bash({
  network: {
    allowedUrlPrefixes: ["https://api.example.com"],
    allowedMethods: ["GET", "HEAD", "POST"]
  }
})

// Allow all URLs and methods (use with caution)
const bash = new Bash({
  network: { dangerouslyAllowFullInternetAccess: true }
})
```

### 6.3 Allow-List Security

The allow-list enforces:
- **Origin matching**: URLs must match exact origin (scheme + host + port)
- **Path prefix**: Only paths starting with specified prefix are allowed
- **HTTP method restrictions**: Only GET and HEAD by default
- **Redirect protection**: Redirects to non-allowed URLs are blocked

### 6.4 Using curl

```bash
# Fetch and process data
curl -s https://api.example.com/data | grep pattern

# Download and convert HTML to Markdown
curl -s https://example.com | html-to-markdown

# POST JSON data
curl -X POST -H "Content-Type: application/json" \
  -d '{"key":"value"}' https://api.example.com/endpoint
```

---

## 7. Custom Commands

### 7.1 Define Command API

```typescript
import { defineCommand } from "just-bash"

const myCommand = defineCommand(
  "command-name",
  async (args: string[], ctx: CommandContext): Promise<ExecResult> => {
    // Command implementation
    return {
      stdout: "output\n",
      stderr: "",
      exitCode: 0
    }
  }
)
```

### 7.2 CommandContext

Full context available to custom commands:

```typescript
interface CommandContext {
  fs: IFileSystem                     // Virtual filesystem
  cwd: string                         // Current working directory
  env: Record<string, string>         // Environment variables
  stdin: string                       // Standard input

  // Available when running via Bash interpreter
  exec?: (command: string, options: CommandExecOptions) => Promise<ExecResult>
  getRegisteredCommands?: () => string[]

  // Conditionally available
  fetch?: SecureFetch                 // When network configured
  sleep?: (ms: number) => Promise<void>  // Custom sleep function

  // Debugging
  limits?: Required<ExecutionLimits>
  trace?: TraceCallback
}
```

### 7.3 Example: API Call Command

```typescript
const apiCall = defineCommand("api-call", async (args, ctx) => {
  if (!ctx.fetch) {
    return {
      stdout: "",
      stderr: "Error: Network access not configured\n",
      exitCode: 1
    }
  }

  const [method, url] = args

  try {
    const response = await ctx.fetch(url, { method })
    const data = await response.json()

    return {
      stdout: JSON.stringify(data, null, 2) + "\n",
      stderr: "",
      exitCode: 0
    }
  } catch (error) {
    return {
      stdout: "",
      stderr: `Error: ${error.message}\n`,
      exitCode: 1
    }
  }
})

const bash = new Bash({
  customCommands: [apiCall],
  network: {
    allowedUrlPrefixes: ["https://api.example.com/"]
  }
})

await bash.exec("api-call GET https://api.example.com/data")
```

### 7.4 Example: File Processing Command

```typescript
const processJson = defineCommand("process-json", async (args, ctx) => {
  const [filePath] = args

  try {
    // Read file from virtual filesystem
    const content = await ctx.fs.readFile(filePath)
    const data = JSON.parse(content)

    // Process data
    const processed = Object.keys(data).map(key => ({
      key,
      value: data[key],
      type: typeof data[key]
    }))

    return {
      stdout: JSON.stringify(processed, null, 2) + "\n",
      stderr: "",
      exitCode: 0
    }
  } catch (error) {
    return {
      stdout: "",
      stderr: `Error: ${error.message}\n`,
      exitCode: 1
    }
  }
})
```

---

## 8. Integration Patterns for Threaded Stack

### 8.1 Basic Shell Environment

```typescript
import { Bash } from "just-bash"

const bash = new Bash({
  cwd: "/workspace",
  env: {
    USER: "tdsk-agent",
    HOME: "/home/agent",
    TDSK_API_URL: "https://api.threaded-stack.com"
  }
})

const result = await bash.exec("ls -la")
console.log(result.stdout)
```

### 8.2 Mounted Workspace Pattern

Recommended for Threaded Stack - combine project directories with temp workspace:

```typescript
import { Bash, MountableFs, InMemoryFs } from "just-bash"
import { OverlayFs } from "just-bash/fs/overlay-fs"

const fs = new MountableFs({ base: new InMemoryFs() })

// Mount project as read-only
fs.mount("/project", new OverlayFs({
  root: process.cwd(),
  readOnly: true
}))

// Mount temp workspace as in-memory
fs.mount("/workspace", new InMemoryFs())

// Mount scratch space as read-write
fs.mount("/tmp", new InMemoryFs())

const bash = new Bash({
  fs,
  cwd: "/workspace",
  env: {
    PROJECT_ROOT: "/project",
    WORKSPACE: "/workspace"
  }
})

// Can read from project, write to workspace
await bash.exec("cp /project/config.json /workspace/")
await bash.exec("cat /workspace/config.json | jq '.key' > /workspace/value.txt")
```

### 8.3 Custom TDSK Commands

```typescript
import { defineCommand, Bash } from "just-bash"

// API call with secret injection
const tdskApiCall = defineCommand("tdsk-api", async (args, ctx) => {
  const [endpoint, method = "GET"] = args
  const apiKey = ctx.env.TDSK_API_KEY

  if (!apiKey) {
    return {
      stdout: "",
      stderr: "Error: TDSK_API_KEY not set\n",
      exitCode: 1
    }
  }

  if (!ctx.fetch) {
    return {
      stdout: "",
      stderr: "Error: Network access not configured\n",
      exitCode: 1
    }
  }

  try {
    const response = await ctx.fetch(
      `https://api.threaded-stack.com${endpoint}`,
      {
        method,
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      }
    )

    const data = await response.json()
    return {
      stdout: JSON.stringify(data, null, 2) + "\n",
      stderr: "",
      exitCode: 0
    }
  } catch (error) {
    return {
      stdout: "",
      stderr: `API Error: ${error.message}\n`,
      exitCode: 1
    }
  }
})

// Secret management
const getSecret = defineCommand("get-secret", async (args, ctx) => {
  const [secretName] = args

  // Read from secure secrets store
  try {
    const secretContent = await ctx.fs.readFile(`/secrets/${secretName}`)
    return {
      stdout: secretContent,  // Secrets already in filesystem
      stderr: "",
      exitCode: 0
    }
  } catch {
    return {
      stdout: "",
      stderr: `Secret not found: ${secretName}\n`,
      exitCode: 1
    }
  }
})

const bash = new Bash({
  customCommands: [tdskApiCall, getSecret],
  network: {
    allowedUrlPrefixes: [
      "https://api.threaded-stack.com/"
    ],
    allowedMethods: ["GET", "POST", "PUT", "DELETE"]
  },
  env: {
    TDSK_API_KEY: process.env.TDSK_API_KEY
  }
})

// Usage
await bash.exec("tdsk-api /orgs GET")
await bash.exec("get-secret my-api-key")
```

### 8.4 Sandbox Streaming for Long-Running Commands

```typescript
import { Sandbox } from "just-bash"

const sandbox = await Sandbox.create({
  cwd: "/app",
  network: {
    allowedUrlPrefixes: ["https://api.threaded-stack.com/"]
  }
})

// Write agent script
await sandbox.writeFiles({
  "/app/agent.sh": `
    #!/bin/bash
    echo "Starting TDSK agent..."
    for i in {1..5}; do
      echo "Processing step $i..."
      sleep 1
    done
    echo "Agent complete"
  `
})

// Run and stream output to client
const cmd = await sandbox.runCommand("bash /app/agent.sh")

for await (const msg of cmd.logs()) {
  if (msg.type === "stdout") {
    // Stream to client (WebSocket, SSE, etc.)
    console.log(`[${msg.timestamp.toISOString()}] ${msg.data}`)
  }
}

const result = await cmd.wait()
console.log(`Exit code: ${result.exitCode}`)
```

---

## 9. Key Takeaways for Implementation

### For Threaded Stack Shell Integration:

1. **Use `MountableFs` for Complex Hierarchies**
   - Mount project directories as read-only via `OverlayFs`
   - Mount workspace as `InMemoryFs` or `ReadWriteFs`
   - Separate temp directories for scratch space

2. **Implement Custom Commands for TDSK Operations**
   - API calls with secret injection
   - Secret retrieval from secure store
   - Project-specific utilities

3. **Leverage CommandContext for Filesystem Access**
   - `ctx.fs` provides full filesystem API
   - `ctx.exec` for running subcommands
   - `ctx.env` for environment variables

4. **Use Sandbox API for Streaming to Clients**
   - `Command.logs()` returns `AsyncGenerator<OutputMessage>`
   - Perfect for WebSocket/SSE streaming
   - Real-time progress updates

5. **Configure Network Allowlist Carefully**
   - Only allow specific TDSK API endpoints
   - Use HTTPS only
   - Restrict HTTP methods as needed

6. **Handle Platform Detection in Wrapper Code**
   - Detect platform via `process.platform`
   - Pass to bash via environment variables
   - Custom commands can access `process.*` directly

7. **Add Logging and Tracing**
   - Implement `BashLogger` for audit trails
   - Use `trace` callback for performance monitoring
   - Track command execution for debugging

8. **Security Considerations**
   - Never expose API keys in environment without encryption
   - Use read-only mounts for source code
   - Validate all user-provided paths
   - Set execution limits to prevent runaway scripts

---

## 10. Supported Commands (70+)

### File Operations
`cat`, `cp`, `file`, `ln`, `ls`, `mkdir`, `mv`, `readlink`, `rm`, `split`, `stat`, `touch`, `tree`

### Text Processing
`awk`, `base64`, `column`, `comm`, `cut`, `diff`, `expand`, `fold`, `grep` (+ `egrep`, `fgrep`), `head`, `join`, `md5sum`, `nl`, `od`, `paste`, `printf`, `rev`, `rg`, `sed`, `sha1sum`, `sha256sum`, `sort`, `strings`, `tac`, `tail`, `tr`, `unexpand`, `uniq`, `wc`, `xargs`

### Data Processing
`jq` (JSON), `sqlite3` (SQLite), `xan` (CSV), `yq` (YAML/XML/TOML/CSV)

### Compression & Archives
`gzip` (+ `gunzip`, `zcat`), `tar`

### Navigation & Environment
`basename`, `cd`, `dirname`, `du`, `echo`, `env`, `export`, `find`, `hostname`, `printenv`, `pwd`, `tee`

### Shell Utilities
`alias`, `bash`, `chmod`, `clear`, `date`, `expr`, `false`, `help`, `history`, `seq`, `sh`, `sleep`, `timeout`, `true`, `unalias`, `which`

### Network Commands
`curl`, `html-to-markdown`

All commands support `--help` for usage information.

---

## 11. References

- **Package**: `just-bash@2.5.5`
- **Repository**: https://github.com/vercel-labs/just-bash
- **AI SDK Tool**: https://github.com/vercel-labs/bash-tool
- **Vercel Sandbox**: https://vercel.com/docs/vercel-sandbox

---

## Appendix: Quick Reference

### IFileSystem Implementation Checklist

- [ ] 18 required async methods
- [ ] 2 synchronous methods: `resolvePath()`, `getAllPaths()`
- [ ] 1 optional method: `readdirWithFileTypes()`
- [ ] Handle symlinks correctly (`stat` vs `lstat`)
- [ ] Normalize paths (`.`, `..`, absolute)
- [ ] Throw errors for invalid operations
- [ ] Support file permissions (chmod)
- [ ] Support hard links and symlinks

### Bash Initialization Checklist

- [ ] Choose filesystem implementation (InMemoryFs, ReadWriteFs, OverlayFs, MountableFs)
- [ ] Set initial files and directories
- [ ] Configure environment variables
- [ ] Set working directory
- [ ] Define execution limits
- [ ] Configure network access (if needed)
- [ ] Add custom commands
- [ ] Set up logging/tracing

### Security Checklist

- [ ] Use read-only mounts for source code
- [ ] Never expose secrets in environment
- [ ] Validate user-provided paths
- [ ] Set execution limits
- [ ] Configure network allowlist
- [ ] Use HTTPS only
- [ ] Restrict HTTP methods
- [ ] Handle errors gracefully
