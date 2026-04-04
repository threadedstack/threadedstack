# Stripe Migration & Plan Simplification

**Date:** 2026-04-03
**Status:** Draft
**Scope:** domain, database, backend, admin, website, integration

## Overview

Migrate ThreadedStack from Polar.sh to Stripe for payment processing. Simultaneously simplify the subscription plan structure from 12 granular resource quotas to 6 org-scoped counters + 2 tier properties (organizations, retention), rename tiers, and add seat-based pricing for team plans. This is a greenfield migration — no existing customer data to preserve.

### Motivation

- Polar.sh integration never worked properly and had multiple bugs
- Plans are too granular (12 resource types) making tracking and enforcement complex
- Need mature, battle-tested payment processor (Stripe)
- Need simplified plans that are easier to maintain and extend

## Plan Tiers

4 tiers: **Free**, **Solo**, **Pro**, **Team**

| Property | Free | Solo | Pro | Team |
|----------|------|------|-----|------|
| **Price** | $0/mo | $15/mo | $39/mo | $99/mo |
| **Included Seats** | 1 | 1 | 3 | 10 |
| **Additional Seats** | No | No | $10/seat/mo | $8/seat/mo |
| **Target User** | Trial/exploration | Solo paid developer | Small teams | Larger organizations |

### Simplified Resource Limits (6 tracked quotas + 2 tier properties)

**6 org-scoped quota counters** (tracked in quotas table, incremented per usage):

| Resource | Free | Solo | Pro | Team |
|----------|------|------|-----|------|
| Projects | 2 | 10 | 50 | Unlimited |
| Compute (units/mo) | 1,000 | 10,000 | 100,000 | Unlimited |
| Threads | 100 | 1,000 | Unlimited | Unlimited |
| Messages/mo | 500 | 10,000 | Unlimited | Unlimited |
| Endpoints | 3 | 20 | Unlimited | Unlimited |
| Secrets | 5 | 25 | Unlimited | Unlimited |

**2 tier properties** (not quota counters — defined in `PlanLimits`, not tracked in quotas table):

| Property | Free | Solo | Pro | Team |
|----------|------|------|-----|------|
| Retention | 7 days | 30 days | 90 days | 365 days |
| Organizations | 1 | 2 | 5 | Unlimited |

**Organizations limit**: Unlike the 6 quota resources which are org-scoped, the `organizations` limit is user-scoped (how many orgs a user can own). This is enforced by counting the user's owned orgs at creation time via query, not by incrementing a quota counter. It lives in `PlanLimits` alongside retention as a tier property.

### Resource Simplifications (12 → 6 quota counters)

- `orgSecrets` + `projectSecrets` → single `secrets` count
- `functionCalls` + `runtime` → single `compute` unit (1 fn call = 1 unit, 1 per 10s runtime chunk)
- `organizations` removed from quotas — user-scoped, enforced by query at org creation
- `members` removed — now seat-based billing, not a counted quota resource
- `price` removed from quotas — tier property in `PlanLimits`, not a per-period snapshot
- `retention` removed from quotas — tier property in `PlanLimits`
- `activeSandboxes` removed — was never enforced

### Compute Unit Calculation

```typescript
const computeUnits = (functionCalls: number, runtimeMs: number):number => {
  const runtimeChunks = Math.ceil(runtimeMs / 10_000)  // 10s chunks
  return functionCalls + runtimeChunks
}
```

A single function call that runs for 25 seconds = 1 (call) + 3 (runtime chunks) = 4 compute units.

## Billing Model

- **Flat monthly per tier** + **per-seat pricing** for Pro/Team
- **Hard block** at limits — API returns 403 with `quota_exceeded`, no overages
- **Stripe hosted checkout** — redirect pattern (same UX as Polar, no embedded forms)
- **Hybrid billing UI** — in-app invoice list + Stripe Customer Portal for payment method management
- **Seats tied to member invitations** — auto-increment on invite, auto-decrement on removal

### Seat Management

When a member is invited:
1. Count current members for org
2. Look up org owner's subscription tier and included seats
3. If current members < included seats → allow (no billing change)
4. If tier allows additional seats → update seat quantity on Stripe subscription, increment `seats` on subscription record
5. If tier doesn't allow additional seats (Free/Solo) → return 403

When a member is removed:
1. If seats > included seats for tier → decrement seat quantity on Stripe, update subscription
2. Otherwise → no billing change

### Free Tier Handling

Free users have a subscription record in the database with `tier: 'free'` and no Stripe customer/subscription. The `setupSubscription` middleware creates this automatically. Upgrading from Free triggers a Stripe checkout session.

### Downgrade Handling

Use Stripe's subscription `update` API to change the price directly (with proration credit). This avoids the cancel-then-re-checkout pattern which risks abandoned checkouts leaving users in a broken state.

1. Call `stripe.subscriptions.update()` with the new tier's price ID and `proration_behavior: 'create_prorations'`
2. Stripe prorates the difference and applies credit to the next invoice
3. On webhook `customer.subscription.updated`, update subscription record with new tier
4. Quota enforcement immediately uses new tier's limits from `PlanLimits`
5. Existing resources beyond the new limits are NOT deleted — only new creation is blocked
6. If downgrading from a plan with paid seats, excess seats are removed and the seat line item is updated or removed

## Domain Changes (repos/domain)

### PlanLimits Config (Single Source of Truth)

New file: `repos/domain/src/constants/plans.ts`

```typescript
export const PlanLimits = {
  free:  { organizations: 1, projects: 2, compute: 1_000, threads: 100, messages: 500, endpoints: 3, secrets: 5, retention: 7, seats: 1, additionalSeats: false },
  solo:  { organizations: 2, projects: 10, compute: 10_000, threads: 1_000, messages: 10_000, endpoints: 20, secrets: 25, retention: 30, seats: 1, additionalSeats: false },
  pro:   { organizations: 5, projects: 50, compute: 100_000, threads: -1, messages: -1, endpoints: -1, secrets: -1, retention: 90, seats: 3, additionalSeats: true },
  team:  { organizations: -1, projects: -1, compute: -1, threads: -1, messages: -1, endpoints: -1, secrets: -1, retention: 365, seats: 10, additionalSeats: true },
} as const
// -1 = unlimited
```

Imported by backend (enforcement), admin (display), and website (pricing pages).

### Updated Types

```typescript
enum ESubscriptionTier {
  free = `free`
  solo = `solo`
  pro = `pro`
  team = `team`
}

enum ESubscriptionStatus {
  active = `active`
  canceled = `canceled`
  past_due = `past_due`
  incomplete = `incomplete`   // Stripe: payment not yet confirmed
  trialing = `trialing`      // Stripe: in free trial period (reserved for future use)
}

type TPlanLimits = {
  organizations: number       // user-scoped (enforced by query, not quota counter)
  projects: number
  compute: number
  threads: number
  messages: number
  endpoints: number
  secrets: number
  retention: number           // days (tier property, not a quota counter)
  seats: number               // included seats
  additionalSeats: boolean
}
```

Removed types: `TPayPlanRaw`, `TPayPlanMeta`, `rawPlanToMeta` utility, `utils/payments/` directory

### Updated Models

**Subscription** — swap Polar fields for Stripe:

```typescript
class Subscription extends Base {
  tier: string = `free`             // `free` | `solo` | `pro` | `team`
  status: string = `active`
  userId: string
  seats: number = 1
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  stripePriceId?: string
  currentPeriodEnd?: string
  currentPeriodStart?: string
  cancelAtPeriodEnd?: boolean
}
```

**Quota** — 6 org-scoped resources:

```typescript
class Quota extends Base {
  orgId: string
  period: string
  projects: number = 0
  compute: number = 0
  threads: number = 0
  messages: number = 0
  endpoints: number = 0
  secrets: number = 0
}
```

**Invoice** (new):

```typescript
class Invoice extends Base {
  userId: string
  stripeInvoiceId: string
  amount: number = 0
  currency: string = `usd`
  status: string = `draft`
  invoiceUrl?: string
  period: string
}
```

**Plan** — simplified, no longer fetched from external API:

```typescript
class Plan {
  id: string                        // tier name
  name: string                      // display name
  price: number                     // monthly price in dollars
  limits: TPlanLimits
}
```

## Database Changes (repos/database)

### Subscriptions Table

```typescript
subscriptions {
  id (UUID, PK)
  userId (UUID, FK → users, unique)
  tier (TEXT) default `free`        // `free` | `solo` | `pro` | `team`
  status (TEXT) default `active`

  // Stripe Integration (replaces polar* columns)
  stripeCustomerId (TEXT)
  stripeSubscriptionId (TEXT)
  stripePriceId (TEXT)

  // Period Tracking (unchanged)
  currentPeriodStart (TIMESTAMP)
  currentPeriodEnd (TIMESTAMP)
  cancelAtPeriodEnd (BOOLEAN) default false

  seats (INTEGER) default 1

  createdAt (TIMESTAMP)
  updatedAt (TIMESTAMP)
}
```

Removed columns: `polarId`, `polarCustomerId`, `polarPriceId`

### Quotas Table

```typescript
quotas {
  id (UUID, PK)
  orgId (VARCHAR(10), FK → orgs, cascade delete)
  period (TEXT)                     // "YYYY-MM"

  // 6 Tracked Resources (org-scoped)
  projects (INTEGER) default 0
  compute (INTEGER) default 0
  threads (INTEGER) default 0
  messages (INTEGER) default 0
  endpoints (INTEGER) default 0
  secrets (INTEGER) default 0

  createdAt (TIMESTAMP)
  updatedAt (TIMESTAMP)

  UNIQUE(orgId, period)
}
```

Removed columns: `price`, `retention`, `runtime`, `functionCalls`, `orgSecrets`, `projectSecrets`, `members`, `activeSandboxes`, `organizations`

### Invoices Table (new)

```typescript
invoices {
  id (UUID, PK)
  userId (UUID, FK → users)
  stripeInvoiceId (TEXT, unique)
  amount (INTEGER)                  // cents
  currency (TEXT) default `usd`
  status (TEXT)                     // `paid` | `open` | `void` | `draft` | `uncollectible`
  invoiceUrl (TEXT)                 // Stripe-hosted invoice PDF URL
  period (TEXT)                     // "YYYY-MM"

  createdAt (TIMESTAMP)
  updatedAt (TIMESTAMP)
}
```

Populated via Stripe webhooks (`invoice.paid`, `invoice.payment_failed`).

## Backend Changes (repos/backend)

### Service Architecture

```
PaymentsService (factory)
├── StripeService (production) — implements BaseService
└── ConsoleService (development) — unchanged
```

PolarService removed entirely. `BaseService` abstract class rewritten with new method signatures. `EPayType.polar` replaced with `EPayType.stripe` in the factory. `TPayConfig.plans` (product ID mapping) removed since plans are now static in `PlanLimits`.

### StripeService Methods

| Method | Purpose | Stripe API |
|--------|---------|------------|
| `createCustomer(email, userId)` | Create Stripe customer on first checkout | `stripe.customers.create()` |
| `createCheckoutSession(tier, customerId, successUrl, cancelUrl)` | Redirect to hosted checkout | `stripe.checkout.sessions.create()` |
| `createPortalSession(customerId)` | Redirect to billing portal | `stripe.billingPortal.sessions.create()` |
| `cancelSubscription(subscriptionId)` | Cancel at period end | `stripe.subscriptions.update({ cancel_at_period_end: true })` |
| `updateSubscription(subscriptionId, newPriceId)` | Change plan tier (upgrade/downgrade) with proration | `stripe.subscriptions.update({ items: [...], proration_behavior: 'create_prorations' })` |
| `updateSeatQuantity(subscriptionId, newQuantity)` | Add/remove paid seats | `stripe.subscriptions.update({ items: [...] })` |
| `getInvoices(customerId)` | Fetch invoice history (fallback) | `stripe.invoices.list()` |
| `constructWebhookEvent(payload, signature)` | Verify webhook signature | `stripe.webhooks.constructEvent()` |

### Webhook Events

| Stripe Event | Action |
|-------------|--------|
| `checkout.session.completed` | Create/update subscription record, set tier + Stripe IDs |
| `customer.subscription.updated` | Sync tier, status, period dates, seats |
| `customer.subscription.deleted` | Set status = canceled, tier = free |
| `invoice.paid` | Upsert invoice record. Reset quota period only when `invoice.billing_reason === 'subscription_cycle'` (not for prorated invoices from seat changes) |
| `invoice.payment_failed` | Update subscription status = past_due, upsert invoice with failed status |

### Quota Enforcement Middleware

```typescript
async function enforceQuota(req, res, next) {
  const { orgId } = req.params
  const resource = mapRouteToResource(req)
  if (!resource) return next()

  const tier = await getOrgOwnerTier(orgId)
  const limit = PlanLimits[tier][resource]
  if (limit === -1) return next()           // unlimited

  const usage = await getOrCreateQuota(orgId, currentPeriod())
  if (usage[resource] >= limit) {
    return res.status(403).json({
      error: `quota_exceeded`,
      resource, current: usage[resource], limit
    })
  }
  next()
}
```

Server-side enforcement on resource-creating routes. The existing `POST /orgs/:orgId/quotas/check` endpoint remains for UI pre-checks but must be updated to read limits from `PlanLimits[tier]` instead of fetching from the payment provider.

### Organizations Limit Enforcement

Organizations are user-scoped (not org-scoped), so they bypass the quota table. Enforced at `POST /orgs` by querying the count of orgs owned by the requesting user:

```typescript
const ownedOrgs = await countOrgsByOwner(userId)
const limit = PlanLimits[tier].organizations
if (limit !== -1 && ownedOrgs >= limit) {
  return res.status(403).json({ error: `quota_exceeded`, resource: `organizations`, current: ownedOrgs, limit })
}
```

### Quota Counter Behavior

Quotas use **current count** semantics for cumulative resources (projects, endpoints, secrets) and **period usage** semantics for consumption resources (compute, threads, messages):

- **Current count** (projects, endpoints, secrets): Decrement on delete. If a user creates 3 endpoints then deletes 1, quota shows 2.
- **Period usage** (compute, threads, messages): Never decrement. These count total usage within the billing period and reset at period boundary.

### Quota Increment Points

All increments are org-scoped. No project-level counting. Organizations are user-scoped (enforced by query, not incremented).

| Resource | Trigger | Type | Location |
|----------|---------|------|----------|
| `projects` | After project creation / After project deletion (decrement) | Current count | `POST /projects`, `DELETE /projects` handlers |
| `endpoints` | After endpoint creation / After endpoint deletion (decrement) | Current count | `POST /endpoints`, `DELETE /endpoints` handlers |
| `secrets` | After secret creation / After secret deletion (decrement) | Current count | `POST /secrets`, `DELETE /secrets` handlers |
| `threads` | After thread creation | Period usage | `POST /threads` handler |
| `messages` | After message creation | Period usage | `POST /messages` handler |
| `compute` | After function execution | Period usage | FaaS handler — call units + runtime chunks |

Enforcement happens before the handler, increment happens after success.

### Backend Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/subscriptions/plans` | GET | — | List all plans (static from `PlanLimits`) |
| `/subscriptions/current` | GET | JWT | Get user's subscription |
| `/subscriptions/checkout` | POST | JWT | Create Stripe checkout session (body: `{tier}`) |
| `/subscriptions/update` | POST | JWT | Change tier via `updateSubscription` (body: `{tier}`) — used for upgrades/downgrades by existing subscribers |
| `/subscriptions/portal` | POST | JWT | Create Stripe Customer Portal session |
| `/subscriptions/current` | DELETE | JWT | Cancel subscription at period end |
| `/subscriptions/invoices` | GET | JWT | Get user's invoice history from invoices table |
| `/payments/webhooks` | POST | Stripe signature | Stripe webhook handler (raw body, no JSON parsing middleware) |
| `/orgs/:orgId/quotas` | GET | JWT | Get org quota usage for current period |
| `/orgs/:orgId/quotas/limits` | GET | JWT | Get plan limits for org (from `PlanLimits[ownerTier]`) |
| `/orgs/:orgId/quotas/check` | POST | JWT | Check if action is allowed (body: `{resource, amount}`) |

**Webhook route note**: Express JSON body parsing must be disabled for `/payments/webhooks`. Stripe requires the raw request body for signature verification via `stripe.webhooks.constructEvent()`.

### Upgrade vs Checkout Flow

- **First-time subscribe** (Free → any paid tier): Uses `createCheckoutSession` — redirects to Stripe hosted checkout for payment method collection
- **Upgrade** (Solo → Pro, Pro → Team): Uses `updateSubscription` — in-place price change with proration, no redirect needed. Payment method already on file.
- **Downgrade** (Team → Pro, Pro → Solo): Uses `updateSubscription` — in-place price change with proration credit. Seat adjustments applied if necessary.
- **Cancel** (any paid → Free): Uses `cancelSubscription` — sets `cancel_at_period_end: true`. On `customer.subscription.deleted` webhook, tier reverts to free.

### npm Dependencies

Remove: `@polar-sh/sdk`, `@polar-sh/express`
Add: `stripe`

### Stripe Dashboard Configuration

The Stripe Customer Portal must be configured in the Stripe Dashboard before `createPortalSession` will work:
- Enable invoice history viewing
- Enable payment method management
- Configure cancellation flow (cancel at period end)
- Disable subscription pausing (not supported in this design)

### Environment Variables

```bash
TDSK_PAY_TYPE=stripe
TDSK_STRIPE_SECRET_KEY=sk_xxx
TDSK_STRIPE_WEBHOOK_SECRET=whsec_xxx
TDSK_STRIPE_PRICE_IDS=solo=price_xxx,pro=price_yyy,team=price_zzz
TDSK_STRIPE_SEAT_PRICE_ID_PRO=price_seat_pro
TDSK_STRIPE_SEAT_PRICE_ID_TEAM=price_seat_team
```

The backend config loader (`configs/backend.config.ts`) parses `TDSK_STRIPE_PRICE_IDS` into a `Record<string, string>` mapping tier → Stripe price ID. The StripeService validates at construction time that all required tiers (solo, pro, team) have price IDs. The `updateSeatQuantity` method resolves the correct seat price ID from the subscription owner's tier.

## Stripe Product/Price Configuration

### Products

| Product | Name | Type |
|---------|------|------|
| Free | ThreadedStack Free | No price (no checkout) |
| Solo | ThreadedStack Solo | Recurring monthly |
| Pro | ThreadedStack Pro | Recurring monthly |
| Team | ThreadedStack Team | Recurring monthly |

### Prices

| Price | Amount | Interval | Purpose |
|-------|--------|----------|---------|
| `price_solo` | $15.00 | monthly | Solo base plan |
| `price_pro` | $39.00 | monthly | Pro base plan |
| `price_team` | $99.00 | monthly | Team base plan |
| `price_seat_pro` | $10.00 | monthly | Additional seat (Pro) |
| `price_seat_team` | $8.00 | monthly | Additional seat (Team) |

### Checkout Session Structure

```typescript
stripe.checkout.sessions.create({
  customer: stripeCustomerId,
  mode: `subscription`,
  line_items: [
    { price: `price_pro`, quantity: 1 }
  ],
  success_url: `${appUrl}/billing?success=true`,
  cancel_url: `${appUrl}/billing?cancelled=true`,
  metadata: { userId, tier: 'pro' }
})
```

Seats are not added at checkout. The seat line item is added to the subscription later when a member invitation exceeds included seats.

## Admin UI Changes (repos/admin)

### Billing Page (3 tabs)

- **Current Plan tab**: Tier name, price, status badge, period dates, seat count (Pro/Team: "3 of 3 seats used"). "Manage Payment Method" opens Stripe portal. Cancellation warning if `cancelAtPeriodEnd`.
- **Upgrade Plan tab**: Grid of 4 plan cards with simplified resources from `PlanLimits`. Current plan highlighted/disabled. Pro/Team cards show "+$X/seat/mo".
- **Payment History tab (new)**: Invoice table (date, amount, status badge, PDF download link). "Manage Payment Method" button opens Stripe portal.

### Quota Usage Component

Updated from 9 progress bars to 6: Projects, Compute, Threads, Messages, Endpoints, Secrets. Same color-coded thresholds (green <70%, yellow 70-90%, red >=90%). Unlimited resources show "Unlimited" with no progress bar. Organizations limit shown separately (user-scoped, not part of org quota).

### Member Invitation UX

- **Free/Solo**: Invite button disabled with tooltip: "Upgrade to Pro to invite team members"
- **Pro/Team with available seats**: Invite button enabled, shows "X seats available"
- **Pro/Team at seat capacity**: Invite button enabled, confirmation dialog: "Adding a member will add a paid seat at $X/mo. Continue?"
- **Member removal (paid seat)**: Confirmation: "This will remove a paid seat from your subscription."

### State Changes

- `subscriptionState` — updated model with Stripe fields
- `orgQuotaState` — 6 resources
- `orgLimitsState` — sourced from `PlanLimits` via backend
- `invoicesState` (new) — array of Invoice models
- `paymentPlansState` — updated Plan model with `TPlanLimits`

### Actions

- `fetchInvoices()` (new) — fetches user's invoice history
- `createCheckoutSession(tier)` — param updated from planId to tier name
- Existing actions updated for new types: `fetchCurrentSubscription`, `fetchPaymentPlans`, `fetchOrgQuota`, `fetchOrgLimits`, `createPortalSession`, `cancelSubscription`

## Website Changes (repos/website)

### Files Affected

- `repos/website/src/components/Shared/pricingTiers.ts` — import from `PlanLimits`, derive tier cards
- `repos/website/src/components/Shared/PricingCard.tsx` — add seat pricing display for Pro/Team
- `repos/website/src/components/Shared/PricingTierGrid.tsx` — no structural changes (renders from `tiers` array)
- `repos/website/src/components/Landing/Pricing.tsx` — no structural changes (wraps PricingTierGrid)
- `repos/website/src/pages/Pricing.tsx` — updated comparison table (Free/Solo/Pro/Team columns), updated FAQ (Stripe references, seat-based FAQ)

### Comparison Table

10 rows: Organizations, Projects, Seats (included), Additional Seats, Compute, Threads, Messages, Endpoints, Secrets, Retention. Values derived from `PlanLimits`.

### FAQ Updates

- Replace all "Polar.sh" references with "Stripe"
- Update billing description for Stripe
- Add "How does seat-based pricing work?" FAQ item
- Update payment methods answer for Stripe

## Migration Sequence

| Phase | Repo | Work | Validation |
|-------|------|------|------------|
| 1 | **domain** | `PlanLimits` config, updated types/enums (`ESubscriptionTier`, `ESubscriptionStatus`), updated models (Subscription, Quota, Plan), new Invoice model. Remove `TPayPlanRaw`, `TPayPlanMeta`, `rawPlanToMeta` utility, `utils/payments/` directory. | `pnpm test` + `pnpm types` |
| 2 | **database** | Update subscriptions schema (polar → stripe columns, default seats=1). Update quotas schema (12 → 6 resources). Add invoices schema. Update model converters. Refactor Quota service: update `TIncrementKey` type (remove members/runtime/functionCalls/orgSecrets/projectSecrets/organizations, add compute/secrets), remove `initializePeriod`'s price/retention params, add decrement support. Replace `findByPolarId()` with `findByStripeSubscriptionId()` and `findByStripeCustomerId()` on Subscription service. | `pnpm test` + `pnpm types` |
| 3 | **backend** | Remove PolarService. Rewrite `BaseService` abstract class with new method signatures. Add StripeService. Replace `EPayType.polar` with `EPayType.stripe` in factory. Update webhook handler. Add enforceQuota middleware. Add org count enforcement (user-scoped). Update quota increments (add decrements for current-count resources). Add seat management. Add invoice endpoints. Update env config. | `pnpm test` + `pnpm types` |
| 4 | **admin** | Update state atoms. Update `TQuotaData` and `TLimitsData` types to use `TPlanLimits`. Update billing components (3 tabs). Add invoice list. Update member invitation UX (disabled/seat-aware). Update actions and API services. | `pnpm test` + `pnpm types` |
| 5 | **website** | Update pricingTiers from `PlanLimits`. Update comparison table and FAQ. Update PricingCard for seats. | `pnpm test` + `pnpm types` |
| 6 | **integration** | Full lifecycle tests: subscription, quota enforcement, seat management, invoices, webhooks, downgrade, security. | Integration tests against live K8s |

## Validation & Testing Strategy

### Unit Tests (per repo, no network)

**domain**: `PlanLimits` config validity, model serialization, enum completeness.

**database**: Schema column changes, model converters for Subscription/Quota/Invoice.

**backend**: StripeService with mocked Stripe SDK (checkout, portal, webhooks, seats). enforceQuota middleware (all 6 resources + org count enforcement, unlimited bypass, hard block). Quota increment and decrement logic (compute units, atomic upsert, current-count decrements). Webhook handler (all 5 events, state transitions, `billing_reason` filtering for period reset). Seat management (invite/remove, tier restrictions). Downgrade via subscription update with proration.

**admin**: Billing components render with new tiers. QuotaUsage displays 6 resources. PlanCard shows seat pricing. Invoice list renders. Member invite disabled for Free/Solo. Seat availability for Pro/Team.

**website**: PricingCard renders 4 tiers. Comparison table columns. FAQ content (no Polar references). pricingTiers derives from PlanLimits.

### Integration Tests (against live K8s)

- **Subscription lifecycle**: Free → checkout → paid tier → webhook → verify → cancel → verify revert to free
- **Quota enforcement**: Create resources to limit → verify 403 → upgrade → verify creation succeeds
- **Seat management**: Invite within included → no Stripe call → invite beyond → seat updated → remove → seat decremented
- **Invoice tracking**: Webhook → invoice record → API fetch → verify data
- **Compute tracking**: Execute function → verify units (calls + runtime chunks)
- **Downgrade**: Resources beyond new limits → downgrade → existing work → new creation blocked
- **Webhook security**: Invalid signature → 400. Expired timestamp → rejection.
