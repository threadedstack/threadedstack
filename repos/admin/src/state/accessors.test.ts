import { describe, it, expect, beforeEach } from 'vitest'
import {
  getInvoices,
  setInvoices,
  resetInvoices,
  getPaymentPlans,
  setPaymentPlans,
  resetPaymentPlans,
} from './accessors'

describe('paymentPlansState convention', () => {
  beforeEach(() => {
    resetPaymentPlans()
  })

  it('initial read returns undefined (not fetched yet)', () => {
    expect(getPaymentPlans()).toBeUndefined()
  })

  it('setPaymentPlans with array makes getPaymentPlans return that array', () => {
    const plans = [{ id: 'p1' }, { id: 'p2' }] as any
    setPaymentPlans(plans)
    expect(getPaymentPlans()).toEqual(plans)
  })

  it('setPaymentPlans with [] distinguishes fetched-empty from not-fetched', () => {
    setPaymentPlans([])
    expect(getPaymentPlans()).toEqual([])
    expect(getPaymentPlans()).not.toBeUndefined()
  })

  it('resetPaymentPlans returns state to undefined (not [])', () => {
    setPaymentPlans([{ id: 'p1' }] as any)
    resetPaymentPlans()
    expect(getPaymentPlans()).toBeUndefined()
  })
})

describe('invoicesState convention', () => {
  beforeEach(() => {
    resetInvoices()
  })

  it('initial read returns undefined (not fetched yet)', () => {
    expect(getInvoices()).toBeUndefined()
  })

  it('setInvoices with array makes getInvoices return that array', () => {
    const invoices = [{ id: 'i1' }] as any
    setInvoices(invoices)
    expect(getInvoices()).toEqual(invoices)
  })

  it('setInvoices with [] distinguishes fetched-empty from not-fetched', () => {
    setInvoices([])
    expect(getInvoices()).toEqual([])
    expect(getInvoices()).not.toBeUndefined()
  })

  it('resetInvoices returns state to undefined (not [])', () => {
    setInvoices([{ id: 'i1' }] as any)
    resetInvoices()
    expect(getInvoices()).toBeUndefined()
  })
})
