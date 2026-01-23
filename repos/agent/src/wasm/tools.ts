/**
 * Tool definitions for AI agent
 * Each tool has a schema that defines its interface for the LLM
 * TODO: these should be split out into own files
 * Should be merged with the actual function definitions
 */

import type { TSandboxMetadata } from '@TAG/types/sandbox.types'

export type TToolDefinition = {
  type: `function`
  function: {
    name: string
    description: string
    parameters: {
      type: `object`
      properties: Record<string, any>
      required: string[]
    }
  }
}

/**
 * Available tool definitions
 * These are registered with the LLM so it knows what tools it can use
 */
export const TOOL_DEFINITIONS: Record<string, TToolDefinition> = {
  executeShell: {
    type: `function`,
    function: {
      name: `executeShell`,
      description: `Execute a shell command in the project directory. Use this to run commands like ls, cat, mkdir, git, npm, etc.`,
      parameters: {
        type: `object`,
        properties: {
          command: {
            type: `string`,
            description: `The command to execute (e.g., "ls", "git", "npm")`,
          },
          args: {
            type: `array`,
            items: { type: `string` },
            description: `Command arguments as an array (e.g., ["status"], ["-la"])`,
          },
        },
        required: [`command`, `args`],
      },
    },
  },

  webSearch: {
    type: `function`,
    function: {
      name: `webSearch`,
      description: `Search the web for information. Use this when you need to look up documentation, examples, or current information.`,
      parameters: {
        type: `object`,
        properties: {
          query: {
            type: `string`,
            description: `The search query`,
          },
        },
        required: [`query`],
      },
    },
  },

  readFile: {
    type: `function`,
    function: {
      name: `readFile`,
      description: `Read the contents of a file in the project directory`,
      parameters: {
        type: `object`,
        properties: {
          path: {
            type: `string`,
            description: `Relative path to the file`,
          },
        },
        required: [`path`],
      },
    },
  },

  writeFile: {
    type: `function`,
    function: {
      name: `writeFile`,
      description: `Write content to a file in the project directory. Creates the file if it does not exist.`,
      parameters: {
        type: `object`,
        properties: {
          path: {
            type: `string`,
            description: `Relative path to the file`,
          },
          content: {
            type: `string`,
            description: `Content to write to the file`,
          },
        },
        required: [`path`, `content`],
      },
    },
  },

  listDirectory: {
    type: `function`,
    function: {
      name: `listDirectory`,
      description: `List all files and directories in a given directory path. Returns an array of file/directory names.`,
      parameters: {
        type: `object`,
        properties: {
          path: {
            type: `string`,
            description: `Relative path to the directory (use "." for current directory)`,
          },
        },
        required: [`path`],
      },
    },
  },

  deleteFile: {
    type: `function`,
    function: {
      name: `deleteFile`,
      description: `Delete a file from the project directory. Use with caution.`,
      parameters: {
        type: `object`,
        properties: {
          path: {
            type: `string`,
            description: `Relative path to the file to delete`,
          },
        },
        required: [`path`],
      },
    },
  },

  createDirectory: {
    type: `function`,
    function: {
      name: `createDirectory`,
      description: `Create a new directory in the project. Creates parent directories if they do not exist.`,
      parameters: {
        type: `object`,
        properties: {
          path: {
            type: `string`,
            description: `Relative path to the directory to create`,
          },
        },
        required: [`path`],
      },
    },
  },

  fileExists: {
    type: `function`,
    function: {
      name: `fileExists`,
      description: `Check if a file or directory exists at the given path.`,
      parameters: {
        type: `object`,
        properties: {
          path: {
            type: `string`,
            description: `Relative path to check`,
          },
        },
        required: [`path`],
      },
    },
  },

  getFileStats: {
    type: `function`,
    function: {
      name: `getFileStats`,
      description: `Get detailed information about a file or directory (size, modified time, type).`,
      parameters: {
        type: `object`,
        properties: {
          path: {
            type: `string`,
            description: `Relative path to the file or directory`,
          },
        },
        required: [`path`],
      },
    },
  },
}

/**
 * Get tool definitions filtered by allow/disallow lists
 *
 * @param allowList - List of tool names to allow (if specified, only these tools are included)
 * @param disallowList - List of tool names to disallow (these tools are excluded)
 * @param customTools - Optional array of custom user-supplied tools
 * @returns Array of tool definitions to register with the LLM
 */
export const getToolDefinitions = (
  allowList?: string[],
  disallowList?: string[],
  customTools?: TSandboxMetadata[]
): TToolDefinition[] => {
  const allTools = Object.keys(TOOL_DEFINITIONS)

  // If allowList is specified, only include those tools
  let selectedTools = allowList ? allowList.filter((t) => allTools.includes(t)) : allTools

  // Remove disallowed tools
  if (disallowList) {
    selectedTools = selectedTools.filter((t) => !disallowList.includes(t))
  }

  const builtInTools = selectedTools.map((name) => TOOL_DEFINITIONS[name])

  // Add custom tools if provided
  if (customTools && customTools.length > 0) {
    const customToolDefs: TToolDefinition[] = customTools.map((tool) => ({
      type: `function`,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }))
    return [...builtInTools, ...customToolDefs]
  }

  return builtInTools
}

/**
 * Convert tool definitions for Anthropic API format
 * Anthropic uses a slightly different schema structure
 */
export const convertToAnthropicTools = (tools: TToolDefinition[]) => {
  return tools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters,
  }))
}
