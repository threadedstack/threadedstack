import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TTask, TTasks } from '@TSCL/types'
import { hasHelp, buildCmdPath } from './help'

const mockExit = vi.spyOn(process, `exit`).mockImplementation((() => {}) as any)
const mockLog = vi.spyOn(console, `log`).mockImplementation(() => {})

const getOutput = () => mockLog.mock.calls[0]?.[0] as string

beforeEach(() => {
  mockExit.mockClear()
  mockLog.mockClear()
})

const leafTask: TTask = {
  name: `build`,
  alias: [`bld`],
  description: `Build a Docker image`,
  example: `tdsk docker build --context proxy`,
  options: {
    context: {
      required: true,
      alias: [`ctx`, `name`],
      description: `Context or name to resolve the Dockerfile`,
    },
    push: {
      type: `boolean`,
      default: false,
      description: `Push the built image to the docker provider`,
    },
    tag: {
      type: `array`,
      alias: [`tags`],
      default: [],
      description: `Name of the tag to add to the built image`,
    },
  },
}

const parentTask: TTask = {
  name: `docker`,
  alias: [`doc`, `dc`],
  description: `Docker container management`,
  tasks: {
    build: leafTask,
    run: {
      name: `run`,
      alias: [`start`],
      description: `Run a Docker container`,
    },
  },
}

const hybridTask: TTask = {
  name: `secret`,
  alias: [`secrets`],
  description: `Manage kubernetes secrets`,
  tasks: {
    list: { name: `list`, description: `List all secrets` },
    tdsk: { name: `tdsk`, description: `Create the master key secret` },
  },
  options: {
    name: {
      alias: [`nm`],
      description: `Name of the secret`,
    },
    namespace: {
      alias: [`ns`],
      description: `Namespace for the secret`,
    },
  },
}

const noDescTask: TTask = {
  name: `deploy`,
  tasks: {
    apply: { name: `apply`, description: `Apply deployment` },
  },
}

const noOptionsTask: TTask = {
  name: `start`,
  description: `Start the web server`,
}

const mockTasks: TTasks = {
  docker: parentTask,
  kube: {
    name: `kube`,
    alias: [`kb`],
    description: `Kubernetes management`,
    tasks: {
      secret: hybridTask,
    },
  },
  deploy: noDescTask,
}

describe(`hasHelp`, () => {
  it(`detects --help`, () => {
    expect(hasHelp([`--help`])).toBe(true)
  })

  it(`detects -h`, () => {
    expect(hasHelp([`-h`])).toBe(true)
  })

  it(`detects --help among other args`, () => {
    expect(hasHelp([`docker`, `build`, `--help`, `--context`, `proxy`])).toBe(true)
  })

  it(`detects -h among other args`, () => {
    expect(hasHelp([`docker`, `-h`])).toBe(true)
  })

  it(`returns false when neither present`, () => {
    expect(hasHelp([`docker`, `build`, `--context`, `proxy`])).toBe(false)
  })

  it(`returns false for empty args`, () => {
    expect(hasHelp([])).toBe(false)
  })

  it(`does not match partial flags`, () => {
    expect(hasHelp([`--helper`, `-help`])).toBe(false)
  })
})

describe(`buildCmdPath`, () => {
  it(`builds path for a leaf task`, () => {
    expect(buildCmdPath([`docker`, `build`, `--help`], mockTasks)).toEqual([
      `tdsk`,
      `docker`,
      `build`,
    ])
  })

  it(`builds path for a parent task`, () => {
    expect(buildCmdPath([`docker`, `--help`], mockTasks)).toEqual([`tdsk`, `docker`])
  })

  it(`resolves aliases`, () => {
    expect(buildCmdPath([`doc`, `bld`, `--help`], mockTasks)).toEqual([
      `tdsk`,
      `docker`,
      `build`,
    ])
  })

  it(`builds path for nested tasks`, () => {
    expect(buildCmdPath([`kube`, `secret`, `--help`], mockTasks)).toEqual([
      `tdsk`,
      `kube`,
      `secret`,
    ])
  })

  it(`skips flag args`, () => {
    expect(buildCmdPath([`--help`], mockTasks)).toEqual([`tdsk`])
  })

  it(`stops at unrecognized args`, () => {
    expect(buildCmdPath([`docker`, `nonexistent`], mockTasks)).toEqual([`tdsk`, `docker`])
  })
})

describe(`printHelp`, () => {
  // We dynamically import to get the function that calls process.exit
  const loadPrintHelp = async () => {
    const mod = await import('./help')
    return mod.printHelp
  }

  describe(`root help`, () => {
    it(`shows CLI header and all top-level commands`, async () => {
      const printHelp = await loadPrintHelp()
      printHelp(null, mockTasks, [`tdsk`])

      const output = getOutput()
      expect(output).toContain(`tdsk - ThreadedStack developer CLI`)
      expect(output).toContain(`Usage: tdsk <command> [options]`)
      expect(output).toContain(`Commands:`)
      expect(output).toContain(`docker`)
      expect(output).toContain(`kube`)
      expect(output).toContain(`deploy`)
      expect(output).toContain(`Global Options:`)
      expect(output).toContain(`--env`)
      expect(output).toContain(`--help, -h`)
      expect(mockExit).toHaveBeenCalledWith(0)
    })

    it(`shows sub-tasks one level deep`, async () => {
      const printHelp = await loadPrintHelp()
      printHelp(null, mockTasks, [`tdsk`])

      const output = getOutput()
      expect(output).toContain(`build`)
      expect(output).toContain(`run`)
      expect(output).toContain(`secret`)
    })
  })

  describe(`parent task help`, () => {
    it(`shows description and sub-commands`, async () => {
      const printHelp = await loadPrintHelp()
      printHelp(parentTask, mockTasks, [`tdsk`, `docker`])

      const output = getOutput()
      expect(output).toContain(`tdsk docker - Docker container management`)
      expect(output).toContain(`Usage: tdsk docker <command> [options]`)
      expect(output).toContain(`Commands:`)
      expect(output).toContain(`build, bld`)
      expect(output).toContain(`run, start`)
      expect(output).not.toContain(`Options:`)
    })
  })

  describe(`leaf task help`, () => {
    it(`shows description, example, and options with metadata`, async () => {
      const printHelp = await loadPrintHelp()
      printHelp(leafTask, mockTasks, [`tdsk`, `docker`, `build`])

      const output = getOutput()
      expect(output).toContain(`tdsk docker build - Build a Docker image`)
      expect(output).toContain(`Usage: tdsk docker build [options]`)
      expect(output).toContain(`Example: tdsk docker build --context proxy`)
      expect(output).toContain(`Options:`)
      expect(output).toContain(`--context, -ctx, -name`)
      expect(output).toContain(`[required]`)
      expect(output).toContain(`--push`)
      expect(output).toContain(`[boolean]`)
      expect(output).toContain(`[default: false]`)
      expect(output).toContain(`--tag, -tags`)
      expect(output).toContain(`[array]`)
      expect(output).not.toContain(`Commands:`)
    })
  })

  describe(`hybrid task help`, () => {
    it(`shows both commands and options sections`, async () => {
      const printHelp = await loadPrintHelp()
      printHelp(hybridTask, mockTasks, [`tdsk`, `kube`, `secret`])

      const output = getOutput()
      expect(output).toContain(`tdsk kube secret - Manage kubernetes secrets`)
      expect(output).toContain(`Commands:`)
      expect(output).toContain(`list`)
      expect(output).toContain(`tdsk`)
      expect(output).toContain(`Options:`)
      expect(output).toContain(`--name, -nm`)
      expect(output).toContain(`--namespace, -ns`)
    })
  })

  describe(`edge cases`, () => {
    it(`omits description line when task has no description`, async () => {
      const printHelp = await loadPrintHelp()
      printHelp(noDescTask, mockTasks, [`tdsk`, `deploy`])

      const output = getOutput()
      const lines = output.split(`\n`)
      expect(lines[0]).toBe(`tdsk deploy`)
      expect(output).not.toContain(` - `)
    })

    it(`omits Options section when task has no options`, async () => {
      const printHelp = await loadPrintHelp()
      printHelp(noOptionsTask, mockTasks, [`tdsk`, `web`, `start`])

      const output = getOutput()
      expect(output).toContain(`tdsk web start - Start the web server`)
      expect(output).not.toContain(`Options:`)
      expect(output).not.toContain(`Commands:`)
    })

    it(`omits Example line when task has no example`, async () => {
      const printHelp = await loadPrintHelp()
      printHelp(noOptionsTask, mockTasks, [`tdsk`, `web`, `start`])

      const output = getOutput()
      expect(output).not.toContain(`Example:`)
    })
  })
})
