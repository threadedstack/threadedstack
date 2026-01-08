import type { TProxyApp } from '@TPX/types'

import express from 'express'

/**
 * Creating the express app in own file to allow it to be shared as needed
 */
export const app = express() as TProxyApp
