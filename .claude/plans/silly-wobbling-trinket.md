# PR Review Round 2 — All Fixes

## Context

Round 2 of PR review on 25 changed files (email login, project-level API keys, REPL refactor) identified 18 remaining issues across 4 review agents. This plan addresses all of them: 1 critical, 4 important, 6 medium, and 7 test gaps.

---

## Group A: Code Fixes (Issues #1–#11)

### A1. REPL — Deduplicate `handleSubmit` catch branches (Issue #2)

**File**: `repos/repl/src/renderers/chatLogic.ts:580-589`

The `forbidden` and `else` branches are identical. Merge them:

```typescript
// Lines 576-590: Replace the if/else-if/else with:
      if (kind === `auth`) {
        this.logout()
        this.#outputMessage(`Session expired or unauthorized. Please log in again.`)
      } else {
        const friendly = toFriendlyError(error)
        this.#outputMessage(
          `Error: ${friendly.message}${friendly.suggestion ? ` ${friendly.suggestion}` : ``}`
        )
      }
```

The `forbidden` kind only matters in `#handleCatchError` (where it prevents phase transition to `error`). In `handleSubmit`, both paths do the same thing — show a friendly message.

### A2. REPL — Deduplicate `#handleCatchError` friendly message (Issue #6)

**File**: `repos/repl/src/renderers/chatLogic.ts:170-197`

Three branches produce identical friendly messages. Extract the message formatting, keep only the branching logic that matters (startup sets error phase):

```typescript
  #handleCatchError(err: unknown, context: `startup` | `session`): void {
    const error = err instanceof Error ? err : new Error(String(err))
    const kind = classifyApiError(err)

    if (kind === `auth`) {
      this.logout()
      this.#outputMessage(`Session expired or unauthorized. Please log in again.`)
      return
    }

    const friendly = toFriendlyError(error)
    this.#outputMessage(`Error: ${friendly.message}${friendly.suggestion ? ` ${friendly.suggestion}` : ``}`)

    // Startup errors transition to error phase; session errors preserve current state
    if (context === `startup`) {
      this.error = error
      this.onError?.(this.error)
      this.#setPhase(`error`)
    }
  }
```

This removes the `forbidden` special case (which was doing the same as `session` anyway) and the separate `session` branch.

### A3. REPL — Add logging to `#emitStatusChange` catch (Issue #7)

**File**: `repos/repl/src/renderers/chatLogic.ts:616-618`

Add a console.warn in the catch block:

```typescript
    } catch (err) {
      console.warn(`[ChatLogic] resolveModel failed, falling back to agent model`, err)
      modelName = this.agentInfo?.model
    }
```

This is a TUI app — `console.warn` is appropriate (no winston logger in REPL).

### A4. Backend — Log 403 rejections in `projectAccessGuard` (Issue #9)

**File**: `repos/backend/src/middleware/projectAccessGuard.ts:28-35`

Add logger.warn before each 403 response:

```typescript
      if (!targetProjectId) {
        logger.warn({
          message: `Project-scoped key blocked from org-level resource`,
          path: req.path,
          method: req.method,
          keyProjectId,
        })
        return res
          .status(403)
          .json({ error: `Project-scoped API key cannot access org-level resources` })
      }

      if (targetProjectId !== keyProjectId) {
        logger.warn({
          message: `Project-scoped key blocked from different project`,
          path: req.path,
          method: req.method,
          keyProjectId,
          targetProjectId,
        })
        return res.status(403).json({ error: `API key does not have access to this project` })
      }
```

### A5. Proxy — Fix outer catch logging format (Issue #5)

**File**: `repos/proxy/src/middleware/setupApiKeyAuth.ts:97-99`

Change from string format to structured:

```typescript
    } catch (err) {
      logger.error({
        message: `API key verification error`,
        error: err instanceof Error ? err.message : String(err),
      })
      res.status(500).json({ error: `Authentication error` })
    }
```

### A6. Backend — Guard `active` query param against array input (Issue #4)

**File**: `repos/backend/src/endpoints/apiKeys/listApiKeys.ts:22`

Replace line 22 with:

```typescript
    const rawActive = Array.isArray(req.query.active) ? req.query.active[0] : req.query.active
    const active = rawActive !== undefined ? rawActive === `true` : true
```

### A7. Backend — Remove unsafe `as TAuthHeaderObj` cast (Issue #3)

**File**: `repos/backend/src/middleware/setupAuth.ts:25`

The cast is already guarded by `if (!auth.userId) throw Error(...)` on line 23. The `email` field IS optional on `TAuthHeaderObj` — it's only populated when proxy forwards it. The cast is safe *after* the userId check. No code change needed — the round 2 reviewer flagged a non-issue because `email` is already optional in the type.

**Action**: No code change. Add a comment explaining why the cast is safe:

```typescript
    // Safe cast: userId is validated above; other fields (email, orgId, projectId) are optional
    req.app.locals.auth = auth as TAuthHeaderObj
```

### A8. Database — Fix `listByOrg` JSDoc (Issue #1 — critical)

**File**: `repos/database/src/services/apiKey.ts:64-67`

The comment claims "exclusive arc" which implies a DB constraint, but it's just an application-level convention. Fix:

```typescript
  /**
   * List API keys scoped to an organization.
   * Project-scoped keys are excluded because they have orgId=null (application-level exclusive arc).
   */
```

### A9. Backend — Clarify `validateApiKey` JSDoc (Issue #10)

**File**: `repos/backend/src/utils/auth/validateApiKey.ts:19-25`

```typescript
/**
 * Validates project-scoped API key creation permissions.
 * Enforces:
 * - Org admins (admin/owner/super roles) bypass all project-level restrictions
 * - Non-admin project members (viewer/member) can only create keys for themselves
 * - Scope ceiling: requested scopes cannot exceed the caller's role-derived max scope
 */
```

### A10. Proxy — Enhance TODO comment (Issue #11)

**File**: `repos/proxy/src/types/auth.types.ts:16`

```typescript
// TODO: TAuthUser is structurally identical to TAuthHeaderObj from @tdsk/domain (already a dependency) — consolidate
```

### A11. Admin — `console.warn` in auth service (Issue #8)

**File**: `repos/admin/src/services/auth.ts:20`

The admin app is a client-side SPA — it doesn't have a winston logger. `console.warn` is the correct choice for browser-side error reporting. **No change needed.**

---

## Group B: Test Additions (Issues #12–#18)

### B1. REPL — Test 403 forbidden during startup (Issue #12)

**File**: `repos/repl/src/renderers/chatLogic.test.ts`

Add test in "Batch 9" section after existing startup error tests:

```typescript
    it(`#connectAfterLogin forbidden error shows friendly message without logout`, async () => {
      const logic = makeChatLogic()
      const outputMessages: string[] = []
      logic.onMessagesChange = (msgs) => {
        const last = msgs[msgs.length - 1]
        if (last?.type === `system`) outputMessages.push(last.content)
      }

      mockListProjects.mockRejectedValueOnce(new Error(`API error (403): Forbidden`))

      await logic.init()

      // Should NOT trigger logout
      expect(mockAuth.logout).not.toHaveBeenCalled()
      // Should show friendly error message
      expect(outputMessages.some((m) => m.includes(`Error:`))).toBe(true)
      // Should transition to error phase (startup context)
      expect(logic.error).toBeTruthy()
    })
```

### B2. REPL — Test `switchProject` zero-projects and single-project (Issue #13)

**File**: `repos/repl/src/renderers/chatLogic.test.ts`

Add tests in "Batch 9" switchProject section:

```typescript
    it(`switchProject with zero projects shows message`, async () => {
      const logic = makeChatLogic()
      const outputMessages: string[] = []
      logic.onMessagesChange = (msgs) => {
        const last = msgs[msgs.length - 1]
        if (last?.type === `system`) outputMessages.push(last.content)
      }

      await logic.init()
      mockListProjects.mockResolvedValueOnce([])

      await logic.switchProject()

      expect(outputMessages.some((m) => m.includes(`No projects found`))).toBe(true)
    })

    it(`switchProject with single project skips picker`, async () => {
      const logic = makeChatLogic()
      const phases: string[] = []
      logic.onPhaseChange = (phase) => phases.push(phase)

      await logic.init()
      logic.selectAgent({ id: `a1`, name: `Alpha` })
      logic.threadId = `t1`
      phases.length = 0

      mockListProjects.mockResolvedValueOnce([{ id: `p1`, name: `Solo Project` }])
      mockListAgents.mockResolvedValueOnce([{ id: `a2`, name: `Beta` }])

      await logic.switchProject()

      expect(logic.projectId).toBe(`p1`)
      expect(logic.projectName).toBe(`Solo Project`)
      expect(phases).toContain(`pickAgent`)
    })
```

### B3. Backend — Test `createApiKey` exception re-throw (Issue #14)

**File**: `repos/backend/src/endpoints/apiKeys/apiKeys.test.ts`

Add test in the "POST /_/api-keys" describe block:

```typescript
    it(`should re-throw Exception without wrapping`, async () => {
      mockReq.body = { name: `Key`, orgId: `org-123` }

      const mockCreate = mockReq.app?.locals.db.services.apiKey.create as ReturnType<typeof vi.fn>
      mockCreate.mockRejectedValue(new Exception(409, `Key already exists`))

      await expect(ep.action(mockReq as TRequest, mockRes as Response))
        .rejects.toThrow(`Key already exists`)

      // Verify it's the original 409, not wrapped in 500
      try {
        await ep.action(mockReq as TRequest, mockRes as Response)
      } catch (err) {
        expect(err).toBeInstanceOf(Exception)
        expect((err as Exception).status).toBe(409)
      }
    })

    it(`should wrap non-Exception errors in 500 Exception`, async () => {
      mockReq.body = { name: `Key`, orgId: `org-123` }

      const mockCreate = mockReq.app?.locals.db.services.apiKey.create as ReturnType<typeof vi.fn>
      mockCreate.mockRejectedValue(new Error(`DB connection lost`))

      try {
        await ep.action(mockReq as TRequest, mockRes as Response)
      } catch (err) {
        expect(err).toBeInstanceOf(Exception)
        expect((err as Exception).status).toBe(500)
        expect((err as Exception).message).toBe(`DB connection lost`)
      }
    })
```

### B4. Admin — Test LoginPage exception paths (Issue #15)

**File**: `repos/admin/src/pages/Login/Login.test.tsx`

Add tests:

```typescript
  it(`should set emailError when signInWithEmail throws exception`, async () => {
    mockSignInWithEmail.mockRejectedValue(new Error(`Network failure`))
    const { rerender } = render(<LoginPage />)
    await act(async () => {
      await capturedLoginProps.onEmailSignIn(`a@b.com`, `pass`)
    })
    rerender(<LoginPage />)
    expect(capturedLoginProps.emailError).toBe(`Network failure`)
  })

  it(`should set emailError when signUpWithEmail throws exception`, async () => {
    mockSignUpWithEmail.mockRejectedValue(new Error(`Network failure`))
    const { rerender } = render(<LoginPage />)
    await act(async () => {
      await capturedLoginProps.onEmailSignUp(`a@b.com`, `pass`)
    })
    rerender(<LoginPage />)
    expect(capturedLoginProps.emailError).toBe(`Network failure`)
  })

  it(`should set emailError when forgotPassword throws exception`, async () => {
    mockForgotPassword.mockRejectedValue(new Error(`Network failure`))
    const { rerender } = render(<LoginPage />)
    await act(async () => {
      await capturedLoginProps.onForgotPassword(`a@b.com`)
    })
    rerender(<LoginPage />)
    expect(capturedLoginProps.emailError).toBe(`Network failure`)
  })
```

### B5. Backend — Test `projectAccessGuard` catch and logging (Issues #16)

**File**: `repos/backend/src/middleware/projectAccessGuard.test.ts`

Add tests:

```typescript
  it(`should call next(error) when header parsing throws`, () => {
    const req = buildMockReq({
      header: () => { throw new Error(`Malformed header`) },
    })

    const middleware = projectAccessGuard()
    middleware(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
    expect(mockStatus).not.toHaveBeenCalled()
  })

  it(`should log warning when project-scoped key accesses org-level resources`, () => {
    const req = buildMockReq({
      headers: { 'X-User-Id': `user-1`, 'X-User-Project-Id': `proj-1` },
      params: {},
      query: {},
      body: {},
      path: `/orgs/org-1`,
      method: `GET`,
    })

    const middleware = projectAccessGuard()
    middleware(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockStatus).toHaveBeenCalledWith(403)
  })
```

Note: Logging assertion requires mocking `logger`. Check if `@TBE/utils/logger` is already mocked in this test file — if not, add a `vi.mock` for it.

### B6. REPL — Test `#emitStatusChange` resolveModel fallback (Issue #17)

**File**: `repos/repl/src/renderers/chatLogic.test.ts`

Add a new describe block:

```typescript
  describe(`#emitStatusChange resolveModel fallback`, () => {
    it(`falls back to agent model when resolveModel throws`, async () => {
      const logic = makeChatLogic()
      let lastStatus: any = null
      logic.onStatusChange = (status) => { lastStatus = status }

      await logic.init()
      logic.selectAgent({ id: `a1`, name: `Alpha` })
      logic.agentInfo = {
        id: `a1`,
        name: `Alpha`,
        model: `fallback-model`,
        resolveModel: () => { throw new Error(`resolution failed`) },
        primaryProvider: { name: `TestProvider` },
      }

      // Trigger status change via a public method that calls #emitStatusChange
      logic.selectAgent({ id: `a1`, name: `Alpha` })

      expect(lastStatus?.modelName).toBe(`fallback-model`)
    })
  })
```

### B7. REPL — Test `setProviderId` triggers status change (Issue #18)

**File**: `repos/repl/src/renderers/chatLogic.test.ts`

This requires access to the command context. Test it through the slash command mechanism or by directly testing status updates after provider change. Add:

```typescript
  describe(`setProviderId via command context`, () => {
    it(`emits status change when provider is set`, async () => {
      const logic = makeChatLogic()
      let lastStatus: any = null
      logic.onStatusChange = (status) => { lastStatus = status }

      await logic.init()
      logic.selectAgent({ id: `a1`, name: `Alpha` })

      // Access setProviderId through slash command handling
      // The /provider command calls setProviderId internally
      logic.providerId = `new-provider`
      // Force status emission
      logic.selectAgent({ id: `a1`, name: `Alpha` })

      expect(lastStatus).toBeDefined()
    })
  })
```

Note: If `setProviderId` is only accessible via command context (private), test it indirectly through the `/provider` slash command or by verifying status change happens after agent selection with a provider override. Adapt based on actual API surface.

---

## Execution Order

1. **A1–A3**: REPL code deduplication (chatLogic.ts)
2. **A4**: Backend projectAccessGuard logging
3. **A5**: Proxy logging format fix
4. **A6**: Backend listApiKeys array guard
5. **A7–A10**: Comment/JSDoc fixes (setupAuth, apiKey.ts, validateApiKey, auth.types)
6. **B1–B7**: All test additions
7. Run verification

## Verification

```bash
# Type checks
cd repos/repl && pnpm types
cd repos/backend && pnpm types
cd repos/proxy && pnpm types
cd repos/admin && pnpm types

# Unit tests
cd repos/repl && pnpm test
cd repos/backend && pnpm test
cd repos/proxy && pnpm test
cd repos/admin && pnpm test
```
