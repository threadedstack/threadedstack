import { KubeSBPrefix } from '@TSB/constants/kube'

export type TSBHostResp = {
  port: string
  subdomain: string
}

/**
 * Parse a sandbox subdomain hostname into its components.
 *
 * Flat format (single DNS label, works with single-level wildcards):
 *   "3000--sb-a1b2c3d4.local.threadedstack.app"
 *   → { port: "3000", subdomain: "sb-a1b2c3d4" }
 *
 * The `--` separator keeps port + subdomain in one DNS label so
 * `*.local.threadedstack.app` and `*.sandbox.threadedstack.app`
 * wildcards match correctly.
 */
export const parseSandboxHost = (hostname: string): TSBHostResp | null => {
  const firstLabel = hostname.split(`.`)[0]
  const sepIdx = firstLabel.indexOf(`--`)
  if (sepIdx < 1) return null

  const port = firstLabel.slice(0, sepIdx)
  const subdomain = firstLabel.slice(sepIdx + 2)

  if (!subdomain.startsWith(`${KubeSBPrefix}-`)) return null
  if (!/^\d+$/.test(port)) return null

  return { port, subdomain }
}
