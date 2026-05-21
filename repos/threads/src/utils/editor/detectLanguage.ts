export const detectLanguage = (path: string): string => {
  if (path.endsWith(`.css`)) return `CSS`
  if (path.endsWith(`.json`)) return `JSON`
  if (path.endsWith(`.html`)) return `HTML`
  if (path.endsWith(`.md`)) return `Markdown`
  if (path.endsWith(`.yml`) || path.endsWith(`.yaml`)) return `YAML`
  if (path.endsWith(`.ts`) || path.endsWith(`.tsx`)) return `TypeScript`
  if (path.endsWith(`.js`) || path.endsWith(`.jsx`)) return `JavaScript`
  return `Plain Text`
}
