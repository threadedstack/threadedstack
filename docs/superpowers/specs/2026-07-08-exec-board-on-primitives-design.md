# Exec-Board on Primitives — Design

**Status:** Design (2026-07-08).
**Part of:** the platform-generalization effort (dogfooding). Sequence: ① Collections/Records (live) →
② unified `invoke` effect surface (live) → ③ generic context injection (`contextSources`, shipped in ①) →
**this: express + activate the AI executive board (CEO/CTO/CMO) purely on the primitives** →
then migrate the live dev-loop the same way. This is the step where the executives actually run, as a
consumer app built on platform primitives — with **zero** exec-specific platform code left behind.

This sub-project is deliberately split from the live-dev-loop migration:
- **⑤a (this spec):** the exec-board is currently **dormant** (`ceo-strategy`/`ceo-board`/`cto-board` ship
  `enabled:false`). Rebuilding it as config-on-primitives and turning it on does **not** touch the running
  steward/adversary loop, so it is low-risk and independently shippable.
- **⑤b (later spec):** migrate the *live* dev-loop off its hard-coded `persist*` path onto the same
  primitives. Higher risk (touches the running system); its own spec after ⑤a proves the pattern.

## 1. Why

The exec-board today is welded into the platform: use-case tables (`decision_proposals`,
`decision_positions`, `company_strategies`), 4 hard-coded effect handlers in `executor.ts`
(`persistDecisions`/`persistDecisionPositions`/`persistStrategy`/`persistInitiativeComplete`), the
`resolveBoard` consensus engine, board-membership constants (`CeoAgentId`, `BoardCtoAgentId`,
`isCeoSchedule`/`isCtoSchedule`/`isBoardMemberSchedule`, `getBoardMembers`), and context builders
(`buildCompanyStrategyContext`, `buildBusinessMetricsContext`). None of it is reusable — a consumer
cannot build their own executive board without editing the platform.

The primitives now exist to hold all of it as **data + config**: Collections (①) for the tables, the
`invoke` effect surface (②) for the effects, `contextSources` (③) for the context, and Agent/Schedule
config for membership and cadence. This spec expresses the board on those primitives and activates it —
proving the dogfooding thesis (another consumer could build the identical thing), and leaving the
platform with no exec-specific code once the hard-coded handlers are retired.

## 2. Scope

### In scope (⑤a)
- Model the board's state as **Collections** in the exec project: `board_members`, `decision_proposals`,
  `decision_positions`, `company_strategy` (one record).
- Reimplement the 5 effects as **consumer Functions** invoked via the ② `tdsk-actions` surface:
  `openDecision`, `postPosition`, `upsertStrategy`, `reportInitiativeComplete`, `resolveBoard`.
- Replace board-membership constants + role gates with **records** in `board_members` (each `{ agentId,
  role, isCEO }`), read by the Functions — no `agentId === constant` checks.
- Replace the context builders with **`contextSources`** entries on the board schedules (Company
  Strategy, Open decisions; Business metrics handled per §6).
- Point the 3 board schedules at the Functions (via `actions` allowlist) + the `contextSources`, seed
  the CEO agent, and **activate** (enable the schedules) — behind the outward-action safety gate (§9).
- Retire the now-unused hard-coded exec handlers/constants/builders **after** the primitive-based board
  is verified live (they are exec-specific; removing them does not touch the dev-loop).

### Out of scope
- The live dev-loop migration (⑤b) — separate spec.
- **CMO — split by capability, not deferred wholesale:**
  - *Board participation* (a third `board_members` record + its own schedule; deliberating, voting, and
    **drafting** marketing strategy/campaigns into a Collection) needs **no new platform code** and can
    ride on this sub-project — it uses the same Collections + Functions as CEO/CTO, draft-first.
  - *Outward marketing* (actually **sending** email/social/ads) stays a **separate, later, gated effort**
    — unchanged from the original "SP2 sends" plan — because it needs external **connectors + providers +
    send Functions** that do not exist yet and is hard-to-reverse/outward-facing. It lives behind the §8
    safety gate and is out of scope here.
- No new primitive: this is built entirely on ①②③ + Agent/Schedule config. §4–§8 confirm ④
  ("coordination/roles") collapses into "shared Collections + a `resolveBoard` Function + membership
  records," so no separate coordination primitive is introduced.

### Non-goals
- Not changing consensus/tiebreak/completion-gate *semantics* — the same rules move from hard-coded code
  into a Function. Behavior parity is a test requirement.
- Not enabling real outward sends in this sub-project (draft-first; §9).

## 3. Architecture

```mermaid
flowchart TB
  subgraph ExecProject[Exec project — consumer app on primitives]
    subgraph Collections[Collections ①]
      BM[board_members\n{agentId, role, isCEO}]
      DP[decision_proposals]
      POS[decision_positions]
      CS[company_strategy (1 record)]
    end
    subgraph Functions[Functions — invoked via ② tdsk-actions]
      F1[openDecision] --> DP
      F2[postPosition] --> POS
      F3[upsertStrategy] --> CS
      F4[reportInitiativeComplete] --> CS
      F5[resolveBoard] --> DP & CS & POS & BM
    end
  end
  CEO[CEO agent ag_ceo0001] -->|tdsk-actions| Functions
  CTO[CTO = steward agent ag_lvUbjp_] -->|tdsk-actions| Functions
  Collections -->|contextSources ③| Prompt[board cycle prompt]
```

Every board cycle is an ordinary agent run: `contextSources` inject the current strategy + open decisions
into the prompt, the executive emits a `tdsk-actions` block, and the ② dispatcher invokes the board
Functions, which read/write the Collections via the ① `records` capability. `resolveBoard` runs as one
of those Functions on a resolution schedule. No exec-specific platform code is on the path.

## 4. Collections (data model)

All in the exec project (`board_members`, `decision_proposals`, `decision_positions`, `company_strategy`),
each with an optional schema so writes are validated (mirrors the hard-coded columns 1:1):

- **`board_members`** — one record per member: `{ agentId, role: 'ceo'|'cto'|'cmo', isCEO: boolean }`.
  Seeded with CEO (`ag_ceo0001`, isCEO:true) + CTO (`ag_lvUbjp_`). This *is* `getBoardMembers()` as data.
- **`decision_proposals`** — `{ title, axis: 'segment'|'positioning'|'pricing'|'active-initiative'|
  'resource-bet'|'other', description, evidence: string[], status: 'open'|'deliberating'|'committed'|
  'tiebroken'|'rejected'|'aborted', round: number, resolution?, resolvedRef?, openedByAgentId }`.
- **`decision_positions`** — `{ proposalId, agentId, stance: 'endorse'|'object'|'amend', reasoning,
  round }`. Uniqueness (proposalId, agentId, round) enforced by an upsert key convention in `postPosition`.
- **`company_strategy`** — exactly one record: `{ northStar, segments: string[], positioning, backlog:
  {title, rationale, priority}[], activeInitiative: { title, definitionOfDone, evidence: string[],
  status: 'active'|'complete'|'aborted', committedAt }|null }`.

Relations are by id fields (a position references a proposal's record id), resolved by query — the
document-oriented pattern ① established.

## 5. Effect Functions (invoked via ② `tdsk-actions`)

Each hard-coded handler becomes a project Function whose body uses the ① `records` capability. The board
prompts emit a single `tdsk-actions` block instead of the four bespoke `tdsk-*` fences; each schedule's
`actions` allowlist names exactly the Functions that role may invoke.

| Function | Replaces | Behavior (parity with today) |
|---|---|---|
| `openDecision` | `persistDecisions` | Upsert a `decision_proposals` record (dedupe by title within project); caller must be a `board_members` record. |
| `postPosition` | `persistDecisionPositions` | Upsert a `decision_positions` record for (proposal, caller, current round); only on `open`/`deliberating` proposals; caller must be a board member. |
| `upsertStrategy` | `persistStrategy` | Patch the single `company_strategy` record (northStar/segments/positioning/backlog, last-write-wins); **only if caller.isCEO**; never touches `activeInitiative`. |
| `reportInitiativeComplete` | `persistInitiativeComplete` | Validate report title == frozen initiative title, status active, evidence non-empty; mark initiative `complete`; promote next backlog item or clear; **only if caller.role=='cto'**. |
| `resolveBoard` | `resolveBoard.ts` | Load open proposals + latest positions per member from Collections; apply consensus / round-advance (`BoardMaxRounds`=3) / CEO-tiebreak / commit effects (active-initiative freeze, stop-the-line abort rules) exactly as today; write results back to `decision_proposals` + `company_strategy`. |

The role gates (`isCEO`, `role=='cto'`, "is a board member") become **lookups in `board_members`**, passed
to the Function as `args` (the caller's agentId) or resolved inside the Function via the records
capability — not `agentId === CeoAgentId` constants.

**How `resolveBoard` is invoked** (pinned): the CEO board cycle **closes by emitting `resolveBoard` in its
own `tdsk-actions` block** — so resolution stays coupled to the CEO deliberation cycle exactly as the
current `if (isCeoSchedule(schedule)) await resolveBoard(...)` does, but through the ② surface instead of
a hard-coded executor branch. `resolveBoard` is on the CEO board schedule's `actions` allowlist. (No
separate resolution schedule — keeping it one cycle preserves today's timing and ordering.)

### 5.1 Trusted caller identity (a small additive extension to ②)
The role gates (`isCEO` for `upsertStrategy`, `role=='cto'` for `reportInitiativeComplete`, "is a board
member" for `openDecision`/`postPosition`) must key off **who actually invoked the Function**, and that
identity must be **trusted** — it cannot come from the model's own `tdsk-actions` output (a prompt could
claim any agentId). Today ② passes only the block's `args` into `context.args`. This sub-project extends
② additively: the platform injects a **trusted `context.caller`** — `{ agentId, scheduleId }` taken from
the invoking run (`dispatchActions` already receives `agentId` + `schedule`; the live `invoke` tool uses
the running agent's own id) — into the Function context, alongside `args`, never from model output. The
board Functions resolve the caller's `board_members` record from `context.caller.agentId` and enforce
role gates against it. `TFunctionContext` gains an optional `caller?: { agentId?: string; scheduleId?:
string }`; `invokeAction`/`dispatchActions`/`createInvokeProvider` thread it through; the isolate receives
it as plain data (no capability). This is generic — any consumer's effect Function can authorize by
caller — and inert for existing callers (they simply pass no `caller`).

## 6. Context injection (`contextSources`)

The board schedules carry `contextSources` entries (③) instead of the hard-coded builders:
- **Company Strategy** → `{ collection: 'company_strategy', query: {}, as: 'Company Strategy' }`.
- **Open board decisions** → `{ collection: 'decision_proposals', query: { where: [{ field:'status',
  op:'in', value:['open','deliberating'] }] }, as: 'Open board decisions' }` (this is the builder the
  mapping flagged as never actually implemented — it lands natively here).
- **Business metrics** → the one genuinely computed context (subscriptions/MRR/signups/churn aggregated
  across platform tables) stays a small platform helper for now, injected the same additive way; it is
  read-only telemetry, not board state, so it is **not** forced into a Collection in ⑤a. (A later step can
  publish a `business_metrics` snapshot Collection via a scheduled Function if we want it fully generic.)

## 7. Activation

- Seed the CEO agent (`ag_ceo0001`) + its sandbox as data (already drafted in `fullorg.ts`, currently
  inert).
- Create the 4 Collections + seed `board_members` (CEO+CTO) + seed the single `company_strategy` record.
- Create the 5 Functions in the exec project.
- Update the 3 board schedules: set `actions` allowlists + `contextSources`; keep prompts (already
  git-versioned) but swap the emitted fences to a single `tdsk-actions` block.
- **Enable** the schedules (flip `enabled:true`) — behind §9.

## 8. Safety gate (outward actions)

The board **deliberates, decides, and records** on the primitives with no gate — that is all internal
state. What stays gated is any **outward, hard-to-reverse action** (sending email/outreach, spending,
posting externally). Per the SP1 design ("drafts, doesn't send"), ⑤a ships the board in **draft-first**
mode: outreach is written to a Collection/artifact, never sent. Turning on real sends is a **separate,
explicitly-disclosed go** (its own Function + connector + an activation checkpoint), never a silent flip.

## 9. Migration / rollout (additive, then retire)

1. **Additive build** — Collections + Functions + schedule config land while the hard-coded exec handlers
   still exist and the schedules are still `enabled:false`. Nothing changes for anyone.
2. **Parity tests** — unit + integration proving each Function reproduces its handler's behavior
   (consensus, tiebreak, active-initiative freeze, completion gate, stop-the-line abort).
3. **Activate** — enable the board schedules; the board runs entirely on primitives. Observe a full
   decision open → deliberate → resolve → strategy-update cycle.
4. **Retire** — once the primitive-based board is verified live, delete the hard-coded exec handlers
   (`persistDecisions`/`persistDecisionPositions`/`persistStrategy`/`persistInitiativeComplete`), the
   `resolveBoard` executor call + constants, and the exec context builders. These are exec-specific;
   removing them does not touch the dev-loop's own (still hard-coded) handlers — those come off in ⑤b.
   Their tables can be dropped after the data is migrated into the Collections (or left dormant if a
   drop is deferred for safety).

## 10. Testing

- **Unit (Functions):** each of the 5 Functions against a records-mock (parity with the handler it
  replaces — reuse the ①/② mocked FunctionExecutor harness).
- **Unit (resolveBoard Function):** consensus commit, round advance, CEO endorse-tiebreak / object-reject,
  active-initiative freeze (block mid-flight), stop-the-line abort (all-non-CEO-endorse + wind-down), and
  completion promotion — mirroring the existing `resolveBoard.test.ts` cases.
- **Integration:** a full board cycle — CEO opens a decision (tdsk-actions → openDecision), CEO+CTO post
  positions, resolveBoard commits it, strategy record updates, and `contextSources` inject the new state
  into the next cycle's prompt.
- **Parity:** a test asserting the primitive path produces the same `decision_proposals`/`company_strategy`
  end-state as the hard-coded path for a fixed scenario, before retiring the handlers.
- **Bar:** `pnpm types` + `test` green on every touched repo; additive migration; the live dev-loop
  untouched (its hard-coded handlers unchanged until ⑤b).
