/**
 * A single drizzle migration file follows the expand-migrate-contract pattern:
 * a destructive change (dropping a table/column) must ship in its own
 * migration, never bundled with additive changes (new tables/columns) that
 * a rollback of the destructive half would otherwise strand.
 */
const StatementBreakpointRe = /--> statement-breakpoint/g
const DestructiveStatementRe = /\bDROP\s+TABLE\b|\bDROP\s+COLUMN\b/i
const AdditiveStatementRe = /\bADD\s+COLUMN\b|\bCREATE\s+TABLE\b/i

export type TMigrationViolation = {
  destructiveStatements: string[]
  additiveStatements: string[]
}

const splitStatements = (sql: string): string[] =>
  sql
    .split(StatementBreakpointRe)
    .map((statement) => statement.trim())
    .filter(Boolean)

/**
 * Returns the offending statements when a migration mixes a destructive
 * (DROP TABLE / DROP COLUMN) statement with an additive (ADD COLUMN /
 * CREATE TABLE) statement, or null when the migration is safe.
 */
export const findMixedMigrationViolation = (sql: string): TMigrationViolation | null => {
  const statements = splitStatements(sql)

  const destructiveStatements = statements.filter((statement) =>
    DestructiveStatementRe.test(statement)
  )
  if (!destructiveStatements.length) return null

  const additiveStatements = statements.filter((statement) =>
    AdditiveStatementRe.test(statement)
  )
  if (!additiveStatements.length) return null

  return { destructiveStatements, additiveStatements }
}
