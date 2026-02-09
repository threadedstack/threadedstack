/**
 * Get the current billing period in YYYY-MM format
 */
export const getBillingPeriod = (): string => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
