---
name: "Threaded Stack - CLI Repo"
description: "Knowledge base for the developer CLI repo - DevOps orchestration for Docker, Kubernetes, and DevSpace"
tags: ["cli", "nodejs", "devops", "kubernetes", "docker", "devspace"]
---
# CLI Repo Skill

## Overview

The CLI repo (`@tdsk/cli`) is a comprehensive developer CLI tool for managing the Threaded Stack monorepo. It provides unified commands for:
- **Docker operations**: Building, pulling, pushing, running, and executing containerized applications
- **Kubernetes management**: Secrets, namespaces, ingress configuration, pod inspection
- **DevSpace orchestration**: Development environment management
- **Web UI management**: Starting and managing the admin UI

The CLI uses a hierarchical task system built on `@keg-hub/args-parse` with support for nested commands, aliases, and options.

## Directory Structure

```
repos/cli/
├── configs/               # Build and tool configurations
│   ├── cli.config.ts     # Main CLI configuration with paths and contexts
│   ├── aliases.ts        # Path aliases (@TSCL/*)
│   ├── biome.json        # Linting and formatting config
│   ├── tsup.config.ts    # Build configuration
│   └── vitest.config.ts  # Test configuration
├── scripts/              # Helper scripts
│   ├── loadEnvs.ts       # Environment loading utilities
│   └── addToProcess.ts   # Process environment helpers
├── src/
│   ├── index.ts          # Entry point (exports cli.ts)
│   ├── cli.ts            # Main CLI runner with argsParse integration
│   ├── constants/        # Constants and filters (EnvFilter)
│   ├── types/            # TypeScript definitions
│   │   ├── tasks.types.ts      # Task system types
│   │   ├── config.types.ts     # Configuration types (ECtxMap enum)
│   │   ├── kube.types.ts       # Kubernetes types
│   │   ├── tdsk.types.ts       # Project-specific types (ETSApps enum)
│   │   ├── helpers.types.ts    # Utility types (TValueOf)
│   │   └── process.types.ts    # Process option types (TProcOpts)
│   ├── tasks/            # Command definitions (hierarchical structure)
│   │   ├── index.ts      # Task registry
│   │   ├── docker/       # Docker commands: build, run, exec, pull, push, login
│   │   ├── kube/         # Kubernetes commands: secret, namespace, ingress, set, remove, pod
│   │   │   └── secret/   # Preset secret commands: tdsk, docker, database, payments, email
│   │   ├── devspace/     # DevSpace commands: start, enter, attach, log, clean, use, render
│   │   └── web/          # Web UI commands: start
│   └── utils/            # Utility functions
│       ├── config/       # Config utilities (getCtx)
│       ├── devspace/     # DevSpace helpers (devspace runner, defaults, selector, use, clean, purge, start)
│       ├── docker/       # Docker helpers (build, run, exec, pull, push, login, auth, helpers)
│       ├── kube/         # Kubernetes utilities (kubectl wrapper, getKubeMeta)
│       ├── pnpm/         # PNPM command execution
│       ├── proc/         # Process management (spawn, exec)
│       ├── tasks/        # Task utilities (find, error, options)
│       └── helpers/      # General helpers (resolveLocalPath)
└── dist/                 # Built output
```

## Key Files

| File | Purpose |
|------|---------|
| `src/cli.ts` | Main CLI entry point - parses args, loads config, executes tasks |
| `src/tasks/index.ts` | Task registry that exports all command groups |
| `configs/cli.config.ts` | Configuration with paths, five contexts (app, proxy, backend, admin, caddy), and environment variables |
| `src/types/tasks.types.ts` | Core type definitions for task system (TTask, TTasks, TTaskAction) |
| `src/types/config.types.ts` | Configuration types and ECtxMap enum (context name aliases) |
| `src/utils/tasks/find.ts` | Task resolution algorithm for nested commands and aliases |
| `src/utils/proc/spawn.ts` | Child process spawning utility with enhanced error handling |
| `src/utils/config/getCtx.ts` | Context resolver using ECtxMap for context name aliasing |
| `src/utils/kube/kubectl.ts` | Kubectl wrapper with methods: create, delete, apply, describe, getPod, getPods, ensureContext, etc. |

## Architecture

### CLI Execution Flow

1. **Entry Point** (`src/cli.ts`):
   ```typescript
   process.argv → find(tasks, args) → argsParse() → loadCfg(env) → task.action()
   ```

2. **Task Resolution**:
   - Parse command-line arguments: `['docker', 'build', '--context', 'proxy']`
   - Find task by name or alias: `docker` → `docker.ts`
   - Traverse nested tasks: `build` → `docker/build.ts`
   - Parse remaining args as options: `['--context', 'proxy']`

3. **Configuration Loading**:
   - Environment determined by `--env` option (default: `local`)
   - Loads `cli.config.ts` which imports `@tdsk/domain/loadEnvs`
   - Provides `config.contexts` with repo metadata (paths, images, tags)

4. **Action Execution**:
   - Task action receives: `{ task, tasks, params, config, options }`
   - Executes via utility functions: `spawn()`, `kubectl()`, `devspace()`, etc.

### Task System Structure

**Task Definition** (`TTask`):
```typescript
{
  name: string              // Primary command name
  alias?: string[]          // Alternative names
  action?: TTaskAction      // Execution function
  tasks?: TTasks            // Nested sub-commands
  options?: TTaskOptions    // Command-line options
}
```

**Task Hierarchy** (3 levels deep):
```
docker (group)
  ├── build (command)
  ├── run (command)
  ├── exec (command)
  ├── pull (command)
  ├── push (command)
  └── login (command)

kube (group)
  ├── secret (group)
  │   ├── tdsk (command)
  │   ├── docker (command)
  │   ├── database (command)
  │   ├── payments (command)
  │   └── email (command)
  ├── pod (command)
  ├── namespace (command)
  ├── ingress (command)
  ├── set (command)
  └── remove (command)

devspace (group)
  ├── start (command)
  ├── clean (command)
  ├── log (command)
  ├── enter (command)
  ├── render (command)
  ├── attach (command)
  └── use (command)

web (group)
  └── start (command)
```

## Available Commands

### Web UI Management (`web`)

**`web start`** - Start the admin UI in dev mode
```bash
pnpm tdsk web start                    # Start admin UI (default)
pnpm tdsk web start --context admin    # Explicit context
pnpm tdsk ui start                     # Via 'ui' alias
```
- Aliases: `ui`
- Sub-commands: `start` (runs `pnpm start` for admin UI)
- Options: `--context` (default: `admin`)
- Runs: `pnpm start` in `repos/admin/` directory

### Docker Commands (`docker`)

**`docker build`** - Build Docker image
```bash
pnpm tdsk docker build --context proxy --tag v1.2.3
```
- Aliases: `doc`, `dc`
- Options: `--context`, `--tag`, `--image`, `--from`, `--push`
- Executes: `docker build` with configured Dockerfile

**`docker run`** - Run Docker container
```bash
pnpm tdsk docker run --context backend --port 3000:3000
```
- Options: `--context`, `--port`, `--detach`, `--env-file`

**`docker exec`** - Execute command in running container
```bash
pnpm tdsk docker exec --context proxy --cmd "/bin/sh"
```

**`docker pull`** - Pull Docker image from registry
```bash
pnpm tdsk docker pull --context proxy
```

**`docker push`** - Push Docker image to registry
```bash
pnpm tdsk docker push --context proxy --tag v1.0.0
```

**`docker login`** - Authenticate with Docker registry
```bash
pnpm tdsk docker login --registry ghcr.io
```

### Kubernetes Commands (`kube`)

**`kube secret`** - Manage Kubernetes secrets
```bash
# From value
pnpm tdsk kube secret --name my-secret --keyvalue key1:value1

# From file
pnpm tdsk kube secret --name db-creds --file ./secrets/database.json

# Multiple secrets
pnpm tdsk kube secret --name app-config --secrets API_KEY:xxx,DB_URL:yyy

# Docker registry secret (for pulling private images)
pnpm tdsk kube secret docker --env prod --namespace production
```
- Aliases: `kubectl`, `kb`, `kcl`
- Sub-commands: `docker`, `tdsk`, `database`, `payments`, `email` (preset configurations)
- Options: `--name`, `--key`, `--value`, `--file`, `--files`, `--secrets`, `--keyvalue`, `--namespace`, `--literal`, `--type`, `--context`, `--log`
- Creates temporary files for secret values, then cleans up

**`kube pod`** - Describe a Kubernetes pod by context or name
```bash
pnpm tdsk kube pod --context proxy
pnpm tdsk kube pod --name my-pod-abc123 --output json
pnpm tdsk kube pod --context backend --namespace my-namespace
```
- Aliases: `pods`, `po`, `describe`
- Options: `--context` (searches pod labels), `--name` (direct pod name), `--namespace`, `--output` (json/yaml/wide), `--log`
- Uses `kubectl.getPod()` to resolve pod from context label, then calls `kubectl.describePod()`

**`kube namespace`** - Manage namespaces
```bash
pnpm tdsk kube namespace --name dev-environment
```

**`kube ingress`** - Configure ingress resources

**`kube set`** - Apply Kubernetes configurations

**`kube remove`** - Delete Kubernetes resources

### DevSpace Commands (`devspace`)

**`devspace start`** - Start DevSpace development environment
```bash
pnpm tdsk devspace start --build --debug
```
- Aliases: `dev`, `ds`
- Options: `--build`, `--debug`, `--purge`, `--deploy`
- Executes: `devspace dev` with custom arguments

**`devspace enter`** - Enter running container shell
```bash
pnpm tdsk devspace enter --selector name=proxy
```

**`devspace attach`** - Attach to container process

**`devspace log`** - Stream container logs
```bash
pnpm tdsk devspace log --follow --selector name=api
```

**`devspace clean`** - Clean DevSpace cache and artifacts

**`devspace use`** - Configure DevSpace context and namespace
```bash
pnpm tdsk devspace use --namespace dev --context minikube
```

**`devspace render`** - Render DevSpace manifests without deploying
```bash
pnpm tdsk devspace render          # Dry-run Helm templates
pnpm tdsk dev render               # Via 'dev' alias
```

## Command Summary Table

| Task Group | Commands | Aliases | Key Options |
|---|---|---|---|
| **web** | start | ui | --context (default: admin) |
| **kube** | set, pod, secret, remove, ingress, namespace | kubectl, kb, kcl | --context, --output, --name, --namespace |
| **docker** | build, run, exec, pull, push, login | doc, dc | --context, --tag, --image, --port |
| **devspace** | start, clean, log, enter, render, attach, use | dev, ds | --build, --debug, --follow, --selector |

## Logic Flow

### 1. Command Parsing Flow

```
User Input: pnpm tdsk docker build --context proxy --tag v1.0

Step 1: src/cli.ts extracts args
  → args = ['docker', 'build', '--context', 'proxy', '--tag', 'v1.0']

Step 2: find(tasks, args)
  → Finds 'docker' task in registry
  → Navigates to 'docker.build' sub-task
  → Returns { task: build, options: ['--context', 'proxy', '--tag', 'v1.0'] }

Step 3: argsParse(options, task.options)
  → Parses options against task definition
  → Returns params = { context: 'proxy', tag: 'v1.0', env: 'local' }

Step 4: loadCfg(params.env)
  → Loads config for 'local' environment
  → Returns config with contexts, paths, envs

Step 5: task.action({ task, tasks, params, config, options })
  → Executes docker build logic
  → Uses getCtx() to resolve proxy context
  → Calls docker.build() utility
```

### 2. Context Resolution Flow

```typescript
// User specifies: --context proxy
getCtx({ params: { context: 'proxy' }, config })
  → ECtxMap['proxy'] → 'proxy'
  → config.contexts['proxy']
  → Returns:
    {
      image: TDSK_PX_IMAGE,
      tag: TDSK_PX_IMAGE_TAG,
      from: TDSK_PX_IMAGE_FROM,
      dtag: TDSK_PX_DEV_IMAGE_TAG,
      deployment: TDSK_PX_DEPLOYMENT,
      dockerfile: 'Dockerfile.proxy',
      location: '/path/to/repos/proxy',
      tags: [],
      mounts: {},
      ports: { [TDSK_PX_PORT]: TDSK_PX_PORT }
    }

// Context aliases via ECtxMap:
//   be → backend, px → proxy, ad → admin, cd → caddy
```

### 3. Process Spawning Flow

```typescript
// Spawning a child process
spawn({
  cmd: 'docker',
  args: ['build', '-t', 'proxy:latest', '.'],
  cwd: '/path/to/repos/proxy',
  log: true,
  output: true
})
  → Creates child process with stdout/stderr capture
  → Logs command execution
  → Handles cleanup on process exit
  → Returns promise with exit code
```

## Key Patterns

### 1. Hierarchical Task Definition

Tasks support nested structures with inheritance:
```typescript
export const kube: TTask = {
  name: 'kube',
  alias: ['kubectl', 'kb', 'kcl'],
  tasks: {
    secret: { /* sub-task with its own action and nested tasks */ },
    pod: { /* sub-task */ },
    namespace: { /* another sub-task */ }
  }
}
```

### 2. Alias Support

Commands can have multiple aliases for convenience:
```typescript
alias: ['doc', 'dc']  // 'docker' can be invoked as 'doc' or 'dc'
```

### 3. Option Parsing

Robust option system with type coercion:
```typescript
options: {
  context: {
    required: true,
    alias: ['ctx', 'name'],
    example: '--context proxy',
    description: 'Context or name of the repo'
  },
  port: {
    type: 'number',
    default: 3000
  },
  detach: {
    type: 'boolean',
    default: false
  }
}
```

### 4. Configuration Contexts

Five contexts for repos/services (app, proxy, backend, admin, caddy):
```typescript
config.contexts = {
  app: {
    image: TDSK_IMAGE,
    tag: TDSK_IMAGE_TAG,
    from: TDSK_IMAGE_FROM,
    dtag: TDSK_DEV_IMAGE_TAG,
    deployment: TDSK_APP_DEPLOYMENT,
    dockerfile: 'Dockerfile.app',
    location: root,
    tags: [],
    mounts: { [root]: '/tdsk' },
    ports: { ... }
  },
  proxy: { ... },
  backend: { ... },
  admin: { ... },
  caddy: { ... }
}
```

Context aliases are defined in `ECtxMap` enum:
```typescript
enum ECtxMap {
  backend = 'backend', be = 'backend',
  caddy = 'caddy', cd = 'caddy',
  admin = 'admin', ad = 'admin',
  proxy = 'proxy', px = 'proxy',
}
```

### 5. Environment Filtering

EnvFilter controls which environment variables are passed to child processes:
```typescript
EnvFilter = {
  starts: ['npm_', 'HOME', 'KEG_', 'FIREBASE', 'FIRE_BASE', 'GOOGLE', 'AZURE', 'AWS'],
  ends: ['_PATH', '_PORT'],
  contains: [],
  exclude: [],
  add: [],
}
```

### 6. Process Management

Enhanced spawn wrapper with lifecycle hooks:
```typescript
await spawn({
  cmd: 'kubectl',
  args: ['create', 'secret', 'generic', 'my-secret'],
  log: true,           // Log command execution
  output: true,        // Capture stdout/stderr
  detached: false,     // Keep process attached
  envs: { FOO: 'bar' }, // Additional env vars
  stdio: 'inherit',   // stdio mode (inherit, pipe, ignore)
  close: (code) => {}, // Close callback
  exit: (code, pid) => {}, // Exit callback
  error: (err) => {},  // Error handler
  stdout: (data) => {}, // stdout data handler
  stderr: (data) => {}, // stderr data handler
})
```

### 7. Temporary File Management

For Kubernetes secrets, temporary files are created and cleaned up:
```typescript
const saveTempSecret = (value: string) => {
  const tempFileLoc = path.join(os.tmpdir(), `${uuid()}.txt`)
  writeFileSync(tempFileLoc, value)
  return tempFileLoc
}
// ... use in kubectl command
// ... cleanup: rmSync(tempFileLoc)
```

## Dependencies

### Core Dependencies
- **`@keg-hub/args-parse`** (10.0.1) - Command-line argument parsing
- **`@keg-hub/jsutils`** (10.0.0) - JavaScript utility functions (isObj, isArr, uuid, emptyArr, emptyObj, parseJSON)
- **`@keg-hub/parse-config`** (2.2.0) - Configuration file parsing
- **`alias-hq`** (6.2.4) - Path alias management for imports
- **`tsup`** (8.3.0) - TypeScript bundler (build tool)
- **`tsx`** (4.21.0) - TypeScript execution for dev mode (`pnpm cli`)

### Workspace Dependencies
- **`@tdsk/domain`** (workspace) - Shared domain types and utilities (loadEnvs)
- **`@tdsk/logger`** (workspace) - Winston-based logging service

### Dev Dependencies
- **`typescript`** (5.7.3)
- **`vitest`** (1.6.1) - Testing framework
- **`@types/node`** (22.12.0)
- **`module-alias`** (2.2.3) - Module alias resolution
- **`vite-tsconfig-paths`** (4.3.2) - Vite plugin for tsconfig paths

## Available NPM/PNPM Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build CLI with tsup (outputs to `dist/`) |
| `pnpm start` | Build in watch mode and run on changes |
| `pnpm cli` | Run CLI directly with tsx (dev mode) |
| `pnpm test` | Run vitest tests |
| `pnpm types` | Type-check with tsc --noEmit |
| `pnpm clean` | Remove node_modules |

### Using the CLI

```bash
# Via PNPM workspace (from monorepo root)
pnpm tdsk <command> <subcommand> <options>

# Direct execution (from cli directory)
node dist/index.js <command>

# Dev mode (from cli directory)
pnpm cli <command>
```

## Integration Points

### 1. Domain Repo (`@tdsk/domain`)
- **Import**: `loadEnvs()` function for environment configuration
- **Usage**: Loads environment variables from `deploy/values.*.yml`

### 2. Logger Repo (`@tdsk/logger`)
- **Import**: `Logger` service for structured logging
- **Usage**: `Logger.info()`, `Logger.pair()`, `Logger.stdout()`, `Logger.stderr()`, `Logger.colors`

### 3. Monorepo Structure
- **Paths**: References root-level `deploy/` and `repos/` directories
- **Contexts**: Manages five contexts: app, proxy, backend, admin, caddy
- **Configuration**: Shares environment variables via `@tdsk/domain`

### 4. Build System
- **Path Aliases**: Uses `alias-hq` for `@TSCL/*` imports
- **Configs**: All configs in `configs/` directory (biome, tsup, vitest)
- **Linting**: Biome configuration shared across monorepo

### 5. External Tools Integration
- **Docker**: Wraps `docker` CLI for image building, pushing, pulling, and container management
- **Kubernetes**: Wraps `kubectl` CLI for cluster operations
- **DevSpace**: Wraps `devspace` CLI for development workflows
- **PNPM**: Executes workspace commands via `pnpm.run()`

### 6. Environment Management
- **NODE_ENV**: Set via `--env` option (default: `local`)
- **Deploy Configs**: Reads from `deploy/values.{env}.yml`
- **Image Tags**: Environment-specific tags (TDSK_PX_IMAGE_TAG, TDSK_BE_IMAGE_TAG, TDSK_AD_IMAGE_TAG, TDSK_CADDY_IMAGE_TAG)

## Type System

### Core Task Types

**TTask** - Task definition
```typescript
{
  name: string           // Command name
  alias?: string[]       // Alternative names
  action?: TTaskAction   // Execution function
  tasks?: TTasks         // Nested commands
  options?: TTaskOptions // CLI options
}
```

**TTaskAction** - Task execution function
```typescript
<P extends TTaskPMap>(args: TTaskActionArgs<P>) => any
```

**TTaskActionArgs** - Arguments passed to action
```typescript
{
  params: TTaskParams    // Parsed CLI options
  task: TTask            // Current task definition
  tasks: TTasks          // All tasks (for delegation)
  config: TCliCfg        // Loaded configuration
  options?: string[]     // Unparsed option strings
}
```

**TTaskOptions** - Option definitions
```typescript
Record<string, {
  alias?: string[]       // Alternative option names
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object'
  default?: any          // Default value
  required?: boolean     // Is option required
  example?: string       // Usage example
  description?: string   // Help text
  env?: string           // Environment variable binding
  allowed?: string[]     // Allowed values
}>
```

## Common Workflows

### Building Docker Images
```bash
# Build proxy image with custom tag
pnpm tdsk docker build --context proxy --tag v2.0.0

# Build and push to registry
pnpm tdsk docker build --context backend --tag v2.0.0 --push
```

### Managing Kubernetes Secrets
```bash
# Create database secret from file
pnpm tdsk kube secret database --env prod --namespace production

# Create Docker registry secret for pulling private images
pnpm tdsk kube secret docker --env staging

# Create custom secret
pnpm tdsk kube secret --name app-config --secrets API_KEY:xxx,DB_URL:yyy
```

### Starting Development Environment
```bash
# Start admin UI locally
pnpm tdsk web start
pnpm tdsk ui start  # Via alias

# Start DevSpace environment (K8s services)
pnpm tdsk devspace start --build --debug
pnpm tdsk dev start --clean  # Via alias with clean option
```

### DevSpace Operations
```bash
# Start dev environment with fresh build
pnpm tdsk devspace start --build --purge

# Stream logs
pnpm tdsk devspace log --follow --selector name=proxy

# Enter container shell
pnpm tdsk devspace enter --selector app=backend

# Clean all artifacts
pnpm tdsk devspace clean --all
```

### Commands Notes

* Linting and formatting are automatic, so `pnpm lint` and `pnpm format` commands should be ignored.

## Test Coverage

The CLI repo currently has minimal test coverage:
- **1 test file**: `src/utils/config/getCtx.test.ts`
- **1 placeholder test**: `expect(true).toBe(true)`
- **Coverage**: ~0%

This is a known gap. The CLI relies heavily on integration testing via manual command execution rather than unit tests.

## Error Handling

The CLI implements comprehensive error handling:

1. **Task Not Found**: `taskError()` throws when command doesn't exist
2. **Missing Options**: Validation for required options
3. **Process Failures**: Spawn wrapper captures exit codes and stderr
4. **Config Errors**: Try-catch around config loading
5. **Cleanup**: Temporary files removed even on error (Kubernetes secrets)
6. **Context Validation**: `getCtx()` verifies context exists in config and directory exists on disk
