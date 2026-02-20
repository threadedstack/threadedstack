import { database } from '@TDB/database'
import { ife } from '@keg-hub/jsutils/ife'
import { loadEnvs } from '@tdsk/domain'
import { sql } from 'drizzle-orm'

const nodeEnv = process.env.NODE_ENV || `local`
loadEnvs({ force: nodeEnv === `local` })

const db = database()

/**
 * Add FK constraint + index for providers.secret_id → secrets.id
 * Safe to re-run: uses IF NOT EXISTS / checks for existing constraint.
 */
ife(async () => {
  console.log(`Adding providers.secret_id FK constraint and index...`)

  // Add FK constraint (skip if already exists)
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'providers_secret_id_fk'
      ) THEN
        ALTER TABLE providers
          ADD CONSTRAINT providers_secret_id_fk
          FOREIGN KEY (secret_id) REFERENCES secrets(id) ON DELETE SET NULL;
        RAISE NOTICE 'FK constraint providers_secret_id_fk created';
      ELSE
        RAISE NOTICE 'FK constraint providers_secret_id_fk already exists, skipping';
      END IF;
    END
    $$;
  `)

  // Add index (IF NOT EXISTS is native to CREATE INDEX)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS providers_secret_id_idx ON providers(secret_id);
  `)

  console.log(`Done.`)
  process.exit(0)
})
