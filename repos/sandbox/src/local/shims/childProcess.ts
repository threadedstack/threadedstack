import type { TShimDefinition } from '@TSB/types'

export const childProcessShim: TShimDefinition = {
  names: [`child_process`, `node:child_process`],

  source: `
    const run = globalThis._shellRun
    const execSync = (cmd) => {
      return run(cmd)
    }
    export { run, execSync }
    export default { run, execSync }
  `,

  setupCallbacks: async (jail, ivm, deps) => {
    await jail.set(
      `_shellRun`,
      new ivm.Callback(
        async (cmd: string) => {
          const result = await deps.bash.exec(cmd)
          if (result.exitCode !== 0)
            throw new Error(result.stderr || `Command failed: ${cmd}`)
          return result.stdout
        },
        { async: true }
      )
    )
  },
}
