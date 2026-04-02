import type { TShimDefinition } from '@TSB/types'

export const eventsShim: TShimDefinition = {
  names: [`events`, `node:events`],

  source: `
    class EventEmitter {
      constructor() {
        this._events = {}
      }

      on(event, listener) {
        if (!this._events[event]) this._events[event] = []
        this._events[event].push(listener)
        return this
      }

      addListener(event, listener) {
        return this.on(event, listener)
      }

      off(event, listener) {
        return this.removeListener(event, listener)
      }

      once(event, listener) {
        const wrapped = (...args) => {
          this.removeListener(event, wrapped)
          listener.apply(this, args)
        }
        wrapped._original = listener
        return this.on(event, wrapped)
      }

      emit(event, ...args) {
        const listeners = this._events[event]
        if (event === 'error' && (!listeners || listeners.length === 0)) {
          const err = args[0]
          throw err instanceof Error ? err : new Error('Unhandled error event')
        }
        if (!listeners || listeners.length === 0) return false
        const copy = listeners.slice()
        for (let i = 0; i < copy.length; i++) {
          copy[i].apply(this, args)
        }
        return true
      }

      removeListener(event, listener) {
        const listeners = this._events[event]
        if (!listeners) return this
        for (let i = listeners.length - 1; i >= 0; i--) {
          if (listeners[i] === listener || listeners[i]._original === listener) {
            listeners.splice(i, 1)
            break
          }
        }
        if (listeners.length === 0) delete this._events[event]
        return this
      }

      removeAllListeners(event) {
        if (event !== undefined) {
          delete this._events[event]
        } else {
          this._events = {}
        }
        return this
      }

      listenerCount(event) {
        const listeners = this._events[event]
        return listeners ? listeners.length : 0
      }

      eventNames() {
        return Object.keys(this._events)
      }

      listeners(event) {
        const listeners = this._events[event]
        if (!listeners) return []
        return listeners.map(fn => fn._original || fn)
      }
    }

    export { EventEmitter }
    export default EventEmitter
  `,
}
