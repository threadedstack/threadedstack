import type { TToolDefGroup } from '@TAG/types'

export const AgentTools: TToolDefGroup = {
  spawnSubAgent: {
    type: `function`,
    function: {
      name: `spawnSubAgent`,
      description: `Spawn a new sub-agent with a unique ID to handle a specific subtask. Sub-agents run in parallel and can be communicated with via messages.`,
      parameters: {
        type: `object`,
        properties: {
          subAgentId: {
            type: `string`,
            description: `Unique identifier for the sub-agent (e.g., "researcher-1", "coder-backend")`,
          },
          prompt: {
            type: `string`,
            description: `Initial prompt/instructions for the sub-agent`,
          },
        },
        required: [`subAgentId`, `prompt`],
      },
    },
  },

  sendMessageToSubAgent: {
    type: `function`,
    function: {
      name: `sendMessageToSubAgent`,
      description: `Send a message to a running sub-agent. Use this to provide additional instructions or context.`,
      parameters: {
        type: `object`,
        properties: {
          subAgentId: {
            type: `string`,
            description: `The ID of the target sub-agent`,
          },
          message: {
            type: `string`,
            description: `Message content to send`,
          },
        },
        required: [`subAgentId`, `message`],
      },
    },
  },

  receiveMessageFromSubAgent: {
    type: `function`,
    function: {
      name: `receiveMessageFromSubAgent`,
      description: `Receive a message or result from a running sub-agent. This will block until a message is available.`,
      parameters: {
        type: `object`,
        properties: {
          subAgentId: {
            type: `string`,
            description: `The ID of the sub-agent to receive from`,
          },
        },
        required: [`subAgentId`],
      },
    },
  },

  terminateSubAgent: {
    type: `function`,
    function: {
      name: `terminateSubAgent`,
      description: `Terminate a running sub-agent and cleanup its resources. Use this when the sub-agent has completed its task.`,
      parameters: {
        type: `object`,
        properties: {
          subAgentId: {
            type: `string`,
            description: `The ID of the sub-agent to terminate`,
          },
        },
        required: [`subAgentId`],
      },
    },
  },
}
