import WebSocket from 'ws'
import { themed } from '@TSA/theme'
import { EShellMsg } from '@tdsk/domain'
import { isStr } from '@keg-hub/jsutils/isStr'
import { ShellConnectMsgs } from '@TSA/constants/shell'

type TShellConnectOptions = {
  run?: boolean
  proxyUrl: string
  sandboxId: string
  insecure?: boolean
  sessionId?: string
  bearerToken: string
  instanceId?: string
}

export const connectShellWebSocket = async (
  options: TShellConnectOptions
): Promise<string> => {
  const { run, proxyUrl, insecure, sandboxId, sessionId, instanceId, bearerToken } =
    options

  const wsBase = proxyUrl.replace(/^https:/, `wss:`).replace(/^http:/, `ws:`)
  const cols = process.stdout.columns || 80
  const rows = process.stdout.rows || 24

  const params = new URLSearchParams({
    cols: String(cols),
    rows: String(rows),
  })
  if (instanceId) params.set(`instanceId`, instanceId)
  if (sessionId) params.set(`sessionId`, sessionId)
  if (run) params.set(`run`, `true`)

  const wsUrl = `${wsBase}/_/sandboxes/${sandboxId}/shell?${params}`

  const ws = new WebSocket(wsUrl, {
    headers: { Authorization: `Bearer ${bearerToken}` },
    rejectUnauthorized: !insecure,
  })
  ws.binaryType = `nodebuffer`

  return new Promise<string>((resolve, reject) => {
    let settled = false
    let connected = false
    let detaching = false
    let menuVisible = false
    let afterNewline = true
    let afterTilde = false
    let resolvedSessionId = sessionId ?? ``

    const showMenu = () => {
      menuVisible = true
      const r = process.stdout.rows || 24
      const c = process.stdout.columns || 80
      const text = ` Session ─ (d) Detach  (esc) Cancel `
      process.stdout.write(`\x1b7\x1b[${r};1H\x1b[2K\x1b[7m${text.padEnd(c)}\x1b[0m\x1b8`)
    }

    const hideMenu = () => {
      menuVisible = false
      const r = process.stdout.rows || 24
      process.stdout.write(`\x1b7\x1b[${r};1H\x1b[2K\x1b8`)
    }

    ws.on(`open`, () => {
      if (process.stdin.isTTY) process.stdin.setRawMode(true)
      process.stdin.resume()
    })

    const onStdinData = (chunk: Buffer) => {
      if (ws.readyState !== WebSocket.OPEN) return

      if (menuVisible) {
        if (chunk[0] === 0x64 || chunk[0] === 0x44) {
          hideMenu()
          detaching = true
          ws.close()
        } else {
          hideMenu()
        }
        return
      }

      if (chunk.length === 1 && chunk[0] === 0x1d) {
        showMenu()
        return
      }

      const out: number[] = []

      for (const byte of chunk) {
        if (afterTilde) {
          afterTilde = false
          if (byte === 0x2e) {
            if (out.length) ws.send(Buffer.from(out))
            detaching = true
            ws.close()
            return
          }
          out.push(0x7e)
          if (byte !== 0x7e) out.push(byte)
          afterNewline = byte === 0x0d || byte === 0x0a
        } else if (afterNewline && byte === 0x7e) {
          afterTilde = true
        } else {
          afterNewline = byte === 0x0d || byte === 0x0a
          out.push(byte)
        }
      }

      if (out.length) ws.send(Buffer.from(out))
    }

    const onResize = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: EShellMsg.Resize,
            rows: process.stdout.rows || 24,
            cols: process.stdout.columns || 80,
          })
        )
      }
    }

    const cleanup = () => {
      clearTimeout(connectTimeout)
      if (settled) return
      settled = true
      process.stdin.off(`data`, onStdinData)
      process.stdout.off(`resize`, onResize)
      if (process.stdin.isTTY) process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdout.write(`\x1b[?1049l\x1b[?25h\x1b[0m`)
    }

    process.stdin.on(`data`, onStdinData)
    process.stdout.on(`resize`, onResize)

    const connectTimeout = setTimeout(() => {
      if (!settled) {
        cleanup()
        ws.close()
        reject(new Error(`Connection timed out`))
      }
    }, 30_000)

    ws.on(`message`, (data: Buffer, isBinary: boolean) => {
      if (!isBinary) {
        const text = isStr(data) ? data : data.toString(`utf8`)
        let msg: Record<string, any>
        try {
          msg = JSON.parse(text)
        } catch {
          process.stdout.write(text)
          return
        }

        if (ShellConnectMsgs.includes(msg.type)) {
          connected = true
          clearTimeout(connectTimeout)
          resolvedSessionId = msg.sessionId ?? resolvedSessionId
          if (msg.type === EShellMsg.Connected) {
            process.stderr.write(
              `${themed(`success`, `Connected`)} session ${resolvedSessionId.slice(0, 12)} ${themed(`muted`, `(ctrl+] to detach)`)}\n`
            )
          }
        } else if (msg.type === EShellMsg.SandboxStopping) {
          process.stderr.write(
            `${themed(`warning`, `Warning:`)} Sandbox is being stopped by another user\n`
          )
        } else if (msg.type === EShellMsg.Error) {
          process.stderr.write(`${themed(`error`, `Error:`)} ${msg.message}\n`)
          if (!connected) {
            cleanup()
            reject(new Error(msg.message))
          }
        } else if (msg.type === EShellMsg.Disconnected) {
          process.stderr.write(`${themed(`muted`, `Disconnected: ${msg.reason}`)}\n`)
        } else if (msg.type === EShellMsg.UserJoined) {
          process.stderr.write(
            `${themed(`muted`, `User ${msg.userId?.slice(0, 8)} joined`)}\n`
          )
        } else if (msg.type === EShellMsg.UserLeft) {
          process.stderr.write(
            `${themed(`muted`, `User ${msg.userId?.slice(0, 8)} left`)}\n`
          )
        }
        return
      }

      process.stdout.write(data)
    })

    ws.on(`close`, (code: number, reason: Buffer) => {
      if (settled) return
      cleanup()
      if (detaching) {
        process.stderr.write(
          `${themed(`muted`, `Detached from session ${resolvedSessionId.slice(0, 12)}`)}\n`
        )
      }
      if (connected) resolve(resolvedSessionId)
      else {
        const detail = reason.length ? reason.toString() : `code ${code}`
        reject(new Error(`Connection closed before session was established (${detail})`))
      }
    })

    ws.on(`error`, (err: Error) => {
      if (settled) return
      cleanup()
      reject(new Error(err.message || `WebSocket connection failed`))
    })
  })
}
