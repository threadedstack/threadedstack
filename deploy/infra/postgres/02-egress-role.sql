-- Step 3: read-only, secrets-scoped role for the standalone egress MITM service (tdsk-egress).
-- Its connection URL goes into TDSK_DB_EGRESS_URL -> `tdsk kube secret database-egress` (secret tdsk-database-egress).
-- Replace the password before running; never commit it.
CREATE ROLE tdsk_egress_ro WITH LOGIN PASSWORD '<set-me>';
GRANT USAGE ON SCHEMA public TO tdsk_egress_ro;
-- Run after the drizzle schema exists (public.secrets must be present).
GRANT SELECT ON public.secrets TO tdsk_egress_ro;
