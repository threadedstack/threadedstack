# Self-Improvement Agent — Design Discussion

**Date**: 2026-03-07
**Status**: PARKED (pending sandbox execution model decision)

## Goal

ThreadedStack should be able to autonomously self-improve — clone itself, branch, find work, implement changes, commit, push, and submit PRs. It should leverage existing platform features: secrets, providers, agents, projects, sandbox, scheduler.

---

## Architecture Decisions

### Mental Model: The Sandbox Is Everything

After several iterations, the correct model is:

- **The sandbox is a single unified execution environment.** Don't decompose it into Node.js/V8/bash layers when thinking about architecture.
- **Everything runs inside the sandbox.** Custom bash commands, tool calls, fetch calls — all sandbox.
- **Secrets are env vars in the V8 sandbox, NOT in the bash shell.** Tools running inside the sandbox can access them. The agent (LLM) cannot see them. The bash shell (just-bash) does NOT get secrets.
- **Everything is a tool.** Git remote operations, GitHub API calls, code analysis — all exposed as agent tools that delegate to sandbox commands.
- **The backend's role is initialization only.** It sets up the agent, secrets, tools, and sandbox, and exposes message/log callbacks. It does NOT participate in the agent loop or tool calling.

### Token/Secret Flow

```
Org Secret (encrypted in DB)
    |  backend decrypts at agent init
Sandbox env var (GITHUB_TOKEN)
    |  available inside V8 sandbox
Tools use it (git push auth, GitHub API calls)
    |  agent never sees the token
Agent calls tools with typed parameters
```

### Trigger Mechanism

No new infrastructure needed. Use existing:
- **Scheduler** — Cron-based via `schedules` table. 60-second tick interval, calls `executeAgent(schedule)`.
- **Manual** — `POST /_/agents/:id/run` endpoint.

### Work Discovery Cascade

Priority order (driven by pipeline skill / system prompt):
1. **GitHub Issues** — Labeled `agent-work`, fetched via GitHub API tool
2. **Internal Tasks** — Read TASKS.md from the cloned repo
3. **Code Scanning** — TODOs, missing tests, type errors, lint issues (AI-driven analysis)

### Agent Autonomy

The agent has full autonomy guided by a pipeline skill (system prompt). The skill provides a structured workflow (clone, branch, discover work, implement, test, commit, PR) but doesn't constrain the agent. The agent decides what to do at each step.

---

## Approved Components

### Component 1: Git Remote Operations (APPROVED)

**File**: `repos/sandbox/src/git/gitCommand.ts`

Extend the existing `gitCommand` (which uses isomorphic-git for local ops) with:
- `clone` — Clone a repo via HTTP transport
- `push` — Push commits to remote
- `fetch` — Fetch from remote
- `remote add` / `remote -v` — Manage remotes

Implementation approach:
- Use isomorphic-git's HTTP transport (`import http from 'isomorphic-git/http/web'`)
- `onAuth` callback reads `GITHUB_TOKEN` from sandbox env vars
- All operations work against the in-memory filesystem (same as existing local ops)

Key design point: A tool can be BOTH a custom bash command AND an exposed agent tool. They run the same code. For common CLIs like `git`, we expose it as a shell command. When the agent calls it, we control execution and can inject secrets as needed.

Conceptual clone handler:
```typescript
case 'clone': {
  const [url] = args
  await git.clone({
    fs, dir: targetDir, url,
    http,
    onAuth: () => ({
      username: 'x-access-token',
      password: env.GITHUB_TOKEN
    }),
    singleBranch: false,
  })
  return { exitCode: 0, stdout: `Cloned ${url}` }
}
```

### Component 2: GitHub API Command (APPROVED)

**New file**: `repos/sandbox/src/github/githubCommand.ts`

A new custom bash command `github` wrapping GitHub REST API via `fetch()`:

| Subcommand | Maps to |
|---|---|
| `github issue list` | `GET /repos/{owner}/{repo}/issues` |
| `github issue get <n>` | `GET /repos/{owner}/{repo}/issues/{n}` |
| `github issue create` | `POST /repos/{owner}/{repo}/issues` |
| `github pr create` | `POST /repos/{owner}/{repo}/pulls` |
| `github pr list` | `GET /repos/{owner}/{repo}/pulls` |
| `github pr get <n>` | `GET /repos/{owner}/{repo}/pulls/{n}` |
| `github repo get` | `GET /repos/{owner}/{repo}` |
| `github label list` | `GET /repos/{owner}/{repo}/labels` |

Auth: Uses `GITHUB_TOKEN` from sandbox env (not bash env).

Registration in `repos/sandbox/src/local.ts`:
```typescript
const bash = new Bash({
  fs, cwd: `/workspace`,
  env: config.envVars || {},
  customCommands: [gitCommand, githubCommand],
})
```

### Component 3: Agent Tools for Git and GitHub (PRESENTED)

**File**: `repos/agent/src/tools/tools.ts`

New factory functions:
- `createGitTools()` — Typed tool definitions (git_clone, git_push, git_branch, etc.)
- `createGitHubTools()` — Typed tool definitions (github_list_issues, github_create_pr, etc.)

These tools delegate to the sandbox:
```typescript
{
  name: 'git_clone',
  description: 'Clone a git repository',
  parameters: {
    url: { type: 'string' },
    branch: { type: 'string', optional: true }
  },
  execute: async ({ url, branch }) => {
    const args = ['clone', url]
    if (branch) args.push('--branch', branch)
    return sandbox.exec('git', args)
  }
}
```

### Component 4: Code Analysis Tools (PARKED)

Would include:
- `analyze_codebase` — Scan for TODOs, missing tests, type errors
- `run_tests` — Execute test suite
- `run_typecheck` — Run TypeScript type checking

**BLOCKED**: Cannot implement until the sandbox real execution model is resolved (see Open Questions).

### Component 5: Work Discovery (RESOLVED — No New Code)

The pipeline skill (system prompt) guides the agent to use existing tools:
1. Use `github issue list --label agent-work` to find GitHub issues
2. Use `sandbox.readFile('TASKS.md')` to find internal tasks
3. Use code analysis tools to find work via scanning

No new infrastructure — just tool orchestration via the skill.

### Component 6: Pipeline Skill (PRESENTED)

A system prompt that guides the agent through the self-improvement workflow:

```
You are ThreadedStack's self-improvement agent. Your mission is to autonomously
improve the ThreadedStack codebase.

WORKFLOW:
1. CLONE — Clone the repository and create a feature branch
2. DISCOVER — Find work to do (GitHub issues then TASKS.md then code scanning)
3. PLAN — Analyze the issue/task and plan your approach
4. IMPLEMENT — Write the code changes
5. VALIDATE — Run tests and type checks
6. COMMIT — Commit changes with conventional commit messages
7. PUSH — Push the branch to the remote
8. PR — Create a pull request with description of changes

PRIORITIES:
- GitHub issues labeled 'agent-work' (highest)
- Entries in TASKS.md
- Code improvements found via scanning (lowest)

RULES:
- One issue/task per run
- Always create a new branch from main
- Write tests for new code
- Follow existing code patterns and conventions
- If tests fail, fix them before committing
- Include the issue number in commit messages and PR title
```

### Component 7: Trigger (RESOLVED — No New Code)

Existing scheduler handles this. Create a schedule record:
- `agentId`: The self-improvement agent's ID
- `cronExpression`: e.g. `0 2 * * *` (daily at 2 AM)
- `prompt`: "Run the self-improvement pipeline"
- `createThread`: true (new thread per run for isolation)

Manual trigger: `POST /_/agents/:id/run`

### Component 8: Agent Configuration (PRESENTED)

Standard agent DB record:
- `name`: "Self-Improvement Agent"
- `systemPrompt`: The pipeline skill text (Component 6)
- Tools: git + GitHub + code analysis + sandbox tools
- Associated with an org that has the `GITHUB_TOKEN` secret

Org secret setup:
- Secret name: `GITHUB_TOKEN`
- Value: GitHub PAT with repo scope
- Scope: org-level (available to all agents in the org)

---

## Rejected Approaches

### 1. Token Passed to Agent
Rejected: Agent should never see secrets. All authenticated operations go through tools.

### 2. Backend Context in Tool Loop
Rejected: Tools don't need backend context. Everything runs in the sandbox. The sandbox has fetch, env vars, and filesystem access.

### 3. getSecret() Method on Sandbox
Rejected: No explicit secret API. Secrets are just env vars inside the V8 sandbox. Tools read them from the sandbox env.

### 4. Separate Node.js / V8 / Bash Layers
Rejected: Don't think in terms of separate execution layers. The sandbox is one thing. Implementation details don't matter to the architecture.

### 5. VFS-to-Disk Materialization
Rejected: Proposed writing the in-memory filesystem to a temp directory on disk so real node/pnpm/tsc could run. User rejected this — needs rethinking.

---

## Open Questions (PARKED)

### How Does the Sandbox Run Real Tests/Builds?

The local sandbox uses InMemoryFs + just-bash (a JavaScript bash emulator). It cannot run real:
- `node` / `bun` — actual JavaScript runtime
- `pnpm test` / `vitest` — test runners
- `tsc` — TypeScript compiler
- `pnpm install` — package manager

Options presented but not decided:

| Option | Description | Trade-off |
|---|---|---|
| Real directory sandbox | Use actual filesystem instead of InMemoryFs | Breaks isolation, security risk |
| Container sandbox | Run in Docker/E2B container with real tools | Already partially exists (E2bSandboxProvider), but adds latency and complexity |
| CI-based validation | Push branch, let CI run tests, read results | Slow feedback loop, but uses existing infrastructure |
| Hybrid | In-memory for development, materialize for validation only | User rejected the materialization approach |

User's position: "I need to rethink it." This is the primary blocker for the full self-improvement pipeline.

What works today without this: Git clone/push, GitHub API calls, code reading/writing, branch management, PR creation. The agent could implement changes and submit PRs without running tests — relying on CI for validation.

---

## Existing Related Code

| File | Role |
|---|---|
| `repos/sandbox/src/git/gitCommand.ts` | Local git ops (isomorphic-git). Extend with remote ops. |
| `repos/sandbox/src/local.ts` | LocalSandbox setup. Add githubCommand to customCommands. |
| `repos/agent/src/tools/tools.ts` | Tool registration. Add createGitTools(), createGitHubTools(). |
| `repos/agent/src/runner/runner.ts` | AgentRunner. New tools integrate here. |
| `repos/backend/src/services/scheduler/scheduler.ts` | Scheduler service. Triggers agent runs. |
| `repos/database/src/schemas/schedules.ts` | Schedule schema. Agent config for cron triggers. |
| `repos/domain/src/types/git.types.ts` | EGitProvider.github already defined. |
| `repos/domain/src/types/sandbox.types.ts` | ISandbox interface. May need secrets support. |

## Existing TASKS.md Entries

- `[IN PROGRESS][P3] Add Git tool for agents` — Directly related
- `[P3] GitHub integration service for agents` — Directly related

---

## Implementation Order (When Unblocked)

1. **Git remote operations** — Extend gitCommand.ts with clone/push/fetch
2. **GitHub API command** — New githubCommand.ts in sandbox
3. **Agent tools** — createGitTools() + createGitHubTools() in agent
4. **Code analysis tools** — Blocked on sandbox execution model
5. **Pipeline skill** — System prompt for self-improvement workflow
6. **Agent record + secret** — DB setup via admin UI or API
7. **Schedule** — Cron trigger via admin UI or API

Steps 1-3 and 5 can proceed independently of the PARKED question. Step 4 requires resolution.

---

## Resume Checklist

When coming back to this:
1. Decide on sandbox real execution model (the PARKED question)
2. Implement Components 1-3 (git remote, GitHub command, agent tools)
3. Implement Component 4 (code analysis — depends on decision from step 1)
4. Create pipeline skill (Component 6)
5. Set up agent record, org secret, and schedule
6. End-to-end test: trigger agent, clone, find issue, implement, PR
