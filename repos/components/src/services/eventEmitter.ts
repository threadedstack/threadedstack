export type TEventCB<T = Record<any, any>> = (evtObj: T, ...args: any[]) => void
export type TEventOffCB = () => void

/**
 * Stores events based on event names, which can then be called at another time in a different location
 *
 * @export
 * @class EventEmitter
 */
export class EventEmitter {
  listeners: Record<string, Set<TEventCB>> = {}
  refKey: Record<string, TEventCB> = {}

  once = <T = Record<any, any>>(event: string, cb: TEventCB<T>, key: string = event) => {
    let off: TEventOffCB
    const wrap = (...args: any[]) => {
      const resp = (cb as any)?.(...args)
      off?.()
      off = undefined
      return resp
    }

    off = this.on(event, wrap, key)

    return off
  }

  on = <T = Record<any, any>>(event: string, cb: TEventCB<T>, key: string = event) => {
    if (!this.listeners[event]) this.listeners[event] = new Set<TEventCB<T>>()

    if (this.listeners[event].has(cb)) return () => this.off(event, cb)

    this.listeners[event].add(cb)
    key && !this.refKey[key] && (this.refKey[key] = cb)

    return () => this.off(event, cb)
  }

  emit = <T = Record<any, any>>(event: string, evtObj: T = {} as T, ...data: any[]) => {
    const listeners = this.listeners[event]
    if (!listeners || !listeners.size) return false

    listeners.forEach((cb) => cb(evtObj, ...data))

    return true
  }

  dispatch = <T = Record<any, any>>(event: string, evtObj?: T, ...data: any[]) => {
    const listeners = this.listeners[event]
    if (!listeners || !listeners.size) return false

    return Promise.all([...listeners].map(async (cb) => cb(evtObj, ...data)))
  }

  off = <T = Record<any, any>>(
    event: string,
    ref: string | TEventCB<T> = event,
    warn: boolean = true
  ) => {
    const cb = typeof ref === `string` ? this.refKey[ref] : ref
    if (!cb) return warn ? console.warn(`Missing callback from ref ${ref}`) : undefined

    this.listeners[event].delete(cb)

    this.refKey = Object.entries(this.refKey).reduce(
      (acc, [key, value]) => {
        if (ref === value || ref === key) return acc

        acc[key] = value
        return acc
      },
      {} as Record<string, TEventCB>
    )

    return this
  }

  reset = () => {
    this.refKey = {}
    Object.values(this.listeners).forEach((cbs) => cbs?.clear?.())
    this.listeners = {}
  }
}

export const EE = new EventEmitter()
