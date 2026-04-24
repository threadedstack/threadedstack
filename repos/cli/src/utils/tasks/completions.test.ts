import { describe, it, expect } from 'vitest'
import type { TTasks } from '@TSCL/types'
import { getCompletions } from './completions'

const mockTasks: TTasks = {
  docker: {
    name: `docker`,
    alias: [`doc`, `dc`],
    description: `Docker container management`,
    tasks: {
      build: {
        name: `build`,
        alias: [`bld`],
        description: `Build a Docker image`,
        options: {
          context: {
            required: true,
            alias: [`ctx`, `name`],
            description: `Context or name to resolve the Dockerfile`,
          },
          push: {
            type: `boolean`,
            default: false,
            description: `Push the built image`,
          },
          tag: {
            type: `array`,
            alias: [`tags`],
            description: `Tag for the built image`,
          },
        },
      },
      run: {
        name: `run`,
        alias: [`start`],
        description: `Run a Docker container`,
      },
    },
  },
  kube: {
    name: `kube`,
    alias: [`kb`],
    description: `Kubernetes management`,
    tasks: {
      secret: {
        name: `secret`,
        alias: [`secrets`],
        description: `Manage kubernetes secrets`,
        options: {
          name: {
            alias: [`nm`],
            description: `Name of the secret`,
          },
        },
      },
    },
  },
  deploy: {
    name: `deploy`,
    description: `Deploy services`,
  },
}

describe(`getCompletions`, () => {
  describe(`top-level task completion`, () => {
    it(`lists all top-level tasks after tdsk + space`, () => {
      const result = getCompletions(`tdsk `, 5, mockTasks)
      expect(result).toContain(`docker`)
      expect(result).toContain(`kube`)
      expect(result).toContain(`deploy`)
      expect(result).not.toContain(`doc`)
      expect(result).not.toContain(`dc`)
      expect(result).not.toContain(`kb`)
    })

    it(`returns all top-level tasks for shell to filter by partial`, () => {
      const result = getCompletions(`tdsk do`, 7, mockTasks)
      expect(result).toContain(`docker`)
      expect(result).toContain(`kube`)
      expect(result).toContain(`deploy`)
    })

    it(`returns all top-level tasks even with alias-like partial`, () => {
      const result = getCompletions(`tdsk dc`, 7, mockTasks)
      expect(result).toContain(`docker`)
      expect(result).toContain(`kube`)
      expect(result).toContain(`deploy`)
    })

    it(`returns all top-level tasks for unmatched partial`, () => {
      const result = getCompletions(`tdsk xyz`, 8, mockTasks)
      expect(result).toContain(`docker`)
      expect(result).toContain(`kube`)
      expect(result).toContain(`deploy`)
    })
  })

  describe(`sub-task completion`, () => {
    it(`lists sub-tasks after resolving parent`, () => {
      const result = getCompletions(`tdsk docker `, 12, mockTasks)
      expect(result).toContain(`build`)
      expect(result).toContain(`run`)
      expect(result).not.toContain(`bld`)
      expect(result).not.toContain(`start`)
    })

    it(`resolves aliases then lists sub-tasks`, () => {
      const result = getCompletions(`tdsk doc `, 9, mockTasks)
      expect(result).toContain(`build`)
      expect(result).toContain(`run`)
    })

    it(`returns all sub-tasks for shell to filter by partial`, () => {
      const result = getCompletions(`tdsk docker b`, 13, mockTasks)
      expect(result).toContain(`build`)
      expect(result).toContain(`run`)
      expect(result).not.toContain(`bld`)
    })

    it(`handles nested sub-tasks`, () => {
      const result = getCompletions(`tdsk kube `, 10, mockTasks)
      expect(result).toContain(`secret`)
      expect(result).not.toContain(`secrets`)
    })
  })

  describe(`option completion`, () => {
    it(`lists options for a leaf task`, () => {
      const result = getCompletions(`tdsk docker build --`, 20, mockTasks)
      expect(result).toContain(`--context`)
      expect(result).toContain(`--push`)
      expect(result).toContain(`--tag`)
      expect(result).toContain(`--env`)
      expect(result).toContain(`--help`)
    })

    it(`includes option aliases with dash prefix`, () => {
      const result = getCompletions(`tdsk docker build -`, 19, mockTasks)
      expect(result).toContain(`-ctx`)
      expect(result).toContain(`-name`)
      expect(result).toContain(`-tags`)
      expect(result).toContain(`-h`)
    })

    it(`returns all options for shell to filter by partial`, () => {
      const result = getCompletions(`tdsk docker build --c`, 21, mockTasks)
      expect(result).toContain(`--context`)
      expect(result).toContain(`--push`)
      expect(result).toContain(`--tag`)
      expect(result).toContain(`--env`)
    })

    it(`returns all options including aliases for dash partial`, () => {
      const result = getCompletions(`tdsk docker build -t`, 20, mockTasks)
      expect(result).toContain(`-tags`)
      expect(result).toContain(`-ctx`)
      expect(result).toContain(`--context`)
    })

    it(`shows global options at root level`, () => {
      const result = getCompletions(`tdsk --`, 7, mockTasks)
      expect(result).toContain(`--env`)
      expect(result).toContain(`--environment`)
      expect(result).toContain(`--help`)
    })

    it(`shows global options for parent task with no own options`, () => {
      const result = getCompletions(`tdsk docker --`, 14, mockTasks)
      expect(result).toContain(`--env`)
      expect(result).toContain(`--help`)
    })

    it(`includes global options alongside task options`, () => {
      const result = getCompletions(`tdsk kube secret --`, 19, mockTasks)
      expect(result).toContain(`--name`)
      expect(result).toContain(`--env`)
      expect(result).toContain(`--help`)
    })

    it(`includes aliases when partial is single dash`, () => {
      const result = getCompletions(`tdsk kube secret -`, 18, mockTasks)
      expect(result).toContain(`-nm`)
      expect(result).toContain(`--name`)
      expect(result).toContain(`-h`)
    })
  })

  describe(`edge cases`, () => {
    it(`returns all top-level tasks for exact match (shell confirms)`, () => {
      const result = getCompletions(`tdsk docker`, 11, mockTasks)
      expect(result).toContain(`docker`)
      expect(result).toContain(`kube`)
      expect(result).toContain(`deploy`)
    })

    it(`handles task with no sub-tasks or options`, () => {
      const result = getCompletions(`tdsk deploy `, 12, mockTasks)
      expect(result).toEqual([])
    })

    it(`respects cursor position mid-line`, () => {
      const result = getCompletions(`tdsk do --help`, 7, mockTasks)
      expect(result).toContain(`docker`)
      expect(result).toContain(`kube`)
      expect(result).toContain(`deploy`)
      expect(result).not.toContain(`--help`)
    })

    it(`completes tasks even without trailing space`, () => {
      const result = getCompletions(`tdsk`, 4, mockTasks)
      expect(result).toContain(`docker`)
      expect(result).toContain(`kube`)
      expect(result).toContain(`deploy`)
    })
  })
})
