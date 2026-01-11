import type { TApp } from '@TBE/types'

import hq from 'alias-hq'
import path from 'node:path'
import express from 'express'
import favicon from 'serve-favicon'
/*
 * Creating the express app in own file to allow it to be shared as needed
 */
export const app = express() as TApp

const aliases = hq.get(`webpack`)
app.use(favicon(path.join(aliases[`@TBE/public`], `/logo.svg`)))
