import type { TLLMToolDef } from '@tdsk/domain'

export const webTools: TLLMToolDef[] = [
  {
    name: `webSearch`,
    description: `Search the web for information. Returns search results.`,
    inputSchema: {
      type: `object`,
      properties: {
        query: { type: `string`, description: `Search query` },
      },
      required: [`query`],
    },
  },
]
