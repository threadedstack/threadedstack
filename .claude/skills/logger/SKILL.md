---
name: "Threaded Stack - Logger Repo"
description: "Knowledge base for the Winston logging service repo"
tags: ["winston", "logging", "nodejs", "service", "express-middleware", "security"]
---
# Logger Repo Skill

## Overview

The `@tdsk/logger` package is a Winston-based logging service that provides:
- **CLI Logger**: Terminal/console logging with colored output (`Log` class, `Logger` singleton)
- **API Logger**: Winston-powered structured logging for backend services (`ApiLogger`, `buildApiLogger`)
- **Express Middleware**: Request/error logging middleware for Express apps
- **Security**: Automatic redaction of sensitive data (passwords, tokens, API keys, secrets)
- **stderr Interception**: Global `process.stderr` hijacking to sanitize error output (stdout interception is currently disabled)

This is a shared utility consumed by `backend` and `proxy` repos for consistent logging across the platform.

## Directory Structure

```
repos/logger/
├── src/
│   ├── index.ts                    # Main entry point (re-exports all modules)
│   ├── logger.ts                   # CLI Logger class (colored console output)
│   ├── logger.test.ts              # Logger unit test
│   ├── apiLogger.ts                # API Logger + buildApiLogger factory (Winston wrapper)
│   ├── middleware.ts               # Express middleware (request/error logging)
│   ├── stdio.ts                    # Process stdout/stderr interception (side-effect import)
│   ├── types/
│   │   ├── logger.types.ts         # TypeScript type definitions
│   │   └── index.ts                # Type re-exports
│   └── utils/
│       ├── index.ts                # Utils re-exports (helpers, stripColors, injectKeyValues)
│       ├── buildLogger.ts          # Winston logger factory
│       ├── colors.ts               # ANSI color helpers
│       ├── levels.ts               # Log level utilities (npm levels)
│       ├── helpers.ts              # Re-exports from @keg-hub/jsutils (isStr, isNum, exists, isColl, identity, capitalize)
│       ├── safeReplacer.ts         # Secret redaction logic
│       ├── injectKeyValues.ts      # Dynamic secret injection
│       └── stripColors.ts          # ANSI color stripping
├── configs/
│   ├── tsup.config.ts              # Build configuration
│   ├── biome.json                  # Linting/formatting config
│   └── vitest.config.ts            # Test configuration
├── scripts/
│   ├── loadEnvs.ts                 # Environment loading
│   └── addToProcess.ts             # Process injection
├── package.json                    # Package metadata
├── tsconfig.json                   # TypeScript config
├── index.js                        # CJS entry point (redirects to dist/log)
└── index.mjs                       # ESM entry point (re-exports from dist/log)
```

## Key Files

### Core Modules

**`src/logger.ts`** - CLI Logger (Log class)
- Terminal/console logging with ANSI colors
- Tag support for message prefixing (`setTag()`, `removeTag()`, `toggleTag()`)
- Helper methods: `header()`, `subHeader()`, `pair()`, `label()`, `spacedMsg()`, `table()`, `highlight()`
- Color methods: `red()`, `green()`, `yellow()`, `cyan()`, `blue()`, `magenta()`, `gray()`, `error()`, `warn()`, `success()`, `fail()`, `info()`, `data()`, `dir()`, `text()`
- Output methods: `print()`, `stdout()`, `stderr()`, `clear()`, `empty()`
- Color customization: `setColors()`, `color()`
- Singleton `Logger` instance exported for direct use

**`src/apiLogger.ts`** - API Logger + `buildApiLogger` factory
- Imports `stdio.ts` as side-effect (triggers stream interception on load)
- `setupLogger({ tag, label, ...opts })` - Configure the default API logger instance
- `buildApiLogger(label?, level?, logger?)` - Factory that creates API logger objects with positional params (not options object)
- `ApiLogger` - Default singleton created via `buildApiLogger()`
- **Known behavior**: `debug()`, `verbose()`, and `silly()` methods all map to Winston `info` level internally (via `loggerWrap('info', ...)`). This means these log levels are not distinguished in output.
- Additional methods: `empty()`, `pair()`, `highlight()`, `data()`, `log()`, `success()`
- Formats messages as structured objects with `{ message, label, data }` shape

**`src/middleware.ts`** - Express Middleware
- `setupLoggerReq(app, middlewareOpts?)` - Request logging middleware (uses `express-winston.logger`)
- `setupLoggerErr(app, middlewareOpts?)` - Error logging middleware (uses `express-winston.errorLogger`)
- Metadata logging enabled at `verbose` level or higher
- Accepts optional `middlewareOpts` to override default express-winston configuration

**`src/stdio.ts`** - Global Stream Interception (side-effect module)
- Imported by `apiLogger.ts` as a side-effect (`import './stdio'`)
- Hijacks `process.stdout.write` and `process.stderr.write`
- **stdout**: Strips colors (when `TDSK_TEST_COLORS` disabled) but `replaceUnsafe()` is currently commented out (no secret redaction on stdout)
- **stderr**: Strips colors AND applies `replaceUnsafe()` for secret redaction, bypassed via `STL_FORCE_DISABLE_SAFE=true`

### Utilities

**`src/utils/buildLogger.ts`** - Winston Factory
- Creates Winston logger instances via `buildLogger(options?, defaultLogger?)`
- `defaultLogger` param (default: `true`): when true, returns singleton `__LOGGER`; when false, creates a new instance
- Transports: Console only
- Formatters: `simple`, `json`, `prettyPrint` (dev), `timestamp`, `label`
- `filterOptionsReq()` custom format filter removes OPTIONS requests from logs
- Singleton `__LOGGER` pattern for default logger

**`src/utils/safeReplacer.ts`** - Secret Redaction
- `safeReplacer(key, value)` - JSON.stringify replacer that redacts sensitive data
- `replaceUnsafe(str)` - Applies safeReplacer to a raw string (used in stderr interception)
- `injectUnsafe(items)` - Add runtime values to the redaction list
- `resetInjectedLogs()` - Clear injected redaction values
- Regex patterns for keys: `/passw(or)?d/i`, `/pass/i`, `/secret/i`, `/token/i`, `/api[-._]?key/i`, `/session[-._]?id/i`, `/^connect\.sid$/`
- Value-level patterns for credit card numbers
- Key-value pair patterns: `authorization` + bearer, `token`, `password`, `secret`
- Replaces matches with `****`

**`src/utils/levels.ts`** - Log Level Management
- `npmLevels` - Winston npm log levels from `config.npm.levels`
- `levelMap` - Maps level names to priority numbers
- `compare(level1, level2)` - Compare two log levels
- `levels` - Structured object with `.check`, `.levels`, `.compare` for level querying
- `getLevelMethods(Logger, logMethod)` - Generate level-gated methods for a CLI logger

**`src/utils/colors.ts`** - ANSI Color Helpers
- ANSI escape codes for terminal colors
- Basic colors: `red`, `green`, `yellow`, `cyan`, `blue`, `magenta`, `white`, `gray`
- Bright variants: `brightRed`, `brightGreen`, `brightYellow`, `brightCyan`, `brightBlue`, `brightWhite`, `brightMagenta`
- Decorators: `underline.<color>()`, `dim.<color>()` (nested color+decorator combos)
- `addColor(...args)` utility for composing color sequences

**`src/utils/injectKeyValues.ts`** - Dynamic Secret Injection
- Extracts keys and values from objects (e.g., API responses with secrets)
- Injects them into `safeReplacer` via `injectUnsafe()`
- Ensures dynamically loaded secrets are redacted from logs

**`src/utils/stripColors.ts`** - Color Stripping
- `stripColors(str)` - Removes ANSI escape codes from strings when colors are disabled
- `loggerColorDisabled()` - Checks `TDSK_TEST_COLORS` env var (`0` or starts with `f`)

**`src/utils/helpers.ts`** - Re-exports from `@keg-hub/jsutils`
- Exports: `isStr`, `isNum`, `exists`, `isColl`, `identity`, `capitalize`

## Logger Configuration

### Winston Configuration

Built via `buildLogger()` with options:

```typescript
// TLogOpts extends winston.LoggerOptions
type TLogOpts = winston.LoggerOptions & {
  label: string              // Logger label for identification (default: 'TDSK')
}

// Defaults used in buildLogger():
// silent: false
// level: 'silly'
// label: 'TDSK'
// exitOnError: false
// handleExceptions: true
```

### Environment Variables

- **`NODE_ENV`**: `production` -> minimal JSON logging; non-production -> pretty-printed logs with colors
- **`TDSK_TEST_COLORS`**: `0` or starts with `f` (e.g., `false`) -> disable colors in logs/strip ANSI codes
- **`STL_FORCE_DISABLE_SAFE`**: `true` -> disable secret redaction on stderr (stdout redaction already disabled)

### Log Levels (npm standard)

| Level | Priority | Use Case |
|-------|----------|----------|
| `error` | 0 | Critical errors |
| `warn` | 1 | Warnings |
| `info` | 2 | General info (default) |
| `http` | 3 | HTTP requests |
| `verbose` | 4 | Detailed info |
| `debug` | 5 | Debug information |
| `silly` | 6 | Trace-level logs |

## Transports

Currently configured with **Console transport only**:

```typescript
new transports.Console({
  level,                             // Log level (default: 'silly')
  format: getFormatter(label),       // Combined format pipeline
  handleExceptions,                  // Handle uncaught exceptions (default: true)
})
```

**Format Pipeline (Development / non-production)**:
1. `filterOptionsReq()` - Remove OPTIONS requests
2. `timestamp()` - Add timestamp
3. `label({ label })` - Add label
4. `simple()` - Simple text format
5. `json()` - JSON structure
6. `prettyPrint({ depth: 10, colorize: true })` - Pretty output with depth 10

**Format Pipeline (Production)**:
1. `filterOptionsReq()` - Remove OPTIONS requests
2. `splat()` - String interpolation
3. `timestamp()` - Add timestamp
4. `label({ label })` - Add label
5. `json()` - JSON output only

## Architecture

### Two Logger Systems

**1. CLI Logger (`Log` class, `Logger` singleton)**
- For CLI tools, scripts, and terminal output
- Colored console output with ANSI codes
- Singleton instance exported as `Logger`
- Methods map to console methods with color wrapping via `logData()`

**2. API Logger (`ApiLogger`, `buildApiLogger`)**
- For backend/proxy API services
- Winston-powered structured logging
- Express middleware integration via `setupLoggerReq` / `setupLoggerErr`
- Automatic secret redaction via `stdio.ts` side-effect import
- `buildApiLogger()` is defined in `apiLogger.ts` (not in `utils/buildLogger.ts`)

### Security Architecture

**Multi-Layer Secret Protection**:

1. **JSON Serialization**: `safeReplacer()` used as `JSON.stringify()` replacer
2. **Stream Interception**: `stdio.ts` hijacks stderr globally (stdout redaction currently disabled)
3. **Dynamic Injection**: `injectKeyValues()` / `injectUnsafe()` add runtime secrets to redaction list
4. **Regex Patterns**: Pre-defined patterns for common secret keys and values

### Singleton Pattern

Both loggers use singleton pattern:
- `Logger` - Exported CLI logger instance (from `logger.ts`)
- `__LOGGER` - Internal Winston instance (from `buildLogger()` in `utils/buildLogger.ts`)
- `__logger` - Internal API logger (from `setupLogger()` in `apiLogger.ts`)
- `ApiLogger` - Default API logger singleton (from `buildApiLogger()` in `apiLogger.ts`)

## Usage Patterns

### CLI Logger (Simple Console Logging)

```typescript
import { Logger } from '@tdsk/logger'

// Basic logging
Logger.log('Starting process...')
Logger.info('Configuration loaded')
Logger.success('Task completed!')
Logger.error('Something went wrong')

// Colored output
Logger.green('Success message')
Logger.red('Error message')
Logger.yellow('Warning message')

// Headers and formatting
Logger.header('Application Started', 'cyan')
Logger.subHeader('Configuration', 'white')
Logger.pair('Database:', 'Connected')
Logger.table([{ name: 'User1', status: 'Active' }])

// Tags
Logger.setTag('[API]', 'cyan')
Logger.info('Request received')  // Output: [API] Request received
Logger.removeTag()

// Direct output
Logger.stdout('Progress: ')  // No newline
Logger.print('Done!\n')      // Same as console.log
```

### API Logger (Winston Backend)

```typescript
import { ApiLogger, setupLogger } from '@tdsk/logger'

// Configure logger (optional, auto-inits with defaults)
setupLogger({
  label: 'Backend API',
  level: 'info',
  exitOnError: false,
})

// Structured logging
ApiLogger.info('Server started', { port: 3000 })
ApiLogger.error('Database connection failed', { error: err })
ApiLogger.warn('Rate limit exceeded', { ip: req.ip })

// Note: debug/verbose/silly all map to 'info' internally
ApiLogger.debug('This logs at info level')
```

### Custom API Logger

```typescript
import { buildApiLogger } from '@tdsk/logger'

// Create custom API logger with positional params: (label, level, logger?)
const dbLogger = buildApiLogger('Database', 'debug')

dbLogger.info('Connection pool initialized')
dbLogger.error('Query failed', { duration: '23ms' })
```

### Express Middleware

```typescript
import express from 'express'
import { setupLoggerReq, setupLoggerErr } from '@tdsk/logger'

const app = express()

// Store logger config in app.locals
app.locals.config = {
  logger: {
    level: 'info',
    label: 'Backend API',
  }
}

// Request logging (logs all incoming requests)
setupLoggerReq(app)

// Your routes here
app.get('/api/users', (req, res) => { ... })

// Error logging (logs all errors thrown in routes)
setupLoggerErr(app)

// Error handlers must come after
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message })
})
```

### Custom Winston Logger

```typescript
import { buildLogger } from '@tdsk/logger'

// Create custom Winston logger instance
const dbLogger = buildLogger({
  label: 'Database',
  level: 'debug',
  silent: false,
}, false) // false = don't use singleton

dbLogger.info('Connection pool initialized')
dbLogger.debug('Query executed', { duration: '23ms' })
```

### Secret Injection (Dynamic)

```typescript
import { injectKeyValues } from '@tdsk/logger'

// Inject secrets from API response
const apiResponse = {
  access_token: 'abc123',
  refresh_token: 'xyz789',
}
injectKeyValues(apiResponse)

// Now these values are redacted from ALL logs (stderr)
// and from JSON.stringify with safeReplacer
```

## Key Patterns

### 1. Singleton Pattern
Both logger systems maintain singleton instances to ensure consistent configuration across the application.

### 2. Factory Pattern
`buildLogger()` acts as a factory for creating Winston instances with default configuration. `buildApiLogger()` wraps Winston loggers with structured message formatting.

### 3. Decorator Pattern
`logData()` wraps console methods with color decorators and tag injection.

### 4. Middleware Pattern
Express middleware functions wrap routes to log requests/errors automatically.

### 5. Strategy Pattern
Log level strategies determine which messages are logged based on priority.

### 6. Observer Pattern
`stdio.ts` hijacks process streams to observe and sanitize all output globally.

### 7. Proxy Pattern
`ApiLogger` proxies Winston methods with auto-initialization and formatting via `loggerWrap()`.

## Dependencies

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `winston` | 3.17.0 | Core logging framework |
| `express-winston` | 4.2.0 | Express middleware for Winston |
| `@keg-hub/jsutils` | 10.0.0 | Utility helpers (isObj, isStr, exists, etc.) |
| `@keg-hub/parse-config` | 2.2.0 | Environment config parsing |

### DevDependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `tsup` | 8.3.6 | Build tool (esbuild wrapper) |
| `vitest` | 1.6.1 | Testing framework |
| `typescript` | 5.7.3 | TypeScript compiler |
| `@types/node` | 22.12.0 | Node.js types |
| `alias-hq` | 6.2.4 | Path alias resolution |
| `module-alias` | 2.2.3 | Module alias registration |
| `vite-tsconfig-paths` | 4.3.2 | Vite tsconfig path resolution |

## Commands

```bash
# Build
pnpm build                 # Compile with tsup -> dist/log/

# Testing
pnpm test                  # Run vitest tests

# Type check
pnpm types                 # Run tsc --noEmit --pretty

# Clean
pnpm clean                 # Remove node_modules
```

### Commands Notes

* Linting and formatting run automatically, so `pnpm lint` and `pnpm format` commands should be ignored.

## Integration Points

### Consumed By

**Backend Repo** (`repos/backend/`)
- Uses `ApiLogger` for structured API logging
- Uses `setupLoggerReq()` and `setupLoggerErr()` middleware
- Configured via `app.locals.config.logger`

**Proxy Repo** (`repos/proxy/`)
- Uses `ApiLogger` for gateway request logging
- Uses middleware for auth/proxy logging
- Logs secret injection when handling API keys

**CLI Repo** (`repos/cli/`)
- Uses `Logger` class for terminal output
- Colored console messages for user feedback

### Export Surface

```typescript
// Main exports (src/index.ts) - uses `export *` from each module
// From ./logger:
export { Log, Logger } from './logger'

// From ./apiLogger:
export { setupLogger, buildApiLogger, ApiLogger } from './apiLogger'

// From ./middleware:
export { setupLoggerReq, setupLoggerErr } from './middleware'

// From ./utils/buildLogger:
export { buildLogger } from './utils/buildLogger'

// From ./utils/levels:
export { npmLevels, levelMap, compare, levels, getLevelMethods } from './utils/levels'

// From ./utils/colors:
export { colors } from './utils/colors'

// From ./utils/stripColors:
export { loggerColorDisabled, stripColors } from './utils/stripColors'

// From ./utils/safeReplacer:
export { resetInjectedLogs, injectUnsafe, safeReplacer, replaceUnsafe } from './utils/safeReplacer'

// From ./utils/injectKeyValues:
export { injectKeyValues } from './utils/injectKeyValues'
```

### Build Output

- **Entry**: `src/index.ts`
- **Output**: `dist/log/index.cjs` (CommonJS only)
- **External**: All dependencies (runtime + dev) externalized via esbuild
- **Sourcemaps**: Yes (`dist/log/index.cjs.map`)
- **Root Entry Points**: `index.js` (CJS, `require('./dist/log')`) and `index.mjs` (ESM, `export * from './dist/log'`)

## Testing Strategy

Tests in `src/logger.test.ts`:
- Logger instance creation (verifies `Logger` is instance of `Log`)

Run with: `pnpm test` (Vitest)

## Security Considerations

**Secrets Redacted**:
- Passwords (`password`, `passwd`, `pw`, `pass`)
- API Keys (`api_key`, `api-key`, `apikey`)
- Tokens (`token`, `bearer`, `authorization`)
- Secrets (`secret`)
- Sessions (`session_id`, `connect.sid`)
- Credit Cards (4x4 digit pattern)
- Custom injected secrets (via `injectUnsafe()`)

**Bypass for Debugging**:
```bash
STL_FORCE_DISABLE_SAFE=true npm start  # Disables redaction on stderr only
```

---

**Key Takeaway**: This repo provides secure, structured logging for the entire Threaded Stack platform with automatic secret redaction and consistent formatting across CLI and API contexts.
