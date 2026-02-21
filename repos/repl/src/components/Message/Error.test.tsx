import { ErrorMessage } from './Error'
import { render } from 'ink-testing-library'
import { describe, it, expect } from 'vitest'

describe(`ErrorMessage`, () => {
  it(`renders error message`, () => {
    const { lastFrame } = render(<ErrorMessage message="Something went wrong" />)
    expect(lastFrame()).toContain(`Something went wrong`)
  })

  it(`renders suggestion when provided`, () => {
    const { lastFrame } = render(
      <ErrorMessage
        message="Failed"
        suggestion="Try again"
      />
    )
    expect(lastFrame()).toContain(`Try again`)
  })

  it(`renders from Error object using friendly mapping`, () => {
    const error = Object.assign(new Error(`connect`), { code: `ECONNREFUSED` })
    const { lastFrame } = render(<ErrorMessage error={error} />)
    expect(lastFrame()).toContain(`reach the server`)
  })
})
