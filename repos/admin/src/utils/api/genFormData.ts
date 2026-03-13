export const genFormData = (data: Record<string, any>) => {
  const form = new FormData()
  for (const [key, value] of Object.entries(data)) {
    form.set(key, typeof value === `object` ? JSON.stringify(value) : value)
  }
  return form
}
