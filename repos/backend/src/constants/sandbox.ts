export const SBTcpTimeout = 10_000
export const SBBackpressureMaxWait = 30_000
export const SBBackpressureThreshold = 64 * 1024
export const SBTunnelPattern = /^\/_\/sandboxes\/([^/]+)\/tunnel$/
export const SBShellPattern = /^\/_\/sandboxes\/([^/]+)\/shell$/

export const DefSBConfig = {
  timeoutMin: 30,
  maxWait: 120_000,
  pollInterval: 2_000,
  idleInterval: 60_000,
}
