---
name: "tdsk-cli"
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
│   ├── tasks/            # Command definitions (hierarchical structure)
│   │   ├── index.ts      # Task registry
│   │   ├── docker/       # Docker commands
│   │   ├── kube/         # Kubernetes commands
│   │   │   └── secret/   # Preset secret commands
│   │   ├── devspace/     # DevSpace commands
│   │   └── web/          # Web UI commands
│   └── utils/            # Utility functions
│       ├── config/       # Config utilities (getCtx)
│       ├── devspace/     # DevSpace helpers
│       ├── docker/       # Docker helpers
│       ├── kube/         # Kubernetes utilities (kubectl wrapper)
│       ├── pnpm/         # PNPM command execution
│       ├── proc/         # Process management (spawn, exec)
│       ├── tasks/        # Task utilities (find, error, options)
│       └── helpers/      # General helpers
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
docker (group)                  aliases: doc, dc
  ├── build, run, exec, pull, push, login

kube (group)                    aliases: kubectl, kb, kcl
  ├── secret (group)
  │   ├── tdsk, docker, database, payments, email
  ├── pod, namespace, ingress, set, remove

devspace (group)                aliases: dev, ds
  ├── start, clean, log, enter, render, attach, use

web (group)                     aliases: ui
  └── start
```

## Available Commands

### Web UI Management (`web`)

**`web start`** - Start the admin UI in dev mode
```bash
pnpm tdsk web start                    # Start admin UI (default)
pnpm tdsk ui start                     # Via 'ui' alias
```
- Options: `--context` (default: `admin`)
- Runs: `pnpm start` in `repos/admin/` directory

### Docker Commands (`docker`)

**`docker build`** - Build Docker image
```bash
pnpm tdsk docker build --context proxy --tag v1.2.3
```
- Options: `--context`, `--tag`, `--image`, `--from`, `--push`

**`docker run`** - Run Docker container
- Options: `--context`, `--port`, `--detach`, `--env-file`

**`docker exec`** - Execute command in running container
```bash
pnpm tdsk docker exec --context proxy --cmd "/bin/sh"
```

**`docker pull`** / **`docker push`** - Pull/push Docker images
```bash
pnpm tdsk docker pull --context proxy
pnpm tdsk docker push --context proxy --tag v1.0.0
```

**`docker login`** - Authenticate with Docker registry

### Kubernetes Commands (`kube`)

**`kube secret`** - Manage Kubernetes secrets
```bash
# From key-value
pnpm tdsk kube secret --name my-secret --keyvalue key1:value1

# From file
pnpm tdsk kube secret --name db-creds --file ./secrets/database.json

# Multiple secrets
pnpm tdsk kube secret --name app-config --secrets API_KEY:xxx,DB_URL:yyy

# Preset configurations
pnpm tdsk kube secret docker --env prod --namespace production
pnpm tdsk kube secret database
pnpm tdsk kube secret tdsk
pnpm tdsk kube secret payments
pnpm tdsk kube secret email
```
- Options: `--name`, `--key`, `--value`, `--file`, `--files`, `--secrets`, `--keyvalue`, `--namespace`, `--literal`, `--type`, `--context`, `--log`
- Creates temporary files for secret values, then cleans up

**`kube pod`** - Describe a Kubernetes pod by context or name
```bash
pnpm tdsk kube pod --context proxy
pnpm tdsk kube pod --name my-pod-abc123 --output json
```
- Aliases: `pods`, `po`, `describe`
- Options: `--context` (searches pod labels), `--name` (direct pod name), `--namespace`, `--output` (json/yaml/wide), `--log`
- Uses `kubectl.getPod()` to resolve pod from context label, then calls `kubectl.describePod()`

**`kube namespace`** - Manage namespaces

**`kube ingress`** - Configure ingress resources

**`kube set`** / **`kube remove`** - Apply/delete Kubernetes configurations

### DevSpace Commands (`devspace`)

**`devspace start`** - Start DevSpace development environment
```bash
pnpm tdsk devspace start --build --debug
pnpm tdsk dev start --clean
```
- Options: `--build`, `--debug`, `--purge`, `--deploy`

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
```

## Command Summary Table

| Task Group | Commands | Aliases | Key Options |
|---|---|---|---|
| **web** | start | ui | --context (default: admin) |
| **kube** | set, pod, secret, remove, ingress, namespace | kubectl, kb, kcl | --context, --output, --name, --namespace |
| **docker** | build, run, exec, pull, push, login | doc, dc | --context, --tag, --image, --port |
| **devspace** | start, clean, log, enter, render, attach, use | dev, ds | --build, --debug, --follow, --selector |

## Context Resolution

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

### Configuration Contexts

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

### Environment Filtering

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

## Process Management

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

### Temporary File Management

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

## Integration Points

### Workspace Dependencies
- **`@tdsk/domain`** - `loadEnvs()` for environment configuration from `deploy/values.*.yml`
- **`@tdsk/logger`** - `Logger.info()`, `Logger.pair()`, `Logger.stdout()`, `Logger.stderr()`, `Logger.colors`

### External Tools Integration
- **Docker**: Wraps `docker` CLI for image building, pushing, pulling, and container management
- **Kubernetes**: Wraps `kubectl` CLI for cluster operations
- **DevSpace**: Wraps `devspace` CLI for development workflows
- **PNPM**: Executes workspace commands via `pnpm.run()`

### Environment Management
- **NODE_ENV**: Set via `--env` option (default: `local`)
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

## Using the CLI

```bash
# Via PNPM workspace (from monorepo root)
pnpm tdsk <command> <subcommand> <options>

# Direct execution (from cli directory)
node dist/index.js <command>

# Dev mode (from cli directory)
pnpm cli <command>
```

## Test Coverage

The CLI repo currently has minimal test coverage:
- **1 test file**: `src/utils/config/getCtx.test.ts`
- **1 placeholder test**: `expect(true).toBe(true)`

This is a known gap. The CLI relies heavily on integration testing via manual command execution rather than unit tests.

## Error Handling

1. **Task Not Found**: `taskError()` throws when command doesn't exist
2. **Missing Options**: Validation for required options
3. **Process Failures**: Spawn wrapper captures exit codes and stderr
4. **Config Errors**: Try-catch around config loading
5. **Cleanup**: Temporary files removed even on error (Kubernetes secrets)
6. **Context Validation**: `getCtx()` verifies context exists in config and directory exists on disk
