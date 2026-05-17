import type { TMonitorMessage } from '@tdsk/domain'

import { toast } from 'sonner'
import { EShellMsg } from '@tdsk/domain'
import { apiService } from '@TTH/services/api'
import { sandboxApi } from '@TTH/services/sandboxApi'
import { setBackendSessions } from '@TTH/state/accessors'

const InitialReconnectDelay = 2_000
const MaxReconnectDelay = 60_000
const MaxRetries = 8
const PermanentCloseFloor = 4001

class MonitorService {
  private ws: WebSocket | null = null
  private orgId: string | null = null
  private retries = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private aborted = false

  connect(orgId: string): void {
    if (this.orgId === orgId && this.ws?.readyState === WebSocket.OPEN) return

    this.disconnect()
    this.orgId = orgId
    this.aborted = false
    this.retries = 0
    this.openConnection()
  }

  disconnect(): void {
    this.aborted = true
    this.orgId = null

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.onmessage = null
      this.ws.close()
      this.ws = null
    }
  }

  private async openConnection(): Promise<void> {
    const orgId = this.orgId
    if (!orgId || this.aborted) return

    const tokenResp = await sandboxApi.monitorToken(orgId)
    if (this.aborted || this.orgId !== orgId) return

    if (tokenResp.error || !tokenResp.data?.token) {
      const status = tokenResp.error?.status
      console.warn(
        `[MonitorService] Token acquisition failed for org ${orgId}:`,
        tokenResp.error?.message ?? `no token returned`
      )
      if (status === 401 || status === 403) return
      this.scheduleReconnect()
      return
    }

    const baseUrl = new URL(apiService.base)
    const wsProto = baseUrl.protocol === `https:` ? `wss:` : `ws:`
    const wsUrl = `${wsProto}//${baseUrl.host}/_/sandboxes/monitor?token=${tokenResp.data.token}`

    const ws = new WebSocket(wsUrl)
    this.ws = ws

    ws.onopen = () => {
      this.retries = 0
    }

    ws.onmessage = (event) => {
      if (this.aborted) return
      if (typeof event.data !== `string`) return

      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(event.data)
      } catch {
        console.warn(
          `[MonitorService] Failed to parse message:`,
          String(event.data).slice(0, 200)
        )
        return
      }

      if (msg.type === EShellMsg.SessionsUpdated && msg.sandboxId) {
        setBackendSessions(
          msg.sandboxId as string,
          (msg as TMonitorMessage).sessions ?? []
        )
      }
    }

    ws.onclose = (event) => {
      if (this.aborted) return
      this.ws = null
      if (event.code >= PermanentCloseFloor) {
        console.warn(
          `[MonitorService] Permanent close (code ${event.code}): ${event.reason}`
        )
        return
      }
      this.scheduleReconnect()
    }

    ws.onerror = (event) => {
      if (this.aborted) return
      console.warn(`[MonitorService] WebSocket error:`, event)
      ws.close()
    }
  }

  private scheduleReconnect(): void {
    if (this.aborted || !this.orgId) return
    if (this.retries >= MaxRetries) {
      console.warn(`[MonitorService] Max retries (${MaxRetries}) reached, stopping`)
      toast.warning(`Live session updates lost`, {
        id: `monitor-org`,
        description: `Refresh the page to reconnect`,
      })
      return
    }
    if (this.reconnectTimer) return

    const delay = Math.min(InitialReconnectDelay * 2 ** this.retries, MaxReconnectDelay)
    this.retries++

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.aborted && this.orgId) this.openConnection()
    }, delay)
  }
}

export const monitorService = new MonitorService()

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    monitorService.disconnect()
  })
}
