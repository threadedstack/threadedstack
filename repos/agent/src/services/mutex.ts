import type { TMutexOpts } from '../types/mutex.types'

/**
 * Mutex class for managing concurrent access to project directories
 * Ensures strict serial execution per projectId to prevent filesystem corruption
 */
export class Mutex {
  private locks = new Map<string, Promise<void>>()
  private maxLocks: number
  private timeout: number

  constructor(opts?: TMutexOpts) {
    this.maxLocks = opts?.maxLocks ?? 100
    this.timeout = opts?.timeout ?? 30000
  }

  /**
   * Acquire a lock for a specific projectId
   * Returns a release function that MUST be called when done
   */
  acquire = async (projectId: string): Promise<() => void> => {
    let releaseLock: () => void

    // Chain new task to end of current promise (Promise-based queue)
    const currentLock = this.locks.get(projectId) || Promise.resolve()
    const newLock = currentLock.then(
      () =>
        new Promise<void>((resolve) => {
          releaseLock = resolve
        })
    )

    this.locks.set(projectId, newLock)

    // Wait for turn
    await currentLock

    return () => {
      releaseLock()
      // Clean up if this was the last task
      if (this.locks.get(projectId) === newLock) {
        this.locks.delete(projectId)
      }
    }
  }

  /**
   * Get number of active locks
   */
  getActiveLocks = (): number => {
    return this.locks.size
  }

  /**
   * Clear all locks (use with caution)
   */
  clearAll = (): void => {
    this.locks.clear()
  }
}
