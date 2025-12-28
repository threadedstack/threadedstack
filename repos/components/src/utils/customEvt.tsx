import { uuid } from '@keg-hub/jsutils/uuid'

export const customEvt = (name: string, ctx: Record<any, any>) =>
  new CustomEvent(name, ctx)

export const valAsEvt = (val: any, name?: string) => {
  return { target: { value: val } }
}
