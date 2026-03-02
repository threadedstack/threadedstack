# Playwright UI Integration Tests for PR Review Fixes

## Context

The PR review fix session added new UI features (Skills, Schedules pages + drawers, Agent Layout 4-tab system, chat enhancements) that have zero Playwright test coverage. The API integration tests (tier1/tier3) are complete and passing. This plan adds Playwright E2E tests to validate the UI renders correctly, forms have proper fields, tabs navigate correctly, and chat UI elements are present.

**Strategy**: 4 new test files + 2 smoke tests added to existing file. Total: **~30 new test cases**.

---

## File 1: NEW `repos/integration/playwright/tier2/skills-page.spec.ts`

**7 tests** — Org Skills page rendering, drawer form fields, sidebar nav.

### 1a. `renders Skills page with heading and empty/list state`
- Navigate to `/orgs/${ctx.orgId}/skills`, wait for `.tdsk-org-skills-page`
- Assert heading `Skills` visible
- If no data: Assert empty state text `No skills yet. Create your first skill to get started.` and `Create Skill` button
- If data: Assert table rendered
- No console errors

### 1b. `Create Skill button opens SkillDrawer with correct fields`
- Click `Create Skill` button (from empty state or header)
- Assert drawer title `Create New Skill`
- Assert all 6 form fields visible:
  - `#tdsk-skill-name-input` (name)
  - `#tdsk-skill-description-input` (description)
  - `#tdsk-skill-instructions-input` (instructions)
  - `#tdsk-skill-tools-input` (tools)
  - `#tdsk-skill-trigger-keywords-input` (keywords)
  - `Always Active` switch label
- Close with Escape

### 1c. `SkillDrawer Always Active switch defaults to off`
- Open create drawer
- Locate checkbox inside `FormControlLabel` with "Always Active" label
- Assert NOT checked (`temp.alwaysActive` starts as `undefined`, switch `checked={temp?.alwaysActive ?? false}`)
- Close drawer

### 1d. `Skills table columns render correctly when data exists`
- Navigate to skills page, check if table rows exist
- `test.skip` if no rows
- Assert column headers: Name, Description, Always Active, Actions
- Assert action buttons with tooltips: `Edit Skill`, `Delete Skill`
- Assert `Always Active` chip shows `Yes` or `No`

### 1e. `clicking table row opens SkillDrawer in edit mode`
- `test.skip` if no rows
- Click first table row
- Assert drawer title `Edit Skill`
- Assert `#tdsk-skill-name-input` has non-empty value
- Close drawer

### 1f. `Skills nav item appears in org sidebar`
- Navigate to skills page
- Assert `.tdsk-admin-sidebar` contains text `Skills`
- Assert sidebar also contains text `Schedules`

### 1g. `no unexpected console errors on Skills page`
- Navigate and collect console errors (using `isIgnored` pattern)
- Assert `errors` is empty

---

## File 2: NEW `repos/integration/playwright/tier2/schedules-page.spec.ts`

**7 tests** — Org Schedules page rendering, drawer form fields.

### 2a. `renders Schedules page with heading and empty/list state`
- Navigate to `/orgs/${ctx.orgId}/schedules`, wait for `.tdsk-org-schedules-page`
- Assert heading `Schedules`
- If no data: empty state text `No schedules yet. Create your first schedule to get started.` and `Create Schedule` button
- No console errors

### 2b. `Create Schedule button opens ScheduleDrawer with correct fields`
- Click `Create Schedule` button
- Assert drawer title `Create New Schedule`
- Assert all 5 form fields visible:
  - `#tdsk-schedule-agent-select` (agent select)
  - `#tdsk-schedule-cron-input` (cron expression)
  - `#tdsk-schedule-prompt-input` (prompt textarea)
  - `Enabled` switch label
  - `Create New Thread Per Run` switch label
- Close with Escape

### 2c. `ScheduleDrawer switches default to on`
- Open create drawer
- Both switches default checked (`enabled: true, createThread: true`)
- Assert both checkboxes ARE checked
- Close drawer

### 2d. `ScheduleDrawer agent select populates with agents`
- Open create drawer
- Click `#tdsk-schedule-agent-select` to open dropdown
- Assert `.MuiMenuItem-root` elements exist (at least 1 agent from test context)
- Close dropdown with Escape

### 2e. `ScheduleDrawer cron input has correct placeholder`
- Open create drawer
- Assert `#tdsk-schedule-cron-input` has placeholder `e.g. 0 9 * * 1-5 (weekdays at 9am)`
- Close drawer

### 2f. `Schedules table columns render correctly when data exists`
- `test.skip` if no rows
- Assert column headers: Prompt, Cron, Status, Next Run, Actions
- Assert action buttons: `Trigger Now`, `Edit Schedule`, `Delete Schedule`
- Assert Status chip: `Enabled` or `Disabled`

### 2g. `clicking table row opens ScheduleDrawer in edit mode`
- `test.skip` if no rows
- Click first table row
- Assert drawer title `Edit Schedule`
- Close drawer

---

## File 3: NEW `repos/integration/playwright/tier2/agent-tabs-extended.spec.ts`

**8 tests** — Extended 4-tab AgentLayout (Agent, Threads, Skills, Schedules).

Base URL: `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}`

### 3a. `agent layout renders all 4 tabs`
- Navigate to agent detail page, wait for `.tdsk-agent-layout-page`
- Assert 4 tabs visible: `Agent`, `Threads`, `Skills`, `Schedules`
- Assert tab count `== 4`

### 3b. `clicking Skills tab navigates to /skills route`
- Click `Skills` tab
- Wait for networkidle
- Assert URL contains `/skills`
- Assert `Skills` tab has `aria-selected: true`
- Assert `Agent` tab has `aria-selected: false`

### 3c. `clicking Schedules tab navigates to /schedules route`
- Click `Schedules` tab
- Wait for networkidle
- Assert URL contains `/schedules`
- Assert `Schedules` tab has `aria-selected: true`

### 3d. `deep link to /agents/:id/skills loads with Skills tab active`
- Navigate directly to `...agents/${ctx.agentId}/skills`
- Assert `.tdsk-agent-layout-page` visible
- Assert `Skills` tab has `aria-selected: true`

### 3e. `deep link to /agents/:id/schedules loads with Schedules tab active`
- Navigate directly to `...agents/${ctx.agentId}/schedules`
- Assert `.tdsk-agent-layout-page` visible
- Assert `Schedules` tab has `aria-selected: true`

### 3f. `switching from Skills tab back to Agent tab works`
- Navigate to skills tab
- Click `Agent` tab
- Assert URL does NOT contain `/skills`, `/threads`, or `/schedules`
- Assert `Agent` tab is active
- Assert `Agent Information` text visible

### 3g. `tabs hidden on chat page (4-tab behavior preserved)`
- Navigate to `.../agents/${ctx.agentId}/chat`
- Assert `.tdsk-agent-layout-page` visible
- Assert tab count is 0 (tabs hidden on chat/thread detail)
- Assert chat input placeholder `Type a message...` visible

### 3h. `page refresh on Skills tab preserves tab state`
- Navigate to skills tab
- Assert Skills tab active
- `page.reload()` + `waitForLoadState('networkidle')`
- Assert `.tdsk-agent-layout-page` still visible
- Assert URL still contains `/skills`
- Assert Skills tab still has `aria-selected: true`

---

## File 4: NEW `repos/integration/playwright/tier2/chat-enhancements.spec.ts`

**6 tests** — Chat UI element presence (no LLM needed).

Base URL: `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/chat`

### 4a. `chat view renders file attach button`
- Navigate to chat page
- Assert `[title="Attach file"]` is visible (IconButton wrapping AttachIcon)
- Assert hidden file input exists: `input[type="file"]` count > 0

### 4b. `chat view renders pi-web-ui toggle button`
- Assert SwapHoriz icon button is visible
- Use `[data-testid="SwapHorizIcon"]` (MUI auto-generates data-testid from icon name)

### 4c. `chat view does not show stop button when not streaming`
- Assert no `Stop` button visible (only shows when `isStreaming === true`)
- Assert send button IS visible (the submit IconButton with SendIcon)

### 4d. `chat view renders New Chat button in header`
- Assert `New Chat` button visible in the chat header bar

### 4e. `chat view shows empty state message before any messages`
- Assert text matching `/Send a message to start chatting with/` visible (new chat, no messages)

### 4f. `clicking pi-web-ui toggle switches UI mode`
- Assert native chat input (`placeholder='Type a message...'`) is visible
- Click `[data-testid="SwapHorizIcon"]`
- Wait 500ms for toggle
- Assert `.pi-chat-panel-wrapper` is visible (PiChatPanel renders)
- Assert native chat input no longer visible
- Click toggle again
- Assert native chat input visible again

---

## File 5: MODIFY `repos/integration/playwright/tier2/page-rendering.spec.ts`

**+2 smoke tests** added to `Org Pages` describe block, after existing `Org Settings` test (line 189).

### 5a. `Org Skills - renders Skills heading`
- Navigate to `/orgs/${ctx.orgId}/skills`, wait for `.tdsk-org-skills-page`
- Assert heading `Skills` visible
- No console errors

### 5b. `Org Schedules - renders Schedules heading`
- Navigate to `/orgs/${ctx.orgId}/schedules`, wait for `.tdsk-org-schedules-page`
- Assert heading `Schedules` visible
- No console errors

**Insert location**: After line 189 (end of `Org Settings` test), before the closing `})` of the `Org Pages` describe block.

---

## Key Patterns (reuse from existing specs)

All test files reuse identical patterns from `page-rendering.spec.ts`:

```typescript
import { test, expect } from '../fixtures/auth'

const ignoredPatterns = [/* same list */]
const isIgnored = (text: string): boolean => ignoredPatterns.some(p => text.includes(p))

async function gotoAndWait(page, url, pageClass, timeout = 10000) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  await expect(page.locator(`.${pageClass}`)).toBeVisible({ timeout })
}
```

Auth: `authenticatedPage` fixture provides pre-authenticated page + `ctx` with `orgId`, `projectId`, `agentId`.

---

## Selectors Reference

| Component | Selector | Notes |
|-----------|----------|-------|
| Skills page | `.tdsk-org-skills-page` | Page class |
| Schedules page | `.tdsk-org-schedules-page` | Page class |
| Agent layout | `.tdsk-agent-layout-page` | Page class |
| SkillDrawer name | `#tdsk-skill-name-input` | Required, autoFocus |
| SkillDrawer desc | `#tdsk-skill-description-input` | Textarea |
| SkillDrawer instructions | `#tdsk-skill-instructions-input` | Textarea |
| SkillDrawer tools | `#tdsk-skill-tools-input` | Comma-separated |
| SkillDrawer keywords | `#tdsk-skill-trigger-keywords-input` | Comma-separated |
| ScheduleDrawer agent | `#tdsk-schedule-agent-select` | MUI Select |
| ScheduleDrawer cron | `#tdsk-schedule-cron-input` | Monospace |
| ScheduleDrawer prompt | `#tdsk-schedule-prompt-input` | Textarea |
| Tabs | `role='tab'` with `name` | Agent, Threads, Skills, Schedules |
| Chat attach | `[title="Attach file"]` | IconButton |
| Chat swap UI | `[data-testid="SwapHorizIcon"]` | MUI icon testid |
| Pi chat panel | `.pi-chat-panel-wrapper` | Web component wrapper |
| Chat input | `placeholder='Type a message...'` | TextField |
| Action buttons | `tooltip` attr | `Edit Skill`, `Delete Skill`, `Trigger Now`, etc. |

---

## Coverage Summary

| PR Change | Test File | Tests | Coverage |
|-----------|-----------|-------|----------|
| Skills page + drawer | skills-page.spec.ts | 1a-1g | Rendering, drawer fields, table, sidebar nav |
| Schedules page + drawer | schedules-page.spec.ts | 2a-2g | Rendering, drawer fields, table, defaults |
| Agent 4-tab layout | agent-tabs-extended.spec.ts | 3a-3h | Tab nav, deep links, refresh, chat hide |
| Chat UI enhancements | chat-enhancements.spec.ts | 4a-4f | Attach, toggle, stop, New Chat, empty state |
| New page smoke tests | page-rendering.spec.ts | 5a-5b | Skills + Schedules page load without errors |

---

## What's NOT Tested (and Why)

| Feature | Reason |
|---------|--------|
| Schedule CRUD (create/edit/delete) | Tests are read-only; CRUD tested via API integration tests |
| Skill CRUD (create/edit/delete) | Same — read-only Playwright tests; CRUD via API tests |
| Chat streaming / LLM interaction | Requires active LLM connection; tested via tier3/ai-stream |
| Thread branching flow | Requires existing messages; API-tested via thread-file-upload |
| File upload flow | Requires file selection dialog interaction; API-tested |
| ArtifactRenderer / MarkdownRenderer | Requires assistant messages with artifacts (LLM) |
| MermaidRenderer | Requires specific message content (LLM) |

---

## Verification

After implementation:
1. Admin dev server must be running: `cd repos/admin && pnpm start`
2. K8s services must be running: `tdsk dev start --clean`
3. Run: `cd repos/integration && pnpm test:ui`
4. All new + existing Playwright tests should pass
5. No existing tests should break (agent-navigation.spec.ts uses `getByRole('tab', { name: /Agent/i })` which still matches with 4 tabs)
