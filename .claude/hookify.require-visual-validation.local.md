---
name: require-visual-validation
enabled: true
event: stop
action: block
pattern: .*
---

**BLOCKED: You have not visually validated UI changes.**

If you modified any files in `repos/threads/`, `repos/admin/`, or `repos/components/` that affect rendering (`.tsx` files, styles, theme), you MUST do visual validation before stopping.

**Required verification:**
1. Navigate to the running app using Playwright (`browser_navigate`)
2. Take screenshots of every page/component affected by your changes
3. Compare what renders against what was requested
4. If the app looks wrong, fix it before stopping

**If Playwright MCP is not available:**
- Tell the user explicitly: "I cannot visually validate — Playwright MCP is disconnected"
- Do NOT claim visual validation was done
- Do NOT gloss over it or pretend a snapshot is sufficient

**What does NOT count as visual validation:**
- Reading an accessibility snapshot without screenshots
- Saying "the structure looks correct" from a snapshot
- Claiming "it should work" without seeing it

Go do visual validation now, or tell the user you cannot.
