import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export interface TestContext {
  orgId: string
  apiKey: string
  userId: string
  agentId: string
  orgName: string
  projectId: string
}

const contextDir = join(tmpdir(), 'tdsk-integration')
const contextFile = join(contextDir, 'context.json')

/** Write shared state from global setup to temp file */
export const writeContext = (ctx: TestContext): void => {
  mkdirSync(contextDir, { recursive: true })
  writeFileSync(contextFile, JSON.stringify(ctx, null, 2))
}

/** Read shared state in individual test files */
export const readContext = (): TestContext => {
  try {
    return JSON.parse(readFileSync(contextFile, 'utf-8')) as TestContext
  } catch {
    throw new Error(
      'Test context not found. Global setup may have failed.\n' +
        `  Expected: ${contextFile}`
    )
  }
}
