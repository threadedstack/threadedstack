# Stripe Migration & Plan Simplification — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Polar.sh with Stripe for payments, simplify 12 quota resources to 6 org-scoped counters + 2 tier properties, rename tiers to Free/Solo/Pro/Team, add seat-based pricing.

**Architecture:** Strategy pattern preserved (StripeService replaces PolarService, ConsoleService updated for new abstract interface). `PlanLimits` in domain is single source of truth for all tier limits. Quotas tracked per-org per-period with atomic SQL upserts. Stripe hosted checkout for first subscribe, in-place subscription updates for upgrades/downgrades.

**Tech Stack:** Stripe SDK (`stripe` npm), Drizzle ORM, Express 5, Jotai, React/MUI, Vitest

**Spec:** `docs/superpowers/specs/2026-04-03-stripe-migration-design.md`

**CRITICAL RULES (include in ALL subagent prompts):**
- NEVER commit, amend, or change git history. User handles all commits.
- NEVER leave TODO/FIXME comments. Implement fully or explain why you can't.
- NEVER use fake/test API keys in integration tests.
- Run `pnpm test` + `pnpm types` at each phase boundary (phases 1-5).
- Read files before modifying — never overwrite without reading first.

---

## Chunk 1: Domain — Types, Models, Constants

### Task 1: Create PlanLimits config and TPlanLimits type

**Files:**
- Create: `repos/domain/src/constants/plans.ts`
- Modify: `repos/domain/src/constants/index.ts` (append export — file already exists with other exports)
- Test: `repos/domain/src/constants/plans.test.ts`

**NOTE:** Tasks 1 and 2 must be implemented together — Task 1's code depends on `TPlanLimits` and `ESubscriptionTier` which are updated in Task 2.

- [ ] **Step 1: Write failing tests for PlanLimits**

Create `repos/domain/src/constants/plans.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { PlanLimits } from './plans'
import { ESubscriptionTier } from '@TDM/types'

describe('PlanLimits', () => {
  it('defines all four tiers', () => {
    const tierKeys = Object.keys(PlanLimits)
    expect(tierKeys).toEqual(['free', 'solo', 'pro', 'team'])
    for (const tier of Object.values(ESubscriptionTier)) {
      expect(PlanLimits[tier]).toBeDefined()
    }
  })

  it('free tier has strictest limits', () => {
    const free = PlanLimits.free
    expect(free.projects).toBe(2)
    expect(free.compute).toBe(1_000)
    expect(free.threads).toBe(100)
    expect(free.messages).toBe(500)
    expect(free.endpoints).toBe(3)
    expect(free.secrets).toBe(5)
    expect(free.retention).toBe(7)
    expect(free.organizations).toBe(1)
    expect(free.seats).toBe(1)
    expect(free.additionalSeats).toBe(false)
  })

  it('solo tier does not allow additional seats', () => {
    expect(PlanLimits.solo.additionalSeats).toBe(false)
    expect(PlanLimits.solo.seats).toBe(1)
  })

  it('pro tier allows additional seats', () => {
    expect(PlanLimits.pro.additionalSeats).toBe(true)
    expect(PlanLimits.pro.seats).toBe(3)
  })

  it('team tier has unlimited (-1) for most resources', () => {
    const team = PlanLimits.team
    expect(team.organizations).toBe(-1)
    expect(team.projects).toBe(-1)
    expect(team.compute).toBe(-1)
    expect(team.threads).toBe(-1)
    expect(team.messages).toBe(-1)
    expect(team.endpoints).toBe(-1)
    expect(team.secrets).toBe(-1)
    expect(team.seats).toBe(10)
    expect(team.additionalSeats).toBe(true)
  })

  it('no tier has negative values except -1 for unlimited', () => {
    for (const [, limits] of Object.entries(PlanLimits)) {
      for (const [key, value] of Object.entries(limits)) {
        if (key === 'additionalSeats') continue
        expect(value === -1 || (value as number) > 0, `${key} must be -1 or positive`).toBe(true)
      }
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd repos/domain && npx vitest run src/constants/plans.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create PlanLimits config**

Create `repos/domain/src/constants/plans.ts`:

```typescript
import type { TPlanLimits } from '@TDM/types'
import { ESubscriptionTier } from '@TDM/types'

export const PlanLimits: Record<ESubscriptionTier, TPlanLimits> = {
  [ESubscriptionTier.free]: { organizations: 1, projects: 2, compute: 1_000, threads: 100, messages: 500, endpoints: 3, secrets: 5, retention: 7, seats: 1, additionalSeats: false },
  [ESubscriptionTier.solo]: { organizations: 2, projects: 10, compute: 10_000, threads: 1_000, messages: 10_000, endpoints: 20, secrets: 25, retention: 30, seats: 1, additionalSeats: false },
  [ESubscriptionTier.pro]: { organizations: 5, projects: 50, compute: 100_000, threads: -1, messages: -1, endpoints: -1, secrets: -1, retention: 90, seats: 3, additionalSeats: true },
  [ESubscriptionTier.team]: { organizations: -1, projects: -1, compute: -1, threads: -1, messages: -1, endpoints: -1, secrets: -1, retention: 365, seats: 10, additionalSeats: true },
} as const
```

Append to existing `repos/domain/src/constants/index.ts` (which already exports `./values` and `./providers`):

```typescript
export * from './plans'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd repos/domain && npx vitest run src/constants/plans.test.ts`
Expected: PASS

Note: `TPlanLimits` type and updated `ESubscriptionTier` don't exist yet — the test will fail until Task 2 completes. Implement Tasks 1-2 together if needed.

---

### Task 2: Update payment types

**Files:**
- Modify: `repos/domain/src/types/payments.types.ts`

- [ ] **Step 1: Read current file, then replace contents**

Replace `repos/domain/src/types/payments.types.ts` entirely:

```typescript
export type TPayPlans = Record<string, string>

export enum ESubscriptionTier {
  free = `free`,
  solo = `solo`,
  pro = `pro`,
  team = `team`,
}
export type TSubscriptionTier = `${ESubscriptionTier}`

export enum ESubscriptionStatus {
  active = `active`,
  canceled = `canceled`,
  past_due = `past_due`,
  incomplete = `incomplete`,
  trialing = `trialing`,
}
export type TSubscriptionStatus = `${ESubscriptionStatus}`

export type TPlanLimits = {
  organizations: number
  projects: number
  compute: number
  threads: number
  messages: number
  endpoints: number
  secrets: number
  retention: number
  seats: number
  additionalSeats: boolean
}
```

Removed: `TPayPlanRaw`, `TPayPlanMeta`, type aliases (`TTimeInSeconds` etc.)

- [ ] **Step 2: Verify no type errors in domain**

Run: `cd repos/domain && pnpm types`
Expected: Will have errors from files still importing removed types (Plan model, utils). Fix in following tasks.

---

### Task 3: Update Subscription model

**Files:**
- Modify: `repos/domain/src/models/subscription.ts`

- [ ] **Step 1: Read current file, then update**

Replace `repos/domain/src/models/subscription.ts`:

```typescript
import { ESubscriptionTier, ESubscriptionStatus } from '../types/payments.types'
import { Base } from './base'

export class Subscription extends Base {
  tier: string = ESubscriptionTier.free
  status: string = ESubscriptionStatus.active
  userId: string
  seats: number = 1
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  stripePriceId?: string
  currentPeriodEnd?: string
  currentPeriodStart?: string
  cancelAtPeriodEnd?: boolean

  constructor(sub: Partial<Subscription>) {
    super()
    Object.assign(this, sub)
  }
}
```

Changes: `polarId` → removed, `polarPriceId` → `stripePriceId`, `polarCustomerId` → `stripeCustomerId`, added `stripeSubscriptionId`, `seats` default `0` → `1`.

---

### Task 4: Update Quota model

**Files:**
- Modify: `repos/domain/src/models/quota.ts`

- [ ] **Step 1: Read current file, then update**

Replace `repos/domain/src/models/quota.ts`:

```typescript
import { Base } from './base'

export class Quota extends Base {
  orgId: string
  period: string
  projects: number = 0
  compute: number = 0
  threads: number = 0
  messages: number = 0
  endpoints: number = 0
  secrets: number = 0

  constructor(quota: Partial<Quota>) {
    super()
    Object.assign(this, quota)
  }
}
```

Removed: `price`, `members`, `runtime`, `retention`, `orgSecrets`, `functionCalls`, `organizations`, `projectSecrets`.

---

### Task 5: Update Plan model

**Files:**
- Modify: `repos/domain/src/models/plan.ts`

- [ ] **Step 1: Read current file, then replace**

Replace `repos/domain/src/models/plan.ts`:

```typescript
import type { TPlanLimits } from '@TDM/types'

export class Plan {
  id: string
  name: string
  price: number
  limits: TPlanLimits

  constructor(opts: Partial<Plan>) {
    Object.assign(this, opts)
  }
}
```

Removed: `TPlanOpts`, `TRecurring`, `description`, `recurring`, `metadata`, `rawPlanToMeta` import.

---

### Task 6: Create Invoice model

**Files:**
- Create: `repos/domain/src/models/invoice.ts`
- Modify: `repos/domain/src/models/index.ts` (add export)

- [ ] **Step 1: Create Invoice model**

Create `repos/domain/src/models/invoice.ts`:

```typescript
import { Base } from './base'

export class Invoice extends Base {
  userId: string
  stripeInvoiceId: string
  amount: number = 0
  currency: string = `usd`
  status: string = `draft`
  invoiceUrl?: string
  period: string

  constructor(invoice: Partial<Invoice>) {
    super()
    Object.assign(this, invoice)
  }
}
```

- [ ] **Step 2: Add export to models index**

Add `export * from './invoice'` to `repos/domain/src/models/index.ts`.

---

### Task 7: Remove Polar payment utilities

**Files:**
- Delete: `repos/domain/src/utils/payments/rawPlanToMeta.ts`
- Delete: `repos/domain/src/utils/payments/rawPlanToMeta.test.ts`
- Delete: `repos/domain/src/utils/payments/index.ts`
- Modify: `repos/domain/src/utils/index.ts` (remove payments re-export if present)
- Keep: `repos/domain/src/utils/payments/parsePayPlans.ts` (still used by backend config)
- Keep: `repos/domain/src/utils/payments/parsePayPlans.test.ts`

- [ ] **Step 1: Delete rawPlanToMeta files**

Delete `repos/domain/src/utils/payments/rawPlanToMeta.ts` and `repos/domain/src/utils/payments/rawPlanToMeta.test.ts`.

- [ ] **Step 2: Update payments barrel export**

Replace `repos/domain/src/utils/payments/index.ts`:

```typescript
export * from './parsePayPlans'
```

- [ ] **Step 3: Verify utils index still exports payments**

Read `repos/domain/src/utils/index.ts` and ensure `export * from './payments'` is still present (for `parsePayPlans`).

---

### Task 8: Verify constants export from domain barrel

**Files:**
- Verify: `repos/domain/src/index.ts`

- [ ] **Step 1: Verify export exists**

Read `repos/domain/src/index.ts` and confirm it already contains `export * from './constants'` (it should — this file already exists). If missing, add it. This ensures other repos can import `PlanLimits` via `@tdsk/domain`.

---

### Task 9: Run domain validation

- [ ] **Step 1: Run all domain tests**

Run: `cd repos/domain && pnpm test`
Expected: All tests pass (parsePayPlans tests still work, new PlanLimits tests pass, rawPlanToMeta tests removed).

- [ ] **Step 2: Run domain type check**

Run: `cd repos/domain && pnpm types`
Expected: Clean — all types resolve.

---

## Chunk 2: Database — Schemas, Services, Converters

### Task 10: Update subscriptions schema

**Files:**
- Modify: `repos/database/src/schemas/subscriptions.ts`

- [ ] **Step 1: Read current file, then update**

Replace the Polar columns section (lines 17-20) with Stripe columns:

```typescript
  // Stripe Integration
  stripeCustomerId: text(`stripe_customer_id`),
  stripeSubscriptionId: text(`stripe_subscription_id`),
  stripePriceId: text(`stripe_price_id`),
```

Change `seats` default from `0` to `1` (line 27):

```typescript
  seats: integer(`seats`).default(1),
```

---

### Task 11: Update quotas schema

**Files:**
- Modify: `repos/database/src/schemas/quotas.ts`

- [ ] **Step 1: Read current file, then replace column definitions**

Replace lines 15-27 (the column definitions after `period`) with:

```typescript
    projects: integer(`projects`).default(0).notNull(),
    compute: integer(`compute`).default(0).notNull(),
    threads: integer(`threads`).default(0).notNull(),
    messages: integer(`messages`).default(0).notNull(),
    endpoints: integer(`endpoints`).default(0).notNull(),
    secrets: integer(`secrets`).default(0).notNull(),
```

Removed: `price`, `retention`, `organizations`, `members`, `functionCalls`, `runtime`, `orgSecrets`, `projectSecrets`, `activeSandboxes`.

---

### Task 12: Create invoices schema

**Files:**
- Create: `repos/database/src/schemas/invoices.ts`
- Modify: `repos/database/src/schemas/schemas.ts` (add export)

- [ ] **Step 1: Create invoices schema**

Create `repos/database/src/schemas/invoices.ts`:

```typescript
import { base } from '@TDB/utils/schema/base'
import { users } from '@TDB/schemas/users'
import { relations } from 'drizzle-orm'
import { pgTable, text, integer, uuid } from 'drizzle-orm/pg-core'

export const invoices = pgTable(`invoices`, {
  ...base,
  userId: uuid(`user_id`)
    .references(() => users.id, { onDelete: `cascade` })
    .notNull(),
  stripeInvoiceId: text(`stripe_invoice_id`).notNull().unique(),
  amount: integer(`amount`).default(0).notNull(),
  currency: text(`currency`).default(`usd`).notNull(),
  status: text(`status`).notNull(),
  invoiceUrl: text(`invoice_url`),
  period: text(`period`).notNull(),
})

export const invoicesRelations = relations(invoices, ({ one }) => ({
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
}))
```

- [ ] **Step 2: Add to schemas barrel export**

Add `export * from './invoices'` to `repos/database/src/schemas/schemas.ts`.

---

### Task 13: Update Subscription database service

**Files:**
- Modify: `repos/database/src/services/subscription.ts`

- [ ] **Step 1: Read current file, then replace findByPolarId with Stripe equivalents**

Replace the `findByPolarId` method (lines 44-60) with two new methods:

```typescript
  findByStripeSubscriptionId = async (stripeSubscriptionId: string) => {
    try {
      const [data] = await this.db
        .select()
        .from(this.table)
        .where(eq(this.table.stripeSubscriptionId, stripeSubscriptionId))

      if (!data) return { error: new DBError(`Subscription not found`) }

      return { data: this.model(data) }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  findByStripeCustomerId = async (stripeCustomerId: string) => {
    try {
      const [data] = await this.db
        .select()
        .from(this.table)
        .where(eq(this.table.stripeCustomerId, stripeCustomerId))

      if (!data) return { error: new DBError(`Subscription not found`) }

      return { data: this.model(data) }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }
```

---

### Task 14: Update Quota database service

**Files:**
- Modify: `repos/database/src/services/quota.ts`

- [ ] **Step 1: Update TIncrementKey type**

Replace lines 9-21:

```typescript
type TIncrementKey = keyof Pick<
  TDBQuotaSelect,
  | 'projects'
  | 'compute'
  | 'threads'
  | 'messages'
  | 'endpoints'
  | 'secrets'
>
```

- [ ] **Step 2: Add decrement method**

Add after the `increment` method (after line 88):

```typescript
  async decrement(orgId: string, period: string, key: TIncrementKey, amount = 1) {
    try {
      if (amount <= 0) throw new DBError(`Quota decrement amount must be positive`)

      const column = this.table[key]
      if (!column) throw new DBError(`Invalid quota key: ${key}`)

      const [data] = await this.db
        .update(this.table)
        .set({
          updatedAt: new Date(),
          [key]: sql`GREATEST(${column} - ${amount}, 0)`,
        })
        .where(and(eq(this.table.orgId, orgId), eq(this.table.period, period)))
        .returning()

      if (!data) return { data: null }

      return { data: this.model(data as TDBQuotaSelect) }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }
```

- [ ] **Step 3: Simplify initializePeriod**

Replace the `initializePeriod` method (lines 94-128):

```typescript
  async initializePeriod(orgId: string, period: string) {
    try {
      const [data] = await this.db
        .insert(this.table)
        .values({
          orgId,
          period,
          projects: 0,
          compute: 0,
          threads: 0,
          messages: 0,
          endpoints: 0,
          secrets: 0,
        })
        .onConflictDoNothing()
        .returning()

      if (!data) return this.getUsage(orgId, period)

      return { data: this.model(data as TDBQuotaSelect) }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }
```

---

### Task 15: Create Invoice database service

**Files:**
- Create: `repos/database/src/services/invoice.ts`
- Modify: `repos/database/src/services/index.ts` (add export + instantiation)

- [ ] **Step 1: Create Invoice service**

Create `repos/database/src/services/invoice.ts`:

```typescript
import type { TServiceOpts, TDBInvoiceSelect, TDBInvoiceInsert } from '@TDB/types'

import { eq } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { invoices } from '@TDB/schemas/invoices'
import { Invoice as InvoiceModel } from '@tdsk/domain'

export class Invoice extends Base<typeof invoices, TDBInvoiceSelect, TDBInvoiceInsert> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: invoices })
  }

  model = (data: TDBInvoiceSelect) => new InvoiceModel(data as Partial<InvoiceModel>)

  async findByUserId(userId: string) {
    try {
      const data = await this.db
        .select()
        .from(this.table)
        .where(eq(this.table.userId, userId))
        .orderBy(this.table.createdAt)

      return { data: data.map((row) => this.model(row as TDBInvoiceSelect)) }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  async upsertByStripeId(stripeInvoiceId: string, data: Partial<TDBInvoiceInsert>) {
    try {
      const [result] = await this.db
        .insert(this.table)
        .values({ ...data, stripeInvoiceId } as TDBInvoiceInsert)
        .onConflictDoUpdate({
          target: [this.table.stripeInvoiceId],
          set: { ...data, updatedAt: new Date() },
        })
        .returning()

      return { data: this.model(result as TDBInvoiceSelect) }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }
}
```

- [ ] **Step 2: Add Invoice to services index**

Read `repos/database/src/services/index.ts` and add the Invoice service instantiation following the existing pattern for Subscription and Quota services.

---

### Task 16: Update database types

**Files:**
- Modify: `repos/database/src/types/schema.types.ts` (or wherever `TDBQuotaSelect`/`TDBSubscriptionSelect` are defined)

- [ ] **Step 1: Read the schema types file and add Invoice types**

Read `repos/database/src/types/schema.types.ts`. Following the existing pattern for subscriptions and quotas, add:

```typescript
import { invoices } from '@TDB/schemas/invoices'

export type TDBInvoiceSelect = typeof invoices.$inferSelect
export type TDBInvoiceInsert = typeof invoices.$inferInsert
```

Also add `TDBInvoiceSelect` and `TDBInvoiceInsert` to any union types (e.g., `TDBEntitySelect`, `TDBEntityInsert`) if the pattern requires it. The exact additions depend on the file structure — read first, then follow the established pattern exactly.

---

### Task 17: Update database seed data

**Files:**
- Modify: `repos/database/src/seeds/fullorg.ts`

- [ ] **Step 1: Update seed subscription data**

Read the file and replace any `polarId`, `polarCustomerId`, `polarPriceId` references with `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId` (set to `undefined` or valid test values).

Update any quota seed data to use the new 6 columns instead of the old 12.

---

### Task 18: Update existing database tests

**Files:**
- Modify: `repos/database/src/services/subscription.test.ts`
- Modify: `repos/database/src/services/quota.test.ts`

- [ ] **Step 1: Update subscription tests**

Read `repos/database/src/services/subscription.test.ts`:
- Replace all `findByPolarId` test cases with `findByStripeSubscriptionId` and `findByStripeCustomerId` tests
- Update mock data: `polarId` → `stripeSubscriptionId`, `polarCustomerId` → `stripeCustomerId`, `polarPriceId` → `stripePriceId`
- Update `seats: 0` defaults to `seats: 1`

- [ ] **Step 2: Update quota tests**

Read `repos/database/src/services/quota.test.ts`:
- Update `TIncrementKey` usage to use new keys (`compute`, `secrets` instead of `runtime`, `functionCalls`, `orgSecrets`, `projectSecrets`)
- Update `initializePeriod` test calls to remove `price` and `retention` params
- Add tests for the new `decrement` method
- Remove tests referencing old columns (`members`, `organizations`, `activeSandboxes`)

---

### Task 19: Run database validation

- [ ] **Step 1: Run all database tests**

Run: `cd repos/database && pnpm test`
Expected: All tests pass.

- [ ] **Step 2: Run database type check**

Run: `cd repos/database && pnpm types`
Expected: Clean.

---

## Chunk 3: Backend — StripeService, Webhooks, Middleware, Endpoints

### Task 20: Update backend payment types

**Files:**
- Modify: `repos/backend/src/types/pay.types.ts`

- [ ] **Step 1: Read current file, then replace**

Replace `repos/backend/src/types/pay.types.ts`:

```typescript
import type { Plan } from '@tdsk/domain'
import type { Exception } from '@tdsk/domain'

export enum EPayType {
  stripe = `stripe`,
  console = `console`,
}

export type TPayType = `${EPayType}`

export type TPayEnv =
  | `sandbox`
  | `ci`
  | `test`
  | `local`
  | `develop`
  | `staging`
  | `production`

export type TStripeConfig = {
  type?: TPayType
  secretKey: string
  webhookSecret: string
  priceIds: Record<string, string>
  seatPriceIds: Record<string, string>
  environment?: TPayEnv
}

export type TPayCustomer = {
  id: string
  email: string
}

export type TPayCheckoutSession = {
  id: string
  url: string
}

export type TPayPortalSession = {
  url: string
}

export type TPlanResp = { data?: Plan[]; error?: Exception }
```

Removed: `TPayConfig`, `TPayProduct`, old `EPayType.polar`. Added: `TStripeConfig`, `EPayType.stripe`.

---

### Task 21: Update backend config

**Files:**
- Modify: `repos/backend/configs/backend.config.ts`

- [ ] **Step 1: Update env var loading**

Replace lines 30-34 (env var destructuring) — remove `TDSK_PAY_PLANS`, `TDSK_PAY_URL`, `TDSK_PAY_WEBHOOK_SECRET`, `TDSK_PAY_ACCESS_TOKEN`. Add:

```typescript
  TDSK_PAY_TYPE,
  TDSK_STRIPE_SECRET_KEY = ``,
  TDSK_STRIPE_WEBHOOK_SECRET = ``,
  TDSK_STRIPE_PRICE_IDS = ``,
  TDSK_STRIPE_SEAT_PRICE_ID_PRO = ``,
  TDSK_STRIPE_SEAT_PRICE_ID_TEAM = ``,
```

- [ ] **Step 2: Update payments config object**

Replace lines 90-97:

```typescript
  payments: {
    type: TDSK_PAY_TYPE as EPayType,
    secretKey: TDSK_STRIPE_SECRET_KEY,
    webhookSecret: TDSK_STRIPE_WEBHOOK_SECRET,
    priceIds: parsePayPlans(TDSK_STRIPE_PRICE_IDS),
    seatPriceIds: {
      pro: TDSK_STRIPE_SEAT_PRICE_ID_PRO,
      team: TDSK_STRIPE_SEAT_PRICE_ID_TEAM,
    },
    environment: process.env.NODE_ENV as TPayEnv,
  },
```

- [ ] **Step 3: Update import**

Remove `parsePayPlans` from import if no longer used, or keep it (it's still used for `TDSK_STRIPE_PRICE_IDS` parsing). Update the `EPayType` import type from `@TBE/types`.

---

### Task 22: Rewrite BaseService abstract class

**Files:**
- Modify: `repos/backend/src/services/payments/strategies/base.ts`

- [ ] **Step 1: Read current file, then replace**

Rewrite with new method signatures matching the spec's StripeService methods table. The abstract methods should be:

```typescript
import type { TStripeConfig, TPayCustomer, TPayCheckoutSession, TPayPortalSession, TPlanResp } from '@TBE/types'
import type { Application } from 'express'

export abstract class BaseService {
  protected config: TStripeConfig

  constructor(config: TStripeConfig) {
    this.config = config
  }

  abstract fetchPlans(): TPlanResp
  abstract createCustomer(email: string, userId: string): Promise<TPayCustomer>
  abstract createCheckoutSession(tier: string, customerId: string, successUrl: string, cancelUrl: string): Promise<TPayCheckoutSession>
  abstract createPortalSession(customerId: string): Promise<TPayPortalSession>
  abstract cancelSubscription(subscriptionId: string): Promise<void>
  abstract updateSubscription(subscriptionId: string, newPriceId: string): Promise<void>
  abstract updateSeatQuantity(subscriptionId: string, quantity: number): Promise<void>
  abstract getInvoices(customerId: string): Promise<any[]>
  abstract constructWebhookEvent(payload: string | Buffer, signature: string): any
  abstract webhook(app: Application, event: any): Promise<void>
}
```

---

### Task 23: Create StripeService

**Files:**
- Create: `repos/backend/src/services/payments/strategies/stripe.ts`
- Create: `repos/backend/src/services/payments/strategies/stripe.test.ts`

- [ ] **Step 1: Write StripeService tests**

Create `repos/backend/src/services/payments/strategies/stripe.test.ts` with mocked Stripe SDK. Test:
- `createCustomer` calls `stripe.customers.create`
- `createCheckoutSession` returns session with URL
- `createPortalSession` returns portal URL
- `cancelSubscription` sets `cancel_at_period_end: true`
- `updateSubscription` updates price with proration
- `updateSeatQuantity` updates subscription item quantity
- `constructWebhookEvent` verifies signature
- `fetchPlans` returns plans from PlanLimits

- [ ] **Step 2: Implement StripeService**

Create `repos/backend/src/services/payments/strategies/stripe.ts`. The service should:
- Import `Stripe` from `stripe` and instantiate with `config.secretKey`
- Implement all abstract methods from `BaseService`
- Use `PlanLimits` from `@tdsk/domain` for `fetchPlans()` (returns static Plan objects, no API call)
- Resolve seat price IDs from `config.seatPriceIds[tier]`
- Webhook handler calls `stripe.webhooks.constructEvent(payload, signature, config.webhookSecret)` and processes events per the spec's webhook events table

- [ ] **Step 3: Run StripeService tests**

Run: `cd repos/backend && npx vitest run src/services/payments/strategies/stripe.test.ts`
Expected: PASS

---

### Task 23b: Update ConsoleService for new BaseService interface

**Files:**
- Modify: `repos/backend/src/services/payments/strategies/console.ts`

- [ ] **Step 1: Read current ConsoleService and rewrite for new abstract methods**

The ConsoleService implements the old `BaseService` methods (`fetchProduct`, `getPlanLimits`, `ensureCustomer`, `createCheckout`, `createPortal`, `validateWebhook`). After Task 22 rewrites `BaseService`, ConsoleService must implement the new abstract methods. Each method should log the operation and return stub data:

- `fetchPlans()` → return plans from `PlanLimits` (same as StripeService)
- `createCustomer(email, userId)` → log + return `{ id: 'console_cus', email }`
- `createCheckoutSession(tier, customerId, successUrl, cancelUrl)` → log + return `{ id: 'console_cs', url: successUrl }`
- `createPortalSession(customerId)` → log + return `{ url: '/billing' }`
- `cancelSubscription(subscriptionId)` → log
- `updateSubscription(subscriptionId, newPriceId)` → log
- `updateSeatQuantity(subscriptionId, quantity)` → log
- `getInvoices(customerId)` → log + return `[]`
- `constructWebhookEvent(payload, signature)` → return parsed JSON payload
- `webhook(app, event)` → log event type

---

### Task 24: Delete PolarService, update factory

**Files:**
- Delete: `repos/backend/src/services/payments/strategies/polar.ts`
- Delete: `repos/backend/src/services/payments/strategies/polar.test.ts`
- Modify: `repos/backend/src/services/payments/payments.ts` (update factory)
- Modify: `repos/backend/src/services/payments/strategies/index.ts`

- [ ] **Step 1: Delete Polar files**

Delete `polar.ts` and `polar.test.ts` from `repos/backend/src/services/payments/strategies/`.

- [ ] **Step 2: Update strategy barrel export**

Update `repos/backend/src/services/payments/strategies/index.ts` to export StripeService instead of PolarService.

- [ ] **Step 3: Update PaymentsService factory**

Read and update `repos/backend/src/services/payments/payments.ts`:
- Replace `EPayType.polar` case with `EPayType.stripe` → `new StripeService(config)`
- Update import from `./strategies/polar` to `./strategies/stripe`
- Update config type from `TPayConfig` to `TStripeConfig`

---

### Task 25: Update webhook endpoint

**Files:**
- Modify: `repos/backend/src/endpoints/payments/webhook.ts`

- [ ] **Step 1: Rewrite webhook handler**

Replace the current Polar webhook handler. The new handler must:
- Accept raw body (not JSON parsed) — configure Express to skip JSON parsing for this route
- Call `payments.service.constructWebhookEvent(rawBody, signature)` to verify
- Pass the verified event to `payments.service.webhook(app, event)`
- Return 200 on success, 400 on signature failure

---

### Task 26: Update subscription endpoints

**Files:**
- Modify: `repos/backend/src/endpoints/subscriptions/createCheckout.ts`
- Modify: `repos/backend/src/endpoints/subscriptions/cancelSubscription.ts`
- Modify: `repos/backend/src/endpoints/subscriptions/getPlans.ts`
- Create: `repos/backend/src/endpoints/subscriptions/updateSubscription.ts`
- Create: `repos/backend/src/endpoints/subscriptions/getInvoices.ts`
- Modify: `repos/backend/src/endpoints/subscriptions/subscriptions.ts` (add new routes)

- [ ] **Step 1: Update createCheckout**

Read and update: change body param from `planId` to `tier`. The endpoint should:
1. Validate tier is a valid `ESubscriptionTier` (not `free`)
2. Check if user already has a Stripe customer — if not, call `createCustomer`
3. If user already has an active subscription, use `updateSubscription` instead
4. Otherwise call `createCheckoutSession(tier, customerId, successUrl, cancelUrl)`
5. Return `{ id, url }`

- [ ] **Step 2: Update cancelSubscription**

Read and update: replace `polarId` check with `stripeSubscriptionId`.

- [ ] **Step 3: Update getPlans**

Read and update: `fetchPlans()` now returns static plans from `PlanLimits` — no API call needed.

- [ ] **Step 3b: Update createPortalSession endpoint**

Read `repos/backend/src/endpoints/subscriptions/createPortalSession.ts`. Update to match new method name (`createPortalSession` instead of `createPortal`). Update to read `stripeCustomerId` from subscription instead of `polarCustomerId`.

- [ ] **Step 3c: Update getCurrentSubscription endpoint**

Read `repos/backend/src/endpoints/subscriptions/getCurrentSubscription.ts`. Verify it returns the updated Subscription model with Stripe fields. Update any references to old Polar field names if present.

- [ ] **Step 4: Create updateSubscription endpoint**

Create `repos/backend/src/endpoints/subscriptions/updateSubscription.ts`:
- `POST /subscriptions/update`
- Body: `{ tier }`
- Validates user has active Stripe subscription
- Resolves new price ID from config
- Calls `payments.service.updateSubscription(subscriptionId, newPriceId)`
- Returns updated subscription

- [ ] **Step 5: Create getInvoices endpoint**

Create `repos/backend/src/endpoints/subscriptions/getInvoices.ts`:
- `GET /subscriptions/invoices`
- Queries invoices table by userId
- Returns array of Invoice models

- [ ] **Step 6: Register new routes**

Add `updateSubscription` and `getInvoices` to the subscriptions router in `subscriptions.ts`.

---

### Task 27: Update quota endpoints for new resource names

**Files:**
- Modify: `repos/backend/src/endpoints/quotas/checkQuota.ts`
- Modify: `repos/backend/src/endpoints/quotas/getOrgLimits.ts`

- [ ] **Step 1: Update checkQuota**

Read and update: replace `payments.service.getPlanLimits(productId)` with `PlanLimits[tier]` lookup from `@tdsk/domain`. Update valid resource names to match the 6 quota counters.

- [ ] **Step 2: Update getOrgLimits**

Read and update: return `PlanLimits[tier]` directly instead of fetching from payment provider.

---

### Task 27b: Create computeUnits helper (domain repo)

**NOTE:** This task modifies the domain repo but lives in Chunk 3 because it's only needed by the backend. Re-run `cd repos/domain && pnpm test && pnpm types` after this task to validate domain.

**Files:**
- Create: `repos/domain/src/utils/payments/computeUnits.ts`
- Create: `repos/domain/src/utils/payments/computeUnits.test.ts`
- Modify: `repos/domain/src/utils/payments/index.ts` (add export)

- [ ] **Step 1: Write tests**

Create `repos/domain/src/utils/payments/computeUnits.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeUnits } from './computeUnits'

describe('computeUnits', () => {
  it('returns 1 for a single call with minimal runtime', () => {
    expect(computeUnits(1, 5_000)).toBe(2) // 1 call + 1 chunk (ceil(5000/10000))
  })

  it('returns calls + runtime chunks', () => {
    expect(computeUnits(1, 25_000)).toBe(4) // 1 call + 3 chunks
  })

  it('rounds up partial runtime chunks', () => {
    expect(computeUnits(1, 10_001)).toBe(3) // 1 call + 2 chunks (ceil)
  })

  it('returns just calls when runtime is 0', () => {
    expect(computeUnits(3, 0)).toBe(3)
  })
})
```

- [ ] **Step 2: Implement**

Create `repos/domain/src/utils/payments/computeUnits.ts`:

```typescript
export const computeUnits = (functionCalls: number, runtimeMs: number): number => {
  const runtimeChunks = Math.ceil(runtimeMs / 10_000)
  return functionCalls + runtimeChunks
}
```

- [ ] **Step 3: Add export**

Add `export * from './computeUnits'` to `repos/domain/src/utils/payments/index.ts`.

- [ ] **Step 4: Run tests**

Run: `cd repos/domain && npx vitest run src/utils/payments/computeUnits.test.ts`
Expected: PASS

---

### Task 28: Create enforceQuota middleware

**Files:**
- Create: `repos/backend/src/middleware/enforceQuota.ts`
- Create: `repos/backend/src/middleware/enforceQuota.test.ts`

- [ ] **Step 1: Write tests**

Test cases:
- Non-quota route passes through
- Unlimited resource (-1) passes through
- Under limit passes through
- At limit returns 403 with `quota_exceeded`
- Organizations check uses user-scoped query (not quota table)

- [ ] **Step 2: Implement middleware**

Following the spec's `enforceQuota` pseudocode. Include `mapRouteToResource` that maps `POST /projects` → `projects`, `POST /endpoints` → `endpoints`, etc. Include the organizations special case (user-scoped, count by query).

- [ ] **Step 3: Register middleware on resource-creating routes**

Apply `enforceQuota` to: `POST /projects`, `POST /endpoints`, `POST /secrets`, `POST /threads`, `POST /messages`, `POST /orgs`.

---

### Task 29: Add quota increment/decrement calls to resource handlers

**Files (creation — increment):**
- Modify: `repos/backend/src/endpoints/projects/createProject.ts` (increment `projects`)
- Modify: `repos/backend/src/endpoints/endpoints/createEndpoint.ts` (increment `endpoints`)
- Modify: `repos/backend/src/endpoints/secrets/createSecret.ts` (increment `secrets`)
- Modify: `repos/backend/src/endpoints/threads/createThread.ts` (increment `threads`)
- Modify: `repos/backend/src/endpoints/messages/createMessage.ts` (increment `messages`)
- Modify: `repos/backend/src/services/endpoints/faasEndpoint.ts` (increment `compute`)

**Files (deletion — decrement, current-count resources only):**
- Modify: `repos/backend/src/endpoints/projects/deleteProject.ts` (decrement `projects`)
- Modify: `repos/backend/src/endpoints/endpoints/deleteEndpoint.ts` (decrement `endpoints`)
- Modify: `repos/backend/src/endpoints/secrets/deleteSecret.ts` (decrement `secrets`)

**NOTE:** File names above follow the project's naming convention. Read each file first to confirm the exact name — it may be e.g., `create.ts` instead of `createProject.ts` depending on the directory structure.

- [ ] **Step 1: Add increments to creation handlers**

Read each creation handler file. After the successful DB insert, add the quota increment. Example pattern:

```typescript
await db.services.quota.increment(orgId, getBillingPeriod(), 'projects', 1)
```

The `orgId` is available from `req.params` or the created resource's parent org. Import `getBillingPeriod` helper (returns `YYYY-MM` format string for the current month).

- [ ] **Step 2: Add compute increment to FaaS handler**

In `repos/backend/src/services/endpoints/faasEndpoint.ts`, after function execution completes:

```typescript
import { computeUnits } from '@tdsk/domain'

const units = computeUnits(1, runtimeMs)
await db.services.quota.increment(orgId, getBillingPeriod(), 'compute', units)
```

- [ ] **Step 3: Add decrements to deletion handlers**

Read each deletion handler. After the successful DB delete, add the decrement for current-count resources only (projects, endpoints, secrets):

```typescript
await db.services.quota.decrement(orgId, getBillingPeriod(), 'endpoints', 1)
```

Do NOT add decrements for threads, messages, or compute — these are period-usage counters that never decrement.

---

### Task 30: Add seat management to invitation and member removal handlers

**Files:**
- Modify: `repos/backend/src/endpoints/orgs/inviteOrgUser.ts` (seat check on invitation creation)
- Modify: `repos/backend/src/endpoints/orgs/removeOrgMember.ts` (seat decrement on member removal)
- Modify: `repos/backend/src/endpoints/invitations/acceptInvitation.ts` (seat increment when invitation is actually accepted)

- [ ] **Step 1: Add seat check on invitation creation**

In `repos/backend/src/endpoints/orgs/inviteOrgUser.ts`, before sending the invitation:
1. Get org owner's subscription tier
2. If Free/Solo → return 403 "Upgrade to Pro to invite team members"
3. Count current org members + pending invitations
4. If total < included seats (from `PlanLimits[tier].seats`) → allow (no billing change)
5. If tier allows additional seats (`PlanLimits[tier].additionalSeats`) → allow (seat will be billed on acceptance)
6. Otherwise → return 403

- [ ] **Step 2: Add seat increment on invitation acceptance**

In `repos/backend/src/endpoints/invitations/acceptInvitation.ts`, after the member is added:
1. Count current org members
2. If members > included seats and tier allows additional seats → call `payments.service.updateSeatQuantity(subscriptionId, members - includedSeats)` and update subscription `seats` in DB

- [ ] **Step 3: Add seat decrement on member removal**

In `repos/backend/src/endpoints/orgs/removeOrgMember.ts`, after the member is removed:
1. Count remaining org members
2. If previous seat count > included seats → call `payments.service.updateSeatQuantity(subscriptionId, Math.max(0, remainingMembers - includedSeats))` and update subscription `seats` in DB

---

### Task 31: Update npm dependencies

**Files:**
- Modify: `repos/backend/package.json`

- [ ] **Step 1: Add stripe, remove Polar packages**

Run: `cd repos/backend && pnpm remove @polar-sh/sdk @polar-sh/express && pnpm add stripe`

---

### Task 32: Update setupSubscription middleware

**Files:**
- Modify: `repos/backend/src/middleware/setupSubscription.ts`
- Modify: `repos/backend/src/middleware/setupSubscription.test.ts`

- [ ] **Step 1: Update for new tier names and defaults**

Read and update: ensure free tier subscription creation uses `seats: 1`, and references the new `ESubscriptionTier` enum.

---

### Task 33: Run backend validation

- [ ] **Step 1: Run all backend tests**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass.

- [ ] **Step 2: Run backend type check**

Run: `cd repos/backend && pnpm types`
Expected: Clean.

---

## Chunk 4: Admin — State, Components, Actions, Services

### Task 34: Update admin types

**Files:**
- Modify: `repos/admin/src/types/subscriptions.types.ts`
- Modify: `repos/admin/src/types/quotas.types.ts`

- [ ] **Step 1: Update subscription types**

Read and update: replace `TCheckoutData` to use `tier` instead of `planId`. Keep `TCheckoutSession` and `TPortalSession` (same shape).

- [ ] **Step 2: Update quota types**

Read and update: replace `TLimitsData = Partial<TPayPlanMeta>` with `TPlanLimits` from `@tdsk/domain`. Update `TQuotaData` to match the 6-field Quota model.

---

### Task 35: Add invoices state

**Files:**
- Create: `repos/admin/src/state/invoices.ts`
- Modify: `repos/admin/src/state/accessors.ts` (add invoice accessors)
- Modify: `repos/admin/src/state/selectors.ts` (add useInvoices hook)

- [ ] **Step 1: Create invoices state atom**

Create `repos/admin/src/state/invoices.ts`:

```typescript
import type { Invoice } from '@tdsk/domain'
import { cacheable } from '@TAF/state/store'

export const invoicesState = cacheable<Invoice[]>([])
```

- [ ] **Step 2: Add accessors and selector**

Follow existing pattern (see subscriptions state) to add `getInvoices`, `setInvoices`, `resetInvoices` accessors and `useInvoices` selector.

---

### Task 36: Add invoices API service and action

**Files:**
- Modify: `repos/admin/src/services/subscriptionsApi.ts` (add invoices method)
- Create: `repos/admin/src/actions/subscriptions/api/fetchInvoices.ts`

- [ ] **Step 1: Add invoices method to subscriptionsApi**

Read and add:

```typescript
async invoices() {
  const resp = await this.request<Invoice[]>({
    url: `/subscriptions/invoices`,
    method: `GET`,
  })
  return resp?.data?.map((inv: Partial<Invoice>) => new Invoice(inv)) ?? []
}
```

- [ ] **Step 2: Create fetchInvoices action**

Create `repos/admin/src/actions/subscriptions/api/fetchInvoices.ts` following the pattern of `fetchCurrentSubscription.ts`. Call `subscriptionsApi.invoices()` and update state via `setInvoices`.

- [ ] **Step 3: Export from barrel**

Add export to `repos/admin/src/actions/subscriptions/api/index.ts`.

---

### Task 37: Update createCheckoutSession action

**Files:**
- Modify: `repos/admin/src/actions/subscriptions/api/createCheckoutSession.ts`

- [ ] **Step 1: Update to use tier instead of planId**

Read and update: change parameter from `planId` to `tier`. Update the request body accordingly.

---

### Task 38: Update billing components

**Files:**
- Modify: `repos/admin/src/components/Billing/QuotaUsage.tsx`
- Modify: `repos/admin/src/components/Billing/PlanCard.tsx`
- Modify: `repos/admin/src/components/Billing/CurrentPlan.tsx`

- [ ] **Step 1: Update QuotaUsage for 6 resources**

Read and update: replace the 9 quota items with 6 (projects, compute, threads, messages, endpoints, secrets). Update labels and any resource-specific formatting.

- [ ] **Step 2: Update PlanCard for new tier structure**

Read and update: replace 11 features with simplified list from `TPlanLimits`. Add seat pricing display for Pro/Team ("+$X/seat/mo"). Update `highlighted` to apply to Pro tier.

- [ ] **Step 3: Update CurrentPlan for Stripe**

Read and update: replace `createPortalSession()` label if needed. Add seat count display ("X of Y seats used") for Pro/Team tiers. Ensure it reads from the updated Subscription model (stripe fields instead of polar).

---

### Task 39: Update Billing page (add Payment History tab)

**Files:**
- Modify: `repos/admin/src/pages/Billing/Billing.tsx`

- [ ] **Step 1: Add third tab for Payment History**

Read and update:
- Add "Payment History" as third tab
- Add `fetchInvoices()` call to the Billing page's React Router loader (NOT useEffect — follow the project's loader pattern from the recent state architecture refactor)
- Create an invoice list section showing: date, amount (formatted from cents), status badge, PDF download link (`invoiceUrl`)
- Add "Manage Payment Method" button that opens Stripe portal

---

### Task 40: Update member invitation UX

**Files:**
- Modify: `repos/admin/src/components/Users/InviteUserDrawer.tsx`

- [ ] **Step 1: Add seat-aware invitation logic**

Read and update:
- Import `useSubscription` to get current tier
- Import `PlanLimits` from `@tdsk/domain`
- For Free/Solo: disable invite button, show tooltip "Upgrade to Pro to invite team members"
- For Pro/Team: show "X seats available" (calculate from subscription.seats - current member count vs PlanLimits[tier].seats)
- When at capacity: show confirmation dialog about paid seat before proceeding

---

### Task 41: Update admin tests

**Files:**
- Update all billing component tests for new tier names and 6 resources
- Update subscription action tests for `tier` param instead of `planId`

- [ ] **Step 1: Update existing billing tests**

Search for and update all test files under `repos/admin/src/components/Billing/` and `repos/admin/src/pages/Billing/` to reference new tiers (free/solo/pro/team), new resource names, and the Invoice model.

---

### Task 42: Run admin validation

- [ ] **Step 1: Run all admin tests**

Run: `cd repos/admin && pnpm test`
Expected: All tests pass.

- [ ] **Step 2: Run admin type check**

Run: `cd repos/admin && pnpm types`
Expected: Clean.

---

## Chunk 5: Website — Pricing Pages

### Task 43: Update pricingTiers to use PlanLimits

**Files:**
- Modify: `repos/website/src/components/Shared/pricingTiers.ts`

- [ ] **Step 1: Read and rewrite to derive from PlanLimits**

Import `PlanLimits` from `@tdsk/domain` and derive the 4 tier cards. Add descriptions and CTA text. Set `highlighted: true` on Pro tier.

Include seat pricing in features for Pro ("+$10/seat/mo") and Team ("+$8/seat/mo"). Solo should show "1 Seat (no additional)".

---

### Task 44: Update PricingCard for seat display

**Files:**
- Modify: `repos/website/src/components/Shared/PricingCard.tsx`

- [ ] **Step 1: Add per-seat pricing display**

Read and update: if the tier has seat pricing info, show it below the base price (e.g., "+$10/seat/mo" in smaller text).

---

### Task 45: Update Pricing page

**Files:**
- Modify: `repos/website/src/pages/Pricing.tsx`

- [ ] **Step 1: Update ComparisonRow type and data**

Replace `ComparisonRow` type columns: `free | basic | developer | pro` → `free | solo | pro | team`.

Replace `comparisonRows` data with 10 rows derived from `PlanLimits`: Organizations, Projects, Seats (included), Additional Seats, Compute, Threads, Messages, Endpoints, Secrets, Retention.

- [ ] **Step 2: Update table headers**

Replace "Basic" / "Developer" / "Pro" column headers with "Solo" / "Pro" / "Team". Move the `color: 'primary.main'` highlight to Pro column.

- [ ] **Step 3: Update FAQ content**

Replace all "Polar.sh" references with "Stripe". Update billing FAQ answer. Update payment methods answer. Add new FAQ: "How does seat-based pricing work?" explaining that Pro/Team tiers include seats and additional seats are billed per-member.

- [ ] **Step 4: Update PageMeta**

Update description to reference new tier names.

---

### Task 46: Update PricingCard test

**Files:**
- Modify: `repos/website/src/components/Shared/PricingCard.test.tsx`

- [ ] **Step 1: Update test data for new tiers**

Read and update test assertions to use new tier names and feature lists.

---

### Task 47: Run website validation

- [ ] **Step 1: Run all website tests**

Run: `cd repos/website && pnpm test`
Expected: All tests pass.

- [ ] **Step 2: Run website type check**

Run: `cd repos/website && pnpm types`
Expected: Clean.

---

## Prerequisites (Manual — Before Integration Tests)

### Task 47b: Add Stripe env vars to deploy config

**Files:**
- Modify: `deploy/values.yaml` (add Stripe env var keys with empty defaults)
- Modify: `deploy/values.local.yaml` or `~/.config/tdsk/values.yaml` (add actual Stripe test keys)

- [ ] **Step 1: Add env vars to values.yaml**

Add the following env vars to the backend section of `deploy/values.yaml`:

```yaml
TDSK_PAY_TYPE: stripe
TDSK_STRIPE_SECRET_KEY: ""
TDSK_STRIPE_WEBHOOK_SECRET: ""
TDSK_STRIPE_PRICE_IDS: ""
TDSK_STRIPE_SEAT_PRICE_ID_PRO: ""
TDSK_STRIPE_SEAT_PRICE_ID_TEAM: ""
```

- [ ] **Step 2: Add actual keys to local config**

Add real Stripe test-mode keys to `~/.config/tdsk/values.yaml` (user's local secret config). Remove old `TDSK_PAY_URL`, `TDSK_PAY_ACCESS_TOKEN`, `TDSK_PAY_WEBHOOK_SECRET` (Polar vars).

- [ ] **Step 3: Create K8s secret if needed**

If Stripe keys need a dedicated K8s secret, add a `tdsk kube secret payments` command for Stripe. Otherwise, existing secret mechanism is sufficient.

### Task 47c: Configure Stripe Dashboard (manual, not code)

This is a manual prerequisite — not automatable:
- [ ] Create Stripe products and prices in Stripe Dashboard (test mode)
- [ ] Configure Customer Portal settings: enable invoice history, payment method management, cancellation at period end, disable subscription pausing
- [ ] Set up webhook endpoint URL in Stripe Dashboard pointing to `https://<domain>/payments/webhooks`
- [ ] Copy webhook signing secret to env config

---

## Chunk 6: Integration Tests

### Task 48: Write subscription lifecycle integration test

**Files:**
- Create: `repos/integration/src/tier3/subscription-lifecycle.test.ts`

- [ ] **Step 1: Write test**

Test the full flow:
1. Create user → verify free tier assigned automatically
2. Fetch plans → verify 4 tiers returned with correct limits
3. Simulate checkout webhook (`checkout.session.completed`) → verify subscription updated to paid tier
4. Fetch current subscription → verify Stripe fields populated
5. Simulate `customer.subscription.deleted` webhook → verify reverted to free

---

### Task 49: Write quota enforcement integration test

**Files:**
- Create: `repos/integration/src/tier3/quota-enforcement.test.ts`

- [ ] **Step 1: Write test**

Test:
1. Set up user with known tier (use test API key)
2. Create resources up to the tier's limit
3. Attempt to create one more → verify 403 `quota_exceeded` response
4. Delete a current-count resource → verify quota decremented
5. Create again → verify success

---

### Task 50: Write seat management integration test

**Files:**
- Create: `repos/integration/src/tier3/seat-management.test.ts`

- [ ] **Step 1: Write test**

Test:
1. Free/Solo org → attempt invite → verify 403
2. Pro org → invite within included seats → verify success, no billing change
3. Pro org → invite beyond included seats → verify seat incremented
4. Remove member → verify seat decremented

---

### Task 51: Write invoice tracking integration test

**Files:**
- Create: `repos/integration/src/tier3/invoice-tracking.test.ts`

- [ ] **Step 1: Write test**

Test:
1. Simulate `invoice.paid` webhook with `billing_reason: 'subscription_cycle'`
2. Verify invoice record created in DB
3. Fetch invoices via `GET /subscriptions/invoices`
4. Verify correct data returned (amount, status, period)

---

### Task 52: Write webhook security integration test

**Files:**
- Create: `repos/integration/src/tier3/webhook-security.test.ts`

- [ ] **Step 1: Write test**

Test:
1. Send webhook with invalid signature → verify 400
2. Send webhook with valid signature → verify 200

---

### Task 52b: Write compute tracking integration test

**Files:**
- Create: `repos/integration/src/tier3/compute-tracking.test.ts`

- [ ] **Step 1: Write test**

Test:
1. Set up user with known tier
2. Execute a function via FaaS endpoint
3. Verify compute units incremented correctly (1 call unit + runtime chunks)
4. Execute again and verify cumulative count

---

### Task 52c: Write downgrade integration test

**Files:**
- Create: `repos/integration/src/tier3/subscription-downgrade.test.ts`

- [ ] **Step 1: Write test**

Test:
1. Set up user with Pro tier and resources created beyond Solo limits
2. Simulate downgrade to Solo (via `customer.subscription.updated` webhook with new tier)
3. Verify existing resources still accessible/functional
4. Attempt to create a new resource → verify 403 `quota_exceeded` at Solo limits
5. Verify subscription record updated to Solo tier

---

### Task 53: Run full integration suite

- [ ] **Step 1: Run all integration tests**

Run: `cd repos/integration && pnpm test`
Expected: All tests pass against live K8s.

---

## Final Validation

### Task 54: Cross-repo type check

- [ ] **Step 1: Run full type check**

Run from root: `pnpm types`
Expected: All 13+ repos type check clean.

### Task 55: Full test suite

- [ ] **Step 1: Run all unit tests from root**

Run from root: `pnpm test`
Expected: All repos pass.
