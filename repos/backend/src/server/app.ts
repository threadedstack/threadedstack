import type { TApp } from '@TBE/types'

import path from 'node:path'
import express from 'express'
import favicon from 'serve-favicon'
import { paths } from '@TBE/utils/paths'

/*
 * Creating the express app in own file to allow it to be shared as needed
 */
export const app = express() as TApp

app.use(favicon(path.join(paths.public, `/logo.svg`)))
