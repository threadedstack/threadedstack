---
name: check-duplicate-code
enabled: true
event: stop
action: block
pattern: .*
---

**BLOCKED: You have not checked for duplicate code.**

If you created new utility functions, components, or moved code between repos, you MUST verify no duplicates remain.

**Required verification:**
1. For every new function/component you created, grep the entire codebase for the old version
2. For every file you refactored to use a shared import, verify the old source file is either:
   - Deleted (if nothing else imports from it)
   - Updated (if other callsites still use it)
3. Search for duplicate function names: `grep -rn "functionName" repos/ --include="*.ts" --include="*.tsx" | grep -v node_modules`
4. Verify no file has a local copy of something that now lives in a shared package

**Per CLAUDE.md rules:**
- NEVER leave re-exports — update all callsites to import from the real source
- DELETE the original file entirely if all callsites are updated
- Check barrel/index files for stale references

**Show the grep output proving no duplicates exist.**

Go check now.
