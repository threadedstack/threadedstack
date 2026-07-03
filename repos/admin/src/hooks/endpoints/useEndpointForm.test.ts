import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useEndpointForm } from './useEndpointForm'

describe('useEndpointForm', () => {
  it('exposes config to parent whenever state changes', () => {
    const onConfigChange = vi.fn()
    const onValidate = vi.fn()
    const mapToConfig = (state: any) => ({ value: state.value })
    const validate = () => null

    const { rerender } = renderHook(
      ({ state }) =>
        useEndpointForm(state, mapToConfig, validate, onConfigChange, onValidate),
      { initialProps: { state: { value: 'a' } } }
    )

    expect(onConfigChange).toHaveBeenCalledWith({ value: 'a' })

    rerender({ state: { value: 'b' } })
    expect(onConfigChange).toHaveBeenCalledWith({ value: 'b' })
  })

  it('runs validation when onValidate identity stays stable across renders (regression)', () => {
    // Regression test: previously validation relied on a ref-based trigger counter
    // that never caused a re-render, so the "validate when requested" effect never
    // re-ran for a stable onValidate — validation silently never fired.
    const onConfigChange = vi.fn()
    const onValidate = vi.fn()
    const validate = vi.fn(() => 'invalid')

    renderHook(() =>
      useEndpointForm({ value: 'a' }, (s: any) => s, validate, onConfigChange, onValidate)
    )

    expect(validate).toHaveBeenCalledTimes(1)
    expect(onValidate).toHaveBeenCalledWith('invalid')
  })

  it('re-runs validation when onValidate identity changes', () => {
    const onConfigChange = vi.fn()
    const validate = vi.fn(() => null)
    const onValidateA = vi.fn()
    const onValidateB = vi.fn()

    const { rerender } = renderHook(
      ({ onValidate }) =>
        useEndpointForm(
          { value: 'a' },
          (s: any) => s,
          validate,
          onConfigChange,
          onValidate
        ),
      { initialProps: { onValidate: onValidateA } }
    )

    expect(onValidateA).toHaveBeenCalledTimes(1)

    rerender({ onValidate: onValidateB })

    expect(onValidateB).toHaveBeenCalledTimes(1)
  })

  it('does not call validate before it has been triggered', () => {
    const onConfigChange = vi.fn()
    const validate = vi.fn(() => null)

    // onValidate is undefined so the trigger effect never fires
    renderHook(() =>
      useEndpointForm(
        { value: 'a' },
        (s: any) => s,
        validate,
        onConfigChange,
        undefined as any
      )
    )

    expect(validate).not.toHaveBeenCalled()
  })

  it('validates against the latest state when re-triggered', () => {
    const onConfigChange = vi.fn()
    const validate = vi.fn((state: any) => (state.value === 'valid' ? null : 'bad'))
    const onValidateA = vi.fn()
    const onValidateB = vi.fn()

    const { rerender } = renderHook(
      ({ state, onValidate }) =>
        useEndpointForm(state, (s: any) => s, validate, onConfigChange, onValidate),
      { initialProps: { state: { value: 'invalid' }, onValidate: onValidateA } }
    )

    expect(validate).toHaveBeenLastCalledWith({ value: 'invalid' })

    rerender({ state: { value: 'valid' }, onValidate: onValidateB })

    expect(validate).toHaveBeenLastCalledWith({ value: 'valid' })
    expect(onValidateB).toHaveBeenCalledWith(null)
  })
})
