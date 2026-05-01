import type { ApiClient } from '@TSA/services/api'
import type { TSandboxSession } from '@tdsk/domain'

import { createInterface } from 'readline'
import { themed } from '@TSA/theme'

const promptSessionSelection = async (sessions: TSandboxSession[]): Promise<string> => {
  const idW = 16
  const ownerW = 20
  const visW = 10

  process.stdout.write(`\n${themed(`primary`, `Select a session:`)}\n`)
  sessions.forEach((s, i) => {
    const id = s.sessionId.slice(0, 14).padEnd(idW)
    const owner = s.userId.slice(0, 18).padEnd(ownerW)
    const vis = s.visibility.padEnd(visW)
    process.stdout.write(
      `  ${themed(`muted`, `${i + 1}.`)} ${themed(`muted`, id)} ${owner} ${vis}\n`
    )
  })

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const onSigint = () => {
    rl.close()
    process.exit(130)
  }
  process.once(`SIGINT`, onSigint)
  return new Promise((resolve) => {
    const ask = () => {
      rl.question(`${themed(`muted`, `Enter number:`)} `, (answer) => {
        const idx = Number.parseInt(answer, 10) - 1
        if (idx >= 0 && idx < sessions.length) {
          process.removeListener(`SIGINT`, onSigint)
          rl.close()
          resolve(sessions[idx].sessionId)
        } else {
          process.stdout.write(
            `  ${themed(`error`, `Invalid selection.`)} Enter a number between 1 and ${sessions.length}.\n`
          )
          ask()
        }
      })
    }
    ask()
  })
}

export const resolveSessionId = async (
  client: ApiClient,
  orgId: string,
  projectId: string,
  sandboxId: string,
  explicitSessionId?: string
): Promise<string> => {
  if (explicitSessionId) return explicitSessionId

  const { data: sessions, error } = await client.getSandboxSessions(
    orgId,
    projectId,
    sandboxId
  )
  if (error || !sessions) throw new Error(error?.message || `Failed to list sessions`)

  if (sessions.length === 0) throw new Error(`No active sessions for this sandbox`)

  if (sessions.length === 1) {
    process.stdout.write(
      `${themed(`muted`, `Using session:`)} ${sessions[0].sessionId.slice(0, 12)}\n`
    )
    return sessions[0].sessionId
  }

  if (process.stdin.isTTY) return promptSessionSelection(sessions)

  throw new Error(`Multiple sessions found. Provide a session ID.`)
}
