/**
 * Bounds fetchPlans() -- the root-route loader's fetch to
 * `/_/subscriptions/plans` -- so a backend that accepts the connection but
 * never responds (stuck pod, hung DB query) can't hang the entire marketing
 * site's root route forever. Matches the ProxyRequestTimeoutMs convention
 * used for this same bug class elsewhere in the monorepo.
 */
export const FetchPlansTimeoutMs = 30_000
