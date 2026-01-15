import type { User } from '@tdsk/domain'

export const getInitials = (user: User) => {
  if (user.first && user.last) {
    return `${user.first[0]}${user.last[0]}`.toUpperCase()
  }
  if (user.displayName) {
    const parts = user.displayName.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return user.displayName.substring(0, 2).toUpperCase()
  }
  return 'U'
}
