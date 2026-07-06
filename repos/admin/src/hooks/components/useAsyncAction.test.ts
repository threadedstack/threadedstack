import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAsyncAction } from './useAsyncAction'

describe('useAsyncAction', () => {
  it('returns the resolved value and leaves error null on success', async () => {
    const { result } = renderHook(() => useAsyncAction())

    let returned: string | undefined
    await act(async () => {
      returned = await result.current.run(() => Promise.resolve('ok'))
    })

    expect(returned).toBe('ok')
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('sets error state from an Error rejection and re-throws it', async () => {
    const { result } = renderHook(() => useAsyncAction())

    let thrown: unknown
    await act(async () => {
      try {
        await result.current.run(() => Promise.reject(new Error('boom')))
      } catch (err) {
        thrown = err
      }
    })

    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message).toBe('boom')
    expect(result.current.error).toBe('boom')
    expect(result.current.loading).toBe(false)
  })

  it('sets error state from a non-Error rejection by stringifying it', async () => {
    const { result } = renderHook(() => useAsyncAction())

    await act(async () => {
      await result.current
        .run(() => Promise.reject('plain string reason'))
        .catch(() => {})
    })

    expect(result.current.error).toBe('plain string reason')
  })

  it('clears a previous error at the start of a new run', async () => {
    const { result } = renderHook(() => useAsyncAction())

    await act(async () => {
      await result.current
        .run(() => Promise.reject(new Error('first failure')))
        .catch(() => {})
    })
    expect(result.current.error).toBe('first failure')

    await act(async () => {
      await result.current.run(() => Promise.resolve('second run'))
    })
    expect(result.current.error).toBeNull()
  })

  it('clearError resets error to null', async () => {
    const { result } = renderHook(() => useAsyncAction())

    await act(async () => {
      await result.current.run(() => Promise.reject(new Error('failure'))).catch(() => {})
    })
    expect(result.current.error).toBe('failure')

    act(() => result.current.clearError())
    expect(result.current.error).toBeNull()
  })
})
