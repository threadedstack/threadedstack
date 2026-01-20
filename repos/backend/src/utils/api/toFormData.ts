import type { TFormData } from '@TBE/types'

export const toFormData = <T extends TFormData = TFormData>(data: T): FormData => {
  if (!data) return undefined

  return Object.entries(data).reduce((form, [key, value]) => {
    form.set(key, typeof value === `object` ? JSON.stringify(value) : value)

    return form
  }, new FormData())
}
