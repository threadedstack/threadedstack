import type { createGitFsAdapter } from '@TSB/git/fsAdapter'

export type TGitFsAdapter = ReturnType<typeof createGitFsAdapter>

export type TGitCmdResult = {
  stdout: string
  stderr: string
  exitCode: number
}
