| **P4** — Major refactor | Stripe migration | 1 |

### ALL

* **[P4] Plans and Subscriptions — switch from Polar.sh to Stripe**
  * Current implementation uses Polar.sh for payments. Backend `PolarService.fetchPlans()` fails when Polar credentials are invalid or products aren't configured. The admin `Billing.tsx` page structure is sound but receives empty/error data
  * This is a full payment stack replacement:
    1. **Backend**: Replace `PolarService` with `StripeService` in `repos/backend/src/services/payments/strategies/`
    2. **Backend**: Update webhook handler from Polar events to Stripe events
    3. **Backend**: Update `getPlans.ts`, `getCurrentSubscription.ts`, `createCheckoutSession.ts` for Stripe
    4. **Domain**: Update plan/subscription models for Stripe-specific fields
    5. **Admin**: Update checkout redirect (Stripe Checkout Session URL)
    6. **Config**: New env vars for `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, product/price IDs
  * **This is a large standalone task that should be planned separately**
  * **Files**: `repos/backend/src/services/payments/strategies/polar.ts` → `stripe.ts`, `repos/backend/src/services/payments/payments.ts`, `repos/backend/src/endpoints/subscriptions/`, `repos/domain/src/models/subscription.ts`, `repos/admin/src/pages/Billing/Billing.tsx`

