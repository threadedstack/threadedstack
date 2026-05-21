---
name: require-plan-completion
enabled: true
event: stop
action: block
pattern: .*
---

**BLOCKED: You have not verified all plan items are complete.**

If you are implementing a plan (from a plan file, task list, or user request with multiple deliverables), you MUST verify EVERY item is done before stopping.

**Required verification:**
1. Re-read the plan file or re-enumerate every deliverable from the user's request
2. For EACH item, state:
   - What was asked
   - What was delivered (specific file + line if applicable)
   - What verification was done (test output, type check, visual check)
3. If ANY item is incomplete, either:
   - Complete it now
   - Explicitly tell the user at the TOP of your response what is missing and why

**What does NOT count:**
- "Most items are done" — ALL items must be accounted for
- Silently dropping scope — if you skip something, SAY SO
- Claiming completion without matching deliverables to requests 1:1

**Per CLAUDE.md Anti-Laziness Rules:**
- "Done" means ALL deliverables verified, not "code written"
- Silence about incomplete work is NOT acceptable
- Missing items go at the TOP of the response, not buried at the bottom

Go enumerate every plan item and verify each one now.
