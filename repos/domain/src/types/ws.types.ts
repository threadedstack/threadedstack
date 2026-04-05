import type {
  TTokenUsage,
  TArtifactType,
  TImageAttachment,
  TFileAttachment,
  TAgentConfigFields,
} from './ai.types'

/**
 * WebSocket event types shared across all repos.
 * Used as the `type` discriminator in all WS messages.
 */
export enum EWSEventType {
  // Client → Server
  Cancel = `cancel`,
  Prompt = `prompt`,
  Steer = `steer`,
  FollowUp = `follow_up`,
  FileUpload = `file_upload`,
  UpdateConfig = `update_config`,
  WorkspaceManifest = `workspace_manifest`,

  // Server → Client
  Ping = `ping`,
  Done = `done`,
  Error = `error`,
  TurnEnd = `turn_end`,
  TextDelta = `text_delta`,
  ThinkingDelta = `thinking_delta`,
  FileRequest = `file_request`,
  FileChanged = `file_changed`,
  ThreadCreated = `thread_created`,
  ToolExecutionEnd = `tool_execution_end`,
  ToolExecutionStart = `tool_execution_start`,
  ToolExecutionUpdate = `tool_execution_update`,
  Artifact = `artifact`,
  FileUploadComplete = `file_upload_complete`,
}

export type TWSEventType = `${EWSEventType}`

// ── Client → Server Messages ──

export type TWSPromptMsg = {
  type: EWSEventType.Prompt
  prompt: string
  threadId?: string
  maxSteps?: number
  files?: TFileAttachment[]
  images?: TImageAttachment[]
}

export type TWSFileUploadMsg = {
  type: EWSEventType.FileUpload
  requestId: string
  path: string
  content: string
}

export type TWSWorkspaceManifestMsg = {
  type: EWSEventType.WorkspaceManifest
  rootDir: string
  files: { path: string; hash: string; size: number }[]
}

export type TWSSteerMsg = {
  type: EWSEventType.Steer
  message: string
}

export type TWSFollowUpMsg = {
  type: EWSEventType.FollowUp
  message: string
}

export type TWSUpdateConfigMsg = TAgentConfigFields & {
  type: EWSEventType.UpdateConfig
}

export type TWSCancelMsg = {
  type: EWSEventType.Cancel
}

export type TWSClientMsg =
  | TWSPromptMsg
  | TWSSteerMsg
  | TWSFollowUpMsg
  | TWSFileUploadMsg
  | TWSUpdateConfigMsg
  | TWSWorkspaceManifestMsg
  | TWSCancelMsg

// ── Server → Client Messages ──

export type TWSTextDeltaMsg = {
  type: EWSEventType.TextDelta
  delta: string
}

export type TWSToolExecStartMsg = {
  type: EWSEventType.ToolExecutionStart
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
}

export type TWSToolExecEndMsg = {
  type: EWSEventType.ToolExecutionEnd
  toolCallId: string
  result: string
  isError: boolean
}

export type TWSToolExecUpdateMsg = {
  type: EWSEventType.ToolExecutionUpdate
  toolCallId: string
  result: string
  isError: boolean
}

export type TWSFileRequestMsg = {
  type: EWSEventType.FileRequest
  requestId: string
  path: string
}

export type TWSFileChangedMsg = {
  type: EWSEventType.FileChanged
  path: string
  content: string
}

export type TWSThinkingDeltaMsg = {
  type: EWSEventType.ThinkingDelta
  delta: string
}

export type TWSThreadCreatedMsg = {
  type: EWSEventType.ThreadCreated
  threadId: string
}

export type TWSTurnEndMsg = {
  type: EWSEventType.TurnEnd
  usage: TTokenUsage
}

export type TWSDoneMsg = {
  type: EWSEventType.Done
  reason: `complete` | `error` | `cancelled`
}

export type TWSErrorMsg = {
  type: EWSEventType.Error
  message: string
}

export type TWSArtifactMsg = {
  type: EWSEventType.Artifact
  artifactType: TArtifactType
  content: string
  title?: string
  language?: string
}

export type TWSFileUploadCompleteMsg = {
  type: EWSEventType.FileUploadComplete
  requestId: string
  assetId: string
  fileName: string
  fileType: string
  fileSize: number
}

export type TWSPingMsg = {
  type: EWSEventType.Ping
}

export type TWSServerMsg =
  | TWSPingMsg
  | TWSTextDeltaMsg
  | TWSThinkingDeltaMsg
  | TWSToolExecStartMsg
  | TWSToolExecEndMsg
  | TWSToolExecUpdateMsg
  | TWSFileRequestMsg
  | TWSFileChangedMsg
  | TWSThreadCreatedMsg
  | TWSTurnEndMsg
  | TWSDoneMsg
  | TWSErrorMsg
  | TWSArtifactMsg
  | TWSFileUploadCompleteMsg
