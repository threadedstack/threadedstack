---
name: "update-docs"
description: "Detect codebase changes, compare against existing documentation in /docs and repos/website, then plan and implement updates to keep docs accurate and in sync with the latest code. Use when code changes need documentation updates, when asked to update or sync docs, after implementing features that affect user-facing behavior, or when docs may be stale."
---

# Update Documentation

Detects what changed across the monorepo, compares those changes against the documentation in `docs/` and the website rendering code in `repos/website/`, then plans and implements updates to keep everything accurate and in sync.

Optional arguments: $ARGUMENTS

## Documentation Architecture

### Rendered Sections (included in website build)

These folders are loaded by `repos/website/src/utils/docsContent.ts` via `import.meta.glob()` and rendered as MDX pages:

| Folder | `_meta.json` label | Order | Purpose |
|--------|-------------------|-------|---------|
| `docs/architecture/` | Architecture | 1 | Platform overview, security model |
| `docs/features/` | Features | 2 | Per-feature docs (orgs, providers, agents, threads, secrets, sandboxes, billing, etc.) |
| `docs/user-guide/` | User Guide | 3 | Getting started, admin UI, API reference, TSA CLI, threads app, sandbox usage |

Root-level `docs/index.md` serves as the docs landing page.

### Non-Rendered Sections (excluded from website)

These folders exist in `docs/` but are **excluded** from the website glob patterns: `superpowers/`, `plans/`, `meta/`, `payments/`, `tech/`, `endpoints/`, `business/`, `developer/`.

**IMPORTANT**: Changes to non-rendered docs are out of scope. Only update docs in `architecture/`, `features/`, `user-guide/`, and root-level files like `index.md`.

### Document Format Conventions

- **No YAML frontmatter** — files start directly with an H1 heading as the page title
- **Markdown with MDX support** — custom components available: `<Note>`, `<Tip>`, `<Warning>` (rendered via `CalloutBox`)
- **Relative links** — cross-references use relative `.md` links (e.g., `[Security Model](security-model.md)`), auto-rewritten by `remarkDocsLinks` plugin to `/docs/architecture/security-model`
- **Relative images** — stored in `images/` subdirectories per section, auto-rewritten to `/docs-assets/` URLs
- **Code blocks** — fenced with language specifier (` ```bash `, ` ```http `, ` ```typescript `)
- **Mermaid diagrams** — ` ```mermaid ` code blocks, lazy-rendered by `MermaidBlock` component
- **Tables** — standard markdown pipe tables, rendered as MUI `<Table>` components
- **Headings** — H2/H3 generate anchor IDs via `rehype-slug` and auto-link via `rehype-autolink-headings`

### Navigation System

Each rendered section has a `_meta.json` file:
```json
{
  "label": "Section Name",
  "order": 2,
  "pages": [
    "page-slug",
    { "slug": "custom-slug", "label": "Custom Display Label" }
  ]
}
```

- `order` controls sidebar section ordering
- `pages` array is **explicit** — only listed items appear in the sidebar, in that order
- When adding a new doc page, it **MUST** be added to the corresponding `_meta.json` `pages` array or it will not appear in navigation

### Website Rendering Pipeline

Key files in `repos/website/`:
- `src/utils/docsContent.ts` — `import.meta.glob()` loader, excluded folder patterns
- `src/utils/docsLoader.ts` — `buildNavigation()`, `findContentModule()` for slug → MDX mapping
- `src/pages/docs/DocsPage.tsx` — catch-all page that dynamically imports MDX by slug
- `src/components/Docs/MDXComponents.tsx` — MDX component overrides (headings → MUI Typography, code → Shiki/Mermaid, callouts → CalloutBox)
- `src/components/Docs/DocsSidebar.tsx` — collapsible section sidebar from `_meta.json`
- `src/components/Docs/DocsTableOfContents.tsx` — auto-generated TOC from H2/H3
- `src/components/Docs/DocsPrevNext.tsx` — prev/next navigation links
- `configs/remarkDocsLinks.ts` — remark plugin for `.md` link and image URL rewriting
- `configs/vitePluginDocsAssets.ts` — dev middleware + build copy for doc images

## Workflow

### Step 1: Detect Changes

Run these git commands in parallel to identify all changed source files:
- `git diff --name-only` (unstaged changes)
- `git diff --name-only --cached` (staged changes)
- `git diff --name-only main...HEAD` (all branch changes vs main)

Deduplicate the results and group by sub-repo (`repos/<name>/`).

Filter to **source files that affect user-facing behavior** — prioritize:
- API endpoint handlers, middleware, route definitions
- Database schema and migrations
- Type definitions and models (especially in `repos/domain/`)
- CLI commands and arguments (in `repos/tsa/`)
- UI components and pages (in `repos/admin/`, `repos/threads/`)
- Sandbox lifecycle and configuration (in `repos/sandbox/`, `repos/backend/`)
- Proxy routing and auth logic (in `repos/proxy/`)

Skip files that don't affect docs: test files, build configs, linter configs, `.claude/` internal files, `deploy/` manifests (unless they change ports/hosts/URLs).

Also check for direct doc changes:
- `git diff --name-only -- docs/` (docs folder changes)
- `git diff --name-only -- repos/website/` (website code changes)

If no source changes are detected AND no doc/website changes exist, tell the user and stop.

Output a change summary: which repos changed, how many files, which behavioral areas are affected.

### Step 2: Load Context

1. Load the `tdsk-website` skill for website architecture knowledge.
2. For each changed repo, load its corresponding skill (e.g., changes in `repos/backend/` → load `tdsk-backend` skill).
3. Use parallel sub-agents (one per changed repo) to:
   - Read the changed source files to understand what behavior changed (new endpoints, renamed fields, new CLI commands, changed API responses, new UI features, modified auth flows)
   - Identify which user-facing behaviors are affected: API contracts, CLI arguments, UI workflows, configuration options, security model, billing/quota changes
   - Read the **current state** of relevant doc pages in `docs/` that cover these areas
   - Note any discrepancies: outdated API examples, missing features, wrong field names, stale diagrams, missing pages

4. Compile a mapping: changed behavior → relevant doc pages → specific gaps or inaccuracies.

### Step 3: Plan Documentation Changes

For each affected area, determine the action:

- **Update existing doc page**: The page exists but contains outdated information — wrong field names, missing new endpoints, stale code examples, incorrect API responses, outdated architecture diagrams, missing configuration options.
- **Create new doc page**: A significant new feature or capability has no documentation at all. Determine the appropriate section:
  - `architecture/` — platform-level architectural changes (new services, security model changes)
  - `features/` — new user-facing features (new API resource, new integration, new capability)
  - `user-guide/` — new workflows or tools (new CLI commands, new UI pages, new getting-started steps)
- **Update `_meta.json`**: A new page needs to be added to navigation, or page ordering needs adjustment.
- **Update website rendering code**: Only if changes in doc format or structure require website code changes (new MDX components, new remark plugin behavior, new sidebar sections). This should be rare.
- **No change needed**: Internal refactoring without user-facing behavior change; existing docs already accurately describe the current behavior.

Present the plan to the user before proceeding. List each doc file to update or create with a brief rationale of what's wrong or missing.

### Step 4: Implement Documentation Changes

Use sub-agents for parallel work across independent doc files and sections.

**Before writing any new doc page**, read 2-3 neighboring pages in the same section to match the local style, depth, and conventions.

Follow existing documentation conventions:
- Start with an H1 heading as the page title — no YAML frontmatter
- Use H2 for major sections, H3 for subsections
- Include practical code examples with language-specified fenced blocks
- Use `<Note>`, `<Tip>`, `<Warning>` callout components for important information
- Use markdown pipe tables for structured data (API endpoints, fields, configuration options)
- Use mermaid diagrams for architecture and flow visualizations
- Cross-reference other pages with relative `.md` links (e.g., `[Secrets](../features/secrets.md)`)
- Keep language clear, direct, and technically precise
- Match the depth of surrounding pages — don't write a 500-line doc in a section of 100-line docs
- Store images in the section's `images/` subdirectory

When creating a **new doc page**:
1. Write the markdown file in the appropriate `docs/<section>/` directory
2. Add the page slug to the section's `_meta.json` `pages` array in the correct position
3. Verify the slug matches the filename (without `.md` extension)

When updating **website rendering code** (rare):
- Follow the patterns in `MDXComponents.tsx` for new MDX component overrides
- Test that existing pages still render correctly
- Ensure new components are properly typed

After implementing changes, run `pnpm types` in `repos/website/` to catch type errors early.

### Step 5: Build Verification

Run the website build to verify all documentation compiles and renders correctly:
```
cd repos/website && pnpm build 2>&1 | tee ../../.temp/docs-build-output.txt
```

Create the `.temp/` directory at the project root if it doesn't exist.

If the build succeeds, jump to Step 7.

Common build failures:
- **MDX syntax errors** — malformed JSX in custom components, unclosed tags
- **Broken relative links** — referencing a `.md` file that doesn't exist or was renamed
- **Missing images** — referencing an image file that doesn't exist
- **Import errors** — if website code was modified, TypeScript or import resolution errors
- **`_meta.json` mismatches** — page slug listed in `_meta.json` but no corresponding `.md` file, or vice versa

### Step 6: Fix and Iterate

For each build failure:
1. Read the error output to identify the failing file and line
2. Read the source file to understand the issue
3. Fix the root cause — don't suppress errors

After fixing, re-run the build:
```
cd repos/website && pnpm build 2>&1 | tee ../../.temp/docs-build-output.txt
```

Also run website tests to verify rendering logic:
```
cd repos/website && pnpm test 2>&1 | tee -a ../../.temp/docs-build-output.txt
```

**Iteration cap**: Maximum 3 build cycles. If still failing after 3 iterations, report the remaining errors with full diagnostic context and stop.

### Step 7: Content Verification

After a successful build, verify documentation accuracy with targeted checks:

1. **Cross-reference API examples** against actual backend endpoint handlers — verify HTTP methods, paths, request/response bodies, status codes, and query parameters match the current implementation.

2. **Cross-reference CLI commands** against actual TSA/CLI argument parsers — verify command names, flags, options, and defaults match current code.

3. **Cross-reference type definitions** — verify field names, types, enum values, and model shapes in docs match `repos/domain/` type definitions.

4. **Verify internal links** — check that all relative `.md` links point to files that exist and slugs that appear in `_meta.json`.

5. **Verify code examples** — ensure code snippets use current API patterns, correct import paths, and valid syntax.

If discrepancies are found during verification, fix them and re-run the build (Step 5).

### Step 8: Final Report

Run `pnpm types` in `repos/website/` and in each sub-repo where application code was modified (if any).

Present a summary report:
- **Changes detected**: Which repos changed, which behavioral areas were affected
- **Docs updated**: List of doc files modified with brief description of what changed
- **Docs created**: List of new doc files with the section they were added to
- **Navigation updated**: Any `_meta.json` changes (new pages, reordering)
- **Website code changes**: If any rendering code was modified (and why)
- **Build result**: Pass/fail, number of iterations needed
- **Content accuracy**: Summary of cross-reference verification results
- **Known gaps**: Any areas where documentation is still incomplete or would benefit from further work (e.g., screenshots, diagrams, additional examples)

Remind the user that no commits were made.

## Key Rules

- **NEVER commit or modify git history** — user handles all git operations. Include this rule in every sub-agent prompt.
- **NEVER add TODO comments** — implement documentation fully or explain why you cannot.
- **NEVER propose fixes without proven root cause** — read the actual code and docs before claiming something is wrong.
- **NEVER fabricate API examples** — every code example, endpoint path, request/response body, and CLI command must be verified against the actual codebase.
- **NEVER invent features** — only document what the code actually does. If a feature is partially implemented, document the current state accurately.
- **K8s services are always running** — do not suggest starting them or ask if they're running.
- **Save build output** to `.temp/docs-build-output.txt` after every build.
- **Use sub-agents** for parallel work across independent doc sections and files.
- **Run `pnpm types`** before reporting completion — in `repos/website/` and any modified sub-repos.
- **Max 3 build iterations** — report remaining errors with diagnostics if still failing after 3 cycles.
- **New pages MUST be added to `_meta.json`** — a doc page that isn't in the `pages` array will not appear in the sidebar navigation.
- **Match surrounding style** — before writing or updating a doc, read neighboring pages in the same section to match depth, tone, and formatting conventions.
- **Accuracy over completeness** — it is better to have a shorter, accurate doc than a longer, inaccurate one. Verify every claim against the code.

## Change-to-Doc Mapping Reference

Use this mapping to quickly identify which docs are likely affected by changes in a given repo:

| Changed Repo | Likely Affected Docs |
|---|---|
| `repos/backend/src/endpoints/` | `features/*.md`, `user-guide/api-reference.md` |
| `repos/backend/src/services/` | `features/*.md`, `architecture/*.md` |
| `repos/backend/src/middleware/` | `architecture/security-model.md`, `features/*.md` |
| `repos/proxy/` | `architecture/security-model.md`, `architecture/platform-overview.md` |
| `repos/database/` | `features/*.md` (field names, relationships), `architecture/platform-overview.md` |
| `repos/domain/src/types/` | Any doc referencing those types — grep for type/field names |
| `repos/domain/src/models/` | `features/*.md`, `user-guide/api-reference.md` |
| `repos/admin/src/components/` | `user-guide/admin-ui.md`, screenshots in `user-guide/images/` |
| `repos/admin/src/actions/` | `user-guide/admin-ui.md`, `features/*.md` |
| `repos/tsa/` | `user-guide/tsa-cli.md`, `features/sandbox-connect.md` |
| `repos/sandbox/` | `features/sandbox-connect.md`, `user-guide/sandbox-usage.md`, `architecture/platform-overview.md` |
| `repos/threads/` | `user-guide/threads-app.md`, `features/threads.md` |
| `repos/agent/` | `features/agent-endpoints.md` |
| `repos/website/` | Website rendering — check if doc display is affected |
| `repos/components/` | May affect admin/threads docs if UI patterns changed |
