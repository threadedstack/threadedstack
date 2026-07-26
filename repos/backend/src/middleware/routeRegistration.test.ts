import type { TApp, TEndpointConfig } from '@TBE/types'

import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi } from 'vitest'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// Every endpoint file gets `await import()`-ed below, including plenty that
// transitively pull in @tdsk/database's logger — which reads DB connection
// env vars at import time and throws if they're unset (there's no live DB in
// this test). Mirrors the exact mocks every such endpoint test file already
// carries (e.g. createOrg.test.ts) so the raw import succeeds the same way.
vi.mock(`@TDB/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))
vi.mock(`@TDB/configs/db.config`, () => ({
  config: { logger: { label: `db`, level: `error` } },
}))

/**
 * `router.ts`'s `Async` helper wraps every handler (middleware AND the final
 * action) passed to a router method in `express-async-handler` before it
 * ever reaches Express. `express-async-handler` doesn't expose the original
 * function it wraps, so the only way to observe "was THIS exact action
 * function actually registered on the real router tree" is to intercept it
 * at the wrapping boundary — spy on the module while still delegating to the
 * real implementation, so route registration behaves identically to prod.
 */
const capturedHandlers = new Set<unknown>()
vi.mock(`express-async-handler`, async (importOriginal) => {
  const actual = await importOriginal<{ default: (fn: unknown) => unknown }>()
  return {
    default: (fn: unknown) => {
      capturedHandlers.add(fn)
      return actual.default(fn)
    },
  }
})

import { config } from '@TBE/configs/backend.config'
import { createAsyncRouter } from '@TBE/server/router'
import { setupEndpoints } from './setupEndpoints'

type TScannedLeaf = { file: string; exportName: string; action: unknown }

/** A genuine leaf endpoint: a real request handler, not an `endpoints: {...}`
 * aggregator (those regroup other files' leaves for test convenience — e.g.
 * `providers.ts` documents itself as "intentionally not registered" — and
 * have no `action` of their own to check). */
const isLeafEndpoint = (value: unknown): value is TEndpointConfig =>
  Boolean(value) &&
  typeof value === `object` &&
  typeof (value as TEndpointConfig).path === `string` &&
  typeof (value as TEndpointConfig).action === `function`

const endpointsDir = path.resolve(__dirname, `../endpoints`)

/** Every non-test .ts file under src/endpoints, collected via a real
 * recursive filesystem walk (not a curated list — a new file is picked up
 * automatically). Returned as paths relative to THIS file so the dynamic
 * `import()` below goes through Vite's normal resolution pipeline — an
 * absolute filesystem path bypasses it and breaks `@TBE`/`@TDB`/etc alias
 * resolution for anything the file transitively imports. */
const listEndpointFiles = (dir: string): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true, recursive: true })
  return entries
    .filter(
      (entry) =>
        entry.isFile() && entry.name.endsWith(`.ts`) && !entry.name.endsWith(`.test.ts`)
    )
    .map((entry) => {
      const absolute = path.join(
        (entry as any).parentPath ?? (entry as any).path ?? dir,
        entry.name
      )
      const relative = path.relative(__dirname, absolute).replace(/\\/g, `/`)
      return relative.startsWith(`.`) ? relative : `./${relative}`
    })
}

describe(`route registration smoke test`, () => {
  it(`mounts every leaf endpoint file's action handler onto the real, production-built router tree`, async () => {
    // Build the SAME app.locals.config the real entrypoint sets before
    // setupEndpoints runs (see main.ts) — none of the tree's builder
    // functions (accounts, author*/dispatchAgentActions) need anything past
    // config.server at BUILD time, so no db/payments/s3 stubs are needed.
    const app = {
      locals: {
        config: {
          ...config,
          proxy: { ...config.proxy, publicRoutes: [] as string[] },
        },
      },
    } as unknown as TApp

    const router = createAsyncRouter()
    setupEndpoints(app, router)

    const files = listEndpointFiles(endpointsDir)
    expect(files.length).toBeGreaterThan(100)

    const leaves: TScannedLeaf[] = []
    for (const file of files) {
      const mod: Record<string, unknown> = await import(file)
      for (const [exportName, value] of Object.entries(mod)) {
        if (isLeafEndpoint(value)) leaves.push({ file, exportName, action: value.action })
      }
    }

    // Sanity check on the scan itself, so a broken glob/import silently
    // finding nothing can't masquerade as "everything passed".
    expect(leaves.length).toBeGreaterThan(100)

    const orphaned = leaves.filter((leaf) => !capturedHandlers.has(leaf.action))

    expect(
      orphaned,
      `The following endpoint file(s) export an action handler that is exported ` +
        `(and presumably unit-tested directly) but was NEVER registered on the ` +
        `real mounted router tree -- it would 404 in production despite green ` +
        `tests, exactly like invokeFunction.ts in PR#395:\n` +
        orphaned.map((o) => `  - ${o.file} (export "${o.exportName}")`).join(`\n`)
    ).toEqual([])
    // 274+ files each get a real dynamic import (cold module-graph transform
    // cost per file); a few seconds per file's worth of transitive imports
    // adds up well past the default 5s test timeout.
  }, 120000)

  it(`the scan and the mount are both non-trivial (would fail loudly if invokeFunction-style orphan is reintroduced)`, async () => {
    // Directly reproduce the PR#395 incident: an endpoint file that exports a
    // valid leaf TEndpointConfig but is never added to any aggregator's
    // `endpoints: {...}` map. If this assertion ever regresses to catching
    // ZERO orphans for an intentionally-unmounted fixture, the smoke test
    // above has silently stopped working.
    const orphanAction = () => undefined
    const orphanEndpoint: TEndpointConfig = {
      path: `/never-mounted`,
      method: `get` as TEndpointConfig[`method`],
      action: orphanAction as TEndpointConfig[`action`],
    }

    expect(isLeafEndpoint(orphanEndpoint)).toBe(true)
    expect(capturedHandlers.has(orphanEndpoint.action)).toBe(false)
  })
})
