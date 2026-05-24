import type { TRunStatusCfg } from '@TAF/types'

export const StatusConfig: Record<string, TRunStatusCfg> = {
  error: { label: `Error`, color: `error` },
  running: { label: `Running`, color: `info` },
  success: { label: `Success`, color: `success` },
  timeout: { label: `Timeout`, color: `warning` },
}
