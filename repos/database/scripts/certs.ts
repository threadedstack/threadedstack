import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'
import { config } from '@TDB/configs/db.config'
import { Pool } from 'pg'
import { ife } from '@keg-hub/jsutils/ife'

/**
 * Restores the Caddy root CA cert/key from local files into the database
 * This allows Caddy to reuse the existing root CA instead of generating a new one
 *
 * Files expected at: ~/.config/tdsk/domain/root.crt and root.key
 * Caddy storage path: pki/authorities/local/root.crt and root.key
 */

const certDir = resolve(homedir(), `.config/tdsk/domain`)
const certPath = resolve(certDir, `root.crt`)
const keyPath = resolve(certDir, `root.key`)

ife(async () => {
  const pool = new Pool({ connectionString: config.url })

  console.log(`Restoring Caddy root CA from ${certDir}...\n`)

  const certData = readFileSync(certPath)
  const keyData = readFileSync(keyPath)

  console.log(`Read root.crt (${certData.length} bytes)`)
  console.log(`Read root.key (${keyData.length} bytes)\n`)

  // Create the caddy_certmagic_objects table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS caddy_certmagic_objects (
      parent TEXT NOT NULL,
      name TEXT NOT NULL,
      is_file BOOLEAN NOT NULL,
      value BYTEA,
      modified TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (parent, name),
      CONSTRAINT caddy_certmagic_objects_chk CHECK (
        (is_file = true AND value IS NOT NULL) OR
        (is_file = false AND value IS NULL)
      )
    );
  `)
  console.log(`Table caddy_certmagic_objects created/verified.`)

  // Create the caddy_locks table and sequence used by cirello.io/pglock
  // for distributed locking during certificate renewal
  await pool.query(`
    CREATE TABLE IF NOT EXISTS caddy_locks (
      name CHARACTER VARYING(255) PRIMARY KEY,
      record_version_number BIGINT,
      data BYTEA,
      owner CHARACTER VARYING(255)
    );
  `)
  await pool.query(`
    CREATE SEQUENCE IF NOT EXISTS caddy_locks_rvn CYCLE OWNED BY caddy_locks.record_version_number;
  `)
  console.log(`Table caddy_locks + sequence caddy_locks_rvn created/verified.`)

  // Insert the root cert and key at the path Caddy expects
  const parent = `pki/authorities/local`

  for (const [name, data] of [
    [`root.crt`, certData],
    [`root.key`, keyData],
  ] as const) {
    await pool.query(
      `INSERT INTO caddy_certmagic_objects (parent, name, is_file, value, modified)
       VALUES ($1, $2, true, $3, NOW())
       ON CONFLICT (parent, name) DO UPDATE SET value = $3, modified = NOW()`,
      [parent, name, data]
    )
    console.log(`Inserted ${parent}/${name}`)
  }

  // Also create directory entries Caddy expects
  const dirs = [`pki`, `pki/authorities`, `pki/authorities/local`]
  for (const dir of dirs) {
    const parts = dir.split(`/`)
    const dirParent = parts.slice(0, -1).join(`/`) || `.`
    const dirName = parts[parts.length - 1]
    await pool.query(
      `INSERT INTO caddy_certmagic_objects (parent, name, is_file, value, modified)
       VALUES ($1, $2, false, NULL, NOW())
       ON CONFLICT (parent, name) DO NOTHING`,
      [dirParent, dirName]
    )
  }
  console.log(`Created directory entries.\n`)

  console.log(`Root CA restored. Start Caddy with: tdsk dev start --clean`)

  await pool.end()
  process.exit(0)
}).catch((err: any) => {
  console.error(`Restore failed:`, err.message)
  process.exit(1)
})
