/**
 * Renders a single contextSources `## <as>` section, accumulating whole
 * documents up to `cap` chars. Never slices the serialized JSON mid-token —
 * a document whose own JSON exceeds the cap (even alone) is omitted entirely
 * rather than partially included. Shared by the backend Schedule executor
 * and the resident's in-pod prompt assembly so both stay byte-identical.
 */
export const renderContextSourceSection = (
  as: string,
  documents: Array<Record<string, unknown>>,
  cap: number
): string => {
  const heading = `## ${as}\n`

  if (!documents.length) return `${heading}(no records)\n\n`

  const included: Array<Record<string, unknown>> = []
  for (const doc of documents) {
    const candidate = [...included, doc]
    const rendered = `${heading}${JSON.stringify(candidate, null, 2)}\n\n`
    if (rendered.length > cap) break
    included.push(doc)
  }

  return `${heading}${JSON.stringify(included, null, 2)}\n\n`
}
