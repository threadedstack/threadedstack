import type { TLLMToolDef } from '@tdsk/domain'

export const codeTools: TLLMToolDef[] = [
  {
    name: `evalCode`,
    description: `Evaluate JavaScript code in an isolated V8 sandbox. Use 'export default <value>' to return a result. Console output is captured separately.`,
    inputSchema: {
      type: `object`,
      properties: {
        code: {
          type: `string`,
          description: `JavaScript code to evaluate. Use 'export default' to return a value.`,
        },
        timeout: {
          type: `number`,
          description: `Execution timeout in milliseconds (default: 5000)`,
        },
      },
      required: [`code`],
    },
  },
]
