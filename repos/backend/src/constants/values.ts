import type { TRetryConfig } from '@TBE/types'
import { EWSEventType, EHttpMethod } from '@tdsk/domain'

export const sigs = [`SIGINT`, `SIGTERM`, `SIGQUIT`]

export const AuthIgnore = [`/`, `/health`, `/payments/webhooks`, `/subscriptions/plans`]

export const LoggerIgnore = {
  methods: [`OPTIONS`],
  routes: [`/.well-known/appspecific/com.chrome.devtools.json`],
}

export const HttpMethods = Object.values(EHttpMethod)

/** Ping interval to keep WS alive through proxy/LB layers during LLM silence */
export const WsPingIntervalMS = 25_000
export const WsMaxConnectionsPerIp = 20

/** Valid message types the server accepts from WebSocket clients */
export const ClientMsgTypes: ReadonlySet<string> = new Set<string>([
  EWSEventType.Steer,
  EWSEventType.Prompt,
  EWSEventType.Cancel,
  EWSEventType.FollowUp,
  EWSEventType.FileUpload,
  EWSEventType.UpdateConfig,
  EWSEventType.WorkspaceManifest,
])

/**
 * Payment plan cache timeout
 * Stripe payment service implementation.
 * Handles subscriptions, checkout, portal sessions, and webhook processing.
 */
export const PlansCacheTtl = 300_000

// Retry on specific HTTP status codes
// 408: Request Timeout
// 429: Too Many Requests
// 500: Internal Server Error
// 502: Bad Gateway
// 503: Service Unavailable
// 504: Gateway Timeout
export const AllowedRetryCodes = [408, 429, 500, 502, 503, 504]

/**
 * Default retry configuration
 */
export const DefRetryCfg: TRetryConfig = {
  maxRetries: 3,
  // 1 second
  initialDelay: 1000,
  // 30 seconds
  maxDelay: 30000,
  backoffMultiplier: 2,
  exponentialBackoff: true,
}

export const DBPaging = {
  max: 200,
  default: 50,
}

export const IDParamPattern = /:(id|[a-zA-Z]+Id)\b/

export const FileMaxSize = 25 * 1024 * 1024 // 25MB
export const FileAllowedMimePrefixes = [`text/`, `image/`]
export const FileAllowedMimeTypes = new Set([
  `application/json`,
  `application/xml`,
  `application/csv`,
  `application/pdf`,
  `application/javascript`,
  `application/typescript`,
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document`,
])

/** 1 MB output cap */
export const MaxOutputBytes = 1_048_576

/** 1 MB request body size limit */
export const RequestBodyMaxSize = 1_048_576

/** Default execution timeout in ms */
export const DefaultTimeoutMS = 30_000

/** Sandbox pool — max idle sandboxes and TTL before eviction */
export const PoolMaxSize = 5
// Aggregate ceiling across ALL tenant buckets combined — restores the
// original system-wide pool size limit that per-tenant partitioning (see
// PoolMaxSize above) would otherwise let grow unboundedly as
// N*PoolMaxSize under concurrent multi-tenant load.
export const PoolMaxTotalSize = 5
export const PoolTtlMS = 5 * 60 * 1000

// How long a session token lasts, used in websocket connections
export const SessionTtlSec = 3600 // 1 hour

// Token preview for placeholder tokens
export const PhTokenPrefix = `tdsk_ph_`

// Egress proxy cert mount locations
export const CACertPath = `/etc/tdsk/ca/tls.crt`
export const CAKeyPath = `/etc/tdsk/ca/tls.key`

// Real client IP from custom header injected by the front TCP server
export const RealIpHeader = `x-tdsk-real-ip`

export const CliSessionKeyTtlDays = 30
export const CliSessionKeyMaxPerOrg = 5
export const CliSessionKeyPrefix = `cli-session-`

/** Max character length for text extracted from uploaded documents (PDF, DOCX, text) */
export const MaxExtractedLength = 50_000
/** MIME type for Microsoft Word (.docx) documents */
export const DocXMime = `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
/** Application MIME types treated as extractable text content */
export const TextMimeTypes: ReadonlySet<string> = new Set([
  `application/json`,
  `application/xml`,
  `application/csv`,
  `application/javascript`,
  `application/typescript`,
])
