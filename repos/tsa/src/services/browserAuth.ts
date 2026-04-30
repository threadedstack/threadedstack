import type { TBrowserAuthResult } from '@TSA/types'

import { randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'
import type { Server } from 'node:http'
import { createServer } from 'node:http'
import { LoginTimeoutMs } from '@TSA/constants/values'

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, `&amp;`)
    .replace(/</g, `&lt;`)
    .replace(/>/g, `&gt;`)
    .replace(/"/g, `&quot;`)

const openBrowser = (url: string): void => {
  const cmd =
    process.platform === `darwin`
      ? `open`
      : process.platform === `win32`
        ? `cmd`
        : `xdg-open`

  const args = process.platform === `win32` ? [`/c`, `start`, `""`, url] : [url]

  execFile(cmd, args, (err) => {
    if (err) {
      process.stderr.write(`\nCould not open browser automatically.\n`)
      process.stderr.write(`Open this URL manually:\n  ${url}\n\n`)
    }
  })
}

export const browserLogin = (authPageUrl: string): Promise<TBrowserAuthResult> => {
  return new Promise((resolve, reject) => {
    const state = randomBytes(16).toString(`hex`)
    let settled = false
    let timeout: ReturnType<typeof setTimeout>

    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      fn()
    }

    const server: Server = createServer((req, res) => {
      const url = new URL(req.url || ``, `http://localhost`)

      if (url.pathname !== `/callback`) {
        res.writeHead(404)
        res.end()
        return
      }

      const returnedState = url.searchParams.get(`state`)
      if (returnedState !== state) {
        res.writeHead(400, { 'Content-Type': `text/html` })
        res.end(`<html><body><h2>State mismatch — please try again.</h2></body></html>`)
        server.close()
        settle(() =>
          reject(new Error(`Auth callback state mismatch. Please re-run login.`))
        )
        return
      }

      const token = url.searchParams.get(`token`)
      const error = url.searchParams.get(`error`)

      if (!token) {
        res.writeHead(400, { 'Content-Type': `text/html` })
        res.end(
          `<html><body><h2>Authentication failed</h2><p>${escapeHtml(error || `No token received`)}</p></body></html>`
        )
        server.close()
        settle(() => reject(new Error(error || `No token received from browser`)))
        return
      }

      const rawExpiresAt = url.searchParams.get(`expiresAt`)
      if (!rawExpiresAt || isNaN(new Date(rawExpiresAt).getTime())) {
        process.stderr.write(
          `Warning: auth callback did not include a valid expiresAt. Token refresh may not work correctly.\n`
        )
      }
      const expiresAt = rawExpiresAt || undefined
      const authUrl = url.searchParams.get(`authUrl`) || undefined

      res.writeHead(200, { 'Content-Type': `text/html` })
      res.end(
        `<html><body><h2>Authentication successful!</h2><p>You can close this tab and return to the terminal.</p></body></html>`
      )

      server.close()
      settle(() => resolve({ token, expiresAt, authUrl }))
    })

    server.on(`error`, (err) => {
      settle(() => reject(new Error(`Failed to start local auth server: ${err.message}`)))
    })

    server.listen(0, `127.0.0.1`, () => {
      const addr = server.address()
      const port = typeof addr === `object` && addr ? addr.port : 0
      if (!port) {
        server.close()
        settle(() =>
          reject(new Error(`Failed to allocate a port for the auth callback server`))
        )
        return
      }
      const loginUrl = `${authPageUrl}?port=${port}&state=${state}`
      openBrowser(loginUrl)
    })

    timeout = setTimeout(() => {
      server.close()
      settle(() => reject(new Error(`Authentication timed out after 5 minutes.`)))
    }, LoginTimeoutMs)
  })
}
