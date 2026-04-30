import { spawn } from 'child_process'

/**
 * Builds the ProxyCommand string for SSH to tunnel through `tsa proxy`.
 */
export const buildProxyCommand = (sandboxId: string): string => {
  const tsaBin = process.argv[0] || `tsa`
  const tsaScript = process.argv[1] || ``

  return tsaScript
    ? `${tsaBin} ${tsaScript} proxy ${sandboxId}`
    : `${tsaBin} proxy ${sandboxId}`
}

/**
 * Spawns an SSH process connected to a sandbox via the tsa proxy.
 *
 * When `remoteCommand` is provided, the command is executed on the remote host
 * with PTY allocation (`-t`) for interactive tools.
 *
 * When `shellToken` is provided, it is passed to the proxy subprocess via
 * the TDSK_TUNNEL_TOKEN env var so the tunnel endpoint can authenticate
 * browser-auth users who don't have an API key.
 *
 * Returns a promise that resolves when SSH exits cleanly, or rejects on error.
 */
export const spawnSsh = async (
  sandboxId: string,
  remoteCommand?: string,
  shellToken?: string
): Promise<void> => {
  const proxyCmd = buildProxyCommand(sandboxId)

  const sshArgs = [
    `-o`,
    `ProxyCommand=${proxyCmd}`,
    `-o`,
    `StrictHostKeyChecking=no`,
    `-o`,
    `UserKnownHostsFile=/dev/null`,
    `-o`,
    `LogLevel=ERROR`,
  ]

  // Add PTY allocation for remote commands (interactive tools need it)
  if (remoteCommand) sshArgs.push(`-t`)

  sshArgs.push(`sandbox@${sandboxId}`)

  // Wrap in login shell so /etc/profile.d/ is sourced (sets NODE_EXTRA_CA_CERTS etc.)
  if (remoteCommand) {
    const escaped = remoteCommand.replace(/'/g, `'\\''`)
    sshArgs.push(`--`, `sh -l -c '${escaped}'`)
  }

  const env = { ...process.env }
  if (shellToken) env.TDSK_TUNNEL_TOKEN = shellToken
  else delete env.TDSK_TUNNEL_TOKEN

  const sshProc = spawn(`ssh`, sshArgs, { stdio: `inherit`, env })

  await new Promise<void>((resolve, reject) => {
    sshProc.on(`close`, (code) => {
      if (code && code !== 0) {
        reject(new Error(`SSH exited with code ${code}`))
      } else {
        resolve()
      }
    })
    sshProc.on(`error`, (err: any) => {
      if (err.code === `ENOENT`) {
        reject(new Error(`ssh not found. Install OpenSSH to connect to sandboxes.`))
      } else {
        reject(err)
      }
    })
  })
}
