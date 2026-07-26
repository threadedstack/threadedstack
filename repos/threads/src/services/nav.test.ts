import type { TSessionLocationState } from '@TTH/types'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ERoutePath } from '@TTH/types'

const mockGetOrgId = vi.fn()

vi.mock(`@TTH/state/accessors`, () => ({
  getOrgId: () => mockGetOrgId(),
}))

import { NavService, nav } from './nav'

const originalLocation = window.location

const setLocation = (overrides: Record<string, unknown> = {}) => {
  Object.defineProperty(window, `location`, {
    configurable: true,
    value: {
      ...originalLocation,
      pathname: `/`,
      search: ``,
      assign: vi.fn(),
      replace: vi.fn(),
      ...overrides,
    },
  })
}

describe(`NavService`, () => {
  let pushStateSpy: ReturnType<typeof vi.spyOn>
  let replaceStateSpy: ReturnType<typeof vi.spyOn>
  let dispatchEventSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    setLocation()
    pushStateSpy = vi.spyOn(history, `pushState`).mockImplementation(() => {})
    replaceStateSpy = vi.spyOn(history, `replaceState`).mockImplementation(() => {})
    dispatchEventSpy = vi.spyOn(window, `dispatchEvent`).mockImplementation(() => true)
    consoleWarnSpy = vi.spyOn(console, `warn`).mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, `error`).mockImplementation(() => {})
  })

  afterEach(() => {
    Object.defineProperty(window, `location`, {
      configurable: true,
      value: originalLocation,
    })
    vi.restoreAllMocks()
  })

  describe(`constructor`, () => {
    it(`strips a leading slash off an explicit base`, () => {
      const service = new NavService(`/example.com`)
      expect(service.base).toBe(`example.com`)
    })

    it(`defaults to window.location.origin when no base is given`, () => {
      setLocation({ origin: `http://test.local` })
      const service = new NavService()
      expect(service.base).toBe(`http://test.local`)
    })
  })

  describe(`to()`, () => {
    it(`warns and does not touch history when path is falsy`, () => {
      const service = new NavService(`base`)
      service.to(``)
      expect(consoleWarnSpy).toHaveBeenCalled()
      expect(pushStateSpy).not.toHaveBeenCalled()
      expect(replaceStateSpy).not.toHaveBeenCalled()
    })

    it(`uses ERoutePath.Home verbatim with no base prefix, appending location.search`, () => {
      setLocation({ search: `?foo=bar` })
      const service = new NavService(`base`)
      service.to(ERoutePath.Home)
      expect(pushStateSpy).toHaveBeenCalledWith({}, ``, `${ERoutePath.Home}?foo=bar`)
    })

    it(`base-prefixes a normal path, stripping a leading slash, and appends location.search`, () => {
      setLocation({ search: `?x=1` })
      const service = new NavService(`base`)
      service.to(`/foo/bar`)
      expect(pushStateSpy).toHaveBeenCalledWith({}, ``, `base/foo/bar?x=1`)
    })

    it(`builds { usr, key } history state when opts.state is set`, () => {
      const service = new NavService(`base`)
      const state: TSessionLocationState = { sandboxId: `s1`, projectId: `p1` }
      service.to(`/foo`, { state })
      expect(pushStateSpy).toHaveBeenCalledWith(
        { usr: state, key: expect.any(String) },
        ``,
        expect.any(String)
      )
    })

    it(`uses an empty history state object when opts.state is not set`, () => {
      const service = new NavService(`base`)
      service.to(`/foo`)
      expect(pushStateSpy).toHaveBeenCalledWith({}, ``, expect.any(String))
    })

    it(`selects history.replaceState over pushState when opts.replace is set`, () => {
      const service = new NavService(`base`)
      service.to(`/foo`, { replace: true })
      expect(replaceStateSpy).toHaveBeenCalled()
      expect(pushStateSpy).not.toHaveBeenCalled()
    })

    it(`dispatches a popstate event after a successful push`, () => {
      const service = new NavService(`base`)
      service.to(`/foo`)
      expect(dispatchEventSpy).toHaveBeenCalledTimes(1)
      const event = dispatchEventSpy.mock.calls[0]?.[0] as Event
      expect(event.type).toBe(`popstate`)
    })

    it(`falls back to location.assign when pushState throws (opts.replace not set)`, () => {
      pushStateSpy.mockImplementationOnce(() => {
        throw new Error(`boom`)
      })
      const assign = vi.fn()
      setLocation({ assign })
      const service = new NavService(`base`)
      service.to(`/foo`)
      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(assign).toHaveBeenCalledWith(`base/foo`)
      expect(dispatchEventSpy).not.toHaveBeenCalled()
    })

    it(`falls back to location.replace when replaceState throws (opts.replace set)`, () => {
      replaceStateSpy.mockImplementationOnce(() => {
        throw new Error(`boom`)
      })
      const replace = vi.fn()
      setLocation({ replace })
      const service = new NavService(`base`)
      service.to(`/foo`, { replace: true })
      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(replace).toHaveBeenCalledWith(`base/foo`)
    })
  })

  describe(`is / not / has`, () => {
    it(`is() matches the exact pathname`, () => {
      setLocation({ pathname: `/orgs/1` })
      const service = new NavService(`base`)
      expect(service.is(`/orgs/1`)).toBe(true)
      expect(service.is(`/orgs/2`)).toBe(false)
    })

    it(`not() is the inverse of is()`, () => {
      setLocation({ pathname: `/orgs/1` })
      const service = new NavService(`base`)
      expect(service.not(`/orgs/1`)).toBe(false)
      expect(service.not(`/orgs/2`)).toBe(true)
    })

    it(`has() matches a pathname prefix`, () => {
      setLocation({ pathname: `/orgs/1/projects/2` })
      const service = new NavService(`base`)
      expect(service.has(`/orgs/1`)).toBe(true)
      expect(service.has(`/orgs/2`)).toBe(false)
    })
  })

  describe(`signin()`, () => {
    it(`is a no-op when already on the Signin path`, () => {
      setLocation({ pathname: ERoutePath.Signin })
      const service = new NavService(`base`)
      service.signin()
      expect(pushStateSpy).not.toHaveBeenCalled()
    })

    it(`navigates to Signin when not already there`, () => {
      setLocation({ pathname: `/somewhere-else` })
      const service = new NavService(`base`)
      service.signin()
      expect(pushStateSpy).toHaveBeenCalledWith(
        {},
        ``,
        expect.stringContaining(ERoutePath.Signin)
      )
    })
  })

  describe(`home()`, () => {
    it(`is a no-op when already on Home`, () => {
      setLocation({ pathname: ERoutePath.Home })
      const service = new NavService(`base`)
      service.home()
      expect(pushStateSpy).not.toHaveBeenCalled()
    })

    it(`routes to projects(orgId) when getOrgId() returns a value`, () => {
      setLocation({ pathname: `/elsewhere` })
      mockGetOrgId.mockReturnValue(`org-1`)
      const service = new NavService(`base`)
      service.home()
      expect(pushStateSpy).toHaveBeenCalledWith(
        {},
        ``,
        expect.stringContaining(`/orgs/org-1/projects`)
      )
    })

    it(`routes to orgs() when getOrgId() returns falsy`, () => {
      setLocation({ pathname: `/elsewhere` })
      mockGetOrgId.mockReturnValue(undefined)
      const service = new NavService(`base`)
      service.home()
      expect(pushStateSpy).toHaveBeenCalledWith({}, ``, `base/orgs`)
    })
  })

  describe(`path builders`, () => {
    it(`produces the expected URL string for each path builder`, () => {
      const service = new NavService(`base`)
      expect(service.path.org(`o1`)).toBe(`/orgs/o1`)
      expect(service.path.orgs()).toBe(`/orgs`)
      expect(service.path.projects(`o1`)).toBe(`/orgs/o1/projects`)
      expect(service.path.project(`o1`, `p1`)).toBe(`/orgs/o1/projects/p1`)
      expect(service.path.sandbox(`o1`, `p1`, `sb1`)).toBe(
        `/orgs/o1/projects/p1/sandbox/sb1`
      )
      expect(service.path.instance(`o1`, `p1`, `sb1`, `i1`)).toBe(
        `/orgs/o1/projects/p1/sandbox/sb1/instance/i1`
      )
      expect(service.path.session(`o1`, `p1`, `i1`, `s1`)).toBe(
        `/orgs/o1/projects/p1/instances/i1/session/s1`
      )
      expect(service.path.settings()).toBe(`/settings`)
    })
  })

  it(`exports a ready-to-use singleton nav instance`, () => {
    expect(nav).toBeInstanceOf(NavService)
  })
})
