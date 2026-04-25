export const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return `N/A`
  return new Date(dateString).toLocaleDateString(`en-US`, {
    year: `numeric`,
    month: `long`,
    day: `numeric`,
  })
}
