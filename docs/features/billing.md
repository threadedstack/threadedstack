# Billing & Subscriptions

## Billing Model

**User pays, orgs consume.** Subscriptions are tied to individual users in a 1:1 relationship (the `subscriptions` table has a unique constraint on `user_id`). An organization's resource limits are determined by its **owner's** subscription tier -- not the org's own record. When the `enforceQuota` middleware checks limits for an org-scoped resource, it looks up the org's `ownerId`, finds that user's subscription, and resolves the tier from `PlanLimits`.

This means:

- A user on the **pro** tier who owns three organizations gives all three orgs pro-level limits.
- Quotas (actual usage counters) are tracked **per org, per billing period** in the `quotas` table, scoped by a `YYYY-MM` period string.
- Invoices are recorded **per user** in the `invoices` table, since the user is the paying entity.

### Key Database Tables

| Table | Scope | Purpose |
|---|---|---|
| `subscriptions` | User (1:1) | Tier, status, Stripe IDs, billing period, seat count |
| `quotas` | Org + Period | Usage counters for projects, compute, threads, messages, endpoints, secrets |
| `invoices` | User | Stripe invoice records with amount, currency, status, hosted URL |

Source files:
- `repos/database/src/schemas/subscriptions.ts`
- `repos/database/src/schemas/quotas.ts`
- `repos/database/src/schemas/invoices.ts`

---

## Stripe Integration

### Strategy Pattern

The `PaymentsService` (`repos/backend/src/services/payments/payments.ts`) uses the **Strategy Pattern** to abstract payment provider operations behind a common `BaseService` interface. The active strategy is selected at startup based on the `type` field in the Stripe config:

| `type` value | Class | Purpose |
|---|---|---|
| `stripe` | `StripeService` | Production. Calls real Stripe APIs via the `stripe` Node SDK. |
| `console` | `ConsoleService` | Development. Logs all method calls to the console and returns stub values. |

Both strategies implement the same abstract interface defined in `BaseService` (`repos/backend/src/services/payments/strategies/base.ts`):

```
fetchPlans()
createCustomer(email, userId)
createCheckoutSession(tier, customerId, successUrl, cancelUrl)
createPortalSession(customerId)
cancelSubscription(subscriptionId)
updateSubscription(subscriptionId, newPriceId)
updateSeatQuantity(subscriptionId, quantity)
getInvoices(customerId)
constructWebhookEvent(payload, signature)
webhook(app, event)
```

### Configuration

The `TStripeConfig` shape (`repos/backend/src/types/pay.types.ts`):

| Field | Type | Description |
|---|---|---|
| `type` | `stripe` or `console` | Selects the active strategy |
| `secretKey` | `string` | Stripe secret key |
| `webhookSecret` | `string` | Stripe webhook signing secret |
| `priceIds` | `Record<string, string>` | Maps tier name to Stripe Price ID (e.g. `{ solo: "price_xxx", pro: "price_yyy" }`) |
| `seatPriceIds` | `Record<string, string>` | Maps tier name to the Stripe Price ID for per-seat billing |
| `environment` | `string` | Deployment environment label |

Source files:
- `repos/backend/src/services/payments/payments.ts`
- `repos/backend/src/services/payments/strategies/base.ts`
- `repos/backend/src/services/payments/strategies/stripe.ts`
- `repos/backend/src/services/payments/strategies/console.ts`

---

## Subscription Tiers

Four tiers are defined in `PlanLimits` (`repos/domain/src/constants/plans.ts`). A value of `-1` means **unlimited**.

| Resource | Free | Solo | Pro | Team |
|---|---|---|---|---|
| Organizations | 1 | 2 | 5 | Unlimited |
| Projects | 2 | 10 | 50 | Unlimited |
| Compute (units) | 1,000 | 10,000 | 100,000 | Unlimited |
| Threads | 100 | 1,000 | Unlimited | Unlimited |
| Messages | 500 | 10,000 | Unlimited | Unlimited |
| Endpoints | 3 | 20 | Unlimited | Unlimited |
| Secrets | 5 | 25 | Unlimited | Unlimited |
| Retention (days) | 7 | 30 | 90 | 365 |
| Included Seats | 1 | 1 | 3 | 10 |
| Additional Seats | No | No | Yes | Yes |

Tier names are defined as the `ESubscriptionTier` enum (`repos/domain/src/types/payments.types.ts`): `free`, `solo`, `pro`, `team`.

---

## Subscription Lifecycle

### States

Defined in `ESubscriptionStatus` (`repos/domain/src/types/payments.types.ts`):

| Status | Meaning |
|---|---|
| `active` | Subscription is current and paid |
| `canceled` | Subscription has been cancelled (reverts to free tier) |
| `past_due` | Invoice payment failed; awaiting retry |
| `incomplete` | Initial payment has not completed |
| `trialing` | Subscription is in a trial period |

### Lifecycle Flow

```
New User
  |
  v
setupSubscription middleware
  |  Creates a free-tier subscription if none exists
  v
User selects paid tier
  |
  v
POST /subscriptions/checkout
  |  Body: { tier, successUrl, cancelUrl }
  |
  |-- No existing Stripe subscription?
  |     1. Creates Stripe customer (if needed)
  |     2. Persists stripeCustomerId on subscription record
  |     3. Creates Stripe Checkout session
  |     4. Returns checkout URL -> user redirected to Stripe
  |
  |-- Has active Stripe subscription at different tier?
  |     1. Resolves new Stripe Price ID for target tier
  |     2. Calls updateSubscription (proration-based swap)
  |     3. Returns { updated: true }
  |
  v
Stripe Checkout completes
  |  Webhook: checkout.session.completed
  |  -> Upserts subscription with tier, status, period dates
  v
Active Subscription
  |
  |-- Manage billing details --------> POST /subscriptions/portal
  |     Returns Stripe Billing Portal URL
  |
  |-- Upgrade/downgrade tier --------> POST /subscriptions/update
  |     Body: { tier }
  |     - Paid tier: calls updateSubscription with proration
  |     - Free tier: calls cancelSubscription (cancel at period end)
  |
  |-- Cancel subscription -----------> DELETE /subscriptions/current
  |     Calls Stripe cancel_at_period_end = true
  |     Subscription remains active until period ends
  |
  v
Stripe fires customer.subscription.deleted
  |  Webhook handler reverts user to free tier, status = "canceled"
  v
Free Tier
```

### Automatic Subscription Setup

The `setupSubscription` middleware (`repos/backend/src/middleware/setupSubscription.ts`) runs on authenticated requests. If the user has no subscription record, it automatically creates one at the `free` tier with `status: active` and `seats: 1`. This guarantees every authenticated user always has a subscription record.

### API Endpoints

All endpoints live under `/_/subscriptions/` (`repos/backend/src/endpoints/subscriptions/subscriptions.ts`):

| Method | Path | Handler | Description |
|---|---|---|---|
| `GET` | `/subscriptions/plans` | `getPlans` | List all available plan tiers with their limits |
| `GET` | `/subscriptions/current` | `getCurrentSubscription` | Get the authenticated user's subscription |
| `GET` | `/subscriptions/invoices` | `getInvoices` | List invoices for the authenticated user |
| `POST` | `/subscriptions/checkout` | `createCheckout` | Create a Stripe Checkout session or upgrade in-place |
| `POST` | `/subscriptions/update` | `updateSubscription` | Change tier on an existing subscription |
| `POST` | `/subscriptions/portal` | `createPortalSession` | Create a Stripe Billing Portal session URL |
| `DELETE` | `/subscriptions/current` | `cancelSubscription` | Cancel subscription at end of current period |

---

## Quota Enforcement

### How It Works

The `enforceQuota` middleware (`repos/backend/src/middleware/enforceQuota.ts`) intercepts **POST** requests that create resources and checks whether the org has capacity remaining under its owner's plan limits.

**Step-by-step flow:**

1. **Route mapping** -- `mapRouteToResource()` matches the request path to a resource key. Only `POST` requests are checked. Supported mappings:
   - `POST .../projects` -> `projects`
   - `POST .../endpoints` -> `endpoints`
   - `POST .../secrets` -> `secrets`
   - `POST .../threads` -> `threads`
   - `POST .../threads/:id/messages` -> `messages`
   - `POST .../orgs` -> `organizations`

2. **Tier resolution** -- The middleware looks up the org owner's subscription tier. For `POST /orgs`, it uses the authenticated user's own subscription tier instead.

3. **Limit lookup** -- The tier's limit for the matched resource is read from `PlanLimits`. If the limit is `-1` (unlimited), the request passes through immediately.

4. **Usage comparison** -- Current usage is read from the `quotas` table for the org's current billing period (`YYYY-MM` format). For `POST /orgs`, the count of orgs where `ownerId = userId` is used instead.

5. **Decision** -- If `current >= limit`, the middleware returns a **403** response:
   ```json
   {
     "error": "quota_exceeded",
     "resource": "projects",
     "current": 2,
     "limit": 2
   }
   ```
   Otherwise, the request proceeds to the endpoint handler.

6. **Non-blocking on error** -- If quota checking itself fails (database error, etc.), the middleware logs the error and allows the request through rather than blocking it.

### Usage Tracking

After a resource is successfully created, the endpoint handler increments the quota counter. For example, `createProject` calls:

```typescript
db.services.quota.increment(orgId, getBillingPeriod(), 'projects')
```

The `increment` method (`repos/database/src/services/quota.ts`) uses an atomic SQL upsert: if no quota row exists for the org+period combination, it inserts one with the incremented value; otherwise it atomically adds to the existing counter via `SET column = column + amount`.

A corresponding `decrement` method exists for resource deletion, using `GREATEST(column - amount, 0)` to prevent negative values.

### Billing Period

The billing period is computed by `getBillingPeriod()` (`repos/backend/src/utils/auth/getBillingPeriod.ts`) as a `YYYY-MM` string (e.g., `2026-04`). The `quotas` table has a unique index on `(org_id, period)`.

### Tracked Resource Types

| Quota Column | Incremented By | Decremented By |
|---|---|---|
| `projects` | `createProject` | `deleteProject` |
| `endpoints` | `createEndpoint` | `deleteEndpoint` |
| `secrets` | `createSecret` | `deleteSecret` |
| `threads` | `createThread` | -- |
| `messages` | `createMessage` | -- |
| `compute` | `faasEndpoint` (function execution) | -- |

Source files:
- `repos/backend/src/middleware/enforceQuota.ts`
- `repos/database/src/services/quota.ts`

---

## Webhooks

### Endpoint

`POST /_/payments/webhooks` (`repos/backend/src/endpoints/payments/webhook.ts`)

The webhook endpoint uses `express.raw({ type: 'application/json' })` middleware to receive the raw request body, which is required by Stripe's signature verification. The `stripe-signature` header is mandatory.

### Verification Flow

1. Extract the `stripe-signature` header from the request.
2. Call `payments.service.constructWebhookEvent(req.body, signature)` which delegates to `stripe.webhooks.constructEvent()` using the configured `webhookSecret`.
3. If verification fails, return **400** with the error message.
4. If verification succeeds, delegate to `payments.service.webhook(app, event)` for processing.

### Handled Events

The `StripeService.webhook()` method (`repos/backend/src/services/payments/strategies/stripe.ts`) handles five Stripe event types:

| Stripe Event | Handler | Effect |
|---|---|---|
| `checkout.session.completed` | `#handleCheckoutCompleted` | Retrieves the full Stripe subscription, resolves the tier from price ID or session metadata, and upserts the local subscription with tier, status, Stripe IDs, and period dates. |
| `customer.subscription.updated` | `#handleSubscriptionUpdated` | Looks up the local subscription by `stripeSubscriptionId`, resolves the new tier from the current price ID, and updates tier, status, price ID, and period dates. |
| `customer.subscription.deleted` | `#handleSubscriptionDeleted` | Reverts the user's subscription to `tier: free`, `status: canceled`, and clears `cancelAtPeriodEnd`. |
| `invoice.paid` | `#handleInvoicePaid` | Records the invoice in the `invoices` table via `upsertByStripeId`. If `billing_reason` is `subscription_cycle` (recurring, not first invoice), resets quota counters by calling `initializePeriod` for all orgs owned by the user. |
| `invoice.payment_failed` | `#handleInvoicePaymentFailed` | Sets the subscription status to `past_due` and records the failed invoice. |

All other event types are logged and ignored.

### Quota Reset on Renewal

When a recurring `invoice.paid` event fires (billing_reason = `subscription_cycle`), the webhook handler finds all organizations owned by the subscribing user and calls `initializePeriod(orgId, period)` for each. This inserts a fresh quota row for the new billing period with all counters at zero (using `ON CONFLICT DO NOTHING` to avoid overwriting if the row already exists).

Source files:
- `repos/backend/src/endpoints/payments/webhook.ts`
- `repos/backend/src/services/payments/strategies/stripe.ts`

---

## Invoice Tracking

### Storage

Invoices are stored in the `invoices` table (`repos/database/src/schemas/invoices.ts`) with the following columns:

| Column | Type | Description |
|---|---|---|
| `user_id` | UUID (FK -> users) | The paying user |
| `stripe_invoice_id` | text (unique) | Stripe invoice ID, used as the upsert key |
| `amount` | integer | Amount in smallest currency unit (e.g., cents) |
| `currency` | text | Currency code (default: `usd`) |
| `status` | text | `paid` or `failed` |
| `invoice_url` | text (nullable) | Stripe hosted invoice URL for the user to view/download |
| `period` | text | Billing period in `YYYY-MM` format |

### How Invoices Are Created

Invoices are never created by API endpoints directly. They are written exclusively by webhook handlers:

- **`invoice.paid`** -- Upserts an invoice record with `status: paid`, the `amount_paid`, and the `hosted_invoice_url` from Stripe.
- **`invoice.payment_failed`** -- Upserts an invoice record with `status: failed` and the `amount_due`.

Both use `upsertByStripeId` (`repos/database/src/services/invoice.ts`), which inserts or updates based on the unique `stripe_invoice_id`.

### How Invoices Are Surfaced

The `GET /subscriptions/invoices` endpoint (`repos/backend/src/endpoints/subscriptions/getInvoices.ts`) queries the `invoices` table by the authenticated user's ID and returns all records ordered by creation date. Each invoice includes the `invoiceUrl` field, which links to Stripe's hosted invoice page where the user can view details and download a PDF.

Source files:
- `repos/database/src/schemas/invoices.ts`
- `repos/database/src/services/invoice.ts`
- `repos/backend/src/endpoints/subscriptions/getInvoices.ts`
