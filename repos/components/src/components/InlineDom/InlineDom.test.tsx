import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { InlineDom } from './InlineDom'

describe(`InlineDom`, () => {
  it(`should strip <script> tags from html`, () => {
    const html = `<div>hello<script>window.__pwned = true</script></div>`
    const { container } = render(<InlineDom html={html} />)

    expect(container.querySelector(`script`)).not.toBeInTheDocument()
    expect(container.textContent).toContain(`hello`)
  })

  it(`should strip onerror/onload event-handler attributes from html`, () => {
    const html = `<div><img src="x" onerror="window.__pwned = true" /><span onload="window.__pwned = true">safe</span></div>`
    const { container } = render(<InlineDom html={html} />)

    const img = container.querySelector(`img`)
    expect(img).toBeInTheDocument()
    expect(img?.getAttribute(`onerror`)).toBeNull()
    expect(container.innerHTML).not.toContain(`onload`)
  })

  it(`should strip javascript: hrefs from html`, () => {
    const html = `<div><a href="javascript:window.__pwned = true">click</a></div>`
    const { container } = render(<InlineDom html={html} />)

    const anchor = container.querySelector(`a`)
    expect(anchor).toBeInTheDocument()
    expect(anchor?.getAttribute(`href`) || ``).not.toContain(`javascript:`)
  })

  it(`should strip <script> tags from svg icon content`, () => {
    const html = `<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" /><script>window.__pwned = true</script></svg>`
    const { container } = render(<InlineDom html={html} />)

    expect(container.querySelector(`script`)).not.toBeInTheDocument()
    expect(container.querySelector(`circle`)).toBeInTheDocument()
  })

  it(`should strip onerror/onload handlers from svg icon content`, () => {
    const html = `<svg xmlns="http://www.w3.org/2000/svg" onload="window.__pwned = true"><rect width="10" height="10" onerror="window.__pwned = true" /></svg>`
    const { container } = render(<InlineDom html={html} />)

    const svgEl = container.querySelector(`svg`)
    expect(svgEl?.getAttribute(`onload`)).toBeNull()
    const rectEl = container.querySelector(`rect`)
    expect(rectEl?.getAttribute(`onerror`)).toBeNull()
  })

  it(`should render benign html correctly`, () => {
    const html = `<p>Hello <strong>world</strong></p>`
    const { container } = render(<InlineDom html={html} />)

    expect(container.querySelector(`strong`)).toBeInTheDocument()
    expect(container.textContent).toContain(`Hello world`)
  })

  it(`should apply id, className, and sx to the wrapping Box`, () => {
    const { container } = render(
      <InlineDom
        id='icon-1'
        html='<p>Hi</p>'
        className='custom-class'
        sx={{ color: `red` }}
      />
    )

    const box = container.firstElementChild
    expect(box?.id).toBe(`icon-1`)
    expect(box?.className).toContain(`custom-class`)
  })
})
