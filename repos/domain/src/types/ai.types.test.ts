import { describe, it, expect } from 'vitest'
import { EAgentTool } from './ai.types'

describe(`EAgentTool enum`, () => {
  it(`should have evalCode enum value`, () => {
    expect(EAgentTool.evalCode).toBe(`evalCode`)
  })

  it(`should have createArtifact enum value`, () => {
    expect(EAgentTool.createArtifact).toBe(`createArtifact`)
  })

  it(`should retain existing tool enum values`, () => {
    expect(EAgentTool.mkdir).toBe(`mkdir`)
    expect(EAgentTool.listDir).toBe(`listDir`)
    expect(EAgentTool.readFile).toBe(`readFile`)
    expect(EAgentTool.webFetch).toBe(`webFetch`)
    expect(EAgentTool.webSearch).toBe(`webSearch`)
    expect(EAgentTool.writeFile).toBe(`writeFile`)
    expect(EAgentTool.shellExec).toBe(`shellExec`)
    expect(EAgentTool.deleteFile).toBe(`deleteFile`)
    expect(EAgentTool.fileExists).toBe(`fileExists`)
  })
})
