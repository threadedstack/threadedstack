export const getInitials = (name: string) => {
  if (!name || name === 'undefined') return `?`
  const words = name.split(' ')
  return words.length >= 2
    ? `${words[0][0]}${words[1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase()
}
