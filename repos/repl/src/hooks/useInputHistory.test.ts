import { describe, it, expect } from 'vitest'

describe('input history logic', () => {
  it('adds entries to history', () => {
    const history: string[] = []
    history.push('first')
    history.push('second')
    expect(history).toEqual(['first', 'second'])
  })

  it('navigates up through history', () => {
    const history = ['first', 'second', 'third']
    let index = history.length
    index--
    expect(history[index]).toBe('third')
    index--
    expect(history[index]).toBe('second')
  })
})
