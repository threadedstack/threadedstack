#!/usr/bin/env bun

import { main } from '@TRL/cli'
import { red, bold } from '@TRL/display/colors'

main().catch((err) => {
  process.stderr.write(`${red(bold(`Fatal:`))} ${err.message}\n`)
  process.exit(1)
})
