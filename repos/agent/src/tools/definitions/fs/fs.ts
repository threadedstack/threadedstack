import type { TToolDefGroup } from '@TAG/types'

export const FSTools: TToolDefGroup = {
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
