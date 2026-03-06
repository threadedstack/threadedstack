import type { UserConfig } from 'vite'

import { defineConfig } from 'vite'
import { config } from './vite.workspace'

export default defineConfig(config as UserConfig)
