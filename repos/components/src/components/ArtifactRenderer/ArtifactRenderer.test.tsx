import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ArtifactRenderer } from './ArtifactRenderer'

describe(`ArtifactRenderer`, () => {
  describe(`html artifact type`, () => {
    it(`should strip <script> tags from html content`, () => {
      const content = `<div>hello</div><script>window.__pwned = true</script>`
      const { container } = render(
        <ArtifactRenderer
          content={content}
          artifactType='html'
        />
      )
      expect(container.querySelector(`script`)).not.toBeInTheDocument()
      expect(container.textContent).toContain(`hello`)
    })

    it(`should strip onerror/onload event-handler attributes from html content`, () => {
      const content = `<img src="x" onerror="window.__pwned = true" /><div onload="window.__pwned = true">safe</div>`
      const { container } = render(
        <ArtifactRenderer
          content={content}
          artifactType='html'
        />
      )
      const img = container.querySelector(`img`)
      expect(img).toBeInTheDocument()
      expect(img?.getAttribute(`onerror`)).toBeNull()
      expect(container.innerHTML).not.toContain(`onload`)
    })

    it(`should render benign html content correctly`, () => {
      const content = `<p>Hello <strong>world</strong></p>`
      const { container } = render(
        <ArtifactRenderer
          content={content}
          artifactType='html'
        />
      )
      expect(container.querySelector(`strong`)).toBeInTheDocument()
      expect(container.textContent).toContain(`Hello world`)
    })
  })

  describe(`svg artifact type`, () => {
    it(`should strip <script> tags from svg content`, () => {
      const content = `<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" /><script>window.__pwned = true</script></svg>`
      const { container } = render(
        <ArtifactRenderer
          content={content}
          artifactType='svg'
        />
      )
      expect(container.querySelector(`script`)).not.toBeInTheDocument()
      expect(container.querySelector(`circle`)).toBeInTheDocument()
    })

    it(`should strip onerror/onload handlers from svg content`, () => {
      const content = `<svg xmlns="http://www.w3.org/2000/svg" onload="window.__pwned = true"><rect width="10" height="10" onerror="window.__pwned = true" /></svg>`
      const { container } = render(
        <ArtifactRenderer
          content={content}
          artifactType='svg'
        />
      )
      const svgEl = container.querySelector(`svg`)
      expect(svgEl?.getAttribute(`onload`)).toBeNull()
      const rectEl = container.querySelector(`rect`)
      expect(rectEl?.getAttribute(`onerror`)).toBeNull()
    })

    it(`should render benign svg content correctly`, () => {
      const content = `<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="red" /></svg>`
      const { container } = render(
        <ArtifactRenderer
          content={content}
          artifactType='svg'
        />
      )
      const circle = container.querySelector(`circle`)
      expect(circle).toBeInTheDocument()
      expect(circle?.getAttribute(`fill`)).toBe(`red`)
    })
  })
})
