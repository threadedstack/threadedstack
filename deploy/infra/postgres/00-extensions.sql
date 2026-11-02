-- Step 1 of a fresh Postgres bootstrap: extensions required before the drizzle schema is applied.
-- (repos/cli/src/utils/db/pushSafe.ts also runs this during `tdsk release`; the drizzle migrations do not.)
CREATE EXTENSION IF NOT EXISTS vector;
