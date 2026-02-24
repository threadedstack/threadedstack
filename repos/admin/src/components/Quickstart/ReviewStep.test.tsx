import type { ReactNode } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock(`@tdsk/components`, () => ({
  Text: (props: { children: ReactNode }) => <span>{props.children}</span>,
}))

import { ReviewStep } from './ReviewStep'

const providerData = {
  model: 'claude-sonnet-4-20250514',
  apiKey: 'sk-test',
  providerUrl: '',
  providerName: '',
  providerBrand: 'anthropic' as const,
}

const agentData = {
  projectName: 'My Test Project',
  agentName: 'test-agent',
  systemPrompt: '',
  agentDescription: 'A test agent',
}

describe(`ReviewStep`, () => {
  it(`renders the header text`, () => {
    render(
      <ReviewStep
        provider={providerData}
        agent={agentData}
      />
    )
    expect(screen.getByText(`Ready to create 5 resources`)).toBeInTheDocument()
  })

  it(`renders all 5 resource labels`, () => {
    render(
      <ReviewStep
        provider={providerData}
        agent={agentData}
      />
    )
    expect(screen.getByText(`Provider`)).toBeInTheDocument()
    expect(screen.getByText(`Secret`)).toBeInTheDocument()
    expect(screen.getAllByText(`Project`).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(`Agent`)).toBeInTheDocument()
    expect(screen.getByText(`Endpoint`)).toBeInTheDocument()
  })

  it(`displays the provider name from data`, () => {
    render(
      <ReviewStep
        provider={providerData}
        agent={agentData}
      />
    )
    expect(screen.getByText(`Anthropic`)).toBeInTheDocument()
  })

  it(`displays the project name from data`, () => {
    render(
      <ReviewStep
        provider={providerData}
        agent={agentData}
      />
    )
    expect(screen.getByText(`My Test Project`)).toBeInTheDocument()
  })

  it(`displays the agent name from data`, () => {
    render(
      <ReviewStep
        provider={providerData}
        agent={agentData}
      />
    )
    expect(screen.getByText(`test-agent`)).toBeInTheDocument()
  })
})
