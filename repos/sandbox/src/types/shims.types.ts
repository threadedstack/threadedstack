import type { Bash, IFileSystem } from 'just-bash'

export type TShimDeps = {
  bash: Bash
  fs: IFileSystem
  maxTimerMs?: number
  env?: Record<string, string>
  onLog?: (...args: any[]) => void
  /**
   * The live isolate context, for shims whose host work settles back into the
   * isolate asynchronously (e.g. fetch's start/settle bridge calls
   * `context.evalClosure` when the host fetch completes).
   */
  context?: any
}

export type TShimDefinition = {
  names: string[]
  source?: string
  setupGlobals?: (context: any, deps: TShimDeps) => Promise<void>
  setupCallbacks?: (jail: any, ivm: any, deps: TShimDeps) => Promise<void>
}
