<!--claude --resume 78a07c07-2602-40a0-9b06-85835668cabb-->

# TSA CLI Integration Tests Design

## Problem

Every TSA integration test in `repos/integration/` imports TSA classes directly (`ApiClient`, `AuthManager`, `Executor`) and calls their methods as a library. None of them spawn the actual `tsa` process. This means:

- CLI argument parsing (parseArgs) is never tested end-to-end
- The `main()` → task dispatch flow is never exercised
- Exit codes are never asserted
- Stdout/stderr output format (themed text, tables) is never verified
- Config file side effects (login writing config YAML) are not tested in a real-process context
- The `requireAuth()` gate is never tested from outside
- Interactive commands (chat via pi-mono TUI, ssh, run, sync) are never tested as a user would experience them

## Solution

Build a `CliRunner` test harness that spawns the real `tsa` CLI as a child process, provides stdin/stdout interaction for interactive commands, and asserts on output text and exit codes. Test all CLI commands — both non-interactive (login, logout, status, agents, threads, sandboxes, help) and interactive (chat, ssh, run, sync, proxy).

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CLI invocation | Source default (`bun src/main.ts`), binary via `TSA_TEST_BINARY=1` | Fast dev iteration with source; CI validates the real binary |
| Config isolation | `TSA_CONFIG_DIR` env var in ConfigService | Targeted override, no side effects on other `~`-relative paths |
| Test location | `repos/integration/src/tsa-cli/` (new directory) | Clean separation from existing library-import tests |
| Harness style | `CliRunner` class with `run()` / `start()` modes | Balances clean test code with transparency; handles ANSI, timeouts, cleanup |

## TSA Code Change

One small change to `repos/tsa/src/constants/values.ts`:

```ts
// Before
export const ConfigDir = path.join(os.homedir(), '.config', 'tdsk', 'tsa')

// After
export const ConfigDir = process.env.TSA_CONFIG_DIR
  || path.join(os.homedir(), '.config', 'tdsk', 'tsa')
```

All paths derived from `ConfigDir` (`ConfigPath`, etc.) automatically pick up the override. No other TSA code changes required.

## CliRunner Harness

### Location

`repos/integration/src/tsa-cli/utils/cli-runner.ts`

### Two Modes

**`run(args, opts?)`** — for commands that print output and exit:

```ts
const result = await cli.run(['login', apiKey, '--insecure'])
// Returns: { stdout: string, stderr: string, exitCode: number }
```

- Spawns child process, collects all output, waits for exit
- Timeout (default 30s, configurable) kills the process and fails the test
- ANSI escape codes stripped from stdout/stderr before returning

**`start(args, opts?)`** — for long-running interactive commands:

```ts
const session = await cli.start(['chat', '--org', orgId, '--agent', agentId])
// Returns: CliSession (live handle to running process)
```

### CliSession API

| Method | Purpose |
|--------|---------|
| `waitForOutput(pattern, timeoutMs?)` | Resolves when stdout matches string or regex. Scans buffered output first, then watches incoming. Fails on timeout (default 15s). |
| `write(text)` | Writes to stdin, auto-appends `\n` |
| `writeRaw(text)` | Writes to stdin without newline (for key sequences, arrow keys) |
| `kill(signal?)` | Sends signal (default SIGTERM), SIGKILL after 5s grace period |
| `waitForExit(timeoutMs?)` | Resolves with `{ stdout, stderr, exitCode }` |
| `stdout` / `stderr` | Accumulated ANSI-stripped output up to this point |

### Config Isolation

`CliRunner` constructor creates a temp directory via `mkdtemp()`. Every spawned process gets `TSA_CONFIG_DIR=<tempdir>` in its environment. `dispose()` removes the temp dir and kills any running processes.

```ts
const cli = new CliRunner({
  env: { TDSK_IT_API_KEY: env.testApiKey }  // extra env vars merged in
})
// cli.configDir → /tmp/tsa-test-xxxx
```

### Source vs Binary Switching

```ts
const tsaBin = process.env.TSA_TEST_BINARY
  ? path.resolve('repos/tsa/dist/tsa')
  : null

// In spawn:
if (tsaBin) spawn(tsaBin, args, opts)
else spawn('bun', ['repos/tsa/src/main.ts', ...args], opts)
```

### ANSI Stripping

All output passes through `stripAnsi()` before being stored and matched. Tests assert on plain text (e.g., `"Logged in successfully"`) without worrying about color codes.

## Directory Structure

```
repos/integration/src/tsa-cli/
├── utils/
│   ├── cli-runner.ts          # CliRunner + CliSession classes
│   ├── strip-ansi.ts          # ANSI escape code removal
│   └── helpers.ts             # authenticatedCli(), setupCliWithOrg(), setupCliWithAgent()
├── auth.test.ts               # login, logout, status
├── discovery.test.ts          # agents, threads, sandboxes
├── help.test.ts               # help, --help, -h, --version, -v
├── chat.test.ts               # chat startup, slash commands, agent interaction
├── ssh.test.ts                # ssh into sandbox pod
├── run.test.ts                # run sandbox with runtime command
├── sync.test.ts               # sync start, status, stop, flush
└── proxy.test.ts              # proxy transport (WebSocket bridge)
```

No vitest config changes needed — the existing `src/**/*.test.ts` include pattern covers the new directory.

## Shared Helpers

`repos/integration/src/tsa-cli/utils/helpers.ts` provides:

```ts
// Returns a CliRunner that has already run `tsa login` with the test API key
async function authenticatedCli(opts?): Promise<CliRunner>

// Returns orgId from env + a logged-in CliRunner
async function setupCliWithOrg(): Promise<{ cli: CliRunner, orgId: string }>

// Same but also resolves a test agent ID
async function setupCliWithAgent(): Promise<{ cli: CliRunner, orgId: string, agentId: string }>
```

These exercise the real `tsa login` flow as a test prerequisite — no mocks.

## Test Coverage

### help.test.ts (~5 tests, no K8s)

| Test | Command | Assertions |
|------|---------|------------|
| Shows help text | `tsa help` | exit 0, stdout contains command list |
| `--help` flag | `tsa --help` | exit 0, same as `tsa help` |
| `-h` flag | `tsa -h` | exit 0, same as `tsa help` |
| Shows version | `tsa --version` | exit 0, stdout matches semver pattern |
| `-v` flag | `tsa -v` | exit 0, same as `tsa --version` |

### auth.test.ts (~10 tests, no K8s)

| Test | Command | Assertions |
|------|---------|------------|
| Successful login | `tsa login <key> --insecure` | exit 0, stdout contains "Logged in" |
| Status after login | `tsa status` | exit 0, stdout contains proxy URL + masked key (first 8 chars) |
| Logout | `tsa logout` | exit 0, stdout contains "Logged out" |
| Status after logout | `tsa status` | exit 0, stdout contains "not logged in" |
| Missing API key | `tsa login` | exit 1, output contains "Usage" |
| Invalid key format | `tsa login not-tdsk` | exit 1, output contains error about format |
| Invalid key (valid format) | `tsa login tdsk_fake --insecure` | exit 1, output contains auth error |
| Login twice overwrites | `tsa login <key1>` then `tsa login <key2>` | Status shows key2 |
| Logout when not logged in | `tsa logout` (fresh config) | exit 0, no crash |
| Commands without auth | `tsa agents` (no login) | exit 1, auth error message |

### discovery.test.ts (~10 tests, no K8s)

| Test | Command | Assertions |
|------|---------|------------|
| List agents with `--org` | `tsa agents --org <id>` | exit 0, stdout contains agent names |
| List agents auto-select org | `tsa agents` (single org) | exit 0, auto-selects org, lists agents |
| List threads | `tsa threads <agentId> --org <id>` | exit 0, stdout contains thread data |
| Threads missing agent ID | `tsa threads` | exit 1, "Usage" message |
| Threads invalid agent ID | `tsa threads fake --org <id>` | exit 1, error message |
| List sandboxes | `tsa sandboxes --org <id>` | exit 0, stdout contains sandbox names |
| Sandboxes empty org | `tsa sandboxes --org <empty>` | exit 0, "No sandboxes found" |
| Agents table formatting | `tsa agents --org <id>` | stdout contains ID and name columns |
| Sandboxes table formatting | `tsa sandboxes --org <id>` | stdout contains Name, Image, ID columns |
| Discovery without auth | `tsa threads <id>` (no login) | exit 1, auth error |

### chat.test.ts (~8 tests, K8s + optional LLM)

| Test | Command | Assertions |
|------|---------|------------|
| Chat startup shows prompt | `tsa chat --org <id> --agent <id>` | `waitForOutput('>')` succeeds |
| `/help` shows commands | Type `/help` at prompt | Output contains "Available commands" |
| `/exit` exits cleanly | Type `/exit` | Process exits with code 0 |
| Agent picker appears | `tsa chat --org <id>` (no `--agent`) | Output contains "Select an agent" or similar |
| `/login` and `/logout` work | Slash commands in session | Appropriate success messages |
| Chat without auth | `tsa chat` (no login) | exit 1, auth error |
| Chat with invalid org | `tsa chat --org fake` | Error phase or exit 1 |
| LLM round-trip (skippable) | Send message, wait for response | Response appears in output (skip if no provider key) |

### ssh.test.ts (~5 tests, K8s pods)

| Test | Command | Assertions |
|------|---------|------------|
| SSH opens shell | `tsa ssh <sandbox-id> --org <id>` | Shell prompt appears (60s timeout for pod startup) |
| Run remote command | Type `echo tsa-test` in shell | Output contains "tsa-test" |
| Exit propagates code | Type `exit` | Process exits with code 0 |
| Missing sandbox ID | `tsa ssh` | exit 1, "Usage" message |
| Nonexistent sandbox | `tsa ssh fake --org <id>` | exit 1, error message |

### run.test.ts (~5 tests, K8s pods)

| Test | Command | Assertions |
|------|---------|------------|
| `--list` shows sandboxes | `tsa run --list --org <id>` | exit 0, sandbox names in output |
| Missing sandbox ID | `tsa run` | exit 1, error message |
| No sandbox ID shows list | `tsa run --org <id>` | exit 1, lists sandboxes as hint |
| Launches runtime | `tsa run <id> --org <id> --no-sync` | Output contains "Launching" (60s timeout) |
| `--no-sync` skips sync | `tsa run <id> --no-sync` | No sync-related messages in output |

### sync.test.ts (~6 tests, K8s pods)

| Test | Command | Assertions |
|------|---------|------------|
| Start sync | `tsa sync <id> --org <id> --source <dir>` | Output contains "File sync started" |
| Sync status | `tsa sync status` | Output contains sandbox ID and session info |
| Sync stop | `tsa sync stop <id>` | Output contains "Sync stopped" |
| Sync flush | `tsa sync flush <id>` | Output contains "Flush triggered" |
| Missing source path | `tsa sync <id> --source /nonexistent` | exit 1, error about source path |
| Stop all | `tsa sync stop --all` | Output contains "All sync sessions stopped" |

### proxy.test.ts (~4 tests, K8s pods)

| Test | Command | Assertions |
|------|---------|------------|
| No auth | `tsa proxy <id>` (no login) | exit 1, stderr contains "Not logged in" |
| Missing sandbox ID | `tsa proxy` | exit 1, stderr contains "Usage" |
| Connection to live pod | `tsa proxy <id>` (with running pod) | Receives SSH banner data on stdout |
| Timeout on dead pod | `tsa proxy <stopped-id>` | Exits with error after timeout |

## Resilience Patterns

- **Timeout on every `waitForOutput()`**: Default 15s, 60s for pod startup, 30s for LLM. No test hangs forever.
- **`afterEach` cleanup**: `CliRunner.dispose()` kills running processes and removes temp config dir.
- **`afterAll` cleanup**: `cleanupSandbox()` tears down pods for K8s tests.
- **`CliSession.kill()` grace period**: SIGTERM first, SIGKILL after 5s if still alive.
- **`test.skipIf(!hasLLM())`**: LLM-dependent tests skip when `TDSK_IT_PROVIDER_KEY` is absent.
- **Pod sharing**: K8s test files use `beforeAll` to call `setupRunningPod()` once, share the pod across tests in the file, and `afterAll` to clean up — minimizes pod churn.

## What This Does Not Cover

- **pi-mono TUI rendering pixel-perfection**: Tests assert on text content, not exact layout or cursor positioning.
- **Compiled binary correctness**: The `TSA_TEST_BINARY=1` mode validates binary execution, but most dev runs use source mode.
- **Multi-user concurrency**: Tests run one CLI instance at a time per test (though files run in parallel via vitest forks).
- **Network failure simulation**: Tests run against live services; transient failure testing is out of scope.
