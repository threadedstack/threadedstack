import { describe, it, expect } from 'vitest'
import { EWSEventType } from './ws.types'

describe(`EWSEventType`, () => {
  it(`should define all client-to-server event types`, () => {
    expect(EWSEventType.Prompt).toBe(`prompt`)
    expect(EWSEventType.Cancel).toBe(`cancel`)
    expect(EWSEventType.FileUpload).toBe(`file_upload`)
    expect(EWSEventType.WorkspaceManifest).toBe(`workspace_manifest`)
  })

  it(`should define all server-to-client event types`, () => {
    expect(EWSEventType.Done).toBe(`done`)
    expect(EWSEventType.Error).toBe(`error`)
    expect(EWSEventType.TurnEnd).toBe(`turn_end`)
    expect(EWSEventType.TextDelta).toBe(`text_delta`)
    expect(EWSEventType.FileRequest).toBe(`file_request`)
    expect(EWSEventType.FileChanged).toBe(`file_changed`)
    expect(EWSEventType.ThreadCreated).toBe(`thread_created`)
    expect(EWSEventType.ToolExecutionEnd).toBe(`tool_execution_end`)
    expect(EWSEventType.ToolExecutionStart).toBe(`tool_execution_start`)
    expect(EWSEventType.ToolExecutionUpdate).toBe(`tool_execution_update`)
  })
})
