export const SBTcpTimeout = 10_000
export const SBBackpressureMaxWait = 30_000
export const SBBackpressureThreshold = 64 * 1024
export const SBTunnelPattern = /^\/_\/sandboxes\/([^/]+)\/tunnel$/
export const SBShellPattern = /^\/_\/sandboxes\/([^/]+)\/shell$/
export const SBMonitorPattern = /^\/_\/sandboxes\/monitor$/

export const DefSBConfig = {
  timeoutMin: 30,
  maxWait: 120_000,
  pollInterval: 2_000,
  idleInterval: 60_000,
}

export const TunnelRateLimit = 5
export const TunnelRateWindow = 60_000
export const TunnelBlockDuration = 60_000
export const TunnelFastCloseThreshold = 10_000

export const WsPingInterval = 30_000

export const MaxTerminalDim = 500
export const RateLimiterMaxKeys = 10_000

export const ExecTimeoutMS = 60 * 60_000

export const MinScheduleTimeoutMS = 60_000
export const MaxScheduleTimeoutMS = 2 * 60 * 60_000

export const PodReadyTimeoutMS = 3 * 60_000

/**
 * Readiness deadline for pod paths that must wait for the entrypoint's setup
 * script (dependency install/build) to finish before the workspace-ready marker
 * appears. Longer than PodReadyTimeoutMS because `pnpm install`/`bundle install`
 * routinely take minutes; the AI tool must not start against a half-installed
 * workspace.
 */
export const SetupReadyTimeoutMS = 10 * 60_000
