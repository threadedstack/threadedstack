# @tdsk/wasm

WebAssembly build and runtime utilities for the Threaded Stack platform.

## Overview

This package provides TypeScript to WebAssembly compilation utilities, building on the `componentize-js` and `jco` toolchain from the Bytecode Alliance.

## Features

- TypeScript → WebAssembly compilation
- WebAssembly → JavaScript interop
- Runtime helper utilities
- Polyfills for Node.js/browser environments

## Installation

```bash
pnpm install
```

## Usage

```typescript
import { buildWasm, runWasm } from '@tdsk/wasm'

// Compile TypeScript to WebAssembly
const wasmModule = await buildWasm({ root: '<path/to/root/directory>' })

// Run WebAssembly module
const result = await runWasm(wasmModule, { /* imports */ })
```

## Development

```bash
# Build the package
pnpm build

# Run tests
pnpm test

# Watch mode
pnpm start
```

## License

MIT
