import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeatureGate } from './FeatureGate'

vi.mock('@tdsk/domain', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tdsk/domain')>()
  return {
    ...original,
    isFeatureEnabled: vi.fn((flag: string) => {
      if (flag === 'terminalGui') return true
      return false
    }),
  }
})

describe('FeatureGate', () => {
  it('should render children when flag is enabled', () => {
    render(
      <FeatureGate flag='terminalGui'>
        <div data-testid='child'>Visible</div>
      </FeatureGate>
    )
    expect(screen.getByTestId('child')).toBeDefined()
  })

  it('should not render children when flag is disabled', () => {
    render(
      <FeatureGate flag='skills'>
        <div data-testid='hidden'>Hidden</div>
      </FeatureGate>
    )
    expect(screen.queryByTestId('hidden')).toBeNull()
  })

  it('should render fallback when flag is disabled and fallback provided', () => {
    render(
      <FeatureGate
        flag='skills'
        fallback={<div data-testid='fallback'>Coming Soon</div>}
      >
        <div data-testid='hidden'>Hidden</div>
      </FeatureGate>
    )
    expect(screen.queryByTestId('hidden')).toBeNull()
    expect(screen.getByTestId('fallback')).toBeDefined()
  })

  it('should render null fallback by default when disabled', () => {
    const { container } = render(
      <FeatureGate flag='skills'>
        <div>Hidden</div>
      </FeatureGate>
    )
    expect(container.innerHTML).toBe('')
  })
})
