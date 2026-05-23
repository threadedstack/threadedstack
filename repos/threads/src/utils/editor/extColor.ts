export const extColor = (path: string): string => {
  if (path.endsWith(`.json`)) return `warning.main`
  if (path.endsWith(`.md`)) return `secondary.main`
  if (path.endsWith(`.ts`) || path.endsWith(`.tsx`)) return `primary.main`
  if (path.endsWith(`.js`) || path.endsWith(`.jsx`)) return `warning.light`
  if (path.endsWith(`.css`) || path.endsWith(`.scss`)) return `info.main`
  return `text.secondary`
}
