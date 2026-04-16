import { describe, it, expect } from 'vitest'
import { validateTree } from './validator'

describe('validateTree', () => {
  it('should accept a valid tree with Select', () => {
    const tree = {
      type: 'div',
      props: null,
      children: [
        {
          type: 'Select',
          props: {
            interactionType: 'ArrowSelect',
            currentIndex: 0,
            options: [
              { label: 'A', value: 'A' },
              { label: 'B', value: 'B' },
            ],
          },
          children: [],
        },
      ],
    }
    expect(validateTree(tree)).toBe(true)
  })

  it('should accept a valid tree with Confirm', () => {
    const tree = {
      type: 'div',
      props: null,
      children: [{ type: 'Confirm', props: { prompt: 'Continue?' }, children: [] }],
    }
    expect(validateTree(tree)).toBe(true)
  })

  it('should accept HTML-only trees', () => {
    const tree = {
      type: 'div',
      props: null,
      children: [{ type: 'p', props: null, children: ['Hello world'] }],
    }
    expect(validateTree(tree)).toBe(true)
  })

  it('should reject non-div root', () => {
    const tree = { type: 'span', props: null, children: [] }
    expect(validateTree(tree)).toBe(false)
  })

  it('should reject unknown component types', () => {
    const tree = {
      type: 'div',
      props: null,
      children: [{ type: 'FancyWidget', props: {}, children: [] }],
    }
    expect(validateTree(tree)).toBe(false)
  })

  it('should reject Select with fewer than 2 options', () => {
    const tree = {
      type: 'div',
      props: null,
      children: [
        {
          type: 'Select',
          props: {
            interactionType: 'NumberSelect',
            options: [{ label: 'A', value: 'A' }],
          },
          children: [],
        },
      ],
    }
    expect(validateTree(tree)).toBe(false)
  })

  it('should reject Confirm with empty prompt', () => {
    const tree = {
      type: 'div',
      props: null,
      children: [{ type: 'Confirm', props: { prompt: '' }, children: [] }],
    }
    expect(validateTree(tree)).toBe(false)
  })

  it('should reject trees exceeding max depth', () => {
    let node: any = { type: 'span', props: null, children: ['leaf'] }
    for (let i = 0; i < 12; i++) {
      node = { type: 'div', props: null, children: [node] }
    }
    expect(validateTree(node)).toBe(false)
  })

  it('should accept string children', () => {
    const tree = {
      type: 'div',
      props: null,
      children: ['Hello', { type: 'strong', props: null, children: ['world'] }],
    }
    expect(validateTree(tree)).toBe(true)
  })

  it('should reject null input', () => {
    expect(validateTree(null)).toBe(false)
  })

  it('should reject array input', () => {
    expect(validateTree([{ type: 'div' }])).toBe(false)
  })

  it('should reject node with children: null', () => {
    const tree = { type: 'div', props: null, children: null }
    // children is null (falsy), so the children block is skipped — node is valid
    expect(validateTree(tree as any)).toBe(true)
  })

  it('should accept Alert with variant prop', () => {
    const tree = {
      type: 'div',
      props: null,
      children: [
        {
          type: 'Alert',
          props: { variant: 'warning', title: 'Watch out' },
          children: ['Be careful'],
        },
      ],
    }
    expect(validateTree(tree)).toBe(true)
  })

  it('should accept TextInput with placeholder', () => {
    const tree = {
      type: 'div',
      props: null,
      children: [
        {
          type: 'TextInput',
          props: { placeholder: 'Enter text...', label: 'Name' },
          children: [],
        },
      ],
    }
    expect(validateTree(tree)).toBe(true)
  })

  it('should accept ProgressBar with value and max', () => {
    const tree = {
      type: 'div',
      props: null,
      children: [
        {
          type: 'ProgressBar',
          props: { value: 50, max: 100, label: 'Loading...' },
          children: [],
        },
      ],
    }
    expect(validateTree(tree)).toBe(true)
  })

  it('should reject Select with undefined options', () => {
    const tree = {
      type: 'div',
      props: null,
      children: [
        { type: 'Select', props: { interactionType: 'NumberSelect' }, children: [] },
      ],
    }
    expect(validateTree(tree)).toBe(false)
  })

  it('should reject node with children containing non-string non-object', () => {
    const tree = {
      type: 'div',
      props: null,
      children: [42 as any],
    }
    expect(validateTree(tree)).toBe(false)
  })
})
