/**
 * Check if a hostname is allowed by a list of domain patterns.
 * Supports exact match and wildcard patterns (e.g. *.example.com).
 */
export function isDomainAllowed(hostname: string, allowedDomains: string[]): boolean {
  return allowedDomains.some((domain) => {
    if (domain.startsWith(`*.`)) {
      const baseDomain = domain.slice(2)
      return hostname === baseDomain || hostname.endsWith(`.${baseDomain}`)
    }
    return hostname === domain
  })
}
