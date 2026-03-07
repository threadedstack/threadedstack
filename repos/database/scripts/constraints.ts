import { sql } from 'drizzle-orm'
import { loadEnvs } from '@tdsk/domain'
import { database } from '@TDB/database'
import { ife } from '@keg-hub/jsutils/ife'

const nodeEnv = process.env.NODE_ENV || `local`
loadEnvs({ force: nodeEnv === `local` })

const db = database()

/**
 * Add FK constraint + index for providers.secret_id → secrets.id
 * Safe to re-run: uses IF NOT EXISTS / checks for existing constraint.
 */
ife(async () => {
  console.log(`Adding providers.secret_id FK constraint and index...`)

  // Drop existing FK constraint if it exists, then recreate with ON DELETE RESTRICT
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'providers_secret_id_fk'
      ) THEN
        ALTER TABLE providers DROP CONSTRAINT providers_secret_id_fk;
        RAISE NOTICE 'Dropped existing FK constraint providers_secret_id_fk';
      END IF;

      ALTER TABLE providers
        ADD CONSTRAINT providers_secret_id_fk
        FOREIGN KEY (secret_id) REFERENCES secrets(id) ON DELETE RESTRICT;
      RAISE NOTICE 'FK constraint providers_secret_id_fk created with ON DELETE RESTRICT';
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
