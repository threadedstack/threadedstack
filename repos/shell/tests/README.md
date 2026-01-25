# Shell Test Suite

Comprehensive test suite for `@tdsk/shell` with dual environment support (jsdom + node).

## Test Structure

```
tests/
├── unit/                           # Unit tests for individual components
│   ├── Shell.test.ts              # Shell class initialization and configuration
│   ├── FileSystem.test.ts         # ZenFS virtual filesystem operations
│   ├── StreamManager.test.ts      # WHATWG Streams I/O testing
│   ├── IndexedDBFileSystem.test.ts # Browser persistence (jsdom only)
│   └── WebWorker.test.ts          # Web Worker integration (jsdom only)
├── integration/                    # End-to-end integration tests
│   └── integration.test.ts        # Complete shell workflows
├── helpers/                        # Test utilities
│   └── testUtils.ts               # Shared test helpers
├── mocks/                          # Mock implementations
└── setup.ts                        # Global test setup
```

## Running Tests

```bash
# Run all tests (both node and jsdom environments)
pnpm test

# Run with coverage
pnpm test -- --coverage

# Run specific test file
pnpm test tests/unit/Shell.test.ts

# Run in watch mode
pnpm test -- --watch

# Run only node environment tests
pnpm test -- --environment node

# Run only jsdom (browser) tests
pnpm test -- --environment jsdom
```

## Test Environments

### Node Environment (Default)
Most tests run in Node.js environment:
- Shell initialization
- File system operations (ZenFS InMemory backend)
- Stream I/O operations
- Command execution
- Integration tests

### jsdom Environment (Browser Simulation)
Browser-specific tests run in jsdom:
- IndexedDB persistence tests
- Web Worker integration tests
- Browser-specific APIs

The test configuration automatically routes tests to appropriate environments using `environmentMatchGlobs`.

## Test Categories

### 1. Shell Core Tests (`Shell.test.ts`)
- Instance creation and initialization
- Configuration validation
- Platform detection
- Type safety
- Memory management

### 2. File System Tests (`FileSystem.test.ts`)
- Read/Write operations
- Directory management
- File metadata
- Path operations
- Binary file handling
- Performance benchmarks

### 3. Stream Tests (`StreamManager.test.ts`)
- ReadableStream operations
- WritableStream operations
- Stream piping and transforms
- Backpressure handling
- Error propagation
- Binary data streaming

### 4. IndexedDB Tests (`IndexedDBFileSystem.test.ts`)
- Browser database initialization
- File storage and retrieval
- Update and delete operations
- Transaction handling
- Binary data storage
- Performance testing

### 5. Web Worker Tests (`WebWorker.test.ts`)
- Worker creation and lifecycle
- Message passing
- Error handling
- Multiple worker coordination
- Data transfer patterns
- Performance testing

### 6. Integration Tests (`integration.test.ts`)
- Complete shell workflows
- Cross-component integration
- Error recovery
- Resource management
- Performance benchmarks
- Platform compatibility

## Test Utilities

The `tests/helpers/testUtils.ts` module provides:

- `createTestConfig()` - Mock shell configuration
- `sleep()` - Async delay utility
- `createTestReadableStream()` - Mock readable streams
- `createTestWritableStream()` - Mock writable streams with output capture
- `waitFor()` - Condition polling
- `measureTime()` - Performance timing
- `generateRandomData()` - Test data generation
- `createTestFileStructure()` - Batch file creation
- `buffersEqual()` - Binary comparison
- `retry()` - Flaky operation helper
- `validateTestEnvironment()` - Environment feature detection

## Coverage Requirements

The test suite enforces minimum coverage thresholds:

- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

View coverage reports in `coverage/` directory after running tests with `--coverage`.

## Performance Tests

Performance benchmarks are included to ensure:

- File operations complete in <100ms
- Stream processing handles 1MB data in <200ms
- Concurrent operations scale linearly
- Memory usage stays within reasonable bounds

## Writing New Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Shell } from '../../src/Shell'

describe('Feature Name', () => {
  let shell: Shell

  beforeEach(async () => {
    shell = new Shell({ verbose: false })
    await shell.initialize()
  })

  afterEach(async () => {
    await shell.destroy()
  })

  it('should do something', async () => {
    const result = await shell.execute('echo test')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('test')
  })
})
```

### Environment-Specific Tests

```typescript
// Skip in browser
const describeIfNode = global.testUtils?.isNode ? describe : describe.skip

describeIfNode('Node-only feature', () => {
  it('should work in Node', () => {
    expect(process.versions.node).toBeDefined()
  })
})

// Skip in Node
const describeIfBrowser = global.testUtils?.isBrowser ? describe : describe.skip

describeIfBrowser('Browser-only feature', () => {
  it('should work in browser', () => {
    expect(typeof window).toBe('object')
  })
})
```

### Using Test Utilities

```typescript
import { createTestConfig, measureTime, waitFor } from '../helpers/testUtils'

it('should be performant', async () => {
  const { result, duration } = await measureTime(async () => {
    return await performOperation()
  })

  expect(result).toBeDefined()
  expect(duration).toBeLessThan(100)
})

it('should handle async conditions', async () => {
  let isReady = false
  setTimeout(() => { isReady = true }, 50)

  await waitFor(() => isReady, 1000, 10)
  expect(isReady).toBe(true)
})
```

## Debugging Tests

```bash
# Run with verbose output
pnpm test -- --reporter=verbose

# Run single test with debugging
pnpm test -- --grep "specific test name"

# Enable console output in tests
# Remove console mocks in tests/setup.ts
```

## Continuous Integration

Tests are designed to run in CI environments:

- No external dependencies
- Deterministic results
- Fast execution (<30s for full suite)
- Comprehensive error messages
- Automatic retry for flaky operations

## Dependencies

Required packages (already in package.json):
- `vitest` - Test framework
- `@zenfs/core` - Virtual filesystem
- `fake-indexeddb` - IndexedDB mock (jsdom)
- `vite-plugin-node-polyfills` - Node.js polyfills for browser tests

## Troubleshooting

### Tests fail with "Worker is not defined"
This is expected in Node.js environment. Worker tests automatically skip in Node.

### IndexedDB tests fail
Ensure `fake-indexeddb` is installed. IndexedDB tests only run in jsdom environment.

### File system tests fail
Check that `@zenfs/core` is properly installed and imported.

### Performance tests are slow
Performance tests have generous timeouts but may fail on slow systems. Adjust timeout values in test files if needed.

## Contributing

When adding new tests:

1. Follow existing patterns in test files
2. Add appropriate environment guards (node/jsdom)
3. Include both success and error cases
4. Add performance tests for critical paths
5. Update this README if adding new test categories
6. Ensure coverage thresholds are maintained
