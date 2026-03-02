import type { AgentTool } from '@mariozechner/pi-agent-core'
import type { ISandbox, TFunctionExecResult } from '@tdsk/domain'
import type { Function as FunctionModel } from '@tdsk/domain'

import { Type } from '@mariozechner/pi-ai'

/**
 * Creates pi-mono AgentTool definitions backed by an ISandbox instance.
 * Each tool calls `onUpdate()` to stream progress, then returns the final result.
 */
export const createSandboxTools = (
  sandbox: ISandbox,
  allowedTools?: string[]
): AgentTool<any>[] => {
  const tools: AgentTool<any>[] = [
    {
      name: `shellExec`,
      label: `Shell`,
      description: `Run a shell command in the sandbox`,
      parameters: Type.Object({
        command: Type.String({ description: `The command to run` }),
        args: Type.Optional(
          Type.Array(Type.String(), { description: `Command arguments` })
        ),
      }),
      execute: async (
        _toolCallId: string,
        params: { command: string; args?: string[] },
        _signal,
        onUpdate
      ) => {
        onUpdate?.({
          content: [
            {
              type: `text`,
              text: `Running: ${params.command}${params.args ? ` ${params.args.join(` `)}` : ``}`,
            },
          ],
          details: { status: `running` },
        })
        // ISandbox.exec() — sandbox method, not child_process
        const result = await sandbox.exec(params.command, params.args)
        return {
          content: [{ type: `text`, text: result.output || result.error || `` }],
          details: { success: result.success, exitCode: result.exitCode },
        }
      },
    },
    {
      name: `readFile`,
      label: `Read File`,
      description: `Read the contents of a file`,
      parameters: Type.Object({
        path: Type.String({ description: `The file path to read` }),
      }),
      execute: async (
        _toolCallId: string,
        params: { path: string },
        _signal,
        onUpdate
      ) => {
        onUpdate?.({
          content: [{ type: `text`, text: `Reading: ${params.path}` }],
          details: { status: `running` },
        })
        const content = await sandbox.readFile(params.path)
        return {
          content: [{ type: `text`, text: content }],
          details: { success: true },
        }
      },
    },
    {
      name: `writeFile`,
      label: `Write File`,
      description: `Write content to a file`,
      parameters: Type.Object({
        path: Type.String({ description: `The file path to write` }),
        content: Type.String({ description: `The content to write` }),
      }),
      execute: async (
        _toolCallId: string,
        params: { path: string; content: string },
        _signal,
        onUpdate
      ) => {
        onUpdate?.({
          content: [{ type: `text`, text: `Writing: ${params.path}` }],
          details: { status: `running` },
        })
        await sandbox.writeFile(params.path, params.content)
        return {
          content: [{ type: `text`, text: `File written to ${params.path}` }],
          details: { success: true },
        }
      },
    },
    {
      name: `listDir`,
      label: `List Directory`,
      description: `List the contents of a directory`,
      parameters: Type.Object({
        path: Type.String({ description: `The directory path to list` }),
      }),
      execute: async (
        _toolCallId: string,
        params: { path: string },
        _signal,
        onUpdate
      ) => {
        onUpdate?.({
          content: [{ type: `text`, text: `Listing: ${params.path}` }],
          details: { status: `running` },
        })
        const entries = await sandbox.listDir(params.path)
        return {
          content: [{ type: `text`, text: entries.join(`\n`) }],
          details: { success: true },
        }
      },
    },
    {
      name: `deleteFile`,
      label: `Delete File`,
      description: `Delete a file`,
      parameters: Type.Object({
        path: Type.String({ description: `The file path to delete` }),
      }),
      execute: async (
        _toolCallId: string,
        params: { path: string },
        _signal,
        onUpdate
      ) => {
        onUpdate?.({
          content: [{ type: `text`, text: `Deleting: ${params.path}` }],
          details: { status: `running` },
        })
        await sandbox.deleteFile(params.path)
        return {
          content: [{ type: `text`, text: `File deleted: ${params.path}` }],
          details: { success: true },
        }
      },
    },
    {
      name: `mkdir`,
      label: `Create Directory`,
      description: `Create a directory`,
      parameters: Type.Object({
        path: Type.String({ description: `The directory path to create` }),
      }),
      execute: async (
        _toolCallId: string,
        params: { path: string },
        _signal,
        onUpdate
      ) => {
        onUpdate?.({
          content: [{ type: `text`, text: `Creating directory: ${params.path}` }],
          details: { status: `running` },
        })
        await sandbox.mkdir(params.path)
        return {
          content: [{ type: `text`, text: `Directory created: ${params.path}` }],
          details: { success: true },
        }
      },
    },
    {
      name: `fileExists`,
      label: `File Exists`,
      description: `Check if a file exists`,
      parameters: Type.Object({
        path: Type.String({ description: `The file path to check` }),
      }),
      execute: async (_toolCallId: string, params: { path: string }) => {
        const exists = await sandbox.fileExists(params.path)
        return {
          content: [{ type: `text`, text: String(exists) }],
          details: { exists },
        }
      },
    },
    {
      name: `evalCode`,
      label: `Evaluate Code`,
      description: `Evaluate JavaScript code in an isolated V8 sandbox`,
      parameters: Type.Object({
        code: Type.String({
          description: `JavaScript code to evaluate. Use 'export default' to return a value.`,
        }),
        timeout: Type.Optional(
          Type.Number({
            description: `Execution timeout in milliseconds (default: 5000)`,
          })
        ),
      }),
      execute: async (
        _toolCallId: string,
        params: { code: string; timeout?: number },
        _signal,
        onUpdate
      ) => {
        onUpdate?.({
          content: [{ type: `text`, text: `Evaluating code...` }],
          details: { status: `running` },
        })
        const result = await sandbox.evaluate(params.code, {
          timeout: params.timeout,
        })
        const output =
          result.result !== undefined
            ? typeof result.result === `string`
              ? result.result
              : JSON.stringify(result.result)
            : result.output || `(no output)`
        return {
          content: [{ type: `text`, text: output }],
          details: { success: true, consoleOutput: result.output },
        }
      },
    },
    {
      name: `createArtifact`,
      label: `Create Artifact`,
      description: `Create a renderable artifact (HTML, SVG, Markdown, code, JSON, CSV, YAML, XML, Mermaid diagram, LaTeX math, image, table, diff, or plaintext). The artifact will be rendered in the UI for the user to view and interact with.`,
      parameters: Type.Object({
        artifactType: Type.Union(
          [
            Type.Literal(`html`),
            Type.Literal(`svg`),
            Type.Literal(`markdown`),
            Type.Literal(`code`),
            Type.Literal(`json`),
            Type.Literal(`csv`),
            Type.Literal(`yaml`),
            Type.Literal(`xml`),
            Type.Literal(`mermaid`),
            Type.Literal(`latex`),
            Type.Literal(`image`),
            Type.Literal(`table`),
            Type.Literal(`diff`),
            Type.Literal(`plaintext`),
          ],
          { description: `The type of artifact to create` }
        ),
        content: Type.String({
          description: `The artifact content`,
        }),
        title: Type.Optional(
          Type.String({ description: `Optional title for the artifact` })
        ),
        language: Type.Optional(
          Type.String({
            description: `Programming language for code artifacts (e.g., "python", "javascript")`,
          })
        ),
      }),
      execute: async (
        _toolCallId: string,
        params: {
          artifactType: string
          content: string
          title?: string
          language?: string
        }
      ) => {
        return {
          content: [
            {
              type: `text`,
              text: JSON.stringify({
                artifactType: params.artifactType,
                content: params.content,
                title: params.title,
                language: params.language,
              }),
            },
          ],
          details: {
            success: true,
            artifactType: params.artifactType,
            title: params.title,
          },
        }
      },
    },
    {
      name: `webSearch`,
      label: `Web Search`,
      description: `Search the web for information`,
      parameters: Type.Object({
        query: Type.String({ description: `The search query` }),
      }),
      execute: async () => ({
        content: [{ type: `text` as const, text: `Web search not yet implemented` }],
        details: { success: false },
      }),
    },
  ]

  if (!allowedTools || allowedTools.length === 0) return tools
  return tools.filter((t) => allowedTools.includes(t.name))
}

/**
 * Map a TFunParamType to a TypeBox schema type.
 */
const mapParamType = (type: string, description?: string) => {
  const opts = description ? { description } : {}
  switch (type) {
    case `number`:
      return Type.Number(opts)
    case `boolean`:
      return Type.Boolean(opts)
    case `object`:
      return Type.Record(Type.String(), Type.Any(), opts)
    case `array`:
      return Type.Array(Type.Any(), opts)
    case `string`:
    default:
      return Type.String(opts)
  }
}

/**
 * Returns true when the function has named parameters
 * (either via inputSchema or defaultArgs keys).
 */
const hasNamedParams = (fn: FunctionModel): boolean =>
  (fn.inputSchema?.length ?? 0) > 0 ||
  (fn.defaultArgs ? Object.keys(fn.defaultArgs).length > 0 : false)

/**
 * Build a description string that includes parameter hints for the LLM.
 * Prefers inputSchema (rich info) over defaultArgs (legacy key list).
 */
const buildFunctionDescription = (fn: FunctionModel): string => {
  const base = fn.description || `Custom function: ${fn.name}`

  if (fn.inputSchema?.length) {
    const paramDescs = fn.inputSchema.map((p) => {
      let desc = `${p.name} (${p.type})`
      if (p.description) desc += `: ${p.description}`
      if (p.required) desc += ` [required]`
      return desc
    })
    return `${base}. Parameters: ${paramDescs.join(`; `)}`
  }

  const argKeys = fn.defaultArgs ? Object.keys(fn.defaultArgs) : []
  if (argKeys.length === 0) return base
  return `${base}. Expected arguments: ${argKeys.join(`, `)}`
}

/**
 * Build TypeBox parameters schema for a custom function tool.
 * Prefers inputSchema (typed params) over defaultArgs (legacy string keys).
 */
const buildFunctionParameters = (fn: FunctionModel) => {
  if (fn.inputSchema?.length) {
    const properties: Record<string, any> = {}
    for (const param of fn.inputSchema) {
      const typeSchema = mapParamType(param.type, param.description)
      properties[param.name] = param.required ? typeSchema : Type.Optional(typeSchema)
    }
    return Type.Object(properties, { additionalProperties: true })
  }

  const argKeys = fn.defaultArgs ? Object.keys(fn.defaultArgs) : []
  if (argKeys.length > 0) {
    const properties: Record<string, ReturnType<typeof Type.String>> = {}
    for (const key of argKeys) {
      properties[key] = Type.String({ description: `Value for ${key}` })
    }
    return Type.Object(properties, { additionalProperties: true })
  }

  return Type.Object({
    input: Type.Optional(
      Type.Record(Type.String(), Type.Any(), {
        description: `Input data as key-value pairs passed to the function`,
      })
    ),
  })
}

/**
 * Converts custom FunctionModel definitions into AgentTool[] for the pi-mono Agent.
 * Each tool delegates execution to the caller-provided onExecute callback,
 * which handles sandbox/runtime execution on the backend side.
 */
export const buildCustomFunctionTools = (
  functions: FunctionModel[],
  onExecute: (functionId: string, input: unknown) => Promise<TFunctionExecResult>
): AgentTool<any>[] => {
  return functions.map((fn) => ({
    name: fn.name,
    label: fn.name,
    description: buildFunctionDescription(fn),
    parameters: buildFunctionParameters(fn),
    execute: async (
      _toolCallId: string,
      params: any,
      _signal: AbortSignal,
      onUpdate?: Function
    ) => {
      onUpdate?.({
        content: [{ type: `text`, text: `Executing function: ${fn.name}` }],
        details: { status: `running` },
      })

      // When inputSchema or defaultArgs define named properties, params IS the input directly.
      // When neither is present, params has an `input` wrapper property.
      const input = hasNamedParams(fn) ? params : params.input

      const result = await onExecute(fn.id, input)

      const outputText = result.success
        ? typeof result.output === `string`
          ? result.output
          : JSON.stringify(result.output)
        : result.error || `Function execution failed`

      return {
        content: [{ type: `text`, text: outputText }],
        details: { success: result.success, duration: result.duration },
      }
    },
  }))
}
