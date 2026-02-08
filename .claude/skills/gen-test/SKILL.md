---
name: gen-test
description: Generate Vitest tests for a source file following project conventions. Use when asked to create tests for a file or module.
---

Generate tests for: $ARGUMENTS

## Project Test Conventions

### Setup
- **Framework**: Vitest (all repos)
- **Imports**: `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'`
- **File Location**: Co-located with source file (`foo.ts` → `foo.test.ts`, `foo.tsx` → `foo.test.tsx`)
- **Config**: Each repo has `configs/vitest.config.ts`

### Structure
- Use **backticks** for all `describe`/`it` strings
- Top-level `describe` = module/component name
- Nested `describe` = method/feature name
- Test names start with "should" and describe expected behavior
- Always include `beforeEach(() => { vi.clearAllMocks() })`

### Mock Patterns

**Module mocking** (at top of file, before tests):
```typescript
vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))
```

**Backend API tests** (Express req/res mocking):
```typescript
let mockReq: Partial<TRequest>
let mockRes: Partial<Response>
let mockJson: ReturnType<typeof vi.fn>
let mockStatus: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  mockJson = vi.fn()
  mockStatus = vi.fn(() => mockRes as Response)
  mockRes = { status: mockStatus, json: mockJson }
  mockReq = { app: mockApp, user: { id: 'test-user-id' }, params: {}, body: {} }
})
```

**Frontend/Admin tests** (state + fetch mocking):
```typescript
let originalFetch: typeof global.fetch
let mockFetch: ReturnType<typeof vi.fn>
beforeEach(() => {
  originalFetch = global.fetch
  mockFetch = vi.fn()
  global.fetch = mockFetch as typeof global.fetch
})
afterEach(() => { global.fetch = originalFetch })
```

### Coverage Requirements
- Happy path (success cases)
- Error handling (401, 403, 404, 500 for API; thrown errors for utils)
- Edge cases (empty inputs, null/undefined, missing fields)
- Auth/permission checks where applicable

### Path Aliases by Repo
| Repo | Alias |
|------|-------|
| admin | `@TAF/*` |
| backend | `@TBE/*` |
| database | `@TDB/*` |
| domain | `@TDM/*` |
| proxy | `@TPX/*` |
| components | `@TCM/*` |
| agent | `@TAG/*` |
| shell | `@TSH/*` |
| logger | `@TLG/*` |

## Steps

1. Read the source file to understand its exports, dependencies, and logic
2. Read the repo's skill file (`.claude/skills/<repo>/SKILL.md`) to understand repo-specific patterns
3. Read 1-2 existing test files in the same repo for style reference
4. Generate test file co-located with the source file
5. Run `pnpm --filter <package-name> test` to verify tests pass
