import { describe, it, expect, vi } from 'vitest'
import { WebSocketServer } from 'ws'
import { createWSServer } from './wsServer'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock(`ws`, () => {
  const mockWSS = {
    on: vi.fn(),
    handleUpgrade: vi.fn(),
    close: vi.fn(),
  }
  return {
    default: { Server: vi.fn(() => mockWSS) },
    WebSocketServer: vi.fn(() => mockWSS),
  }
})

vi.mock(`@TBE/endpoints/ai/onWSConnect`, () => ({
  onWSConnect: vi.fn(),
}))

describe(`createWSServer`, () => {
  it(`should create a WebSocketServer with noServer: true`, () => {
    const app = { locals: { db: {} } } as any

    createWSServer(app)

    expect(WebSocketServer).toHaveBeenCalledWith({ noServer: true })
  })

  it(`should return an object with handleUpgrade method`, () => {
    const app = { locals: { db: {} } } as any
    const result = createWSServer(app)

    expect(typeof result.onUpgrade).toBe(`function`)
  })
})
