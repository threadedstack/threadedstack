import { render } from 'ink-testing-library'
import { ProjectPicker } from './ProjectPicker'
import { describe, it, expect, vi } from 'vitest'

describe(`ProjectPicker`, () => {
  const projects = [
    { id: `p1`, name: `Project Alpha`, description: `First project` },
    { id: `p2`, name: `Project Beta`, description: `Second project` },
  ]

  it(`renders project list`, () => {
    const { lastFrame } = render(
      <ProjectPicker
        projects={projects}
        onSelect={() => {}}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain(`Project Alpha`)
    expect(frame).toContain(`Project Beta`)
  })

  it(`auto-selects when only one project`, () => {
    const onSelect = vi.fn()
    render(
      <ProjectPicker
        projects={[projects[0]]}
        onSelect={onSelect}
      />
    )
    expect(onSelect).toHaveBeenCalledWith(projects[0])
  })

  it(`shows project count`, () => {
    const { lastFrame } = render(
      <ProjectPicker
        projects={projects}
        onSelect={() => {}}
      />
    )
    expect(lastFrame()).toContain(`2 projects`)
  })
})
