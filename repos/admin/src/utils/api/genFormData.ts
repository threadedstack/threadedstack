export const genFormData = (data: Record<string, any>) => {
  return Object.entries(data).reduce((form, [key, value]) => {
    form.set(key, typeof value === `object` ? JSON.stringify(value) : value)

    return form
  }, new FormData())
}
