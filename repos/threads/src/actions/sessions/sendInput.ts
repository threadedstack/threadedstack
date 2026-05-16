import { toast } from 'sonner'
import { EShellMsg } from '@tdsk/domain'
import { sessionService } from '@TTH/services/sessionService'

export const sendInput = (sessionId: string, text: string): boolean =>
  sessionService.sendInput(sessionId, text)

export const sendControl = (sessionId: string, msg: Record<string, unknown>): boolean =>
  sessionService.sendControl(sessionId, msg)

export const approvePermission = (sessionId: string) => {
  if (
    !sessionService.sendControl(sessionId, {
      type: EShellMsg.PermissionResponse,
      response: `y`,
    })
  )
    toast.error(`Could not send approval`, { description: `Session disconnected` })
}

export const denyPermission = (sessionId: string) => {
  if (
    !sessionService.sendControl(sessionId, {
      type: EShellMsg.PermissionResponse,
      response: `n`,
    })
  )
    toast.error(`Could not send denial`, { description: `Session disconnected` })
}
