import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TOverrideEntry } from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { logger } from '@TBE/utils/logger'
import { applyOverrides } from './applyOverrides'

const buildMockDb = (createImpl?: (...args: any[]) => any) => {
  return {
    services: {
      permissionOverride: {
        create: createImpl ?? vi.fn().mockResolvedValue({ data: { id: `override-1` } }),
      },
    },
  } as any
}

const buildOverride = (overrides: Partial<TOverrideEntry> = {}): TOverrideEntry => ({
  permission: `agent:read` as any,
  effect: `grant`,
  ...overrides,
})

const opts = { userId: `user-1`, projectId: `proj-1`, grantedBy: `granter-1` }

describe(`applyOverrides`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`returns no warnings and is a no-op when overrides is empty`, async () => {
    const db = buildMockDb()

    const warnings = await applyOverrides(db, [], opts)

    expect(db.services.permissionOverride.create).not.toHaveBeenCalled()
    expect(warnings).toEqual([])
  })

  it(`creates a permission override for each entry, scoped to the given project/user`, async () => {
    const db = buildMockDb()

    const warnings = await applyOverrides(
      db,
      [
        buildOverride({ permission: `agent:read` as any, effect: `grant` }),
        buildOverride({
          permission: `agent:write` as any,
          effect: `deny`,
          reason: `too risky`,
          expiresAt: `2026-08-01T00:00:00.000Z`,
        }),
      ],
      opts
    )

    expect(db.services.permissionOverride.create).toHaveBeenCalledTimes(2)
    expect(db.services.permissionOverride.create).toHaveBeenNthCalledWith(1, {
      effect: `grant`,
      reason: undefined,
      userId: `user-1`,
      expiresAt: undefined,
      projectId: `proj-1`,
      grantedBy: `granter-1`,
      permission: `agent:read`,
    })
    expect(db.services.permissionOverride.create).toHaveBeenNthCalledWith(2, {
      effect: `deny`,
      reason: `too risky`,
      userId: `user-1`,
      expiresAt: `2026-08-01T00:00:00.000Z`,
      projectId: `proj-1`,
      grantedBy: `granter-1`,
      permission: `agent:write`,
    })
    expect(warnings).toEqual([])
  })

  it(`logs and collects a warning, but continues, when a create fails`, async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({ error: new Error(`DB error`) })
      .mockResolvedValueOnce({ data: { id: `override-2` } })
    const db = buildMockDb(create)

    const warnings = await applyOverrides(
      db,
      [
        buildOverride({ permission: `agent:read` as any }),
        buildOverride({ permission: `agent:write` as any }),
      ],
      opts
    )

    expect(create).toHaveBeenCalledTimes(2)
    expect(logger.error).toHaveBeenCalledWith(
      `Failed to create permission override:`,
      expect.any(Error)
    )
    expect(warnings).toEqual([`Failed to set agent:read override`])
  })

  it(`collects one warning per failed create when multiple fail`, async () => {
    const create = vi.fn().mockResolvedValue({ error: new Error(`DB down`) })
    const db = buildMockDb(create)

    const warnings = await applyOverrides(
      db,
      [
        buildOverride({ permission: `agent:read` as any }),
        buildOverride({ permission: `agent:write` as any }),
      ],
      opts
    )

    expect(create).toHaveBeenCalledTimes(2)
    expect(warnings).toEqual([
      `Failed to set agent:read override`,
      `Failed to set agent:write override`,
    ])
  })
})
