---
name: "Threaded Stack - Logger Repo"
description: "Knowledge base for the Winston logging service repo"
version: "1.0.0"
tags: ["winston", "logging", "nodejs", "service", "express-middleware", "security"]
---
# Logger Repo Skill

## Overview

The `@tdsk/logger` package is a Winston-based logging service that provides:
- **CLI Logger**: Terminal/console logging with colored output (`Logger` class)
- **API Logger**: Winston-powered structured logging for backend services (`ApiLogger`, `buildLogger`)
- **Express Middleware**: Request/error logging middleware for Express apps
- **Security**: Automatic redaction of sensitive data (passwords, tokens, API keys, secrets)
- **stdout/stderr Interception**: Global process stream hijacking to sanitize all output

This is a shared utility consumed by `backend` and `proxy` repos for consistent logging across the platform.

## Directory Structure

```
repos/logger/
├── src/
│   ├── index.ts                    # Main entry point (exports all)
│   ├── logger.ts                   # CLI Logger class (colored console output)
│   ├── apiLogger.ts                # API Logger (Winston wrapper)
│   ├── middleware.ts               # Express middleware (request/error logging)
│   ├── stdio.ts                    # Process stdout/stderr interception
│   ├── types/
│   │   ├── logger.types.ts         # TypeScript type definitions
│   │   └── index.ts                # Type exports
│   └── utils/
│       ├── buildLogger.ts          # Winston logger factory
│       ├── colors.ts               # ANSI color helpers
│       ├── levels.ts               # Log level utilities (npm levels)
│       ├── helpers.ts              # Type checking utilities
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
└── index.js                        # CJS entry point
```

## Key Files

### Core Modules

**`src/logger.ts`** - CLI Logger (Log class)
- Terminal/console logging with ANSI colors
- Tag support for message prefixing
- Helper methods: `header()`, `subHeader()`, `pair()`, `table()`, `highlight()`
- Color methods: `red()`, `green()`, `yellow()`, `cyan()`, `error()`, `warn()`, `success()`
- Direct console access via singleton `Logger` instance

**`src/apiLogger.ts`** - API Logger
- Winston wrapper for structured backend logging
- Auto-initialization with default config
- Methods: `info()`, `error()`, `warn()`, `debug()`, `verbose()`, `silly()`
- Structured message formatting with label metadata

**`src/middleware.ts`** - Express Middleware
- `setupLoggerReq()` - Request logging middleware (uses `express-winston.logger`)
- `setupLoggerErr()` - Error logging middleware (uses `express-winston.errorLogger`)
- Filters OPTIONS requests to reduce noise
- Metadata logging enabled at `verbose` level or higher

**`src/stdio.ts`** - Global Stream Interception
- Hijacks `process.stdout.write` and `process.stderr.write`
- Automatically strips colors in test environments
- Applies `replaceUnsafe()` to redact secrets from ALL output
- Bypass via `STL_FORCE_DISABLE_SAFE=true` environment variable

### Utilities

**`src/utils/buildLogger.ts`** - Winston Factory
- Creates Winston logger instances via `buildLogger()` (general use) or `buildApiLogger()` (API services)
- Transports: Console only (configurable)
- Formatters: `simple`, `json`, `prettyPrint` (dev), `timestamp`, `label`
- Filters OPTIONS requests from logs
- Singleton pattern for default logger

**`buildApiLogger()`** - Factory for API-specific loggers:
```typescript
// Creates a pre-configured logger for API services
const logger = buildApiLogger({
  label: 'Backend API',
  level: 'info',
  pretty: true,  // Enable pretty printing in dev
  silent: false,
})
```

**`src/utils/safeReplacer.ts`** - Secret Redaction
- Redacts sensitive data from logs: passwords, tokens, API keys, secrets, credit cards
- Regex patterns for keys (`/token/i`, `/passw(or)?d/i`, `/api[-._]?key/i`)
- Dynamic injection via `injectUnsafe()` for runtime secrets
- Replaces matches with `****`
- Used as JSON.stringify replacer and in stdio interception

**`src/utils/levels.ts`** - Log Level Management
- NPM log levels: `error(0)`, `warn(1)`, `info(2)`, `http(3)`, `verbose(4)`, `debug(5)`, `silly(6)`
- Level comparison utilities
- Dynamic method generation based on current log level

**`src/utils/colors.ts`** - ANSI Color Helpers
- ANSI escape codes for terminal colors
- Basic colors: `red`, `green`, `yellow`, `cyan`, `blue`, `magenta`, `white`, `gray`
- Bright variants: `brightRed`, `brightGreen`, `brightYellow`, etc.
- Decorators: `underline`, `dim`

**`src/utils/injectKeyValues.ts`** - Dynamic Secret Injection
- Extracts keys/values from objects (e.g., API responses with secrets)
- Injects them into `safeReplacer` regex list
- Ensures dynamically loaded secrets are redacted from logs

**`src/utils/stripColors.ts`** - Color Stripping
- Removes ANSI escape codes from strings
- Controlled by `TDSK_TEST_COLORS` environment variable
- Used in stdio interception for clean test output

## Logger Configuration

### Winston Configuration

Built via `buildLogger()` with options:

```typescript
type TLogOpts = {
  silent?: boolean         // Disable all logging (default: false)
  level?: string           // Log level: error|warn|info|http|verbose|debug|silly (default: 'silly')
  label?: string           // Logger label for identification (default: 'TDSK')
  exitOnError?: boolean    // Exit process on error (default: false)
  handleExceptions?: boolean // Handle uncaught exceptions (default: true)
}
```

### Environment Variables

- **`NODE_ENV`**: `production` → minimal logging; `development` → pretty-printed logs
- **`TDSK_TEST_COLORS`**: `0` or `false` → disable colors in logs
- **`STL_FORCE_DISABLE_SAFE`**: `true` → disable secret redaction (dangerous!)

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
  level: 'silly',                    // Log level
  format: getFormatter(label),       // Combined format
  handleExceptions: true,            // Log uncaught exceptions
})
```

**Format Pipeline (Development)**:
1. `filterOptionsReq()` - Remove OPTIONS requests
2. `timestamp()` - Add timestamp
3. `label({ label })` - Add label
4. `simple()` - Simple text format
5. `json()` - JSON structure
6. `prettyPrint({ colorize: true })` - Pretty output

**Format Pipeline (Production)**:
1. `filterOptionsReq()` - Remove OPTIONS requests
2. `splat()` - String interpolation
3. `timestamp()` - Add timestamp
4. `label({ label })` - Add label
5. `json()` - JSON output only

**Future Transports** (not implemented):
- File transport (rotating logs)
- HTTP transport (remote logging)
- Stream transport (log aggregation)

## Architecture

### Two Logger Systems

**1. CLI Logger (`Logger` class)**
- For CLI tools, scripts, and terminal output
- Colored console output with ANSI codes
- Singleton instance exported as `Logger`
- Methods map to console methods with color wrapping

**2. API Logger (`ApiLogger`, `buildLogger`)**
- For backend/proxy API services
- Winston-powered structured logging
- Express middleware integration
- Automatic secret redaction

### Security Architecture

**Multi-Layer Secret Protection**:

1. **JSON Serialization**: `safeReplacer()` used in `JSON.stringify()`
2. **Stream Interception**: `stdio.ts` hijacks stdout/stderr globally
3. **Dynamic Injection**: `injectKeyValues()` adds runtime secrets to redaction list
4. **Regex Patterns**: Pre-defined patterns for common secrets

### Singleton Pattern

Both loggers use singleton pattern:
- `Logger` - Exported CLI logger instance
- `__LOGGER` - Internal Winston instance (via `buildLogger()`)
- `__logger` - Internal API logger (via `setupLogger()`)

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

// Automatic secret redaction
ApiLogger.info('User authenticated', {
  token: 'secret-token-123',  // Logged as ****
  apiKey: 'my-api-key',       // Logged as ****
})
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

// Create custom logger instance
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

// Now these values are redacted from ALL logs
console.log('Token:', apiResponse.access_token)
// Output: Token: ****
```

## Key Patterns

### 1. Singleton Pattern
Both logger systems maintain singleton instances to ensure consistent configuration across the application.

### 2. Factory Pattern
`buildLogger()` acts as a factory for creating Winston instances with default configuration.

### 3. Decorator Pattern
`logData()` wraps console methods with color decorators and tag injection.

### 4. Middleware Pattern
Express middleware functions wrap routes to log requests/errors automatically.

### 5. Strategy Pattern
Log level strategies determine which messages are logged based on priority.

### 6. Observer Pattern
`stdio.ts` hijacks process streams to observe and sanitize all output globally.

### 7. Proxy Pattern
`ApiLogger` proxies Winston methods with auto-initialization and formatting.

## Dependencies

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `winston` | 3.17.0 | Core logging framework |
| `express-winston` | 4.2.0 | Express middleware for Winston |
| `@keg-hub/jsutils` | 10.0.0 | Utility helpers (isObj, exists, etc.) |
| `@keg-hub/parse-config` | 2.2.0 | Environment config parsing |

### DevDependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `tsup` | 8.3.6 | Build tool (esbuild wrapper) |
| `vitest` | ^1.4.0 | Testing framework |
| `@types/node` | 22.12.0 | Node.js types |
| `alias-hq` | 6.2.4 | Path alias resolution |

## Commands

```bash
# Build
pnpm build                 # Compile with tsup → dist/log/

# Testing
pnpm test                  # Run vitest tests

# Clean
pnpm clean                 # Remove node_modules
```

### Commands Notes

* Linting and formatting are automatically, so `pnpm lint` and `pnpm format` commands should be ignored.

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
// Main exports (src/index.ts)
export { Logger, Log } from './logger'              // CLI Logger
export { ApiLogger, setupLogger } from './apiLogger' // API Logger
export { setupLoggerReq, setupLoggerErr } from './middleware' // Middleware
export { buildLogger, buildApiLogger } from './utils/buildLogger' // Factories
export { levels, levelMap } from './utils/levels'   // Levels
export { colors } from './utils/colors'             // Colors
export { stripColors } from './utils/stripColors'   // Utilities
export { safeReplacer, injectUnsafe } from './utils/safeReplacer' // Security
export { injectKeyValues } from './utils/injectKeyValues' // Security
```

### Build Output

- **Entry**: `src/index.ts`
- **Output**: `dist/log/index.js` (CommonJS only)
- **External**: All dependencies externalized (not bundled)
- **Sourcemaps**: Yes
- **Main Entry**: `index.js` (root) redirects to `dist/log/index.js`

## Testing Strategy

Tests in `src/logger.test.ts`:
- Logger instance creation
- Color output verification
- Tag functionality
- Level filtering
- Secret redaction validation
- Winston integration

Run with: `pnpm test` (Vitest)

## Security Considerations

**Secrets Redacted**:
- Passwords (`password`, `passwd`, `pw`, `pass`)
- API Keys (`api_key`, `api-key`, `apikey`)
- Tokens (`token`, `bearer`, `authorization`)
- Sessions (`session_id`, `connect.sid`)
- Credit Cards (4x4 digit pattern)
- Custom injected secrets (via `injectUnsafe()`)

**Bypass for Debugging**:
```bash
STL_FORCE_DISABLE_SAFE=true npm start  # DANGEROUS - disables redaction
```

## Future Enhancements

1. **File Transport**: Rotating log files for persistence
2. **Remote Logging**: HTTP transport to log aggregation service
3. **Log Levels per Module**: Granular level control by namespace
4. **Structured Queries**: JSON log parsing utilities
5. **Custom Formatters**: Plugin system for custom log formats
6. **Performance Metrics**: Built-in latency/throughput tracking
7. **Log Sampling**: Reduce log volume in high-traffic scenarios
8. **Context Propagation**: Request ID tracking across logs

---

**Key Takeaway**: This repo provides secure, structured logging for the entire Threaded Stack platform with automatic secret redaction and consistent formatting across CLI and API contexts.
