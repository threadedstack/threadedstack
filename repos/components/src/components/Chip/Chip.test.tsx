import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Chip } from './Chip'

describe(`Chip`, () => {
  describe(`variants`, () => {
    it(`renders an outlined MUI chip with the tone color as its text/border color`, () => {
      const { container } = render(
        <Chip
          label='Outlined'
          tone='success'
          variant='outlined'
        />
      )

      const chip = container.querySelector(`.MuiChip-root`)
      expect(chip).toBeInTheDocument()
      expect(chip).toHaveClass(`MuiChip-outlined`)
      expect(chip).toHaveStyle({ color: `rgb(44, 182, 125)` })
    })

    it(`renders a solid MUI chip with the tone color as its background`, () => {
      const { container } = render(
        <Chip
          label='Solid'
          tone='error'
          variant='solid'
        />
      )

      const chip = container.querySelector(`.MuiChip-root`)
      expect(chip).toBeInTheDocument()
      expect(chip).not.toHaveClass(`MuiChip-outlined`)
      expect(chip).toHaveStyle({ backgroundColor: `rgb(239, 68, 68)`, color: `#fff` })
    })

    it(`renders the default tint variant with a dot indicator and no icon by default`, () => {
      const { container } = render(
        <Chip
          label='Tint'
          tone='info'
        />
      )

      const chip = container.querySelector(`.MuiChip-root`)
      expect(chip).toBeInTheDocument()
      expect(container).toHaveTextContent(`Tint`)
      // the tint variant's dot indicator is a plain div, not an svg icon
      expect(container.querySelector(`.MuiChip-icon`)).not.toBeInTheDocument()
    })
  })

  describe(`label content`, () => {
    it(`renders the label text for every variant`, () => {
      const outlined = render(
        <Chip
          label='A'
          variant='outlined'
        />
      )
      expect(outlined.container).toHaveTextContent(`A`)

      const solid = render(
        <Chip
          label='B'
          variant='solid'
        />
      )
      expect(solid.container).toHaveTextContent(`B`)

      const tint = render(
        <Chip
          label='C'
          variant='tint'
        />
      )
      expect(tint.container).toHaveTextContent(`C`)
    })
  })

  describe(`pulse animation`, () => {
    it(`does not apply a pulse animation to the dot when pulse is false`, () => {
      const { container } = render(
        <Chip
          label='No Pulse'
          pulse={false}
        />
      )

      const dot = container.querySelector(`.MuiChip-label > div > div`)
      expect(dot).toBeInTheDocument()
      expect(getComputedStyle(dot as Element).animation).toBeFalsy()
    })

    it(`applies a pulse animation to the dot when pulse is true`, () => {
      const { container } = render(
        <Chip
          label='Pulse'
          pulse
        />
      )

      const dot = container.querySelector(`.MuiChip-label > div > div`)
      expect(dot).toBeInTheDocument()
      expect(getComputedStyle(dot as Element).animation).toContain(`1.5s`)
    })

    it(`only applies the pulse animation on the tint variant, not outlined or solid`, () => {
      const outlined = render(
        <Chip
          label='Outlined'
          variant='outlined'
          pulse
        />
      )
      const solid = render(
        <Chip
          label='Solid'
          variant='solid'
          pulse
        />
      )

      // outlined/solid variants never render the dot element at all
      expect(
        outlined.container.querySelector(`.MuiChip-label > div > div`)
      ).not.toBeInTheDocument()
      expect(
        solid.container.querySelector(`.MuiChip-label > div > div`)
      ).not.toBeInTheDocument()
    })
  })
})
