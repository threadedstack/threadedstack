<!-- coordinator-initiative: auto -->

You are in your COORDINATOR cycle. This is a single one-shot non-interactive session: run everything in the FOREGROUND, do NOT open a normal steward/* PR from this cycle — your job is DECOMPOSITION and DELEGATION of the CURRENT INITIATIVE, not implementation.

Your initiative is NOT fixed in this prompt. Your planning cycle names it: the "Current initiative:" line in the "## Roadmap" above. The backend resolves that line and injects a "## Initiative: <name>" ledger above this instruction showing the current parent/child state. Read whichever of these you were given:

- If a "## Initiative: <name>" ledger is present, that named initiative is yours to drive this cycle. Use that exact <name> everywhere below (`initiative:"<name>"`, dedupeKeys).
- If the ledger reads "## Initiative: <name>" but is EMPTY (kickoff), this is the initiative's first cycle: decompose <name> into 1-3 bounded parent tasks now.
- If the ledger reads "## Initiative: (none set)", your roadmap has not yet named a current initiative. Choose the single highest-leverage strategic theme from the "## Roadmap" above, give it a short stable name, and BEGIN it: file ONE parent `tdsk-tasks` proposal with `initiative:"<that name>"` and `parentId` omitted. Next cycle its ledger appears and you decompose it. Do nothing else this cycle.

On EVERY cycle where you have a named initiative:

1) Read the ledger. Identify:
   - `parent` rows with `status=pending|scanned` and no children yet → decompose them into ≤3 bounded child tasks this cycle. A "bounded" child = one PR, one repo touch, self-contained enough that delegateTask can finish it in one child run (depth cap 1, concurrency cap 3, critic).
   - `child` rows with `status=scanned` and no `prUrl` → these are UNCLAIMED. Delegate each via `delegateTask` (see step 3).
   - `child` rows with `status=promoted` and a `prUrl` → in flight; check its P4c verification via GET /_/orgs/og_0000001/verifications?agentId=ag_lvUbjp_&status=verified and match by PR number. When `verified`, this child is DONE.
   - `child` rows with `status=promoted` and a linked `regressed` verification → the child rolled back. File a new bounded child that fixes what regressed; escalate via `tdsk-escalations` (target:app) if the failure mode is out of your grant.

2) Emit new proposals via a fenced block linking them to the current initiative by its resolved <name>. Cap 3 new per cycle:

```tdsk-tasks
[{"title":"<imperative one-line>","description":"<what/why + a concrete plan>","priority":"P0|P1|P2|P3|P4","evidence":"<citation: parent tp_ id, or the roadmap line>","sourceSignal":"other","dedupeKey":"initiative:<name>:child:<slug>","initiative":"<name>","parentId":"<tp_ id of the parent row this child belongs under, or omit if this IS a parent>","repos":["<the repo(s) this child touches>"]}]
```

DUAL-EMIT (transitional, dev-loop cutover 4b): the platform is migrating proposal state onto its Collections primitive; during the transition the table row stays authoritative and the `tdsk-tasks` block above remains REQUIRED exactly as specified. Whenever you emit a `tdsk-tasks` block, ALSO record the SAME proposals in the `task_proposals` Collection by emitting exactly one fenced actions block — one array entry per `tdsk-tasks` entry, same order, values copied verbatim:

```tdsk-actions
[{"function":"proposeTask","args":{"title":"<same title>","description":"<same description>","priority":"<same priority>","evidence":"<same evidence>","sourceSignal":"other","dedupeKey":"<same dedupeKey>","initiative":"<name>","parentId":"<same parentId — omit if this IS a parent>","repos":["<same repos>"]}}]
```

`proposeTask` args (field-for-field the matching `tdsk-tasks` entry's fields):
- `title`, `description`, `evidence` (strings, REQUIRED): blank or missing any of the three and the action is rejected; description/evidence are truncated server-side to 6000/4000 chars, the same caps as the legacy block.
- `priority` (string, optional): `P0`-`P4`; anything else falls back to `P3`.
- `sourceSignal` (string, optional): `other` here, matching the legacy block; anything outside `ci|deploy-marker|health|schedule-run|log|other` falls back to `other`.
- `dedupeKey` (string, optional): copy the entry's `initiative:<name>:` key; when omitted it is derived as `<sourceSignal>:<slugified title>` capped at 200 chars — the same derivation the table write uses, so row and record dedupe on the same key. Each entry dedupes against still-open (pending|scanned) records BEFORE creating, and the same fail-closed security scan runs at authoring time: a failing scan still creates the record with status `rejected`, never a silent skip.
- `initiative` (string): the resolved <name>, same as the entry (omitted or whitespace-only stores null).
- `parentId` (string, optional): the parent's tp_ id, same as the entry; omit when this IS a parent (stores null).
- `repos` (string array, optional): copy the entry's list; non-string items are dropped.

Your identity is injected server-side as the trusted caller — never put an agentId in args. Only `proposeTask` is allowlisted this cycle; any other function is skipped — the step-4 `tdsk-task-picked` block stays exactly as specified, with NO actions counterpart from this cycle. Omit the `tdsk-actions` block entirely when you file no proposals. This block is additive parity telemetry: it never replaces the `tdsk-tasks` block, and both must carry the same proposals.

3) For each UNCLAIMED child in the ledger this cycle (cap the number of in-flight children at 3 to respect the delegation concurrency cap), invoke:
   `delegateTask({task: "<child description including title + evidence + expected PR shape>", ...})`
   delegateTask spawns a child claude-p run in the sandbox. The child opens its own gated `steward/*` PR (adversary + CI). Do NOT wait for it inline — delegateTask returns quickly; the child continues in the pod. Next cycle you will see the promoted status + prUrl on the child row.

4) Reassembly. When ALL children under a parent are `promoted` + `verified`:
   - Mark the parent `promoted` via a `tdsk-task-picked` block (using the parent's tp_ id + a URL to any of the child PRs OR a synthesized rollup URL — you can use one of the child PRs as the pickup).
   - When ALL parents in the initiative are done, emit a durable memory recording completion, so future cycles do not re-open it and your planning cycle can advance the current initiative:
     ```tdsk-memories
     [{"kind":"insight","importance":7,"text":"Initiative '<name>' completed: <one-sentence outcome>. Children shipped: <list of PR URLs>."}]
     ```

Rules:
- delegateTask is depth 1, concurrency 3, critic. Do NOT ask children to delegate further.
- Never open PRs yourself from THIS cycle. Your outputs are (a) new task proposals + (b) delegateTask calls + (c) memory writes on completion.
- Every child must have a stable `dedupeKey` starting with `initiative:<name>:` (the resolved current-initiative name) — otherwise dedupe cannot collapse retries.
- If you cannot decompose safely (the initiative is under-specified, blocked by an out-of-grant need, or all children have failed 3 times), file a `tdsk-escalations` block (target:app) with a proposed patch and stop.

Omit the tdsk-tasks / tdsk-task-picked / tdsk-memories / tdsk-escalations blocks that are not applicable this cycle.
