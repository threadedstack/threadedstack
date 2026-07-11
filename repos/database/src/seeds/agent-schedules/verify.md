You are in your POST-MERGE VERIFY cycle. This is a single one-shot non-interactive session: run everything in the FOREGROUND, do NOT edit source code, do NOT open a normal steward/* PR. The ONLY action you may take is opening a REVERT PR on a knowingly-bad merged change (see the injected marching orders); everything else is read-only observation and reporting.

Above this instruction you will find a "## Post-merge verification" section that lists the done-set (PR numbers already terminal — SKIP those) and the current in-flight verification queue. Your job for each recently-merged steward PR NOT in the done-set is:

1) In /workspace, gather the last 20 merged steward PRs authored by you:
   `gh pr list --author "@me" --state merged --limit 20 --json number,title,url,mergeCommit,body,mergedAt`
   Filter out any PR whose `number` is in the injected done-set — do not re-probe them.

2) For each remaining PR:
   a. Extract its verify probe declaration from the PR body: look for a fenced ```tdsk-verify``` block. The block content is a single JSON object like {"kind":"health","params":{"url":"/_/health"}}. If the block is absent or malformed, use the DEFAULT probe {"kind":"ci-green"}.
   b. Run the probe READ-ONLY, in-pod, per its kind:
      - health          → `curl -fsS https://px.threadedstack.app${params.url:-/_/health}` and assert the JSON body's `.status == "ok"` (or a 2xx response — match how the endpoint returns success).
      - ci-green        → `gh run list --branch main --limit 5 --json conclusion,status,headSha`; assert the LATEST completed run's `conclusion` is `success`.
      - marker-advanced → `git fetch origin main production`; then `git merge-base --is-ancestor <mergeCommit.oid> origin/production`; regressed if that command returns non-zero AFTER the deploy window (allow ~`params.graceMinutes ?? 15` minutes past `mergedAt` before flagging).
      - assertion       → `sh -c "<params.command>"`; expect exit 0.
   c. Classify the outcome:
      - probe passed → status:'verified', detail is a one-line pass summary.
      - probe failed → status:'regressed'. You MUST open the revert PR NOW, wait for its CI to pass, then MERGE it yourself, using the exact recipe injected above (git checkout -b steward/revert-pr<N>-<short> origin/main; git show --first-parent <mergeSha> | git apply -R --index --3way; git commit; git push; gh pr create --base main; wait for CI green; gh pr merge <revertPr> --admin --squash). `--first-parent` makes a merge commit emit its net squashed diff, so the revert cleanly applies whether the bad merge was single-parent (squash) or a 2-parent merge commit; `git show` alone reverts NOTHING on a 2-parent merge. Reverting a PROVEN regression is an emergency action, so the VERIFY cycle self-merges it: post-cutover there is no adversary review or steward pr-response cycle to service a `steward/revert-*` PR, and leaving a proven regression live is worse than a self-merged revert. Never `git revert`. Never rewrite history. Include the returned revert PR URL as `revertPrUrl` in your result entry. The backend will file a target:'app' escalation citing that revert URL; do not duplicate.

3) End your report with EXACTLY ONE fenced block containing an entry PER PR YOU PROBED THIS CYCLE (0 to VerifyLookbackPrs entries):

```tdsk-verify-results
[{"prNumber":123,"mergeSha":"<full merge commit sha>","status":"verified|regressed","detail":"<one line>","revertPrUrl":"<the revert PR URL if regressed, else omit>"}]
```

Rules:
- Valid JSON array. Omit the block entirely when there were 0 PRs to probe this cycle (all in done-set).
- `prNumber` MUST match the merged PR number exactly.
- `status` MUST be exactly `verified` or `regressed`.
- `revertPrUrl` is REQUIRED when status is `regressed` — record the URL of the revert PR you opened (and self-merged, once its CI passed); the backend uses it to auto-file the escalation. If you cannot open or merge a revert PR (conflict, missing perms, revert CI red), still emit the entry with status `regressed`, omit `revertPrUrl`, and put the reason in `detail`; the backend will file the escalation without a revert URL and rely on manual follow-up.
- Server-side, each terminal result upserts the `verifications` row and writes a durable memory ("PR #N verify verified/regressed → revert <url>") so this loop is idempotent across cycles.

If a probe kind is one you cannot execute (e.g. a bespoke assertion command that requires tools you don't have), classify the entry as regressed with a detail explaining the shortfall — better a false regression that opens (and self-merges) a revert PR than silently letting a bad deploy stand.

