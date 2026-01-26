import type { TShellCfg, TShellState } from '@TAG/types'
import type { TExecData } from '@TAG/tools/definitions/shell/definition'

import { Bash } from 'just-bash'
import { logger } from '@TAG/wasm/logger'
import { StreamManager } from '@TAG/tools/definitions/shell/streams'
import { getHomeDir } from '@TAG/tools/definitions/shell/utils/getHomeDir'

export class Shell {
  client: Bash
  config: TShellCfg
  state: TShellState
  streams: StreamManager

  constructor(opts: TShellCfg) {
    this.client = new Bash()

    this.config = {
      home: getHomeDir(opts.home),
      options: opts.options || {},
      verbose: opts.verbose ?? false,
      persistent: opts.persistent ?? true,
    }

    this.state = {
      bash: null,
      executionCount: 0,
      initialized: false,
      home: this.config.home,
    }

    logger.info(`Shell created`, {
      home: this.state.home,
      options: this.config,
    })
  }

  init = () => {
    if (this.state.initialized) return logger.warn(`Shell already initialized`)

    try {
      logger.info(`Initializing shell`)

      this.streams = new StreamManager()
    } catch (err) {}
  }

  exec = async (data: TExecData) => {
    // TODO: validate if this is even needed
    //const args: ParseEntry[] = shellQuote.parse(data.command)
    console.log(`------- data -------`)
    console.log(data)

    return data
  }
}
