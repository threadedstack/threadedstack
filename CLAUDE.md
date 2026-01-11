# Claude Code Configuration - SPARC Development Environment

## 🚨 CRITICAL: CONCURRENT EXECUTION & FILE MANAGEMENT

**ABSOLUTE RULES**:
1. ALL operations MUST be concurrent/parallel in a single message
2. **NEVER save working files, text/mds and tests to the root folder**
3. ALWAYS organize files in appropriate subdirectories
4. **USE CLAUDE CODE'S TASK TOOL** for spawning agents concurrently, not just MCP

### ⚡ GOLDEN RULE: "1 MESSAGE = ALL RELATED OPERATIONS"

**MANDATORY PATTERNS:**
- **TodoWrite**: ALWAYS batch ALL todos in ONE call (5-10+ todos minimum)
- **Task tool (Claude Code)**: ALWAYS spawn ALL agents in ONE message with full instructions
- **File operations**: ALWAYS batch ALL reads/writes/edits in ONE message
- **Bash commands**: ALWAYS batch ALL terminal operations in ONE message
- **Memory operations**: ALWAYS batch ALL memory store/retrieve in ONE message

### 🎯 CRITICAL: Claude Code Task Tool for Agent Execution

**Claude Code's Task tool is the PRIMARY way to spawn agents:**
```javascript
// ✅ CORRECT: Use Claude Code's Task tool for parallel agent execution
[Single Message]:
  Task("Research agent", "Analyze requirements and patterns...", "researcher")
  Task("Coder agent", "Implement core features...", "coder")
  Task("Tester agent", "Create comprehensive tests...", "tester")
  Task("Reviewer agent", "Review code quality...", "reviewer")
  Task("Architect agent", "Design system architecture...", "system-architect")
```

**MCP tools are ONLY for coordination setup:**
- `mcp__claude-flow__swarm_init` - Initialize coordination topology
- `mcp__claude-flow__agent_spawn` - Define agent types for coordination
- `mcp__claude-flow__task_orchestrate` - Orchestrate high-level workflows

### 📁 File Organization Rules

**NEVER save to root folder. Use these directories:**
- `/src` - Source code files
- `/tests` - Test files
- `/docs` - Documentation and markdown files
- `/config` - Configuration files
- `/scripts` - Utility scripts
- `/examples` - Example code

## Project Overview

This project uses SPARC (Specification, Pseudocode, Architecture, Refinement, Completion) methodology with Claude-Flow orchestration for systematic Test-Driven Development.

## SPARC Commands

### Core Commands
- `npx claude-flow sparc modes` - List available modes
- `npx claude-flow sparc run <mode> "<task>"` - Execute specific mode
- `npx claude-flow sparc tdd "<feature>"` - Run complete TDD workflow
- `npx claude-flow sparc info <mode>` - Get mode details

### Batchtools Commands
- `npx claude-flow sparc batch <modes> "<task>"` - Parallel execution
- `npx claude-flow sparc pipeline "<task>"` - Full pipeline processing
- `npx claude-flow sparc concurrent <mode> "<tasks-file>"` - Multi-task processing

### Build Commands
- `npm run build` - Build project
- `npm run test` - Run tests
- `npm run lint` - Linting
- `npm run typecheck` - Type checking

## SPARC Workflow Phases

1. **Specification** - Requirements analysis (`sparc run spec-pseudocode`)
2. **Pseudocode** - Algorithm design (`sparc run spec-pseudocode`)
3. **Architecture** - System design (`sparc run architect`)
4. **Refinement** - TDD implementation (`sparc tdd`)
5. **Completion** - Integration (`sparc run integration`)

## Code Style & Best Practices

- **Modular Design**: Files under 500 lines
- **Environment Safety**: Never hardcode secrets
- **Test-First**: Write tests before implementation
- **Clean Architecture**: Separate concerns
- **Documentation**: Keep updated

## 🚀 Available Agents (54 Total)

### Core Development
`coder`, `reviewer`, `tester`, `planner`, `researcher`

### Swarm Coordination
`hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`, `collective-intelligence-coordinator`, `swarm-memory-manager`

### Consensus & Distributed
`byzantine-coordinator`, `raft-manager`, `gossip-coordinator`, `consensus-builder`, `crdt-synchronizer`, `quorum-manager`, `security-manager`

### Performance & Optimization
`perf-analyzer`, `performance-benchmarker`, `task-orchestrator`, `memory-coordinator`, `smart-agent`

### GitHub & Repository
`github-modes`, `pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`, `workflow-automation`, `project-board-sync`, `repo-architect`, `multi-repo-swarm`

### SPARC Methodology
`sparc-coord`, `sparc-coder`, `specification`, `pseudocode`, `architecture`, `refinement`

### Specialized Development
`backend-dev`, `mobile-dev`, `ml-developer`, `cicd-engineer`, `api-docs`, `system-architect`, `code-analyzer`, `base-template-generator`

### Testing & Validation
`tdd-london-swarm`, `production-validator`

### Migration & Planning
`migration-planner`, `swarm-init`

## 🎯 Claude Code vs MCP Tools

### Claude Code Handles ALL EXECUTION:
- **Task tool**: Spawn and run agents concurrently for actual work
- File operations (Read, Write, Edit, MultiEdit, Glob, Grep)
- Code generation and programming
- Bash commands and system operations
- Implementation work
- Project navigation and analysis
- TodoWrite and task management
- Git operations
- Package management
- Testing and debugging

### MCP Tools ONLY COORDINATE:
- Swarm initialization (topology setup)
- Agent type definitions (coordination patterns)
- Task orchestration (high-level planning)
- Memory management
- Neural features
- Performance tracking
- GitHub integration

**KEY**: MCP coordinates the strategy, Claude Code's Task tool executes with real agents.

## 🚀 Quick Setup

```bash
# Add MCP servers (Claude Flow required, others optional)
claude mcp add claude-flow npx claude-flow@alpha mcp start
claude mcp add ruv-swarm npx ruv-swarm mcp start  # Optional: Enhanced coordination
claude mcp add flow-nexus npx flow-nexus@latest mcp start  # Optional: Cloud features
```

## MCP Tool Categories

### Coordination
`swarm_init`, `agent_spawn`, `task_orchestrate`

### Monitoring
`swarm_status`, `agent_list`, `agent_metrics`, `task_status`, `task_results`

### Memory & Neural
`memory_usage`, `neural_status`, `neural_train`, `neural_patterns`

### GitHub Integration
`github_swarm`, `repo_analyze`, `pr_enhance`, `issue_triage`, `code_review`

### System
`benchmark_run`, `features_detect`, `swarm_monitor`

### Flow-Nexus MCP Tools (Optional Advanced Features)
Flow-Nexus extends MCP capabilities with 70+ cloud-based orchestration tools:

**Key MCP Tool Categories:**
- **Swarm & Agents**: `swarm_init`, `swarm_scale`, `agent_spawn`, `task_orchestrate`
- **Sandboxes**: `sandbox_create`, `sandbox_execute`, `sandbox_upload` (cloud execution)
- **Templates**: `template_list`, `template_deploy` (pre-built project templates)
- **Neural AI**: `neural_train`, `neural_patterns`, `seraphina_chat` (AI assistant)
- **GitHub**: `github_repo_analyze`, `github_pr_manage` (repository management)
- **Real-time**: `execution_stream_subscribe`, `realtime_subscribe` (live monitoring)
- **Storage**: `storage_upload`, `storage_list` (cloud file management)

**Authentication Required:**
- Register: `mcp__flow-nexus__user_register` or `npx flow-nexus@latest register`
- Login: `mcp__flow-nexus__user_login` or `npx flow-nexus@latest login`
- Access 70+ specialized MCP tools for advanced orchestration

## 🚀 Agent Execution Flow with Claude Code

### The Correct Pattern:

1. **Optional**: Use MCP tools to set up coordination topology
2. **REQUIRED**: Use Claude Code's Task tool to spawn agents that do actual work
3. **REQUIRED**: Each agent runs hooks for coordination
4. **REQUIRED**: Batch all operations in single messages

### Example Full-Stack Development:

```javascript
// Single message with all agent spawning via Claude Code's Task tool
[Parallel Agent Execution]:
  Task("Backend Developer", "Build REST API with Express. Use hooks for coordination.", "backend-dev")
  Task("Frontend Developer", "Create React UI. Coordinate with backend via memory.", "coder")
  Task("Database Architect", "Design PostgreSQL schema. Store schema in memory.", "code-analyzer")
  Task("Test Engineer", "Write Jest tests. Check memory for API contracts.", "tester")
  Task("DevOps Engineer", "Setup Docker and CI/CD. Document in memory.", "cicd-engineer")
  Task("Security Auditor", "Review authentication. Report findings via hooks.", "reviewer")
  
  // All todos batched together
  TodoWrite { todos: [...8-10 todos...] }
  
  // All file operations together
  Write "backend/server.js"
  Write "frontend/App.jsx"
  Write "database/schema.sql"
```

## 📋 Agent Coordination Protocol

### Every Agent Spawned via Task Tool MUST:

**1️⃣ BEFORE Work:**
```bash
npx claude-flow@alpha hooks pre-task --description "[task]"
npx claude-flow@alpha hooks session-restore --session-id "swarm-[id]"
```

**2️⃣ DURING Work:**
```bash
npx claude-flow@alpha hooks post-edit --file "[file]" --memory-key "swarm/[agent]/[step]"
npx claude-flow@alpha hooks notify --message "[what was done]"
```

**3️⃣ AFTER Work:**
```bash
npx claude-flow@alpha hooks post-task --task-id "[task]"
npx claude-flow@alpha hooks session-end --export-metrics true
```

## 🎯 Concurrent Execution Examples

### ✅ CORRECT WORKFLOW: MCP Coordinates, Claude Code Executes

```javascript
// Step 1: MCP tools set up coordination (optional, for complex tasks)
[Single Message - Coordination Setup]:
  mcp__claude-flow__swarm_init { topology: "mesh", maxAgents: 6 }
  mcp__claude-flow__agent_spawn { type: "researcher" }
  mcp__claude-flow__agent_spawn { type: "coder" }
  mcp__claude-flow__agent_spawn { type: "tester" }

// Step 2: Claude Code Task tool spawns ACTUAL agents that do the work
[Single Message - Parallel Agent Execution]:
  // Claude Code's Task tool spawns real agents concurrently
  Task("Research agent", "Analyze API requirements and best practices. Check memory for prior decisions.", "researcher")
  Task("Coder agent", "Implement REST endpoints with authentication. Coordinate via hooks.", "coder")
  Task("Database agent", "Design and implement database schema. Store decisions in memory.", "code-analyzer")
  Task("Tester agent", "Create comprehensive test suite with 90% coverage.", "tester")
  Task("Reviewer agent", "Review code quality and security. Document findings.", "reviewer")
  
  // Batch ALL todos in ONE call
  TodoWrite { todos: [
    {id: "1", content: "Research API patterns", status: "in_progress", priority: "high"},
    {id: "2", content: "Design database schema", status: "in_progress", priority: "high"},
    {id: "3", content: "Implement authentication", status: "pending", priority: "high"},
    {id: "4", content: "Build REST endpoints", status: "pending", priority: "high"},
    {id: "5", content: "Write unit tests", status: "pending", priority: "medium"},
    {id: "6", content: "Integration tests", status: "pending", priority: "medium"},
    {id: "7", content: "API documentation", status: "pending", priority: "low"},
    {id: "8", content: "Performance optimization", status: "pending", priority: "low"}
  ]}
  
  // Parallel file operations
  Bash "mkdir -p app/{src,tests,docs,config}"
  Write "app/package.json"
  Write "app/src/server.js"
  Write "app/tests/server.test.js"
  Write "app/docs/API.md"
```

### ❌ WRONG (Multiple Messages):
```javascript
Message 1: mcp__claude-flow__swarm_init
Message 2: Task("agent 1")
Message 3: TodoWrite { todos: [single todo] }
Message 4: Write "file.js"
// This breaks parallel coordination!
```

## Performance Benefits

- **84.8% SWE-Bench solve rate**
- **32.3% token reduction**
- **2.8-4.4x speed improvement**
- **27+ neural models**

## Hooks Integration

### Pre-Operation
- Auto-assign agents by file type
- Validate commands for safety
- Prepare resources automatically
- Optimize topology by complexity
- Cache searches

### Post-Operation
- Auto-format code
- Train neural patterns
- Update memory
- Analyze performance
- Track token usage

### Session Management
- Generate summaries
- Persist state
- Track metrics
- Restore context
- Export workflows

## Advanced Features (v2.0.0)

- 🚀 Automatic Topology Selection
- ⚡ Parallel Execution (2.8-4.4x speed)
- 🧠 Neural Training
- 📊 Bottleneck Analysis
- 🤖 Smart Auto-Spawning
- 🛡️ Self-Healing Workflows
- 💾 Cross-Session Memory
- 🔗 GitHub Integration

## Integration Tips

1. Start with basic swarm init
2. Scale agents gradually
3. Use memory for context
4. Monitor progress regularly
5. Train patterns from success
6. Enable hooks automation
7. Use GitHub tools first

## Support

- Documentation: https://github.com/ruvnet/claude-flow
- Issues: https://github.com/ruvnet/claude-flow/issues
- Flow-Nexus Platform: https://flow-nexus.ruv.io (registration required for cloud features)

---

Remember: **Claude Flow coordinates, Claude Code creates!**

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
Never save working files, text/mds and tests to the root folder.

## Project Overview

**Threaded Stack** is a developer platform that unifies authentication, serverless compute (FaaS), and secure API proxying for building AI agent applications. It acts as the "nervous system" between AI models and external APIs/databases, enabling orgs to build autonomous software without managing complex cloud infrastructure.

The platform solves three key problems:
1. **Fragmented stacks** - Replaces stitching together Vercel + Lambda + LangChain + Vault
2. **Security gaps** - Secrets are injected server-side; AI never sees API keys
3. **Context management** - Built-in RAG and memory management for LLM applications

## Architecture

### Request Flow
```
Client → Auth-Proxy (repos/proxy) → Backend (repos/backend) → External APIs/DB
                ↓
         Auth: /auth/*
         Admin: /_/* → Backend Admin API
         Proxy: /proxy/* → Backend Proxy Engine
         FaaS: /faas/* → Backend Compute Engine
         AI: /ai/* → Backend AI Engine
```

### Workspace Structure (`repos/`)

| Directory | Role | Tech | Skill |
|-----------|------|------|-------|
| `proxy/` | Auth Gateway - single entry point for all external traffic | Express, JWT, http-proxy | `.claude/skills/proxy-repo.yml` |
| `backend/` | Core API - Admin CRUD, Proxy Engine, FaaS, AI orchestration | Express 5, WebSocket | `.claude/skills/backend-repo.yml` |
| `admin/` | SPA Dashboard | Vite, React, MUI, Jotai | `.claude/skills/admin-repo.yml` |
| `database/` | ORM & migrations | Drizzle, PostgreSQL | `.claude/skills/database-repo.yml` |
| `domain/` | Shared types, models, utilities | TypeScript | `.claude/skills/domain-repo.yml` |
| `components/` | Shared React components/hooks | React, MUI | `.claude/skills/components-repo.yml` |
| `logger/` | Winston-based logging service | Winston | `.claude/skills/logger-repo.yml` |
| `cli/` | Developer CLI for project management | Node.js | `.claude/skills/cli-repo.yml` |

## Sub-Repo Skills

**IMPORTANT**: Before working on any sub-repo, load its corresponding skill file for comprehensive knowledge of the codebase structure, patterns, and best practices.

### How to Use Skills
Load the relevant skill when working on a specific repo:
- Working on admin UI? → Read `.claude/skills/admin-repo.yml` first
- Adding API endpoints? → Read `.claude/skills/backend-repo.yml` first
- Modifying database schema? → Read `.claude/skills/database-repo.yml` first

### Available Skills
| Skill File | Contents |
|------------|----------|
| `admin-repo.yml` | React/Vite architecture, Jotai state, MUI theming, Neon Auth, routing patterns |
| `backend-repo.yml` | Express 5 API structure, middleware patterns, route organization, WebSocket setup |
| `cli-repo.yml` | CLI command structure, DevOps orchestration, task system, Docker/K8s integration |
| `components-repo.yml` | 30+ React components, 25+ hooks, Monaco editor integration, MUI patterns |
| `database-repo.yml` | Drizzle ORM patterns, schema definitions, Exclusive Arc pattern, migrations |
| `domain-repo.yml` | TypeScript types, models, crypto utilities, Express helpers, error handling |
| `logger-repo.yml` | Winston configuration, transports, secret redaction, Express middleware |
| `proxy-repo.yml` | Auth gateway architecture, JWT handling, route forwarding, middleware chain |

### Database & Authentication

**Neon.com** is used as both the PostgreSQL database provider and for user authentication.

**Neon Auth** is integrated in the admin repo via `@neondatabase/neon-js`:
- `createAuthClient()` from `@neondatabase/neon-js/auth` - Auth client
- `NeonAuthUIProvider` from `@neondatabase/neon-js/auth/react` - React provider
- Social sign-in (GitHub, GitLab, Google, Vercel) for user authentication
- Auth URL configured via `TDSK_AUTH_URL` environment variable

### Database Schema (Exclusive Arc Pattern)

Key tables: `orgs`, `users`, `repos`, `endpoints`, `functions`, `configs`, `providers`, `secrets`, `roles`, `threads`, `messages`, `assets`

Polymorphic relationships use "Exclusive Arc" - e.g., `secrets` belong to Org OR Repo (not both).

## Common Commands

```bash
# Install (PNPM required - enforced)
pnpm install

# Run unit tests via vitest
pnpm test

# Run code formatting via biome
pnpm format

# Run code linting via biome
pnpm lint

# Sync package versions
pnpm sync

# Clean reinstall of node_modules
pnpm clean:full
```

### Per-Repo Commands

**Admin** (`repos/admin/`)
```bash
pnpm start          # Dev server
pnpm build          # Production build
pnpm lint           # Biome lint
pnpm format         # Biome format
```

**Backend** (`repos/backend/`)
```bash
pnpm start          # Dev with watch (watches domain/logger/database)
pnpm build          # Production build
pnpm lint           # Biome lint
pnpm format         # Biome format
```

**Proxy** (`repos/proxy/`)
```bash
pnpm start          # Dev with watch
pnpm test           # Vitest tests
pnpm lint           # Biome lint
pnpm format         # Biome format
```

**Database** (`repos/database/`)
```bash
pnpm generate       # Generate migrations
pnpm migrate        # Run migrations
pnpm push           # Push schema to DB
pnpm studio         # Open Drizzle Studio
```

## Development Phases

The project follows a phased rollout:

1. **Phase 1 (Base Setup)**: Monorepo, DB, Auth backbone, basic UI - Orgs/Users CRUD
2. **Phase 2 (Proxy Feature)**: Secret injection, header/body transforms, M2M auth
3. **Phase 3 (FaaS)**: WASM sandbox execution, Monaco editor, TS/Python support
4. **Phase 4 (AI Engine)**: RAG-enabled LLM proxy, streaming chat, tool execution
5. **Phase 5 (Agents)**: Containerized agent sandbox, Git integration, browser automation

## Key Patterns

**Path Aliases**: Admin uses `@TAF/*` prefix via `alias-hq`. All repos have `configs/aliases.ts`.

**Configuration**: Each repo has `configs/` with build configs (vite/tsup/tsdown), linter configs (biome.json), and aliases.

**Environment Variables**: Loaded via `@keg-hub/parse-config` from `deploy/values.*.yml` (local, dev, prod).

**Linting**: All repos use Biome for linting and formatting.