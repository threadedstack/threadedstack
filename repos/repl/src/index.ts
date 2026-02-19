#!/usr/bin/env bun

import { main } from '@TRL/cli'
import { themed } from '@TRL/theme'

main().catch((err) => {
  process.stderr.write(`${themed('error', `Fatal:`)} ${err.message}\n`)
  process.exit(1)
})
