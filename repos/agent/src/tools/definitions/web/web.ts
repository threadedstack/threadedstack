import type { TLLMToolDef } from '@tdsk/domain'

export const webTools: TLLMToolDef[] = [
  {
    name: `webSearch`,
    description: `Search the web for information. Returns search results with titles, URLs, and snippets.`,
    inputSchema: {
      type: `object`,
      required: [`query`],
      properties: {
        query: { type: `string`, description: `Search query` },
        maxResults: {
          type: `number`,
          description: `Max results to return (default 5, max 10)`,
        },
      },
    },
  },
  {
    name: `webFetch`,
    description: `Fetch and extract content from a specific URL. Returns the page content as cleaned markdown text.`,
    inputSchema: {
      type: `object`,
      required: [`url`],
      properties: {
        url: { type: `string`, description: `The URL to fetch` },
        maxLength: {
          type: `number`,
          description: `Max content length in chars (default: 50000)`,
        },
      },
    },
  },
]
