import type { Mock } from 'vitest'
import type { TFunctionExecResult } from '@tdsk/domain'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSandboxTools, buildCustomFunctionTools } from './tools'

const ALL_TOOL_NAMES = [
  `shellExec`,
  `readFile`,
  `writeFile`,
  `listDir`,
  `deleteFile`,
  `mkdir`,
  `fileExists`,
  `evalCode`,
  `webSearch`,
]

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
    it(`should return all 9 tools when no filter is provided`, () => {
      const tools = createSandboxTools(mockSandbox as any)
      expect(tools).toHaveLength(9)
      expect(tools.map((t) => t.name)).toEqual(ALL_TOOL_NAMES)
    })

    it(`should filter tools by allowedTools names`, () => {
      const tools = createSandboxTools(mockSandbox as any, [`shellExec`, `readFile`])
      expect(tools).toHaveLength(2)
      expect(tools.map((t) => t.name)).toEqual([`shellExec`, `readFile`])
    })

    it(`should return all tools when allowedTools is an empty array`, () => {
      const tools = createSandboxTools(mockSandbox as any, [])
      expect(tools).toHaveLength(9)
      expect(tools.map((t) => t.name)).toEqual(ALL_TOOL_NAMES)
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

  describe(`webSearch`, () => {
    it(`should return not yet implemented message`, async () => {
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `webSearch`)!
      const result = await tool.execute(
        `call-1`,
        { query: `vitest docs` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([
        { type: `text`, text: `Web search not yet implemented` },
      ])
      expect(result.details).toEqual({ success: false })
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
        `Web Search`,
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
