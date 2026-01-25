# @tdsk/shell

WASM-based shell environment for secure command execution across Node.js, Bun.js, and Browser environments.

## Overview

`@tdsk/shell` provides an isolated shell execution environment using WebAssembly, enabling secure command execution with:

- **Virtual File System**: In-memory file system for sandboxed file operations
- **WASM Runtime**: WebAssembly-based command execution
- **Stream Support**: WHATWG Streams API for stdin/stdout/stderr handling
- **Multi-Platform**: Works in Node.js, Bun.js, and modern browsers
- **Worker Support**: Parallel execution using Web Workers

## Architecture

```
repos/shell/
├── src/
│   ├── vfs/        # Virtual File System implementation
│   ├── wasm/       # WASM module loader and runtime
│   ├── streams/    # WHATWG Streams utilities
│   ├── core/       # Core shell functionality
│   ├── runtime/    # Platform-specific adapters
│   ├── workers/    # Web Workers support
│   ├── types/      # TypeScript type definitions
│   └── utils/      # Shared utilities
├── configs/        # Build and tooling configuration
├── scripts/        # Build scripts (WASM compilation)
├── tests/          # Vitest unit tests
└── docs/           # Additional documentation
```

## Installation

```bash
# Install dependencies
pnpm install

# Build WASM modules
pnpm build:wasm

# Build application
pnpm build
```

## Development

```bash
# Start development server with watch mode
pnpm start

# Run tests
pnpm test

# Lint and format
pnpm lint
pnpm format
```

## Usage

```typescript
import { createShell, type ShellCommand } from '@tdsk/shell'

// Create shell instance
const shell = await createShell({
  vfs: true,        // Enable virtual file system
  workers: true,    // Enable worker support
})

// Execute command
const result = await shell.execute({
  name: 'ls',
  args: ['-la'],
  cwd: '/home',
  env: { PATH: '/bin:/usr/bin' },
})

console.log(result.exitCode)  // 0
console.log(result.stdout)    // Command output
```

## Path Aliases

This package uses `@TSH/*` prefix for internal path aliasing:

- `@TSH/*` - Source files (`src/*`)
- `@TSH/configs/*` - Configuration files
- `@TSH/root/*` - Repository root
- `@TDM/*` - Domain types (`@tdsk/domain`)
- `@TDB/*` - Database access (`@tdsk/database`)

## Build Targets

- **Node.js**: ESM/CJS bundles via tsup
- **Bun.js**: Native ESM support
- **Browser**: ESM bundle via Vite

## Dependencies

- `@bytecodealliance/componentize-js` - WASM component tooling
- `@bytecodealliance/jco` - JavaScript component tools
- `web-streams-polyfill` - WHATWG Streams polyfill
- `alias-hq` - Path aliasing support

## License

MIT
