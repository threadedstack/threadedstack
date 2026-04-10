#!/usr/bin/env bun

import util from 'node:util'
import { main } from '@TSA/cli'
import { themed } from '@TSA/theme'

util.inspect.defaultOptions.depth = null
process.env.STL_FORCE_DISABLE_SAFE = `1`

main().catch((err) => {
  process.stderr.write(`${themed('error', `Fatal:`)} ${err.message}\n`)
  process.exit(1)
})
