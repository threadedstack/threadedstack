import fs from 'node:fs'
import path from 'node:path'
import { ife } from '@keg-hub/jsutils/ife'
import { findMixedMigrationViolation } from '@TDB/utils/database/destructiveMigrationGuard'

const DrizzleDir = path.resolve(`drizzle`)

ife(async () => {
  const files = fs.existsSync(DrizzleDir)
    ? fs.readdirSync(DrizzleDir).filter((file) => file.endsWith(`.sql`))
    : []

  let hasViolation = false

  for (const file of files) {
    const sql = fs.readFileSync(path.join(DrizzleDir, file), `utf8`)
    const violation = findMixedMigrationViolation(sql)
    if (!violation) continue

    hasViolation = true
    console.error(`\nDestructive+additive mix detected in ${file}:`)
    console.error(`  Destructive statements:`)
    violation.destructiveStatements.forEach((statement) =>
      console.error(`    - ${statement}`)
    )
    console.error(`  Additive statements:`)
    violation.additiveStatements.forEach((statement) =>
      console.error(`    - ${statement}`)
    )
  }

  if (hasViolation) {
    console.error(
      `\nMixing destructive (DROP TABLE / DROP COLUMN) and additive (ADD COLUMN / CREATE TABLE) changes in the same migration violates the expand-migrate-contract pattern — split into separate migrations.`
    )
    process.exit(1)
  }

  console.log(`No destructive+additive migration mixes found.`)
}).catch((err: any) => {
  console.error(`Destructive migration check failed:`, err.message)
  process.exit(1)
})
