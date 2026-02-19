import { execFile } from 'node:child_process'
import type { THooksConfig } from '@TRL/types'

type THookName = keyof THooksConfig

export class HooksService {
  #config: THooksConfig

  constructor(config: THooksConfig) {
    this.#config = config
  }

  async run(name: THookName, env: Record<string, string>): Promise<void> {
    const command = this.#config[name]
    if (!command) return

    return new Promise<void>((resolve) => {
      execFile(
        '/bin/sh',
        ['-c', command],
        {
          env: { ...process.env, ...env },
          timeout: 10000,
        },
        (error) => {
          if (error) {
            process.stderr.write(`Hook "${name}" failed: ${error.message}\n`)
          }
          resolve()
        }
      )
    })
  }
}
