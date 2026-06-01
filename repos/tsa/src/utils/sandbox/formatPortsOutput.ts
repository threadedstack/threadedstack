import type { TPortsResponse } from '@tdsk/domain'

import { themed } from '@TSA/theme'

export const formatPortsOutput = (data: TPortsResponse): void => {
  const { instanceId, exposed, detected } = data

  const exposedKeys = Object.keys(exposed)
  process.stdout.write(
    `\n${themed(`bold`, `Ports for instance`)} ${instanceId.slice(-16)}\n\n`
  )

  if (exposedKeys.length > 0) {
    process.stdout.write(`  ${themed(`primary`, `Exposed:`)}\n`)
    for (const [port, cfg] of Object.entries(exposed)) {
      process.stdout.write(`    ${themed(`bold`, port)} (${cfg.protocol})\n`)
    }
    process.stdout.write(`\n`)
  }

  if (detected.length > 0) {
    process.stdout.write(`  ${themed(`muted`, `Detected (not exposed):`)}\n`)
    for (const d of detected) {
      process.stdout.write(`    ${themed(`muted`, String(d.port))} (${d.protocol})\n`)
    }
    process.stdout.write(`\n`)
  }

  if (exposedKeys.length === 0 && detected.length === 0) {
    process.stdout.write(`  ${themed(`muted`, `No ports found`)}\n\n`)
  }
}
