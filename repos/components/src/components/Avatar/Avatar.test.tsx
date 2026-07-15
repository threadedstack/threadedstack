import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Avatar } from './Avatar'
import { getAvatarColor } from '@TSC/utils/getAvatarColor'

describe(`Avatar`, () => {
  describe(`src-image fallback to initials`, () => {
    it(`renders an <img> when src is provided`, () => {
      const { container } = render(
        <Avatar
          name='Ada Lovelace'
          src='https://example.com/a.png'
        />
      )

      const img = container.querySelector(`img`)
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute(`src`, `https://example.com/a.png`)
      expect(img).toHaveAttribute(`alt`, `Ada Lovelace`)
    })

    it(`renders initials instead of an <img> when src is absent`, () => {
      const { container } = render(<Avatar name='Ada Lovelace' />)

      expect(container.querySelector(`img`)).not.toBeInTheDocument()
      expect(container.textContent).toBe(`AL`)
    })
  })

  describe(`initials derivation`, () => {
    it(`uses the first letter of the first two words for a multi-word name`, () => {
      const { container } = render(<Avatar name='Grace Hopper' />)
      expect(container.textContent).toBe(`GH`)
    })

    it(`uses a single letter for a one-word name`, () => {
      const { container } = render(<Avatar name='Cher' />)
      expect(container.textContent).toBe(`C`)
    })

    it(`falls back to "?" for an empty name`, () => {
      const { container } = render(<Avatar name='' />)
      expect(container.textContent).toBe(`?`)
    })
  })

  describe(`color determinism`, () => {
    it(`renders the same background color for the same identifier across separate renders`, () => {
      const { container: first } = render(
        <Avatar
          name='x'
          identifier='user-123'
        />
      )
      const { container: second } = render(
        <Avatar
          name='x'
          identifier='user-123'
        />
      )

      const firstColor = getComputedStyle(
        first.firstElementChild as Element
      ).backgroundColor
      const secondColor = getComputedStyle(
        second.firstElementChild as Element
      ).backgroundColor

      expect(firstColor).toBeTruthy()
      expect(firstColor).toBe(secondColor)
    })

    it(`matches the color getAvatarColor(identifier) computes directly`, () => {
      const { container } = render(
        <Avatar
          name='x'
          identifier='user-123'
        />
      )
      const expectedColor = getAvatarColor(`user-123`)

      expect(container.firstElementChild).toHaveStyle({ backgroundColor: expectedColor })
    })

    it(`falls back to deriving color from name when identifier is absent`, () => {
      const { container } = render(<Avatar name='fallback-name' />)
      const expectedColor = getAvatarColor(`fallback-name`)

      expect(container.firstElementChild).toHaveStyle({ backgroundColor: expectedColor })
    })
  })

  describe(`square vs round`, () => {
    it(`renders fully round (50%) by default`, () => {
      const { container } = render(<Avatar name='Round' />)
      expect(container.firstElementChild).toHaveStyle({ borderRadius: `50%` })
    })

    it(`renders with the square border radius when square is true`, () => {
      const { container } = render(
        <Avatar
          name='Square'
          square
        />
      )
      expect(container.firstElementChild).toHaveStyle({ borderRadius: `8px` })
    })

    it(`applies the square border radius to the image variant too`, () => {
      const { container } = render(
        <Avatar
          name='Square Img'
          src='https://example.com/b.png'
          square
        />
      )
      expect(container.querySelector(`img`)).toHaveStyle({ borderRadius: `8px` })
    })
  })
})
