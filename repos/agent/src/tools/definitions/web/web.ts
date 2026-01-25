import type { TToolDefGroup, TToolDefinition } from '@TAG/types'

export const WebTools: TToolDefGroup = {
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
}
