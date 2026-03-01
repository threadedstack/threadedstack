---
name: "tdsk-logger"
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
│   │   └── logger.types.ts         # TypeScript type definitions
│   └── utils/
│       ├── buildLogger.ts          # Winston logger factory
│       ├── colors.ts               # ANSI color helpers
│       ├── levels.ts               # Log level utilities (npm levels)
│       ├── helpers.ts              # Re-exports from @keg-hub/jsutils
│       ├── safeReplacer.ts         # Secret redaction logic
│       ├── injectKeyValues.ts      # Dynamic secret injection
│       └── stripColors.ts          # ANSI color stripping
├── configs/
│   ├── tsup.config.ts              # Build configuration
│   ├── biome.json                  # Linting/formatting config
│   └── vitest.config.ts            # Test configuration
└── package.json
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

**`src/utils/injectKeyValues.ts`** - Dynamic Secret Injection
- Extracts keys and values from objects (e.g., API responses with secrets)
- Injects them into `safeReplacer` via `injectUnsafe()`
- Ensures dynamically loaded secrets are redacted from logs

**`src/utils/levels.ts`** - Log Level Management
- `npmLevels` - Winston npm log levels from `config.npm.levels`
- `levelMap` - Maps level names to priority numbers
- `compare(level1, level2)` - Compare two log levels
- `levels` - Structured object with `.check`, `.levels`, `.compare` for level querying
- `getLevelMethods(Logger, logMethod)` - Generate level-gated methods for a CLI logger

**`src/utils/colors.ts`** - ANSI Color Helpers
- Basic colors: `red`, `green`, `yellow`, `cyan`, `blue`, `magenta`, `white`, `gray`
- Bright variants: `brightRed`, `brightGreen`, `brightYellow`, `brightCyan`, `brightBlue`, `brightWhite`, `brightMagenta`
- Decorators: `underline.<color>()`, `dim.<color>()` (nested color+decorator combos)

**`src/utils/stripColors.ts`** - Color Stripping
- `stripColors(str)` - Removes ANSI escape codes from strings when colors are disabled
- `loggerColorDisabled()` - Checks `TDSK_TEST_COLORS` env var (`0` or starts with `f`)

## Logger Configuration

### Winston Configuration

Built via `buildLogger()` with options:

```typescript
// TLogOpts extends winston.LoggerOptions
type TLogOpts = winston.LoggerOptions & {
  label: string              // Logger label for identification (default: 'TDSK')
}

// Defaults: silent: false, level: 'silly', label: 'TDSK', exitOnError: false, handleExceptions: true
```

### Environment Variables

- **`NODE_ENV`**: `production` -> minimal JSON logging; non-production -> pretty-printed logs with colors
- **`TDSK_TEST_COLORS`**: `0` or starts with `f` (e.g., `false`) -> disable colors in logs/strip ANSI codes
- **`STL_FORCE_DISABLE_SAFE`**: `true` -> disable secret redaction on stderr (stdout redaction already disabled)

### Format Pipeline

**Development (non-production)**: `filterOptionsReq()` -> `timestamp()` -> `label()` -> `simple()` -> `json()` -> `prettyPrint({ depth: 10, colorize: true })`

**Production**: `filterOptionsReq()` -> `splat()` -> `timestamp()` -> `label()` -> `json()`

## Architecture

### Two Logger Systems

**1. CLI Logger (`Log` class, `Logger` singleton)**
- For CLI tools, scripts, and terminal output
- Colored console output with ANSI codes
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

## Usage Examples

### CLI Logger

```typescript
import { Logger } from '@tdsk/logger'

Logger.info('Configuration loaded')
Logger.success('Task completed!')
Logger.error('Something went wrong')
Logger.green('Colored message')
Logger.header('Application Started', 'cyan')
Logger.pair('Database:', 'Connected')

// Tags
Logger.setTag('[API]', 'cyan')
Logger.info('Request received')  // Output: [API] Request received
Logger.removeTag()
```

### API Logger (Backend/Proxy)

```typescript
import { ApiLogger, buildApiLogger, setupLogger } from '@tdsk/logger'
import { setupLoggerReq, setupLoggerErr } from '@tdsk/logger'
import { injectKeyValues } from '@tdsk/logger'

// Configure (optional, auto-inits with defaults)
setupLogger({ label: 'Backend API', level: 'info' })

// Structured logging
ApiLogger.info('Server started', { port: 3000 })
ApiLogger.error('Database connection failed', { error: err })

// Note: debug/verbose/silly all map to 'info' internally
ApiLogger.debug('This logs at info level')

// Custom labeled logger: buildApiLogger(label, level, logger?)
const dbLogger = buildApiLogger('Database', 'debug')
dbLogger.info('Connection pool initialized')

// Express middleware
setupLoggerReq(app)    // Request logging (add before routes)
setupLoggerErr(app)    // Error logging (add after routes)

// Dynamic secret injection (values redacted from all stderr output)
injectKeyValues({ access_token: 'abc123', refresh_token: 'xyz789' })
```

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

### Export Surface

```typescript
// Main exports (src/index.ts) - uses `export *` from each module
export { Log, Logger } from './logger'
export { setupLogger, buildApiLogger, ApiLogger } from './apiLogger'
export { setupLoggerReq, setupLoggerErr } from './middleware'
export { buildLogger } from './utils/buildLogger'
export { npmLevels, levelMap, compare, levels, getLevelMethods } from './utils/levels'
export { colors } from './utils/colors'
export { loggerColorDisabled, stripColors } from './utils/stripColors'
export { resetInjectedLogs, injectUnsafe, safeReplacer, replaceUnsafe } from './utils/safeReplacer'
export { injectKeyValues } from './utils/injectKeyValues'
```

### Build Output

- **Entry**: `src/index.ts`
- **Output**: `dist/log/index.cjs` (CommonJS only)
- **External**: All dependencies externalized via esbuild
- **Root Entry Points**: `index.js` (CJS) and `index.mjs` (ESM)

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
