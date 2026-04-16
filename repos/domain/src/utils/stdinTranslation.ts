import type { TInteraction } from '@TDM/types/gui.types'

const ArrowDown = '\x1b[B'
const ArrowUp = '\x1b[A'
const Enter = '\r'

export function translateInteraction(interaction: TInteraction): string {
  switch (interaction.type) {
    case 'ArrowSelect': {
      const delta = interaction.selectedIndex - interaction.currentIndex
      if (delta === 0) return Enter
      const arrow = delta > 0 ? ArrowDown : ArrowUp
      return arrow.repeat(Math.abs(delta)) + Enter
    }
    case 'NumberSelect':
      return `${interaction.selectedIndex + 1}${Enter}`
    case 'YesNo':
      return `${interaction.approved ? 'y' : 'n'}${Enter}`
    case 'TextInput':
      return `${interaction.text}${Enter}`
    case 'Keystroke':
      return interaction.key
  }
}
