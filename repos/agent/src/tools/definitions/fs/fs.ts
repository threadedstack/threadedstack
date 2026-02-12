import type { TLLMToolDef } from '@tdsk/domain'

export const fsTools: TLLMToolDef[] = [
  {
    name: `readFile`,
    description: `Read the contents of a file at the specified path`,
    inputSchema: {
      type: `object`,
      properties: {
        path: { type: `string`, description: `File path to read` },
      },
      required: [`path`],
    },
  },
  {
    name: `writeFile`,
    description: `Write content to a file at the specified path. Creates parent directories if needed.`,
    inputSchema: {
      type: `object`,
      properties: {
        path: { type: `string`, description: `File path to write to` },
        content: { type: `string`, description: `Content to write` },
      },
      required: [`path`, `content`],
    },
  },
  {
    name: `listDir`,
    description: `List files and directories at the specified path`,
    inputSchema: {
      type: `object`,
      properties: {
        path: { type: `string`, description: `Directory path to list` },
      },
      required: [`path`],
    },
  },
  {
    name: `deleteFile`,
    description: `Delete a file at the specified path`,
    inputSchema: {
      type: `object`,
      properties: {
        path: { type: `string`, description: `File path to delete` },
      },
      required: [`path`],
    },
  },
  {
    name: `mkdir`,
    description: `Create a directory at the specified path, including parent directories`,
    inputSchema: {
      type: `object`,
      properties: {
        path: { type: `string`, description: `Directory path to create` },
      },
      required: [`path`],
    },
  },
  {
    name: `fileExists`,
    description: `Check if a file or directory exists at the specified path`,
    inputSchema: {
      type: `object`,
      properties: {
        path: { type: `string`, description: `Path to check` },
      },
      required: [`path`],
    },
  },
]
