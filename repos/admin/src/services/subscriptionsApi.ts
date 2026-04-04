import type {
  TApiRes,
  TApiCacheKeys,
  TCheckoutData,
  TPortalSession,
  TCheckoutSession,
} from '@TAF/types'

import { BaseApi } from '@TAF/services/api'
import { Plan, Invoice, Subscription } from '@tdsk/domain'

/**
 * Subscriptions API Service
 * Handles all subscription-related API operations
 */
export class SubscriptionsApi extends BaseApi {
  private readonly path = `/subscriptions`

  cache: TApiCacheKeys = {
    all: () => [this.path] as const,
    current: () => [...this.cache.all(), `current`] as const,
    plans: () => [...this.cache.all(), `plans`] as const,
    invoices: () => [...this.cache.all(), `invoices`] as const,
  }

  /**
   * Get current user's subscription
   * @returns Current subscription data
   */
  async current(): Promise<TApiRes<Subscription>> {
    const resp = await this.api.get<Subscription>({
      path: `${this.path}/current`,
      queryKey: this.cache.current(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load subscription`))

    return {
      ...resp,
      data: new Subscription(resp.data),
    }
  }

  /**
   * Get available payment plans
   * @returns List of payment plans
   */
  async plans(): Promise<TApiRes<Plan[]>> {
    const resp = await this.api.get<Plan[]>({
      path: `${this.path}/plans`,
      queryKey: this.cache.plans(),
      staleTime: 5 * 60 * 1000, // Cache plans for 5 minutes
    })

    resp.error && (await this._onError(resp.error, `Failed to load payment plans`))

    return {
      ...resp,
      data: resp.data.map((item) => new Plan(item)),
    }
  }

  /**
   * Create a checkout session for a plan
   * @param data - Checkout data (planId, successUrl, cancelUrl)
   * @returns Checkout session with redirect URL
   */
  async checkout(data: TCheckoutData): Promise<TApiRes<TCheckoutSession>> {
    const resp = await this.api.post<TCheckoutSession>({
      data,
      path: `${this.path}/checkout`,
    })

    resp.error && (await this._onError(resp.error, `Failed to create checkout session`))

    return resp
  }

  /**
   * Get portal session URL for managing subscription
   * @returns Portal session with redirect URL
   */
  async portal(): Promise<TApiRes<TPortalSession>> {
    const resp = await this.api.post<TPortalSession>({
      path: `${this.path}/portal`,
    })

    resp.error && (await this._onError(resp.error, `Failed to create portal session`))

    return resp
  }

  /**
   * Get invoices for the current user
   * @returns List of invoices
   */
  async invoices(): Promise<TApiRes<Invoice[]>> {
    const resp = await this.api.get<Invoice[]>({
      path: `${this.path}/invoices`,
      queryKey: this.cache.invoices(),
      staleTime: 60 * 1000,
    })

    resp.error && (await this._onError(resp.error, `Failed to load invoices`))

    return {
      ...resp,
      data: resp.data?.map((item) => new Invoice(item)) ?? [],
    }
  }

  /**
   * Cancel current subscription
   * @returns Success status
   */
  async cancel(): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.path}/current`,
    })

    resp.error && (await this._onError(resp.error, `Failed to cancel subscription`))

    return resp
  }
}

// Export singleton instance
export const subscriptionsApi = new SubscriptionsApi()
