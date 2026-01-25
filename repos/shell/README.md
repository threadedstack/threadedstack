# @tdsk/shell

Cross-platform bash execution environment for Browser, Node.js, and Bun runtimes using just-bash kernel.

## Overview

`@tdsk/shell` provides a unified Shell class that integrates the just-bash kernel with platform-specific filesystems, enabling seamless bash command execution across different JavaScript environments.

### Features

- 🌐 **Cross-Platform**: Automatic runtime detection (Browser, Node.js, Bun)
- 📁 **Filesystem Abstraction**: Platform-appropriate filesystem mounting (InMemoryFs/ReadWriteFs)
- 🔄 **Stream Management**: Full stdin/stdout/stderr support with buffering
- ⚡ **Promise-based API**: Modern async/await interface
- 🧪 **Fully Tested**: Comprehensive test suite with 50+ test cases
- 📚 **Well Documented**: Complete API documentation and examples

## Architecture

```
Shell
├── Platform Detection
│   └── Detects Browser/Node/Bun
├── Filesystem
│   ├── Browser → InMemoryFs
│   └── Node/Bun → ReadWriteFs
├── Stream Management
│   └── stdin/stdout/stderr buffering
└── Just-Bash Integration
    └── Command execution kernel
```

### Directory Structure
```
repos/shell/
├── src/
│   ├── Shell.ts         # Main Shell class
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Platform detection, filesystem, streams
│   ├── constants/       # Constants and configuration
│   └── examples/        # Usage examples
├── tests/               # Vitest unit tests
├── docs/                # Documentation
│   ├── SHELL_CLASS.md           # API documentation
│   └── IMPLEMENTATION_SUMMARY.md # Architecture details
└── configs/             # Build and tooling configuration
```

## Installation

```bash
pnpm install @tdsk/shell
```

## Quick Start

```typescript
import { Shell } from '@tdsk/shell'

// Create and initialize shell
const shell = new Shell()
await shell.initialize()

// Execute commands
const result = await shell.execute('echo "Hello, World!"')
console.log(result.stdout)    // "Hello, World!"
console.log(result.exitCode)  // 0
console.log(result.duration)  // execution time in ms

// Clean up
await shell.destroy()
```

## API

### Constructor
```typescript
new Shell(options?: TShellOptions)
```

**Options:**
- `homeDir?: string` - Home directory for Node/Bun (default: `process.cwd()`)
- `persistent?: boolean` - Enable IndexedDB in browser (default: `true`)
- `bashOptions?: Partial<BashOptions>` - Custom bash configuration
- `verbose?: boolean` - Enable verbose logging (default: `false`)

### Key Methods

- `initialize(): Promise<void>` - Initialize shell environment
- `execute(command: string): Promise<TExecutionResult>` - Execute command
- `getStreams(): TShellStreams` - Get I/O streams
- `destroy(): Promise<void>` - Cleanup resources
- `reset(): Promise<void>` - Reset to initial state
- `cd(path: string): Promise<void>` - Change directory
- `pwd(): Promise<string>` - Get current directory

## Examples

### Basic Command Execution
```typescript
const shell = new Shell()
await shell.initialize()

const result = await shell.execute('ls -la')
console.log(result.stdout)

await shell.destroy()
```

### Custom Configuration
```typescript
const shell = new Shell({
  homeDir: '/custom/path',
  verbose: true
})
await shell.initialize()
```

### Directory Operations
```typescript
await shell.initialize()
await shell.execute('mkdir -p /home/workspace')
await shell.cd('/home/workspace')
const pwd = await shell.pwd()
console.log(pwd) // "/home/workspace"
```

### Error Handling
```typescript
const result = await shell.execute('nonexistent-command')
if (result.exitCode !== 0) {
  console.error('Command failed:', result.stderr)
}
```

## Development

```bash
# Build
pnpm build

# Run tests
pnpm test

# Start development with watch
pnpm start

# Lint
pnpm lint
```

## Path Aliases

This package uses `@TSH/*` prefix for internal path aliasing:

- `@TSH/*` - Source files (`src/*`)
- `@TSH/configs/*` - Configuration files
- `@TSH/root/*` - Repository root
- `@TDM/*` - Domain types (`@tdsk/domain`)
- `@TDB/*` - Database access (`@tdsk/database`)

## Platform Support

### Browser
- Uses `InMemoryFs` for filesystem operations
- All operations performed in virtual filesystem
- Optional IndexedDB persistence (coming soon)

### Node.js / Bun
- Uses `ReadWriteFs` for real filesystem access
- Configurable home directory
- Full filesystem read/write capabilities

## Build Targets

- **Node.js**: ESM/CJS bundles via tsup
- **Bun**: Native ESM support
- **Browser**: Compatible with bundlers (Vite, webpack)

## Dependencies

- **just-bash** (2.5.5) - Bash kernel for command execution
- **@zenfs/core** (1.0.5) - Filesystem abstraction layer
- **node:stream** - Stream API for I/O
- **alias-hq** - Path aliasing support

## Documentation

- [API Documentation](./docs/SHELL_CLASS.md) - Complete API reference
- [Implementation Summary](./docs/IMPLEMENTATION_SUMMARY.md) - Architecture details
- [Usage Examples](./src/examples/basic-usage.ts) - Comprehensive examples

## Related Packages

- `@tdsk/domain` - Shared types and models
- `@tdsk/logger` - Winston-based logging
- `@tdsk/backend` - Core API server
- `@tdsk/admin` - Admin dashboard

## License

MIT

---

**Status**: ✅ Production Ready
**Version**: 1.0.0
**Last Updated**: January 25, 2026
