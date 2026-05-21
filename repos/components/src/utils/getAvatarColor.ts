import { AvatarColors } from '@TSC/theme/colors'

export const getAvatarColor = (identifier?: string): string => {
  if (!identifier) return AvatarColors[0]
  let hash = 0
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % AvatarColors.length
  return AvatarColors[index] ?? AvatarColors[0]
}
