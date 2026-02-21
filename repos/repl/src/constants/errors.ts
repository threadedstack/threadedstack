export type TErrorPattern = {
  match: (error: unknown) => boolean
  message: string
  suggestion?: string
}

export const FRIENDLY_ERRORS: TErrorPattern[] = [
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

function hasCode(e: unknown, code: string): boolean {
  return e instanceof Error && `code` in e && (e as any).code === code
}

function hasStatus(e: unknown, status: number): boolean {
  return e instanceof Error && e.message.includes(`(${status})`)
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
