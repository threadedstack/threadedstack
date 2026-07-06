import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useSandboxForm } from './useSandboxForm'

vi.mock('@TAF/state/selectors', () => ({
  useSkills: () => [{}],
  useProjects: () => [{}],
  useProviders: () => [{}],
  useOrgSecrets: () => [{}],
  useProjectSecrets: () => [{}],
  useProjectSandboxes: () => [{}],
}))

vi.mock('@TAF/actions/sandboxes', () => ({
  createSandbox: vi.fn(),
  updateSandbox: vi.fn(),
}))

const buildSandbox = (overrides: Record<string, any> = {}): any => ({
  id: `sb-1`,
  name: `Original Name`,
  config: {},
  ...overrides,
})

describe('useSandboxForm', () => {
  describe('sandbox population effect', () => {
    it('populates form fields from the sandbox on initial mount', () => {
      const sandbox = buildSandbox()
      const { result } = renderHook(() => useSandboxForm({ orgId: `org-1`, sandbox }))

      expect(result.current.name).toBe(`Original Name`)
    })

    it('does not re-populate (clobber user edits) when the sandbox object identity changes but its id stays the same', () => {
      const sandboxV1 = buildSandbox({ name: `Original Name` })
      const { result, rerender } = renderHook(
        ({ sandbox }) => useSandboxForm({ orgId: `org-1`, sandbox }),
        { initialProps: { sandbox: sandboxV1 } }
      )

      expect(result.current.name).toBe(`Original Name`)

      // User edits the name locally
      act(() => result.current.setName(`Edited By User`))
      expect(result.current.name).toBe(`Edited By User`)

      // Parent re-renders with a brand-new sandbox object (same id) — e.g. a
      // selector recomputing a fresh reference for identical underlying data.
      const sandboxV2 = buildSandbox({ name: `Original Name` })
      rerender({ sandbox: sandboxV2 })

      // The effect must key off sandbox.id, not object identity, so it should
      // not re-fire and stomp the user's in-progress edit.
      expect(result.current.name).toBe(`Edited By User`)
    })

    it('re-populates when the sandbox id actually changes', () => {
      const sandboxV1 = buildSandbox({ id: `sb-1`, name: `First Sandbox` })
      const { result, rerender } = renderHook(
        ({ sandbox }) => useSandboxForm({ orgId: `org-1`, sandbox }),
        { initialProps: { sandbox: sandboxV1 } }
      )

      expect(result.current.name).toBe(`First Sandbox`)

      act(() => result.current.setName(`Edited By User`))
      expect(result.current.name).toBe(`Edited By User`)

      const sandboxV2 = buildSandbox({ id: `sb-2`, name: `Second Sandbox` })
      rerender({ sandbox: sandboxV2 })

      expect(result.current.name).toBe(`Second Sandbox`)
    })

    it('resets the form when sandbox becomes null/undefined (create mode)', () => {
      const sandbox = buildSandbox()
      const { result, rerender } = renderHook(
        ({ sandbox }) => useSandboxForm({ orgId: `org-1`, sandbox }),
        { initialProps: { sandbox: sandbox as any } }
      )

      expect(result.current.name).toBe(`Original Name`)

      rerender({ sandbox: null })
      expect(result.current.name).toBe(``)
    })
  })
})
