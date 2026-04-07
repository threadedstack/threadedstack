export type TErrorPattern = {
  match: (error: unknown) => boolean
  message: string
  suggestion?: string
}

export const FRIENDLY_ERRORS: TErrorPattern[] = [
  {
    match: (e) => isTlsCertError(e),
    message: `TLS certificate verification failed.`,
    suggestion: `Re-run with --insecure or log in again: tsa login <key> --insecure`,
  },
  {
    match: (e) =>
      hasCode(e, `ECONNREFUSED`) || hasCode(e, `ETIMEDOUT`) || hasCode(e, `ENOTFOUND`),
    message: `Can't reach the server.`,
    suggestion: `Check your internet connection and try again.`,
  },
  {
    match: (e) => hasStatus(e, 401),
    message: `Your session has expired.`,
    suggestion: `Run "tsa login" to reconnect.`,
  },
  {
    match: (e) => hasStatus(e, 403),
    message: `You don't have permission to do that.`,
    suggestion: `Contact your admin for access.`,
  },
  {
    match: (e) => hasStatus(e, 404),
    message: `That resource isn't available right now.`,
    suggestion: `Try "/agent" to pick a different one.`,
  },
  {
    match: (e) => hasStatus(e, 429),
    message: `The service is busy.`,
    suggestion: `Waiting a moment before trying again...`,
  },
  {
    match: (e) => hasStatus(e, 500) || hasStatus(e, 502) || hasStatus(e, 503),
    message: `The server is having trouble.`,
    suggestion: `Try again in a few moments.`,
  },
]

const TLS_ERROR_PATTERNS = [
  `unable to get local issuer certificate`,
  `self-signed certificate`,
  `UNABLE_TO_VERIFY_LEAF_SIGNATURE`,
  `CERT_HAS_EXPIRED`,
  `DEPTH_ZERO_SELF_SIGNED_CERT`,
  `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`,
]

function isTlsCertError(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  const msg = e.message
  const cause = (e as any).cause
  const causeMsg = cause instanceof Error ? cause.message : ``
  const causeCode = typeof cause?.code === `string` ? cause.code : ``
  return TLS_ERROR_PATTERNS.some(
    (p) => msg.includes(p) || causeMsg.includes(p) || causeCode.includes(p)
  )
}

function hasCode(e: unknown, code: string): boolean {
  return e instanceof Error && `code` in e && (e as any).code === code
}

function hasStatus(e: unknown, status: number): boolean {
  return e instanceof Error && e.message.includes(`(${status})`)
}

export type TApiErrorKind =
  | `auth`
  | `forbidden`
  | `network`
  | `notFound`
  | `data`
  | `server`
  | `tls`
  | `unknown`

export function classifyApiError(err: unknown): TApiErrorKind {
  if (!(err instanceof Error)) return `unknown`

  // Check Exception.status directly (new return-style errors)
  const status = `status` in err ? ((err as any).status as number) : undefined

  if (isTlsCertError(err)) return `tls`
  if (
    hasCode(err, `ECONNREFUSED`) ||
    hasCode(err, `ETIMEDOUT`) ||
    hasCode(err, `ENOTFOUND`)
  )
    return `network`

  // Check status field first, fall back to message parsing
  if (status === 401 || err.message.includes(`Not logged in`)) return `auth`
  if (status === 403) return `forbidden`
  if (status === 404) return `notFound`
  if (status === 400 || status === 422) return `data`
  if (status === 429 || status === 500 || status === 502 || status === 503)
    return `server`

  // Legacy fallback for old-style "(status)" messages
  if (hasStatus(err, 401) || err.message.includes(`Not logged in`)) return `auth`
  if (hasStatus(err, 403)) return `forbidden`
  if (hasStatus(err, 404)) return `notFound`
  if (hasStatus(err, 400) || hasStatus(err, 422)) return `data`
  if (
    hasStatus(err, 429) ||
    hasStatus(err, 500) ||
    hasStatus(err, 502) ||
    hasStatus(err, 503)
  )
    return `server`

  return `unknown`
}

export function toFriendlyError(error: Error): {
  message: string
  suggestion?: string
} {
  for (const pattern of FRIENDLY_ERRORS) {
    if (pattern.match(error))
      return { message: pattern.message, suggestion: pattern.suggestion }
  }

  return {
    message: `Something unexpected happened.\n[Error] ${error.message}`,
    suggestion: `Your conversation is saved — just restart the REPL.`,
  }
}
