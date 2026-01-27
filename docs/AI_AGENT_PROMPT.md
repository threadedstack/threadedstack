# AI Agent Development Prompt - Threaded Stack Platform

## Context & Overview

You are an AI software development agent working on **Threaded Stack**, a developer platform that unifies authentication, serverless compute (FaaS), and secure API proxying for building AI agent applications. The platform acts as the "nervous system" between AI models and external APIs/databases.

## Critical Instructions - READ FIRST

### 1. Project Conventions (MANDATORY)
- **Read `CLAUDE.md`** immediately - contains critical project conventions, commands, and architecture
- **Load relevant skills** before working on any repo:
  - Admin UI work? → Read `.claude/skills/admin/SKILL.md`
  - Backend APIs? → Read `.claude/skills/backend/SKILL.md`
  - AI agents? → Read `.claude/skills/agent/SKILL.md`
  - Database? → Read `.claude/skills/database/SKILL.md`
  - Other repos? → Check `.claude/skills/[repo]/SKILL.md`

### 2. Epic Documentation
Review current epic status in `docs/epics/`:
- **Epic 1**: ✅ 100% Complete (Auth, DB, Orgs/Users, basic UI)
- **Epic 2**: ⚠️ 95% Complete (Proxy feature - **NEEDS INTEGRATION TESTING**)
- **Billing**: ✅ 100% Complete (Polar.sh, quotas, payments)
- **Epic 3**: ⏳ 10% Complete (FaaS - APIs only)
- **Epic 4**: ⏳ 5% Complete (AI Engine - Providers API only)
- **Epic 5**: ❌ 0% Complete (Agents - Not started)

### 3. Repository Structure
This is a **PNPM monorepo** with 9 sub-repositories in `repos/`:

| Repo | Purpose | Tech Stack |
|------|---------|------------|
| `backend/` | Core API - Admin CRUD, Proxy Engine, FaaS, AI orchestration | Express 5, WebSocket |
| `proxy/` | Auth Gateway - JWT/JWKS validation, backend proxying | Express 5, jose |
| `admin/` | SPA Dashboard | Vite, React, MUI, Jotai |
| `agent/` | AI Agent Backend - WASM isolation, LLM orchestration, virtual shell, AI provider wrappers | TypeScript, WASM |
| `database/` | ORM & migrations | Drizzle, PostgreSQL |
| `domain/` | Shared types, models, utilities | TypeScript |
| `components/` | Shared React components/hooks | React, MUI |
| `logger/` | Winston-based logging | Winston |
| `cli/` | Developer CLI | Node.js |

**IMPORTANT NOTES**:
- The **shell repo no longer exists** - it has been migrated into `repos/agent`
- **OpenAI/Anthropic API wrappers already exist** in `repos/agent` - don't recreate them

## Current Priority: Epic 2 Integration Testing

### The Gap
Epic 2 (Proxy Feature) is 95% complete with full backend implementation:
- ✅ Secrets API (encrypted storage with AES-256-GCM)
- ✅ Endpoints API (proxy configuration)
- ✅ API Keys API (M2M authentication)
- ✅ Proxy Engine (secret injection, body transformation, OAuth)
- ✅ Admin UI (secrets, endpoints, API keys management)

**BUT**: No end-to-end proof that the system works. We need integration tests.

### What's Required
Read `docs/epics/INTEGRATION_TESTING.md` for full details. Summary:

1. **Database Seeds** (`repos/database/src/seeds/integration.ts`):
   - Test organization
   - Test project
   - Test secrets (encrypted API keys)
   - Test endpoints (proxy configurations with secret references)
   - Test API keys for M2M auth

2. **Integration Test Suite** (`repos/backend/src/endpoints/proxy/__tests__/integration.test.ts`):
   - Secret injection test (prove `{{SECRET_NAME}}` replacement works)
   - Custom headers test (prove header merging works)
   - Body transformation test (prove regex/JSON path replacement works)
   - OAuth client credentials test (prove token fetching works)
   - Domain whitelisting test (prove validation works)
   - Streaming test (prove request/response streaming works)

3. **Seed Loading Script**:
   - `pnpm seed:integration` command
   - Loads test data for integration testing

### Implementation Tasks
See `INTEGRATION_TESTING.md` for 17 detailed tasks (TASK-INT-1 through TASK-INT-17).

## Alternative Development Paths

If integration testing is blocked or you want to work on something else:

### Option A: Epic 3 - FaaS Implementation
**Goal**: Serverless function execution with WASM isolation

**Current State**: Only basic function APIs exist (10% complete)

**Next Steps**:
1. Implement WASM runtime sandbox (`repos/backend/src/faas/runtime/`)
2. Create Monaco code editor UI in admin
3. Add TypeScript/Python function templates
4. Implement function deployment and execution
5. Add logs and metrics

**Skills Required**: WASM, TypeScript, React, Monaco Editor

### Option B: Epic 4 - AI Engine
**Goal**: RAG-enabled LLM proxy with memory and streaming

**Current State**: Providers API only (5% complete)

**Key Points**:
- **Don't recreate AI wrappers** - they exist in `repos/agent`
- Integrate agent repo's Provider abstraction
- Focus on RAG context management and thread/message APIs

**Next Steps**:
1. Create AI router at `repos/backend/src/middleware/aiEngine.ts`
2. Integrate `repos/agent` Provider class into backend
3. Implement threads and messages API
4. Implement RAG vector search (pgvector or Pinecone)
5. Add streaming chat endpoint

**Skills Required**: LLMs, RAG, Vector DBs, TypeScript

### Option C: Epic 3 UI Enhancements
**Goal**: Improve existing admin UI

**Ideas**:
- Add endpoint testing tool (send test requests from UI)
- Add headers configuration UI (key-value pairs with secret picker)
- Add proxy options configuration UI (regex rules)
- Add API keys navigation integration
- Add function code editor with Monaco
- Add real-time logs viewer

**Skills Required**: React, MUI, TypeScript

## Development Guidelines

### Commands
```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build all repos
pnpm build

# Run specific repo
cd repos/backend && pnpm start
cd repos/admin && pnpm start
cd repos/proxy && pnpm start

# Database operations
cd repos/database
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### Code Style
- **Files under 500 lines** - keep modules small
- **No hardcoded secrets** - always use environment variables
- **Test-first development** - write tests before implementation
- **TypeScript strict mode** - no `any` types
- **Clean architecture** - separate concerns
- **Biome** for linting/formatting (runs automatically)

### Authentication Flow
- Client-side: Neon Auth (social login via GitHub, GitLab, Google, Vercel)
- Proxy validates JWT using JWKS from Neon
- Backend APIs protected by JWT middleware

### Database
- **Provider**: Neon.com PostgreSQL
- **ORM**: Drizzle
- **Schemas**: See `repos/database/src/schemas/`
- **Pattern**: Exclusive Arc (secrets belong to org OR project, not both)
- **Encryption**: AES-256-GCM with HKDF key derivation for secrets

## Success Criteria

For any work you do:

1. **Tests pass**: `pnpm test` succeeds
2. **Build succeeds**: `pnpm build` completes without errors
3. **Types are correct**: No TypeScript errors
4. **Linting passes**: Biome checks pass (automatic)
5. **Documentation updated**: Update relevant epic tasks.md files
6. **Skills updated**: If you discover new patterns, update `.claude/skills/[repo]/SKILL.md`

## Getting Started Checklist

- [ ] Read `CLAUDE.md` for project conventions
- [ ] Review epic documentation in `docs/epics/`
- [ ] Read `docs/epics/INTEGRATION_TESTING.md` if working on Epic 2
- [ ] Load relevant skill file from `.claude/skills/[repo]/SKILL.md`
- [ ] Choose development path (integration testing, Epic 3, Epic 4, or UI work)
- [ ] Check current git status and branch
- [ ] Run `pnpm install` to ensure dependencies are up to date
- [ ] Run `pnpm test` to verify current state

## Questions to Ask

If you need clarification:

1. **Which epic should I prioritize?** (Integration testing is highest priority)
2. **Which repo should I focus on?** (Backend for APIs, Admin for UI, Agent for AI work)
3. **Should I write tests first?** (Yes, always TDD approach)
4. **Where should I start?** (Start with INTEGRATION_TESTING.md tasks)
5. **Can I make breaking changes?** (Consult first if it affects existing APIs)

## Resources

- **Project conventions**: `CLAUDE.md`
- **Epic documentation**: `docs/epics/epic-[1-5]/`
- **Integration testing**: `docs/epics/INTEGRATION_TESTING.md`
- **Repository skills**: `.claude/skills/[repo]/SKILL.md`
- **Database schemas**: `repos/database/src/schemas/`
- **API models**: `repos/domain/src/models/`

---

## Your Task

Based on the current state of the project and the priorities outlined above:

1. **Immediate Priority**: Implement Epic 2 integration testing (database seeds + test suite)
2. **Alternative**: Choose Epic 3 (FaaS), Epic 4 (AI Engine), or UI enhancements
3. **Always**: Follow TDD, update documentation, maintain code quality

Good luck! 🚀
