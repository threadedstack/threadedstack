import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HooksService } from './hooks'

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}))

describe('HooksService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs a configured hook with environment variables', async () => {
    const cp = await import('node:child_process')
    vi.mocked(cp.execFile).mockImplementation(
      (_cmd: any, _args: any, _opts: any, cb: any) => {
        if (cb) cb(null, '', '')
        return {} as any
      }
    )

    const service = new HooksService({
      onSessionStart: 'echo hello',
    })

    await service.run('onSessionStart', { TDSK_AGENT_ID: 'a1' })
    expect(cp.execFile).toHaveBeenCalled()
  })

  it('does nothing when hook is not configured', async () => {
    const cp = await import('node:child_process')
    const service = new HooksService({})

    await service.run('onSessionStart', {})
    expect(cp.execFile).not.toHaveBeenCalled()
  })

  it('does not throw when hook command fails', async () => {
    const cp = await import('node:child_process')
    vi.mocked(cp.execFile).mockImplementation(
      (_cmd: any, _args: any, _opts: any, cb: any) => {
        if (cb) cb(new Error('command failed'), '', '')
        return {} as any
      }
    )

    const service = new HooksService({
      onError: 'bad-command',
    })

    await expect(service.run('onError', {})).resolves.not.toThrow()
  })

  it('passes environment variables to the hook', async () => {
    const cp = await import('node:child_process')
    vi.mocked(cp.execFile).mockImplementation(
      (_cmd: any, _args: any, opts: any, cb: any) => {
        if (cb) cb(null, '', '')
        return {} as any
      }
    )

    const service = new HooksService({
      onMessage: 'echo test',
    })

    await service.run('onMessage', { TDSK_THREAD_ID: 't1' })

    const callOpts = vi.mocked(cp.execFile).mock.calls[0][2] as any
    expect(callOpts.env.TDSK_THREAD_ID).toBe('t1')
  })
})
