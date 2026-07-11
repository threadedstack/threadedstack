import { describe, it, expect } from 'vitest'
import { findMixedMigrationViolation } from './destructiveMigrationGuard'

describe(`findMixedMigrationViolation`, () => {
  it(`returns null for a pure-additive migration`, () => {
    const sql = [
      `CREATE TABLE "widgets" ("id" varchar(10) PRIMARY KEY);`,
      `ALTER TABLE "endpoints" ADD COLUMN "meta" jsonb;`,
    ].join(`--> statement-breakpoint\n`)

    expect(findMixedMigrationViolation(sql)).toBeNull()
  })

  it(`returns null for a pure-destructive migration`, () => {
    const sql = [
      `DROP TABLE "widgets";`,
      `ALTER TABLE "endpoints" DROP COLUMN "meta";`,
    ].join(`--> statement-breakpoint\n`)

    expect(findMixedMigrationViolation(sql)).toBeNull()
  })

  it(`flags a migration mixing DROP TABLE with CREATE TABLE`, () => {
    const sql = [
      `DROP TABLE "widgets";`,
      `CREATE TABLE "gadgets" ("id" varchar(10) PRIMARY KEY);`,
    ].join(`--> statement-breakpoint\n`)

    const violation = findMixedMigrationViolation(sql)
    expect(violation).not.toBeNull()
    expect(violation?.destructiveStatements).toHaveLength(1)
    expect(violation?.destructiveStatements[0]).toContain(`DROP TABLE`)
    expect(violation?.additiveStatements).toHaveLength(1)
    expect(violation?.additiveStatements[0]).toContain(`CREATE TABLE`)
  })

  it(`flags a migration mixing DROP COLUMN with ADD COLUMN`, () => {
    const sql = [
      `ALTER TABLE "endpoints" DROP COLUMN "legacy_field";`,
      `ALTER TABLE "endpoints" ADD COLUMN "meta" jsonb;`,
    ].join(`--> statement-breakpoint\n`)

    const violation = findMixedMigrationViolation(sql)
    expect(violation).not.toBeNull()
    expect(violation?.destructiveStatements[0]).toContain(`DROP COLUMN`)
    expect(violation?.additiveStatements[0]).toContain(`ADD COLUMN`)
  })

  it(`is case-insensitive`, () => {
    const sql = [
      `drop table "widgets";`,
      `create table "gadgets" ("id" varchar(10));`,
    ].join(`--> statement-breakpoint\n`)

    expect(findMixedMigrationViolation(sql)).not.toBeNull()
  })
})
