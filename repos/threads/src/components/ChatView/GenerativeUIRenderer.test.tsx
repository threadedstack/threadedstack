import type { TJsonComponentTree } from '@tdsk/domain'

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GenerativeUIRenderer } from './GenerativeUIRenderer'

describe('GenerativeUIRenderer', () => {
  it('should render text children', () => {
    const tree: TJsonComponentTree = {
      type: 'div',
      props: null,
      children: [{ type: 'p', props: null, children: ['Hello world'] }],
    }
    render(
      <GenerativeUIRenderer
        tree={tree}
        onAction={vi.fn()}
      />
    )
    expect(screen.getByText('Hello world')).toBeDefined()
  })

  it('should render Select component from registry', () => {
    const tree: TJsonComponentTree = {
      type: 'div',
      props: null,
      children: [
        {
          type: 'Select',
          props: {
            interactionType: 'NumberSelect',
            options: [
              { label: 'Redis', value: 'Redis' },
              { label: 'PostgreSQL', value: 'PostgreSQL' },
            ],
          },
          children: [],
        },
      ],
    }
    render(
      <GenerativeUIRenderer
        tree={tree}
        onAction={vi.fn()}
      />
    )
    expect(screen.getByText('Redis')).toBeDefined()
    expect(screen.getByText('PostgreSQL')).toBeDefined()
  })

  it('should call onAction when interactive component is clicked', () => {
    const onAction = vi.fn()
    const tree: TJsonComponentTree = {
      type: 'div',
      props: null,
      children: [
        {
          type: 'Confirm',
          props: { prompt: 'Continue?' },
          children: [],
        },
      ],
    }
    render(
      <GenerativeUIRenderer
        tree={tree}
        onAction={onAction}
      />
    )
    fireEvent.click(screen.getByText('Yes'))
    expect(onAction).toHaveBeenCalledWith({ type: 'YesNo', approved: true })
  })

  it('should render nested HTML elements', () => {
    const tree: TJsonComponentTree = {
      type: 'div',
      props: null,
      children: [
        {
          type: 'p',
          props: null,
          children: [
            'This is ',
            { type: 'strong', props: null, children: ['bold'] },
            ' text',
          ],
        },
      ],
    }
    render(
      <GenerativeUIRenderer
        tree={tree}
        onAction={vi.fn()}
      />
    )
    expect(screen.getByText('bold')).toBeDefined()
  })
})
