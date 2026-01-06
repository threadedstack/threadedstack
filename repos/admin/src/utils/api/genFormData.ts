export const genFormData = (data: Record<string, any>) => {
  return Object.entries(data).reduce((form, [key, value]) => {
    form.set(key, value)

    return form
  }, new FormData())
}
