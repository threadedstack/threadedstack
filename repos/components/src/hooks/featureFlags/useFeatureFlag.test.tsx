import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('@tdsk/domain', () => ({
  isFeatureEnabled: vi.fn(() => false),
}))

import { useFeatureFlag } from './useFeatureFlag'

describe('useFeatureFlag', () => {
  it('should return false for disabled flags', () => {
    const { result } = renderHook(() => useFeatureFlag('terminalGui'))
    expect(result.current).toBe(false)
  })

  it('should return false for all currently disabled flags', () => {
    for (const flag of ['terminalGui', 'schedules', 'skills'] as const) {
      const { result } = renderHook(() => useFeatureFlag(flag))
      expect(result.current).toBe(false)
    }
  })
})
