# tsa -- Terminal REPL CLI

## What is tsa

`tsa` is the Threaded Stack terminal REPL for interacting with AI agents from the command line. It provides an interactive chat interface with streaming responses, tool call visualization, and context injection -- all without needing a browser.

Built with Bun and Ink (React for terminals), `tsa` runs agent ReAct loops locally while proxying LLM calls through the backend. API keys never leave the server; the REPL authenticates with a session token and the backend injects provider credentials server-side.

Key capabilities:

- Interactive chat sessions with AI agents
- Real-time streaming responses with markdown rendering
- Tool call visualization (file reads, shell commands, web fetches)
- Context file injection from `AGENTS.md` and `.tdsk/context/`
- Thread management (create, switch, fork/branch, list)
- Two-layer configuration (global + per-project)
- Lifecycle hooks triggered on session, tool, and error events
- Slash command system for in-session control

## Installation

### From source (development)

```bash
cd repos/repl

# Run directly with Bun (requires Bun runtime)
pnpm start

# Bundle to dist/index.js
pnpm build

# Compile to standalone native binary (no Bun required at runtime)
pnpm compile
```

After `pnpm compile`, the binary is at `repos/repl/dist/tsa`. Add it to your PATH or symlink it:

```bash
ln -s "$(pwd)/repos/repl/dist/tsa" /usr/local/bin/tsa
```

### Verify installation

```bash
tsa --version
tsa --help
```

## Authentication

`tsa` authenticates against the Threaded Stack API using API keys (prefixed `tdsk_`). On login, the key is validated by fetching `/_/orgs` through the proxy. Credentials are stored in a YAML config file at `~/.config/tdsk/tsa.yaml` with `0600` permissions.

### Log in

```bash
tsa login <api-key>
```

The API key can be passed as a positional argument or with `--apiKey`:

```bash
tsa login tdsk_abc123def456
tsa login --apiKey tdsk_abc123def456
```

**Options:**

| Flag | Description |
|------|-------------|
| `--url <proxy-url>` | Custom proxy URL (default: `https://px.local.threadedstack.app`) |
| `--insecure` | Skip TLS certificate validation (useful for local dev with self-signed certs) |

Example with a local development proxy:

```bash
tsa login tdsk_abc123def456 --url https://px.local.threadedstack.app --insecure
```

### Check status

```bash
tsa status
```

Displays whether you are logged in, the proxy URL, and a masked version of your API key.

### Log out

```bash
tsa logout
```

Removes stored credentials from `~/.config/tdsk/tsa.yaml`.

### Credential storage

Credentials are stored in the global config file:

```
~/.config/tdsk/tsa.yaml
```

The file is created with `0600` permissions (owner read/write only) inside a directory with `0700` permissions. The stored fields are:

```yaml
auth:
  apiKey: "tdsk_..."
  proxyUrl: "https://px.local.threadedstack.app"
  insecure: false
```

## Key Commands

### CLI commands

These are invoked from your shell as `tsa <command>`.

| Command | Alias | Description | Auth Required |
|---------|-------|-------------|:---:|
| `tsa chat` | `ch` | Start interactive chat session (default command) | Yes |
| `tsa login <key>` | `li` | Authenticate with API key | No |
| `tsa logout` | `lo` | Remove stored credentials | No |
| `tsa status` | `st` | Show authentication status | No |
| `tsa agents` | `ag` | List available agents | Yes |
| `tsa threads <agent-id>` | `th` | List threads for an agent | Yes |
| `tsa help` | `-h`, `--help` | Show available commands | No |
| `tsa --version` | `-v` | Show version | No |

Running `tsa` with no arguments launches the `chat` command (the default).

### Common usage patterns

```bash
# List agents in your org (auto-selects org if you only belong to one)
tsa agents

# List agents for a specific org
tsa agents --org org_abc123

# List threads for an agent
tsa threads agent_xyz789

# Start a chat session
tsa chat

# Start a chat session with a specific agent
tsa chat --agent agent_xyz789

# Resume a specific thread
tsa chat --thread thread_abc123

# Full options
tsa chat --org org_abc123 --agent agent_xyz789 --thread thread_abc123
```

## Interactive Chat

Running `tsa chat` (or just `tsa`) launches the interactive terminal UI. The session goes through several phases:

1. **Login** -- If not authenticated, prompts for an API key. Pre-auth slash commands (`/login`, `/help`, `/exit`) are available.
2. **Loading** -- Connects to the backend and fetches agent data.
3. **Agent Selection** -- If `--agent` was not specified, displays a list of available agents. Auto-selects if only one agent exists.
4. **Chat** -- The main chat interface with a prompt, message history, and streaming responses.

### The chat interface

```
┌─────────────────────────────────────────────────┐
│ Agent: my-agent | Provider: openai | Model: gpt │
│ Thread: thread_abc123 | Status: connected       │
├─────────────────────────────────────────────────┤
│ > What files are in the project?                │
│                                                 │
│   Read file (src/index.ts) .................. OK │
│   Listed directory (src/) ................... OK │
│                                                 │
│   The project contains the following files:     │
│   - src/index.ts                                │
│   - src/utils.ts                                │
│   ...                                           │
├─────────────────────────────────────────────────┤
│ >                                               │
└─────────────────────────────────────────────────┘
```

- Type a message at the `>` prompt and press Enter to send.
- Responses stream in real-time with markdown rendering.
- Tool calls (file reads, shell commands, web fetches) display with a spinner while executing, then show success or error status.
- Use `/verbose` to toggle detailed tool output (shows tool results inline).

### Message flow

1. You type a message at the prompt.
2. `tsa` creates a session with the backend, which resolves the provider API key and returns a session token.
3. A thread is created if one does not exist.
4. Any context files (`AGENTS.md`, `.tdsk/context/*`, manually added) are prepended to the prompt as XML `<context>` blocks.
5. The agent's ReAct loop runs locally, with LLM calls proxied through the backend WebSocket (`/ai/ws`) using the session token. The backend injects the API key server-side.
6. Streaming events update the UI in real-time: text chunks, tool call starts, tool results, and errors.
7. Messages are persisted to the backend via HTTP.

### Slash commands

Inside the chat session, type `/` followed by a command name. These are distinct from the CLI commands and control the active session.

| Command | Aliases | Description |
|---------|---------|-------------|
| `/help` | `/h` | Show available slash commands |
| `/exit` | `/quit`, `/q` | Exit the REPL |
| `/login` | `/li` | Authenticate with an API key |
| `/logout` | `/lo` | Remove credentials |
| `/clear` | `/cl` | Clear screen and start a new thread |
| `/new` | `/n` | Start a new conversation thread |
| `/agent` | `/a` | Switch to a different agent (interactive picker or `/agent <id>`) |
| `/switch` | `/sw` | Switch to a different thread (interactive picker or `/switch <id>`) |
| `/threads` | `/t` | List and select conversation threads |
| `/provider` | `/p` | Switch LLM provider (`/provider <id>`) |
| `/verbose` | `/v` | Toggle verbose output (shows tool results) |
| `/info` | `/i` | Show current session info (org, agent, thread, connection) |
| `/context` | `/ctx` | List loaded context files |
| `/add` | -- | Add a context file (`/add <file-path>`) |
| `/remove` | `/rm` | Remove a context file by index (`/remove <index>`) |
| `/history` | `/hist` | Show conversation history |
| `/fork` | `/br` | Branch current thread at a message (`/fork [messageId]`) |
| `/tree` | -- | Display the thread branch tree |
| `/projects` | `/proj` | Switch project |

**Pre-auth commands** (available before logging in): `/login`, `/help`, `/exit`.

### Thread branching

`tsa` supports branching conversations at any message:

```
/fork              # Branch at the last message
/fork msg_abc123   # Branch at a specific message ID
```

View the branch tree with `/tree`:

```
/tree
```

This displays a visual tree of threads and their branch points.

## Configuration

`tsa` uses a two-layer YAML configuration system. Project-level config overrides global config for shared keys.

### Config file locations

| Path | Purpose |
|------|---------|
| `~/.config/tdsk/tsa.yaml` | Global config (auth, display, behavior, hooks, tools) |
| `.tdsk/config.yaml` | Project config (org, agent, context paths, hooks, tools) |
| `AGENTS.md` | Auto-detected agent context file (project root) |
| `.tdsk/context/` | Auto-detected context files directory |

### Global config (`~/.config/tdsk/tsa.yaml`)

```yaml
# Authentication (managed by tsa login/logout)
auth:
  apiKey: "tdsk_..."
  proxyUrl: "https://px.local.threadedstack.app"
  insecure: false

# Default IDs (used when --org/--agent not specified)
org: "org_xxx"
agent: "agent_xxx"
project: "proj_xxx"

# Display preferences
display:
  theme: "dark"       # dark | light | auto
  verbose: false
  markdown: true
  timestamps: false

# Behavior settings
behavior:
  autoResume: false
  maxHistory: 50       # Max input history entries
  confirmTools: false

# Sandbox settings
sandbox:
  provider: "local"    # local | e2b
  timeout: 300000      # 5 minutes

# Lifecycle hooks (shell commands)
hooks:
  onSessionStart: "echo started"
  onSessionEnd: "echo ended"
  onToolCall: "echo tool called"
  onToolResult: "echo tool result"
  onError: "echo error"
  onMessage: "echo message"

# Tool safety controls
tools:
  confirm: ["shellExec"]   # Require confirmation before running
  block: ["deleteFile"]    # Block entirely
```

### Project config (`.tdsk/config.yaml`)

Place this file in your project root to set project-specific defaults:

```yaml
org: "org_xxx"
agent: "agent_xxx"
context: ["./docs/api.md"]

hooks:
  onSessionStart: "echo project session"

tools:
  confirm: ["writeFile"]
  block: []
```

### Config merge rules

When both global and project configs exist:

- `org` and `agent` from project config **override** global values.
- `hooks` are **merged** per-key (project wins on conflicts).
- `tools.confirm` and `tools.block` arrays are **concatenated** (both global and project entries apply).

### Context files

`tsa` automatically detects and injects context files into agent prompts:

- **`AGENTS.md`** -- If present at the project root, its contents are prepended to every prompt.
- **`.tdsk/context/`** -- All files in this directory are loaded and injected.
- **Manual** -- Use `/add <path>` during a session to add files on the fly.

Context is injected as XML blocks:

```xml
<context>--- AGENTS.md ---
Your agent context here...
</context>
```

### Environment variables

`tsa` respects the following environment variables:

| Variable | Description |
|----------|-------------|
| `HOME` | Used to resolve `~/.config/tdsk/` config directory |
| `NO_COLOR` | When set, disables colored output |

### Lifecycle hooks

Hooks execute shell commands on specific events. They run via `/bin/sh -c` with a 10-second timeout. Errors are silently written to stderr.

| Hook | Triggered when |
|------|---------------|
| `onSessionStart` | A chat session begins |
| `onSessionEnd` | A chat session ends |
| `onToolCall` | An agent tool is invoked |
| `onToolResult` | A tool returns a result |
| `onError` | An error occurs |
| `onMessage` | A message is sent or received |
