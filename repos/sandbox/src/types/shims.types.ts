import type { Bash, IFileSystem } from 'just-bash'

export type TShimDeps = {
  bash: Bash
  fs: IFileSystem
  maxTimerMs?: number
  env?: Record<string, string>
  onLog?: (...args: any[]) => void
}

export type TShimDefinition = {
  names: string[]
  source?: string
  setupGlobals?: (context: any, deps: TShimDeps) => Promise<void>
  setupCallbacks?: (jail: any, ivm: any, deps: TShimDeps) => Promise<void>
}
