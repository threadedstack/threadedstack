import type { TSlashCommand } from '@TRL/types'
import { SlashMenu } from './SlashMenu'
import { render } from 'ink-testing-library'
import { describe, it, expect } from 'vitest'

const mockCommands: TSlashCommand[] = [
  {
    name: `help`,
    aliases: [`h`],
    description: `Show available commands`,
    handler: async () => {},
  },
  {
    name: `agent`,
    aliases: [`a`],
    description: `Switch to a different agent`,
    handler: async () => {},
  },
  {
    name: `add`,
    aliases: [],
    description: `Add a context file`,
    handler: async () => {},
  },
]

describe(`SlashMenu`, () => {
  it(`renders nothing when visible is false`, () => {
    const { lastFrame } = render(
      <SlashMenu
        visible={false}
        commands={mockCommands}
        selectedIndex={0}
      />
    )
    expect(lastFrame()).toBe(``)
  })

  it(`renders command names when visible`, () => {
    const { lastFrame } = render(
      <SlashMenu
        visible={true}
        commands={mockCommands}
        selectedIndex={0}
      />
    )
    const frame = lastFrame()
    expect(frame).toContain(`/help`)
    expect(frame).toContain(`/agent`)
    expect(frame).toContain(`/add`)
  })

  it(`renders command descriptions`, () => {
    const { lastFrame } = render(
      <SlashMenu
        visible={true}
        commands={mockCommands}
        selectedIndex={0}
      />
    )
    const frame = lastFrame()
    expect(frame).toContain(`Show available commands`)
    expect(frame).toContain(`Switch to a different agent`)
  })

  it(`renders aliases in parentheses`, () => {
    const { lastFrame } = render(
      <SlashMenu
        visible={true}
        commands={mockCommands}
        selectedIndex={0}
      />
    )
    const frame = lastFrame()
    expect(frame).toContain(`(h)`)
    expect(frame).toContain(`(a)`)
  })

  it(`does not render alias parens for commands with no aliases`, () => {
    const noAliasCommands: TSlashCommand[] = [
      { name: `add`, aliases: [], description: `Add file`, handler: async () => {} },
    ]
    const { lastFrame } = render(
      <SlashMenu
        visible={true}
        commands={noAliasCommands}
        selectedIndex={0}
      />
    )
    const frame = lastFrame()
    expect(frame).toContain(`/add`)
    expect(frame).not.toContain(`()`)
  })

  it(`shows no matching commands message when list is empty`, () => {
    const { lastFrame } = render(
      <SlashMenu
        visible={true}
        commands={[]}
        selectedIndex={0}
      />
    )
    expect(lastFrame()).toContain(`No matching commands`)
  })
})
