import { spawn } from '@TSCL/utils/proc/spawn'

export type TCapture = {
  code: number
  output: string
  error: string
}

export type TCaptureOpts = {
  cwd?: string
  envs?: Record<string, string>
}

/**
 * Runs a command and captures its stdout/stderr and exit code without
 * writing to the parent stdio. Never throws — a spawn failure (e.g. missing
 * binary) resolves with a non-zero code and the error message.
 */
export const capture = async (
  cmd: string,
  args: string[] = [],
  opts: TCaptureOpts = {}
): Promise<TCapture> => {
  let output = ``
  let error = ``

  try {
    const code = await spawn({
      cmd,
      args,
      cwd: opts.cwd,
      envs: opts.envs,
      output: false,
      stdio: `pipe`,
      stdout: (data: string) => {
        output += data
      },
      stderr: (data: string) => {
        error += data
      },
    })

    // A null/undefined code means the process was terminated by a signal
    // (e.g. OOM-killed) — treat that as failure, never as success.
    return {
      code: code == null ? 1 : code,
      output: output.trim(),
      error: error.trim(),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { code: 1, output: output.trim(), error: (error || message).trim() }
  }
}
