# Billing & Subscriptions -- Developer Internals

## Stripe Integration

### Strategy Pattern

The `PaymentsService` (`repos/backend/src/services/payments/payments.ts`) uses the **Strategy Pattern** to abstract payment provider operations behind a common `BaseService` interface. The active strategy is selected at startup based on the `type` field in the Stripe config:

| `type` value | Class | Purpose |
|---|---|---|
| `stripe` | `StripeService` | Production. Calls real Stripe APIs via the `stripe` Node SDK. |
| `console` | `ConsoleService` | Development. Logs all method calls to the console and returns stub values. |

Both strategies implement the same abstract interface defined in `BaseService` (`repos/backend/src/services/payments/strategies/base.ts`):

```text
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

Source files:
- `repos/backend/src/services/payments/payments.ts`
- `repos/backend/src/services/payments/strategies/base.ts`
- `repos/backend/src/services/payments/strategies/stripe.ts`
- `repos/backend/src/services/payments/strategies/console.ts`

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

---

## Quota Enforcement -- How It Works

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

Source: `repos/backend/src/middleware/enforceQuota.ts`

---

## Usage Tracking

After a resource is successfully created, the endpoint handler increments the quota counter. For example, `createProject` calls:

```typescript
db.services.quota.increment(orgId, getBillingPeriod(), 'projects')
```

The `increment` method (`repos/database/src/services/quota.ts`) uses an atomic SQL upsert: if no quota row exists for the org+period combination, it inserts one with the incremented value; otherwise it atomically adds to the existing counter via `SET column = column + amount`.

A corresponding `decrement` method exists for resource deletion, using `GREATEST(column - amount, 0)` to prevent negative values.

### Billing Period

The billing period is computed by `getBillingPeriod()` (`repos/backend/src/utils/auth/getBillingPeriod.ts`) as a `YYYY-MM` string (e.g., `2026-04`). The `quotas` table has a unique index on `(org_id, period)`.

Source files:
- `repos/database/src/services/quota.ts`
- `repos/backend/src/utils/auth/getBillingPeriod.ts`

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

Source files:
- `repos/database/src/schemas/invoices.ts`
- `repos/database/src/services/invoice.ts`
- `repos/backend/src/endpoints/subscriptions/getInvoices.ts`
