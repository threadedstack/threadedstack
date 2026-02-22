import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSignout = vi.fn()
const mockReset = vi.fn()
const mockNavSignin = vi.fn()
const mockTokenRefreshStop = vi.fn()
const mockClearBearer = vi.fn()

vi.mock('@TAF/services/auth', () => ({
  auth: {
    signout: () => mockSignout(),
  },
}))

vi.mock('@TAF/services/api', () => ({
  apiService: {
    clearBearer: () => mockClearBearer(),
    bearer: vi.fn(),
  },
}))

vi.mock('@TAF/actions/auth/local/reset', () => ({
  reset: () => mockReset(),
}))

vi.mock('@TAF/services/nav', () => ({
  nav: {
    signin: () => mockNavSignin(),
  },
}))

vi.mock('@TAF/services/tokenRefresh', () => ({
  tokenRefresh: {
    stop: () => mockTokenRefreshStop(),
  },
}))

import { signout } from './signout'

describe(`signout`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignout.mockResolvedValue(true)
  })

  it(`should call tokenRefresh.stop()`, async () => {
    await signout()
    expect(mockTokenRefreshStop).toHaveBeenCalledOnce()
  })

  it(`should call tokenRefresh.stop() before auth.signout()`, async () => {
    const callOrder: string[] = []
    mockTokenRefreshStop.mockImplementation(() => callOrder.push(`stop`))
    mockSignout.mockImplementation(() => {
      callOrder.push(`signout`)
      return Promise.resolve(true)
    })

    await signout()
    expect(callOrder).toEqual([`stop`, `signout`])
  })

  it(`should call apiService.clearBearer()`, async () => {
    await signout()
    expect(mockClearBearer).toHaveBeenCalledOnce()
  })

  it(`should call auth.signout()`, async () => {
    await signout()
    expect(mockSignout).toHaveBeenCalledOnce()
  })

  it(`should call reset()`, async () => {
    await signout()
    expect(mockReset).toHaveBeenCalledOnce()
  })

  it(`should call nav.signin()`, async () => {
    await signout()
    expect(mockNavSignin).toHaveBeenCalledOnce()
  })

  it(`should continue when auth.signout() throws`, async () => {
    mockSignout.mockRejectedValueOnce(new Error(`Network error`))

    await signout()

    expect(mockClearBearer).toHaveBeenCalledOnce()
    expect(mockReset).toHaveBeenCalledOnce()
    expect(mockNavSignin).toHaveBeenCalledOnce()
  })
})
