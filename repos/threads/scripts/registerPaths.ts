import 'esbuild-register'

import { register } from 'tsconfig-paths'
import tsConfig from '../tsconfig.json'
register({
  baseUrl: '../',
  paths: tsConfig.compilerOptions.paths,
})
