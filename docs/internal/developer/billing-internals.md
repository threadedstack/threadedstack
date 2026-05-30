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

The webhook endpoint receives the raw request body (captured via `express.json({ verify })` as `req.rawBody`), which is required by Stripe's signature verification. The `stripe-signature` header is always mandatory regardless of environment.

### Verification Flow

1. Extract the `stripe-signature` header from the request. If missing, return **400**.
2. Call `payments.service.constructWebhookEvent(payload, signature)`:
   - **Production** or **webhookSecret is configured**: delegates to `stripe.webhooks.constructEvent()` for full HMAC-SHA256 verification. If verification fails, return **400**.
   - **Non-production with no webhookSecret**: skips HMAC verification and parses the raw payload as JSON directly. Logs a warning. This enables local development with `stripe listen` without needing to synchronize signing secrets (see [Local Development](#local-development) below).
3. If verification/parsing succeeds, delegate to `payments.service.webhook(app, event)` for processing.

If a `webhookSecret` IS configured in a non-production environment, full HMAC verification is performed, allowing developers to opt in to the full verification flow when needed.

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

---

## Local Development

### Overview

Testing Stripe webhooks locally requires forwarding events from Stripe's servers to your local backend. The Stripe CLI's `stripe listen` command handles this, but it generates a new ephemeral webhook signing secret (`whsec_*`) on every restart. In non-production environments, the backend skips HMAC signature verification when no `webhookSecret` is configured, eliminating the need to update K8s secrets and restart pods after each `stripe listen` restart.

### Prerequisites

- [Stripe CLI](https://docs.stripe.com/stripe-cli) installed and authenticated (`stripe login`)
- K8s services running (`tdsk dev start --clean`)
- Payments K8s secret created with at least a Stripe API token:

```bash
tdsk kube secret payments --token <stripe_test_api_key> --type stripe --plans <plan_config>
```

The `--webhook` flag is optional in non-production environments. Without it, the backend skips signature verification automatically.

### Forwarding Webhooks

Use the `tdsk stripe forward` CLI command to start the Stripe event listener:

```bash
tdsk stripe forward
```

This runs `stripe listen` filtered to the five webhook event types the backend handles, forwarding them to `https://local.threadedstack.app/_/payments/webhooks`. The forwarding URL is derived from the `TDSK_HOST_DOMAIN` config value.

Default events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.

| Option | Description |
|---|---|
| `--url` | Override the webhook forwarding URL |
| `--events` | Override the default event filter (comma-separated) |

Aliases: `tdsk st fwd`, `tdsk st listen`, `tdsk stripe fwd`.

### Triggering Test Events

With `tdsk stripe forward` running in one terminal, trigger test events from another:

```bash
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_failed
```

The backend logs will show:
- A warning: `[Stripe] Skipping webhook signature verification (no webhookSecret configured)`
- The event being processed by the appropriate handler

### How Skip-Verification Works

The `StripeService.constructWebhookEvent()` method checks two conditions before deciding whether to verify signatures:

1. **`webhookSecret` is falsy** (empty string or undefined). The `TDSK_PAY_WEBHOOK_SECRET` env var defaults to `''` in `backend.config.ts`, and the K8s secretKeyRef is marked `optional: true` in `devspace.yaml`.
2. **`environment` is not `production`**. The environment value comes from `process.env.NODE_ENV`.

If both conditions are met, the raw payload is parsed as JSON directly, bypassing HMAC verification. Otherwise, the standard `stripe.webhooks.constructEvent()` path is used.

```
stripe listen generates whsec_*
        |
        v
Stripe CLI forwards event with stripe-signature header
        |
        v
Backend receives POST /_/payments/webhooks
        |
        v
stripe-signature header present? --NO--> 400
        |
       YES
        |
        v
webhookSecret configured? --YES--> verify HMAC (standard Stripe flow)
        |
        NO
        |
        v
environment === production? --YES--> verify HMAC (fail-closed)
        |
        NO
        |
        v
Parse payload as JSON directly (skip verification)
        |
        v
Dispatch to event handler
```

### Opting In to Full Verification

If you want to test the full signature verification flow locally, include the `--webhook` flag when creating the payments secret:

```bash
tdsk kube secret payments \
  --token <stripe_test_api_key> \
  --type stripe \
  --plans <plan_config> \
  --webhook <whsec_from_stripe_listen>
```

With a `webhookSecret` configured, HMAC verification is active regardless of environment. You will need to update the K8s secret and restart the backend pod each time `stripe listen` restarts, since the CLI generates a new signing secret per session.

### Production

In production, `TDSK_PAY_WEBHOOK_SECRET` must be configured with the signing secret from the Stripe Dashboard (Developers > Webhooks > Signing secret). The skip-verification path is never used in production. If the secret is missing, `stripe.webhooks.constructEvent()` will throw, and the webhook returns 400.

Source files:
- `repos/backend/src/services/payments/strategies/stripe.ts` (constructWebhookEvent)
- `repos/cli/src/tasks/stripe/forward.ts` (tdsk stripe forward)
- `repos/cli/src/tasks/kube/secret/payments.ts` (payments secret creation)
