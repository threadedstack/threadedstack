export const toFormData = (data: Record<string, any>): FormData | undefined => {
  if (!data) return undefined

  return Object.entries(data).reduce((form, [key, value]) => {
    form.set(key, typeof value === `object` ? JSON.stringify(value) : value)

    return form
  }, new FormData())
}
