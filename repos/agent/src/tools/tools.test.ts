import type { Mock } from 'vitest'
import type { TFunctionExecResult } from '@tdsk/domain'

import { EAgentTool } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createWebTools,
  createMemoryTools,
  createRecordTools,
  createSandboxTools,
  createDelegateTools,
  buildCustomFunctionTools,
} from './tools'

const SANDBOX_TOOL_NAMES = [
  `shellExec`,
  `readFile`,
  `writeFile`,
  `listDir`,
  `deleteFile`,
  `mkdir`,
  `fileExists`,
  `evalCode`,
  `createArtifact`,
]

const WEB_TOOL_NAMES = [`webSearch`, `webFetch`]

describe(`createSandboxTools`, () => {
  let mockSandbox: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    mockSandbox = {
      mkdir: vi.fn().mockResolvedValue(undefined),
      fileExists: vi.fn().mockResolvedValue(true),
      close: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue(`file contents`),
      listDir: vi.fn().mockResolvedValue([`file1.ts`, `file2.ts`]),
      exec: vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        output: `cmd output`,
        error: ``,
      }),
      evaluate: vi.fn().mockResolvedValue({
        output: `console output`,
        result: 42,
      }),
    }
  })

  describe(`tool creation and filtering`, () => {
    it(`should return all 9 sandbox tools when no filter is provided`, () => {
      const tools = createSandboxTools(mockSandbox as any)
      expect(tools).toHaveLength(9)
      expect(tools.map((t) => t.name)).toEqual(SANDBOX_TOOL_NAMES)
    })

    it(`should filter tools by allowedTools names`, () => {
      const tools = createSandboxTools(mockSandbox as any, [`shellExec`, `readFile`])
      expect(tools).toHaveLength(2)
      expect(tools.map((t) => t.name)).toEqual([`shellExec`, `readFile`])
    })

    it(`should return all sandbox tools when allowedTools is an empty array`, () => {
      const tools = createSandboxTools(mockSandbox as any, [])
      expect(tools).toHaveLength(9)
      expect(tools.map((t) => t.name)).toEqual(SANDBOX_TOOL_NAMES)
    })

    it(`should return no tools when allowedTools contains no matching names`, () => {
      const tools = createSandboxTools(mockSandbox as any, [`nonExistent`])
      expect(tools).toHaveLength(0)
    })

    it(`should return a single filtered tool`, () => {
      const tools = createSandboxTools(mockSandbox as any, [`mkdir`])
      expect(tools).toHaveLength(1)
      expect(tools[0].name).toBe(`mkdir`)
    })
  })

  describe(`shellExec`, () => {
    it(`should call sandbox.exec with command and args and return output`, async () => {
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `shellExec`)!
      const result = await tool.execute(
        `call-1`,
        { command: `ls`, args: [`-la`] },
        undefined as any,
        vi.fn()
      )

      expect(mockSandbox.exec).toHaveBeenCalledWith(`ls`, [`-la`])
      expect(result.content).toEqual([{ type: `text`, text: `cmd output` }])
      expect(result.details).toEqual({ success: true, exitCode: 0 })
    })

    it(`should call sandbox.exec without args when none provided`, async () => {
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `shellExec`)!
      await tool.execute(`call-1`, { command: `pwd` }, undefined as any, vi.fn())

      expect(mockSandbox.exec).toHaveBeenCalledWith(`pwd`, undefined)
    })

    it(`should return error text when output is empty but error exists`, async () => {
      mockSandbox.exec.mockResolvedValue({
        success: false,
        exitCode: 1,
        output: ``,
        error: `not found`,
      })
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `shellExec`)!
      const result = await tool.execute(
        `call-1`,
        { command: `bad` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([{ type: `text`, text: `not found` }])
      expect(result.details).toEqual({ success: false, exitCode: 1 })
    })

    it(`should call onUpdate with running status`, async () => {
      const onUpdate = vi.fn()
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `shellExec`)!
      await tool.execute(
        `call-1`,
        { command: `echo`, args: [`hello`] },
        undefined as any,
        onUpdate
      )

      expect(onUpdate).toHaveBeenCalledWith({
        content: [{ type: `text`, text: `Running: echo hello` }],
        details: { status: `running` },
      })
    })

    it(`should format onUpdate text without args when args not provided`, async () => {
      const onUpdate = vi.fn()
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `shellExec`)!
      await tool.execute(`call-1`, { command: `pwd` }, undefined as any, onUpdate)

      expect(onUpdate).toHaveBeenCalledWith({
        content: [{ type: `text`, text: `Running: pwd` }],
        details: { status: `running` },
      })
    })
  })

  describe(`readFile`, () => {
    it(`should call sandbox.readFile with path and return content`, async () => {
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `readFile`)!
      const result = await tool.execute(
        `call-1`,
        { path: `/tmp/test.txt` },
        undefined as any,
        vi.fn()
      )

      expect(mockSandbox.readFile).toHaveBeenCalledWith(`/tmp/test.txt`)
      expect(result.content).toEqual([{ type: `text`, text: `file contents` }])
      expect(result.details).toEqual({ success: true })
    })

    it(`should call onUpdate with running status`, async () => {
      const onUpdate = vi.fn()
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `readFile`)!
      await tool.execute(`call-1`, { path: `/tmp/test.txt` }, undefined as any, onUpdate)

      expect(onUpdate).toHaveBeenCalledWith({
        content: [{ type: `text`, text: `Reading: /tmp/test.txt` }],
        details: { status: `running` },
      })
    })
  })

  describe(`writeFile`, () => {
    it(`should call sandbox.writeFile with path and content and return success`, async () => {
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `writeFile`)!
      const result = await tool.execute(
        `call-1`,
        { path: `/tmp/out.txt`, content: `hello world` },
        undefined as any,
        vi.fn()
      )

      expect(mockSandbox.writeFile).toHaveBeenCalledWith(`/tmp/out.txt`, `hello world`)
      expect(result.content).toEqual([
        { type: `text`, text: `File written to /tmp/out.txt` },
      ])
      expect(result.details).toEqual({ success: true })
    })

    it(`should call onUpdate with running status`, async () => {
      const onUpdate = vi.fn()
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `writeFile`)!
      await tool.execute(
        `call-1`,
        { path: `/tmp/out.txt`, content: `data` },
        undefined as any,
        onUpdate
      )

      expect(onUpdate).toHaveBeenCalledWith({
        content: [{ type: `text`, text: `Writing: /tmp/out.txt` }],
        details: { status: `running` },
      })
    })
  })

  describe(`listDir`, () => {
    it(`should call sandbox.listDir with path and return entries joined by newline`, async () => {
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `listDir`)!
      const result = await tool.execute(
        `call-1`,
        { path: `/tmp` },
        undefined as any,
        vi.fn()
      )

      expect(mockSandbox.listDir).toHaveBeenCalledWith(`/tmp`)
      expect(result.content).toEqual([{ type: `text`, text: `file1.ts\nfile2.ts` }])
      expect(result.details).toEqual({ success: true })
    })

    it(`should call onUpdate with running status`, async () => {
      const onUpdate = vi.fn()
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `listDir`)!
      await tool.execute(`call-1`, { path: `/src` }, undefined as any, onUpdate)

      expect(onUpdate).toHaveBeenCalledWith({
        content: [{ type: `text`, text: `Listing: /src` }],
        details: { status: `running` },
      })
    })
  })

  describe(`deleteFile`, () => {
    it(`should call sandbox.deleteFile with path and return success`, async () => {
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `deleteFile`)!
      const result = await tool.execute(
        `call-1`,
        { path: `/tmp/old.txt` },
        undefined as any,
        vi.fn()
      )

      expect(mockSandbox.deleteFile).toHaveBeenCalledWith(`/tmp/old.txt`)
      expect(result.content).toEqual([
        { type: `text`, text: `File deleted: /tmp/old.txt` },
      ])
      expect(result.details).toEqual({ success: true })
    })

    it(`should call onUpdate with running status`, async () => {
      const onUpdate = vi.fn()
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `deleteFile`)!
      await tool.execute(`call-1`, { path: `/tmp/old.txt` }, undefined as any, onUpdate)

      expect(onUpdate).toHaveBeenCalledWith({
        content: [{ type: `text`, text: `Deleting: /tmp/old.txt` }],
        details: { status: `running` },
      })
    })
  })

  describe(`mkdir`, () => {
    it(`should call sandbox.mkdir with path and return success`, async () => {
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `mkdir`)!
      const result = await tool.execute(
        `call-1`,
        { path: `/tmp/newdir` },
        undefined as any,
        vi.fn()
      )

      expect(mockSandbox.mkdir).toHaveBeenCalledWith(`/tmp/newdir`)
      expect(result.content).toEqual([
        { type: `text`, text: `Directory created: /tmp/newdir` },
      ])
      expect(result.details).toEqual({ success: true })
    })

    it(`should call onUpdate with running status`, async () => {
      const onUpdate = vi.fn()
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `mkdir`)!
      await tool.execute(`call-1`, { path: `/tmp/newdir` }, undefined as any, onUpdate)

      expect(onUpdate).toHaveBeenCalledWith({
        content: [{ type: `text`, text: `Creating directory: /tmp/newdir` }],
        details: { status: `running` },
      })
    })
  })

  describe(`fileExists`, () => {
    it(`should call sandbox.fileExists with path and return true as text`, async () => {
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `fileExists`)!
      const result = await tool.execute(
        `call-1`,
        { path: `/tmp/test.txt` },
        undefined as any,
        vi.fn()
      )

      expect(mockSandbox.fileExists).toHaveBeenCalledWith(`/tmp/test.txt`)
      expect(result.content).toEqual([{ type: `text`, text: `true` }])
      expect(result.details).toEqual({ exists: true })
    })

    it(`should return false as text when file does not exist`, async () => {
      mockSandbox.fileExists.mockResolvedValue(false)
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `fileExists`)!
      const result = await tool.execute(
        `call-1`,
        { path: `/tmp/missing.txt` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([{ type: `text`, text: `false` }])
      expect(result.details).toEqual({ exists: false })
    })
  })

  describe(`evalCode`, () => {
    it(`should call sandbox.evaluate with code and return result`, async () => {
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `evalCode`)!
      const result = await tool.execute(
        `call-1`,
        { code: `export default 42` },
        undefined as any,
        vi.fn()
      )

      expect(mockSandbox.evaluate).toHaveBeenCalledWith(`export default 42`, {
        timeout: undefined,
      })
      expect(result.content).toEqual([{ type: `text`, text: `42` }])
      expect(result.details).toEqual({ success: true, consoleOutput: `console output` })
    })

    it(`should pass timeout to sandbox.evaluate`, async () => {
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `evalCode`)!
      await tool.execute(
        `call-1`,
        { code: `export default 1`, timeout: 10000 },
        undefined as any,
        vi.fn()
      )

      expect(mockSandbox.evaluate).toHaveBeenCalledWith(`export default 1`, {
        timeout: 10000,
      })
    })

    it(`should return string result directly`, async () => {
      mockSandbox.evaluate.mockResolvedValue({
        output: ``,
        result: `hello world`,
      })
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `evalCode`)!
      const result = await tool.execute(
        `call-1`,
        { code: `export default 'hello world'` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([{ type: `text`, text: `hello world` }])
    })

    it(`should JSON.stringify non-string result`, async () => {
      mockSandbox.evaluate.mockResolvedValue({
        output: ``,
        result: { key: `value` },
      })
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `evalCode`)!
      const result = await tool.execute(
        `call-1`,
        { code: `export default { key: 'value' }` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([{ type: `text`, text: `{"key":"value"}` }])
    })

    it(`should fallback to output when result is undefined`, async () => {
      mockSandbox.evaluate.mockResolvedValue({
        output: `logged something`,
        result: undefined,
      })
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `evalCode`)!
      const result = await tool.execute(
        `call-1`,
        { code: `console.log('logged something')` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([{ type: `text`, text: `logged something` }])
    })

    it(`should return (no output) when both result and output are empty`, async () => {
      mockSandbox.evaluate.mockResolvedValue({
        output: ``,
        result: undefined,
      })
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `evalCode`)!
      const result = await tool.execute(
        `call-1`,
        { code: `const x = 1` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([{ type: `text`, text: `(no output)` }])
    })

    it(`should call onUpdate with running status`, async () => {
      const onUpdate = vi.fn()
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `evalCode`)!
      await tool.execute(
        `call-1`,
        { code: `export default 1` },
        undefined as any,
        onUpdate
      )

      expect(onUpdate).toHaveBeenCalledWith({
        content: [{ type: `text`, text: `Evaluating code...` }],
        details: { status: `running` },
      })
    })
  })

  describe(`createArtifact`, () => {
    it(`should return JSON-stringified artifact content with all fields`, async () => {
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `createArtifact`)!
      const result = await tool.execute(
        `call-1`,
        {
          artifactType: `html`,
          content: `<h1>Hello</h1>`,
          title: `My Page`,
          language: undefined,
        },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([
        {
          type: `text`,
          text: JSON.stringify({
            title: `My Page`,
            content: `<h1>Hello</h1>`,
            artifactType: `html`,
          }),
        },
      ])
    })

    it(`should include artifactType and title in details`, async () => {
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `createArtifact`)!
      const result = await tool.execute(
        `call-1`,
        {
          artifactType: `markdown`,
          content: `# Heading`,
          title: `Doc Title`,
        },
        undefined as any,
        vi.fn()
      )

      expect(result.details).toEqual({
        success: true,
        artifactType: `markdown`,
        title: `Doc Title`,
      })
    })

    it(`should handle artifact without optional title and language`, async () => {
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `createArtifact`)!
      const result = await tool.execute(
        `call-1`,
        { artifactType: `json`, content: `{"key":"value"}` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([
        {
          type: `text`,
          text: JSON.stringify({
            content: `{"key":"value"}`,
            artifactType: `json`,
          }),
        },
      ])
      expect(result.details).toEqual({
        success: true,
        artifactType: `json`,
        title: undefined,
      })
    })

    it(`should handle different artifact types`, async () => {
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `createArtifact`)!

      const types = [
        `html`,
        `svg`,
        `markdown`,
        `code`,
        `json`,
        `csv`,
        `yaml`,
        `xml`,
        `mermaid`,
        `latex`,
        `image`,
        `table`,
        `diff`,
        `plaintext`,
      ] as const
      for (const artifactType of types) {
        const result = await tool.execute(
          `call-1`,
          { artifactType, content: `test content` },
          undefined as any,
          vi.fn()
        )

        expect(result.details).toEqual(
          expect.objectContaining({ success: true, artifactType })
        )
      }
    })

    it(`should not require onUpdate callback`, async () => {
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `createArtifact`)!
      const result = await tool.execute(
        `call-1`,
        {
          artifactType: `code`,
          content: `console.log("hi")`,
          title: `Snippet`,
          language: `javascript`,
        },
        undefined as any
      )

      expect(result.content).toEqual([
        {
          type: `text`,
          text: JSON.stringify({
            title: `Snippet`,
            content: `console.log("hi")`,
            language: `javascript`,
            artifactType: `code`,
          }),
        },
      ])
      expect(result.details).toEqual({
        success: true,
        artifactType: `code`,
        title: `Snippet`,
      })
    })
  })

  describe(`tool metadata`, () => {
    it(`should have correct labels for all tools`, () => {
      const tools = createSandboxTools(mockSandbox as any)
      const labels = tools.map((t) => t.label)
      expect(labels).toEqual([
        `Shell`,
        `Read File`,
        `Write File`,
        `List Directory`,
        `Delete File`,
        `Create Directory`,
        `File Exists`,
        `Evaluate Code`,
        `Create Artifact`,
      ])
    })

    it(`should have descriptions for all tools`, () => {
      const tools = createSandboxTools(mockSandbox as any)
      for (const tool of tools) {
        expect(tool.description).toBeTruthy()
        expect(typeof tool.description).toBe(`string`)
      }
    })

    it(`should have parameters defined for all tools`, () => {
      const tools = createSandboxTools(mockSandbox as any)
      for (const tool of tools) {
        expect(tool.parameters).toBeDefined()
      }
    })
  })
})

describe(`createWebTools`, () => {
  describe(`tool creation and filtering`, () => {
    it(`should return 2 web tools when no filter is provided`, () => {
      const tools = createWebTools()
      expect(tools).toHaveLength(2)
      expect(tools.map((t) => t.name)).toEqual(WEB_TOOL_NAMES)
    })

    it(`should filter tools by allowedTools`, () => {
      const tools = createWebTools(undefined, [`webSearch`])
      expect(tools).toHaveLength(1)
      expect(tools[0].name).toBe(`webSearch`)
    })

    it(`should return all web tools when allowedTools is empty`, () => {
      const tools = createWebTools(undefined, [])
      expect(tools).toHaveLength(2)
    })

    it(`should return no tools when allowedTools has no matches`, () => {
      const tools = createWebTools(undefined, [`shellExec`])
      expect(tools).toHaveLength(0)
    })
  })

  describe(`webSearch`, () => {
    it(`should return "not configured" when no webProvider is given`, async () => {
      const tools = createWebTools()
      const tool = tools.find((t) => t.name === `webSearch`)!
      const result = await tool.execute(
        `call-1`,
        { query: `vitest docs` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([
        { type: `text`, text: `Web search not configured` },
      ])
      expect(result.details).toEqual({ success: false })
    })

    it(`should call webProvider.search and format results`, async () => {
      const mockProvider = {
        type: `jina` as const,
        search: vi.fn().mockResolvedValue([
          { title: `Result 1`, url: `https://r1.com`, snippet: `First result` },
          { title: `Result 2`, url: `https://r2.com`, snippet: `Second result` },
        ]),
        fetch: vi.fn(),
      }
      const tools = createWebTools(mockProvider)
      const tool = tools.find((t) => t.name === `webSearch`)!
      const result = await tool.execute(
        `call-1`,
        { query: `test query` },
        undefined as any,
        vi.fn()
      )

      expect(mockProvider.search).toHaveBeenCalledWith(`test query`, 5)
      expect((result.content[0] as any).text).toContain(`Result 1`)
      expect((result.content[0] as any).text).toContain(`https://r1.com`)
      expect(result.details).toEqual(
        expect.objectContaining({ success: true, resultCount: 2 })
      )
    })

    it(`should cap maxResults at 10`, async () => {
      const mockProvider = {
        type: `jina` as const,
        search: vi.fn().mockResolvedValue([]),
        fetch: vi.fn(),
      }
      const tools = createWebTools(mockProvider)
      const tool = tools.find((t) => t.name === `webSearch`)!
      await tool.execute(
        `call-1`,
        { query: `test`, maxResults: 20 },
        undefined as any,
        vi.fn()
      )

      expect(mockProvider.search).toHaveBeenCalledWith(`test`, 10)
    })

    it(`should return "No results found" when search returns empty`, async () => {
      const mockProvider = {
        type: `jina` as const,
        search: vi.fn().mockResolvedValue([]),
        fetch: vi.fn(),
      }
      const tools = createWebTools(mockProvider)
      const tool = tools.find((t) => t.name === `webSearch`)!
      const result = await tool.execute(
        `call-1`,
        { query: `obscure query` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([{ type: `text`, text: `No results found` }])
      expect(result.details).toEqual(
        expect.objectContaining({ success: false, resultCount: 0 })
      )
    })

    it(`should call onUpdate with searching status`, async () => {
      const mockProvider = {
        type: `jina` as const,
        search: vi.fn().mockResolvedValue([]),
        fetch: vi.fn(),
      }
      const onUpdate = vi.fn()
      const tools = createWebTools(mockProvider)
      const tool = tools.find((t) => t.name === `webSearch`)!
      await tool.execute(`call-1`, { query: `hello` }, undefined as any, onUpdate)

      expect(onUpdate).toHaveBeenCalledWith({
        content: [{ type: `text`, text: `Searching: hello` }],
        details: { status: `running` },
      })
    })

    it(`should catch errors and return failure message`, async () => {
      const mockProvider = {
        type: `jina` as const,
        search: vi.fn().mockRejectedValue(new Error(`Provider crashed`)),
        fetch: vi.fn(),
      }
      const tools = createWebTools(mockProvider)
      const tool = tools.find((t) => t.name === `webSearch`)!
      const result = await tool.execute(
        `call-1`,
        { query: `test` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([
        { type: `text`, text: `Search failed: Provider crashed` },
      ])
      expect(result.details).toEqual({ success: false })
    })
  })

  describe(`webFetch`, () => {
    it(`should return "not configured" when no webProvider is given`, async () => {
      const tools = createWebTools()
      const tool = tools.find((t) => t.name === `webFetch`)!
      const result = await tool.execute(
        `call-1`,
        { url: `https://example.com` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([{ type: `text`, text: `Web fetch not configured` }])
      expect(result.details).toEqual({ success: false })
    })

    it(`should call webProvider.fetch and return content`, async () => {
      const mockProvider = {
        type: `jina` as const,
        search: vi.fn(),
        fetch: vi.fn().mockResolvedValue({
          url: `https://example.com`,
          title: `Example`,
          content: `Page content here`,
          contentLength: 17,
        }),
      }
      const tools = createWebTools(mockProvider)
      const tool = tools.find((t) => t.name === `webFetch`)!
      const result = await tool.execute(
        `call-1`,
        { url: `https://example.com` },
        undefined as any,
        vi.fn()
      )

      expect(mockProvider.fetch).toHaveBeenCalledWith(`https://example.com`, {
        maxLength: undefined,
      })
      expect(result.content).toEqual([{ type: `text`, text: `Page content here` }])
      expect(result.details).toEqual(
        expect.objectContaining({ success: true, title: `Example`, contentLength: 17 })
      )
    })

    it(`should pass maxLength to provider`, async () => {
      const mockProvider = {
        type: `jina` as const,
        search: vi.fn(),
        fetch: vi.fn().mockResolvedValue({
          url: `https://example.com`,
          title: `Example`,
          content: `Short`,
          contentLength: 5,
        }),
      }
      const tools = createWebTools(mockProvider)
      const tool = tools.find((t) => t.name === `webFetch`)!
      await tool.execute(
        `call-1`,
        { url: `https://example.com`, maxLength: 1000 },
        undefined as any,
        vi.fn()
      )

      expect(mockProvider.fetch).toHaveBeenCalledWith(`https://example.com`, {
        maxLength: 1000,
      })
    })

    it(`should return error message when fetch fails`, async () => {
      const mockProvider = {
        type: `jina` as const,
        search: vi.fn(),
        fetch: vi.fn().mockRejectedValue(new Error(`404 Not Found`)),
      }
      const tools = createWebTools(mockProvider)
      const tool = tools.find((t) => t.name === `webFetch`)!
      const result = await tool.execute(
        `call-1`,
        { url: `https://example.com/missing` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([
        { type: `text`, text: `Fetch failed: 404 Not Found` },
      ])
      expect(result.details).toEqual({ success: false })
    })

    it(`should call onUpdate with fetching status`, async () => {
      const mockProvider = {
        type: `jina` as const,
        search: vi.fn(),
        fetch: vi.fn().mockResolvedValue({
          url: `https://example.com`,
          title: `Example`,
          content: `text`,
          contentLength: 4,
        }),
      }
      const onUpdate = vi.fn()
      const tools = createWebTools(mockProvider)
      const tool = tools.find((t) => t.name === `webFetch`)!
      await tool.execute(
        `call-1`,
        { url: `https://example.com` },
        undefined as any,
        onUpdate
      )

      expect(onUpdate).toHaveBeenCalledWith({
        content: [{ type: `text`, text: `Fetching: https://example.com` }],
        details: { status: `running` },
      })
    })
  })

  describe(`tool metadata`, () => {
    it(`should have correct labels for web tools`, () => {
      const tools = createWebTools()
      const labels = tools.map((t) => t.label)
      expect(labels).toEqual([`Web Search`, `Web Fetch`])
    })

    it(`should have descriptions for all web tools`, () => {
      const tools = createWebTools()
      for (const tool of tools) {
        expect(tool.description).toBeTruthy()
        expect(typeof tool.description).toBe(`string`)
      }
    })

    it(`should have parameters defined for all web tools`, () => {
      const tools = createWebTools()
      for (const tool of tools) {
        expect(tool.parameters).toBeDefined()
      }
    })
  })
})

describe(`createMemoryTools`, () => {
  const makeProvider = () => ({
    search: vi.fn().mockResolvedValue([
      {
        id: `mm_1`,
        text: `The prod DB is Neon`,
        kind: `fact`,
        importance: 8,
        score: 4.123,
      },
      {
        id: `mm_2`,
        text: `Steward runs brain=runtime`,
        kind: `insight`,
        importance: 6,
      },
    ]),
    write: vi.fn().mockResolvedValue({ id: `mm_new` }),
  })

  describe(`tool creation and filtering`, () => {
    it(`should return 2 memory tools when no filter is provided`, () => {
      const tools = createMemoryTools(makeProvider())
      expect(tools).toHaveLength(2)
      expect(tools.map((t) => t.name)).toEqual([
        EAgentTool.memorySearch,
        EAgentTool.memoryWrite,
      ])
    })

    it(`should filter to only memorySearch when only that is allowed`, () => {
      const tools = createMemoryTools(makeProvider(), [EAgentTool.memorySearch])
      expect(tools).toHaveLength(1)
      expect(tools[0].name).toBe(EAgentTool.memorySearch)
    })

    it(`should filter to only memoryWrite when only that is allowed`, () => {
      const tools = createMemoryTools(makeProvider(), [EAgentTool.memoryWrite])
      expect(tools).toHaveLength(1)
      expect(tools[0].name).toBe(EAgentTool.memoryWrite)
    })

    it(`should return all memory tools when allowedTools is empty`, () => {
      const tools = createMemoryTools(makeProvider(), [])
      expect(tools).toHaveLength(2)
    })

    it(`should return no tools when allowedTools has no matches`, () => {
      const tools = createMemoryTools(makeProvider(), [`shellExec`])
      expect(tools).toHaveLength(0)
    })
  })

  describe(`memorySearch`, () => {
    it(`should call provider.search and format scored results`, async () => {
      const provider = makeProvider()
      const tools = createMemoryTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.memorySearch)!
      const result = await tool.execute(
        `call-1`,
        { query: `prod db`, limit: 5, kinds: [`fact`] },
        undefined as any,
        vi.fn()
      )

      expect(provider.search).toHaveBeenCalledWith({
        query: `prod db`,
        limit: 5,
        kinds: [`fact`],
      })
      const text = (result.content[0] as any).text
      expect(text).toContain(`[fact]`)
      expect(text).toContain(`importance 8`)
      expect(text).toContain(`score 4.123`)
      expect(text).toContain(`The prod DB is Neon`)
      expect(result.details).toEqual(
        expect.objectContaining({ success: true, resultCount: 2 })
      )
    })

    it(`should return "No memories found" when search returns empty`, async () => {
      const provider = makeProvider()
      provider.search.mockResolvedValue([])
      const tools = createMemoryTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.memorySearch)!
      const result = await tool.execute(
        `call-1`,
        { query: `nothing` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([{ type: `text`, text: `No memories found` }])
      expect(result.details).toEqual(
        expect.objectContaining({ success: false, resultCount: 0 })
      )
    })

    it(`should call onUpdate with searching status`, async () => {
      const onUpdate = vi.fn()
      const tools = createMemoryTools(makeProvider())
      const tool = tools.find((t) => t.name === EAgentTool.memorySearch)!
      await tool.execute(`call-1`, { query: `hello` }, undefined as any, onUpdate)

      expect(onUpdate).toHaveBeenCalledWith({
        content: [{ type: `text`, text: `Searching memory: hello` }],
        details: { status: `running` },
      })
    })

    it(`should catch errors and return failure message`, async () => {
      const provider = makeProvider()
      provider.search.mockRejectedValue(new Error(`db down`))
      const tools = createMemoryTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.memorySearch)!
      const result = await tool.execute(
        `call-1`,
        { query: `test` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([
        { type: `text`, text: `Memory search failed: db down` },
      ])
      expect(result.details).toEqual({ success: false })
    })
  })

  describe(`memoryWrite`, () => {
    it(`should call provider.write and confirm with the new id`, async () => {
      const provider = makeProvider()
      const tools = createMemoryTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.memoryWrite)!
      const result = await tool.execute(
        `call-1`,
        { text: `remember this`, importance: 7, kind: `insight` },
        undefined as any,
        vi.fn()
      )

      expect(provider.write).toHaveBeenCalledWith({
        text: `remember this`,
        importance: 7,
        kind: `insight`,
      })
      expect(result.content).toEqual([{ type: `text`, text: `Memory saved (mm_new)` }])
      expect(result.details).toEqual({ success: true, id: `mm_new` })
    })

    it(`should call onUpdate with writing status`, async () => {
      const onUpdate = vi.fn()
      const tools = createMemoryTools(makeProvider())
      const tool = tools.find((t) => t.name === EAgentTool.memoryWrite)!
      await tool.execute(`call-1`, { text: `note` }, undefined as any, onUpdate)

      expect(onUpdate).toHaveBeenCalledWith({
        content: [{ type: `text`, text: `Writing memory...` }],
        details: { status: `running` },
      })
    })

    it(`should catch errors and return failure message`, async () => {
      const provider = makeProvider()
      provider.write.mockRejectedValue(new Error(`write failed`))
      const tools = createMemoryTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.memoryWrite)!
      const result = await tool.execute(
        `call-1`,
        { text: `note` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([
        { type: `text`, text: `Memory write failed: write failed` },
      ])
      expect(result.details).toEqual({ success: false })
    })
  })

  describe(`tool metadata`, () => {
    it(`should have correct labels for memory tools`, () => {
      const tools = createMemoryTools(makeProvider())
      expect(tools.map((t) => t.label)).toEqual([`Memory Search`, `Memory Write`])
    })

    it(`should have descriptions and parameters for all memory tools`, () => {
      const tools = createMemoryTools(makeProvider())
      for (const tool of tools) {
        expect(tool.description).toBeTruthy()
        expect(tool.parameters).toBeDefined()
      }
    })
  })
})

describe(`createRecordTools`, () => {
  const makeProvider = () => ({
    query: vi.fn().mockResolvedValue([
      { id: `rec_1`, data: { status: `open`, title: `First` } },
      { id: `rec_2`, data: { status: `open`, title: `Second` } },
    ]),
    get: vi.fn().mockResolvedValue({ id: `rec_1`, data: { status: `open` } }),
    upsert: vi.fn().mockResolvedValue({ id: `rec_new` }),
    delete: vi.fn().mockResolvedValue({ deleted: true }),
  })

  const RECORD_TOOL_NAMES = [
    EAgentTool.collectionQuery,
    EAgentTool.collectionGet,
    EAgentTool.collectionUpsert,
    EAgentTool.collectionDelete,
  ]

  describe(`tool creation and filtering`, () => {
    it(`should return 4 record tools when no filter is provided`, () => {
      const tools = createRecordTools(makeProvider())
      expect(tools).toHaveLength(4)
      expect(tools.map((t) => t.name)).toEqual(RECORD_TOOL_NAMES)
    })

    it(`should filter to only collectionQuery when only that is allowed`, () => {
      const tools = createRecordTools(makeProvider(), [EAgentTool.collectionQuery])
      expect(tools).toHaveLength(1)
      expect(tools[0].name).toBe(EAgentTool.collectionQuery)
    })

    it(`should return all record tools when allowedTools is empty`, () => {
      const tools = createRecordTools(makeProvider(), [])
      expect(tools).toHaveLength(4)
    })

    it(`should return no tools when allowedTools has no matches`, () => {
      const tools = createRecordTools(makeProvider(), [`shellExec`])
      expect(tools).toHaveLength(0)
    })

    it(`should have descriptions and parameters for all record tools`, () => {
      const tools = createRecordTools(makeProvider())
      for (const tool of tools) {
        expect(tool.description).toBeTruthy()
        expect(tool.parameters).toBeDefined()
      }
    })
  })

  describe(`collectionQuery`, () => {
    it(`should call provider.query with collection + query and format results`, async () => {
      const provider = makeProvider()
      const tools = createRecordTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.collectionQuery)!
      const result = await tool.execute(
        `call-1`,
        {
          collection: `tasks`,
          where: [{ field: `status`, op: `eq`, value: `open` }],
          orderBy: { field: `title`, direction: `asc` },
          limit: 10,
        },
        undefined as any,
        vi.fn()
      )

      expect(provider.query).toHaveBeenCalledWith(`tasks`, {
        where: [{ field: `status`, op: `eq`, value: `open` }],
        orderBy: { field: `title`, direction: `asc` },
        limit: 10,
      })
      const text = (result.content[0] as any).text
      expect(text).toContain(`rec_1`)
      expect(text).toContain(`First`)
      expect(result.details).toEqual(
        expect.objectContaining({ success: true, resultCount: 2 })
      )
    })

    it(`should return "No records found" when query returns empty`, async () => {
      const provider = makeProvider()
      provider.query.mockResolvedValue([])
      const tools = createRecordTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.collectionQuery)!
      const result = await tool.execute(
        `call-1`,
        { collection: `tasks` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([{ type: `text`, text: `No records found` }])
      expect(result.details).toEqual(
        expect.objectContaining({ success: true, resultCount: 0 })
      )
    })

    it(`should catch errors and return failure message`, async () => {
      const provider = makeProvider()
      provider.query.mockRejectedValue(new Error(`db down`))
      const tools = createRecordTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.collectionQuery)!
      const result = await tool.execute(
        `call-1`,
        { collection: `tasks` },
        undefined as any,
        vi.fn()
      )

      expect((result.content[0] as any).text).toContain(
        `Collection query failed: db down`
      )
      expect(result.details).toEqual(expect.objectContaining({ success: false }))
    })
  })

  describe(`collectionGet`, () => {
    it(`should call provider.get with collection + id and format the record`, async () => {
      const provider = makeProvider()
      const tools = createRecordTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.collectionGet)!
      const result = await tool.execute(
        `call-1`,
        { collection: `tasks`, id: `rec_1` },
        undefined as any,
        vi.fn()
      )

      expect(provider.get).toHaveBeenCalledWith(`tasks`, `rec_1`)
      expect((result.content[0] as any).text).toContain(`rec_1`)
      expect(result.details).toEqual(
        expect.objectContaining({ success: true, id: `rec_1` })
      )
    })

    it(`should return not-found when the record is missing`, async () => {
      const provider = makeProvider()
      provider.get.mockResolvedValue(null)
      const tools = createRecordTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.collectionGet)!
      const result = await tool.execute(
        `call-1`,
        { collection: `tasks`, id: `nope` },
        undefined as any,
        vi.fn()
      )

      expect((result.content[0] as any).text).toContain(`Record nope not found`)
      expect(result.details).toEqual(expect.objectContaining({ success: false }))
    })
  })

  describe(`collectionUpsert`, () => {
    it(`should call provider.upsert with collection + record and return the id`, async () => {
      const provider = makeProvider()
      const tools = createRecordTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.collectionUpsert)!
      const result = await tool.execute(
        `call-1`,
        { collection: `tasks`, record: { id: `rec_1`, data: { status: `done` } } },
        undefined as any,
        vi.fn()
      )

      expect(provider.upsert).toHaveBeenCalledWith(`tasks`, {
        id: `rec_1`,
        data: { status: `done` },
      })
      expect((result.content[0] as any).text).toContain(`Record saved (rec_new)`)
      expect(result.details).toEqual(
        expect.objectContaining({ success: true, id: `rec_new` })
      )
    })
  })

  describe(`collectionDelete`, () => {
    it(`should call provider.delete with collection + id and report deletion`, async () => {
      const provider = makeProvider()
      const tools = createRecordTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.collectionDelete)!
      const result = await tool.execute(
        `call-1`,
        { collection: `tasks`, id: `rec_1` },
        undefined as any,
        vi.fn()
      )

      expect(provider.delete).toHaveBeenCalledWith(`tasks`, `rec_1`)
      expect((result.content[0] as any).text).toContain(`Record rec_1 deleted`)
      expect(result.details).toEqual(
        expect.objectContaining({ success: true, deleted: true })
      )
    })

    it(`should report not-found when nothing was deleted`, async () => {
      const provider = makeProvider()
      provider.delete.mockResolvedValue({ deleted: false })
      const tools = createRecordTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.collectionDelete)!
      const result = await tool.execute(
        `call-1`,
        { collection: `tasks`, id: `rec_1` },
        undefined as any,
        vi.fn()
      )

      expect((result.content[0] as any).text).toContain(`Record rec_1 not found`)
      expect(result.details).toEqual(
        expect.objectContaining({ success: false, deleted: false })
      )
    })
  })
})

describe(`buildCustomFunctionTools`, () => {
  const makeFn = (overrides: Record<string, any> = {}) => ({
    id: `fn-001`,
    name: `myFunction`,
    projectId: `proj-1`,
    content: `export default () => {}`,
    branch: `main`,
    language: `typescript`,
    description: `A test function`,
    ...overrides,
  })

  let onExecute: Mock<[string, unknown], Promise<TFunctionExecResult>>

  beforeEach(() => {
    onExecute = vi.fn().mockResolvedValue({
      success: true,
      output: `result data`,
      duration: 42,
    })
  })

  it(`should convert functions to AgentTool array with correct name and description`, () => {
    const fns = [
      makeFn(),
      makeFn({ id: `fn-002`, name: `anotherFunc`, description: `Second function` }),
    ]
    const tools = buildCustomFunctionTools(fns as any, onExecute)

    expect(tools).toHaveLength(2)
    expect(tools[0].name).toBe(`myFunction`)
    expect(tools[0].label).toBe(`myFunction`)
    expect(tools[0].description).toBe(`A test function`)
    expect(tools[1].name).toBe(`anotherFunc`)
    expect(tools[1].description).toBe(`Second function`)
  })

  describe(`without defaultArgs (generic input schema)`, () => {
    it(`should call onExecute with function id and input params`, async () => {
      const tools = buildCustomFunctionTools([makeFn()] as any, onExecute)
      const tool = tools[0]
      await tool.execute(`call-1`, { input: { key: `value` } }, undefined as any, vi.fn())

      expect(onExecute).toHaveBeenCalledWith(`fn-001`, { key: `value` })
    })

    it(`should return success output as text content`, async () => {
      const tools = buildCustomFunctionTools([makeFn()] as any, onExecute)
      const tool = tools[0]
      const result = await tool.execute(
        `call-1`,
        { input: `hello` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([{ type: `text`, text: `result data` }])
      expect(result.details).toEqual({ success: true, duration: 42 })
    })

    it(`should JSON.stringify non-string output`, async () => {
      onExecute.mockResolvedValue({
        success: true,
        output: { nested: true },
        duration: 10,
      })
      const tools = buildCustomFunctionTools([makeFn()] as any, onExecute)
      const tool = tools[0]
      const result = await tool.execute(
        `call-1`,
        { input: null },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([{ type: `text`, text: `{"nested":true}` }])
    })

    it(`should return error output when function fails`, async () => {
      onExecute.mockResolvedValue({
        success: false,
        output: null,
        duration: 5,
        error: `Something broke`,
      })
      const tools = buildCustomFunctionTools([makeFn()] as any, onExecute)
      const tool = tools[0]
      const result = await tool.execute(
        `call-1`,
        { input: undefined },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([{ type: `text`, text: `Something broke` }])
      expect(result.details).toEqual({ success: false, duration: 5 })
    })

    it(`should return default error message when error string is empty`, async () => {
      onExecute.mockResolvedValue({
        success: false,
        output: null,
        duration: 1,
        error: ``,
      })
      const tools = buildCustomFunctionTools([makeFn()] as any, onExecute)
      const tool = tools[0]
      const result = await tool.execute(
        `call-1`,
        { input: undefined },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([
        { type: `text`, text: `Function execution failed` },
      ])
    })

    it(`should use generic input schema with Record type`, () => {
      const tools = buildCustomFunctionTools([makeFn()] as any, onExecute)
      const params = tools[0].parameters
      expect(params).toBeDefined()
      expect(params.properties?.input).toBeDefined()
    })
  })

  describe(`with inputSchema (rich typed parameters)`, () => {
    const fnWithSchema = makeFn({
      inputSchema: [
        { name: `city`, type: `string`, description: `City name`, required: true },
        { name: `temperature`, type: `number`, description: `Temperature value` },
        { name: `verbose`, type: `boolean`, description: `Enable verbose output` },
      ],
    })

    it(`should create typed properties from inputSchema`, () => {
      const tools = buildCustomFunctionTools([fnWithSchema] as any, onExecute)
      const params = tools[0].parameters
      expect(params.properties?.city).toBeDefined()
      expect(params.properties?.temperature).toBeDefined()
      expect(params.properties?.verbose).toBeDefined()
      expect(params.properties?.input).toBeUndefined()
    })

    it(`should include parameter descriptions in tool description`, () => {
      const tools = buildCustomFunctionTools([fnWithSchema] as any, onExecute)
      expect(tools[0].description).toContain(`city (string): City name [required]`)
      expect(tools[0].description).toContain(`temperature (number): Temperature value`)
      expect(tools[0].description).toContain(`verbose (boolean): Enable verbose output`)
    })

    it(`should pass params directly as input when inputSchema defined`, async () => {
      const tools = buildCustomFunctionTools([fnWithSchema] as any, onExecute)
      await tools[0].execute(
        `call-1`,
        { city: `Tokyo`, temperature: 72 },
        undefined as any,
        vi.fn()
      )
      expect(onExecute).toHaveBeenCalledWith(`fn-001`, { city: `Tokyo`, temperature: 72 })
    })

    it(`should prefer inputSchema over defaultArgs when both present`, () => {
      const fnBoth = makeFn({
        inputSchema: [
          { name: `query`, type: `string`, description: `Search query`, required: true },
        ],
        defaultArgs: { '0': `old-arg` },
      })
      const tools = buildCustomFunctionTools([fnBoth] as any, onExecute)
      expect(tools[0].parameters.properties?.query).toBeDefined()
      expect(tools[0].parameters.properties?.[`0`]).toBeUndefined()
    })

    it(`should handle all five param types`, () => {
      const fnAllTypes = makeFn({
        inputSchema: [
          { name: `s`, type: `string` },
          { name: `n`, type: `number` },
          { name: `b`, type: `boolean` },
          { name: `o`, type: `object` },
          { name: `a`, type: `array` },
        ],
      })
      const tools = buildCustomFunctionTools([fnAllTypes] as any, onExecute)
      const params = tools[0].parameters
      expect(params.properties?.s).toBeDefined()
      expect(params.properties?.n).toBeDefined()
      expect(params.properties?.b).toBeDefined()
      expect(params.properties?.o).toBeDefined()
      expect(params.properties?.a).toBeDefined()
    })

    it(`should wrap non-required params in Optional`, () => {
      const fnOptional = makeFn({
        inputSchema: [
          { name: `required_param`, type: `string`, required: true },
          { name: `optional_param`, type: `string`, required: false },
        ],
      })
      const tools = buildCustomFunctionTools([fnOptional] as any, onExecute)
      const params = tools[0].parameters

      const reqProp = params.properties?.required_param
      const optProp = params.properties?.optional_param

      expect(reqProp).toBeDefined()
      expect(optProp).toBeDefined()
      // Optional TypeBox wraps produce a different schema kind
      expect(reqProp).not.toHaveProperty(`[Symbol.for('TypeBox.Kind')]`, `Optional`)
    })
  })

  describe(`with defaultArgs (named parameters schema)`, () => {
    const fnWithArgs = makeFn({
      defaultArgs: { city: `Denver`, units: `celsius` },
    })

    it(`should pass full params object as input when defaultArgs are defined`, async () => {
      const tools = buildCustomFunctionTools([fnWithArgs] as any, onExecute)
      const tool = tools[0]
      await tool.execute(
        `call-1`,
        { city: `Tokyo`, units: `fahrenheit` },
        undefined as any,
        vi.fn()
      )

      expect(onExecute).toHaveBeenCalledWith(`fn-001`, {
        city: `Tokyo`,
        units: `fahrenheit`,
      })
    })

    it(`should include arg names in description`, () => {
      const tools = buildCustomFunctionTools([fnWithArgs] as any, onExecute)
      expect(tools[0].description).toContain(`city`)
      expect(tools[0].description).toContain(`units`)
    })

    it(`should create named properties in parameters schema`, () => {
      const tools = buildCustomFunctionTools([fnWithArgs] as any, onExecute)
      const params = tools[0].parameters
      expect(params.properties?.city).toBeDefined()
      expect(params.properties?.units).toBeDefined()
      expect(params.properties?.input).toBeUndefined()
    })

    it(`should not have input wrapper in params when defaultArgs defined`, async () => {
      const tools = buildCustomFunctionTools([fnWithArgs] as any, onExecute)
      const tool = tools[0]
      await tool.execute(`call-1`, { city: `Berlin` }, undefined as any, vi.fn())

      expect(onExecute).toHaveBeenCalledWith(`fn-001`, { city: `Berlin` })
    })
  })

  it(`should use fallback description when function has no description`, () => {
    const tools = buildCustomFunctionTools(
      [makeFn({ description: undefined })] as any,
      onExecute
    )
    expect(tools[0].description).toBe(`Custom function: myFunction`)
  })

  it(`should call onUpdate with running status before execution`, async () => {
    const onUpdate = vi.fn()
    const tools = buildCustomFunctionTools([makeFn()] as any, onExecute)
    const tool = tools[0]
    await tool.execute(`call-1`, { input: `test` }, undefined as any, onUpdate)

    expect(onUpdate).toHaveBeenCalledWith({
      content: [{ type: `text`, text: `Executing function: myFunction` }],
      details: { status: `running` },
    })
  })

  it(`should work without onUpdate callback`, async () => {
    const tools = buildCustomFunctionTools([makeFn()] as any, onExecute)
    const tool = tools[0]
    const result = await tool.execute(`call-1`, { input: `test` }, undefined as any)

    expect(result.content).toEqual([{ type: `text`, text: `result data` }])
  })

  it(`should return empty array when given empty functions list`, () => {
    const tools = buildCustomFunctionTools([], onExecute)
    expect(tools).toEqual([])
  })

  it(`should have parameters defined for all generated tools`, () => {
    const fns = [makeFn(), makeFn({ id: `fn-002`, name: `secondFunc` })]
    const tools = buildCustomFunctionTools(fns as any, onExecute)
    for (const tool of tools) {
      expect(tool.parameters).toBeDefined()
    }
  })
})

describe(`createDelegateTools`, () => {
  let delegate: ReturnType<typeof vi.fn>
  let provider: { delegate: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    delegate = vi.fn().mockResolvedValue({
      success: true,
      exitCode: 0,
      output: `child output`,
      critic: { passed: true, reason: `looks complete` },
    })
    provider = { delegate }
  })

  describe(`tool creation and filtering`, () => {
    it(`should expose the delegateTask tool`, () => {
      const tools = createDelegateTools(provider as any)
      expect(tools).toHaveLength(1)
      expect(tools[0].name).toBe(EAgentTool.delegateTask)
    })

    it(`should filter by allowedTools names`, () => {
      expect(createDelegateTools(provider as any, [`nonExistent`])).toHaveLength(0)
      expect(
        createDelegateTools(provider as any, [EAgentTool.delegateTask])
      ).toHaveLength(1)
    })

    it(`should return the tool when allowedTools is empty`, () => {
      expect(createDelegateTools(provider as any, [])).toHaveLength(1)
    })
  })

  describe(`depth-cap refusal`, () => {
    it(`refuses without calling the provider once depth reaches the max`, async () => {
      const tools = createDelegateTools(provider as any, undefined, {
        delegationDepth: 1,
        maxDelegationDepth: 1,
      })
      const result = await tools[0].execute(
        `call-1`,
        { task: `do work` },
        undefined as any,
        vi.fn()
      )

      expect(delegate).not.toHaveBeenCalled()
      expect(result.details).toEqual({ success: false, refused: true })
      expect((result.content[0] as { text: string }).text).toContain(
        `max delegation depth`
      )
    })

    it(`delegates at depth 0 with the default max`, async () => {
      const tools = createDelegateTools(provider as any)
      await tools[0].execute(`call-1`, { task: `do work` }, undefined as any, vi.fn())
      expect(delegate).toHaveBeenCalledWith({
        task: `do work`,
        tools: undefined,
        timeoutMs: undefined,
        runtime: undefined,
      })
    })
  })

  describe(`result formatting`, () => {
    it(`formats a successful result with exit code and critic verdict`, async () => {
      const tools = createDelegateTools(provider as any)
      const result = await tools[0].execute(
        `call-1`,
        { task: `do work` },
        undefined as any,
        vi.fn()
      )

      const text = (result.content[0] as { text: string }).text
      expect(text).toContain(`Delegated task succeeded (exit 0)`)
      expect(text).toContain(`Critic: PASS: looks complete`)
      expect(text).toContain(`child output`)
      expect(result.details).toEqual({
        success: true,
        exitCode: 0,
        critic: { passed: true, reason: `looks complete` },
      })
    })

    it(`formats a failed result with the error and without a critic line`, async () => {
      delegate.mockResolvedValue({
        success: false,
        output: ``,
        error: `Delegation concurrency cap (3) reached`,
      })
      const tools = createDelegateTools(provider as any)
      const result = await tools[0].execute(
        `call-1`,
        { task: `do work` },
        undefined as any,
        vi.fn()
      )

      const text = (result.content[0] as { text: string }).text
      expect(text).toContain(`Delegated task failed: Delegation concurrency cap`)
      expect(text).not.toContain(`Critic:`)
      expect(text).toContain(`(no output)`)
      expect(result.details.success).toBe(false)
    })

    it(`passes runtime, tools, and timeoutMs through to the provider`, async () => {
      const tools = createDelegateTools(provider as any)
      await tools[0].execute(
        `call-1`,
        {
          task: `do work`,
          runtime: `codex`,
          tools: [`readFile`],
          timeoutMs: 5000,
        },
        undefined as any,
        vi.fn()
      )
      expect(delegate).toHaveBeenCalledWith({
        task: `do work`,
        runtime: `codex`,
        tools: [`readFile`],
        timeoutMs: 5000,
      })
    })

    it(`returns a failed result when the provider rejects`, async () => {
      delegate.mockRejectedValue(new Error(`pod not running`))
      const tools = createDelegateTools(provider as any)
      const result = await tools[0].execute(
        `call-1`,
        { task: `do work` },
        undefined as any,
        vi.fn()
      )

      expect(result.details).toEqual({ success: false })
      expect((result.content[0] as { text: string }).text).toBe(
        `Delegation failed: pod not running`
      )
    })
  })
})
