export const getOrgInitials = (name: string) => {
  if (!name) return `?`
  const words = name.split(' ')
  return words.length >= 2
    ? `${words[0][0]}${words[1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase()
}
