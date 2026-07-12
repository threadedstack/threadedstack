import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSetActiveOrgId = vi.fn()
const mockGetActiveOrgId = vi.fn()
const mockResetApiKeys = vi.fn()
const mockResetOrgQuota = vi.fn()
const mockResetOrgLimits = vi.fn()
const mockResetSubscription = vi.fn()
const mockResetInvoices = vi.fn()
const mockResetPaymentPlans = vi.fn()
const mockUnsetActiveProject = vi.fn()
const mockNavTo = vi.fn()

vi.mock('@TAF/state/accessors', () => ({
  setActiveOrgId: (...args: any[]) => mockSetActiveOrgId(...args),
  getActiveOrgId: () => mockGetActiveOrgId(),
  resetApiKeys: () => mockResetApiKeys(),
  resetOrgQuota: () => mockResetOrgQuota(),
  resetOrgLimits: () => mockResetOrgLimits(),
  resetSubscription: () => mockResetSubscription(),
  resetInvoices: () => mockResetInvoices(),
  resetPaymentPlans: () => mockResetPaymentPlans(),
}))

vi.mock('@TAF/actions/projects/local/unsetActiveProject', () => ({
  unsetActiveProject: (...args: any[]) => mockUnsetActiveProject(...args),
}))

vi.mock('@TAF/services/nav', () => ({
  nav: {
    to: (...args: any[]) => mockNavTo(...args),
  },
}))

import { setOrgActive } from './setOrgActive'

describe(`setOrgActive`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should reset all org-scoped caches when switching to a different org`, () => {
    mockGetActiveOrgId.mockReturnValue('org-a')

    setOrgActive('org-b', false)

    expect(mockResetOrgQuota).toHaveBeenCalledOnce()
    expect(mockResetOrgLimits).toHaveBeenCalledOnce()
    expect(mockResetSubscription).toHaveBeenCalledOnce()
    expect(mockResetInvoices).toHaveBeenCalledOnce()
    expect(mockResetPaymentPlans).toHaveBeenCalledOnce()
    expect(mockResetApiKeys).toHaveBeenCalledOnce()
    expect(mockUnsetActiveProject).toHaveBeenCalledOnce()
    expect(mockSetActiveOrgId).toHaveBeenCalledWith('org-b')
  })

  it(`should not reset org-scoped caches when the org is unchanged and force is falsy`, () => {
    mockGetActiveOrgId.mockReturnValue('org-a')

    setOrgActive('org-a', false)

    expect(mockResetOrgQuota).not.toHaveBeenCalled()
    expect(mockResetOrgLimits).not.toHaveBeenCalled()
    expect(mockResetSubscription).not.toHaveBeenCalled()
    expect(mockResetInvoices).not.toHaveBeenCalled()
    expect(mockResetPaymentPlans).not.toHaveBeenCalled()
    expect(mockResetApiKeys).not.toHaveBeenCalled()
    expect(mockUnsetActiveProject).not.toHaveBeenCalled()
    expect(mockSetActiveOrgId).not.toHaveBeenCalled()
  })

  it(`should reset org-scoped caches when the org is unchanged but force is true`, () => {
    mockGetActiveOrgId.mockReturnValue('org-a')

    setOrgActive('org-a', false, true)

    expect(mockResetOrgQuota).toHaveBeenCalledOnce()
    expect(mockResetOrgLimits).toHaveBeenCalledOnce()
    expect(mockResetSubscription).toHaveBeenCalledOnce()
    expect(mockResetInvoices).toHaveBeenCalledOnce()
    expect(mockResetPaymentPlans).toHaveBeenCalledOnce()
    expect(mockSetActiveOrgId).toHaveBeenCalledWith('org-a')
  })

  it(`should navigate to the org route when navigate is true`, () => {
    mockGetActiveOrgId.mockReturnValue('org-a')

    setOrgActive('org-b', true)

    expect(mockNavTo).toHaveBeenCalledWith('/orgs/org-b')
  })

  it(`should navigate to the orgs list route when orgId is empty`, () => {
    mockGetActiveOrgId.mockReturnValue('org-a')

    setOrgActive('', true)

    expect(mockNavTo).toHaveBeenCalledWith('/orgs')
  })
})
