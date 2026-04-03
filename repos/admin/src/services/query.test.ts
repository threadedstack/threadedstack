import { describe, it, expect, beforeEach } from 'vitest'
import { QueryService } from './query'

type TestEntity = { id: string; name: string }

describe('QueryService cache methods', () => {
  let qs: QueryService

  beforeEach(() => {
    qs = new QueryService()
  })

  describe('upsertListCache', () => {
    it('should update an existing entity in the cached list', () => {
      const key = ['test', 'list'] as const
      const items: TestEntity[] = [
        { id: '1', name: 'A' },
        { id: '2', name: 'B' },
      ]
      qs.client.setQueryData(key, items)

      qs.upsertListCache(key, { id: '2', name: 'B-updated' })

      const cached = qs.client.getQueryData<TestEntity[]>(key)
      expect(cached).toEqual([
        { id: '1', name: 'A' },
        { id: '2', name: 'B-updated' },
      ])
    })

    it('should append a new entity when id is not found in cached list', () => {
      const key = ['test', 'list'] as const
      const items: TestEntity[] = [{ id: '1', name: 'A' }]
      qs.client.setQueryData(key, items)

      qs.upsertListCache(key, { id: '3', name: 'C' })

      const cached = qs.client.getQueryData<TestEntity[]>(key)
      expect(cached).toEqual([
        { id: '1', name: 'A' },
        { id: '3', name: 'C' },
      ])
    })

    it('should return cached unchanged when cache is undefined', () => {
      const key = ['test', 'empty'] as const

      qs.upsertListCache(key, { id: '1', name: 'A' })

      const cached = qs.client.getQueryData<TestEntity[]>(key)
      expect(cached).toBeUndefined()
    })

    it('should not throw when setQueryData updater throws', () => {
      const key = ['test', 'bad'] as const
      // Seed with a non-array value to provoke an error inside the updater
      // (findIndex will fail on a non-array)
      qs.client.setQueryData(key, 'not-an-array')

      expect(() => {
        qs.upsertListCache(key, { id: '1', name: 'A' })
      }).not.toThrow()
    })
  })

  describe('removeFromListCache', () => {
    it('should remove an entity from the cached list by id', () => {
      const key = ['test', 'list'] as const
      const items: TestEntity[] = [
        { id: '1', name: 'A' },
        { id: '2', name: 'B' },
        { id: '3', name: 'C' },
      ]
      qs.client.setQueryData(key, items)

      qs.removeFromListCache(key, '2')

      const cached = qs.client.getQueryData<TestEntity[]>(key)
      expect(cached).toEqual([
        { id: '1', name: 'A' },
        { id: '3', name: 'C' },
      ])
    })

    it('should handle undefined cache gracefully', () => {
      const key = ['test', 'missing'] as const

      expect(() => {
        qs.removeFromListCache(key, '1')
      }).not.toThrow()

      const cached = qs.client.getQueryData<TestEntity[]>(key)
      expect(cached).toBeUndefined()
    })

    it('should not throw when cache contains unexpected data', () => {
      const key = ['test', 'bad'] as const
      qs.client.setQueryData(key, 42)

      expect(() => {
        qs.removeFromListCache(key, '1')
      }).not.toThrow()
    })
  })

  describe('updateDetailCache', () => {
    it('should set entity data at the query key', () => {
      const key = ['test', 'detail', '1'] as const
      const entity: TestEntity = { id: '1', name: 'Detail' }

      qs.updateDetailCache(key, entity)

      const cached = qs.client.getQueryData<TestEntity>(key)
      expect(cached).toEqual({ id: '1', name: 'Detail' })
    })

    it('should overwrite previously cached data', () => {
      const key = ['test', 'detail', '1'] as const
      qs.client.setQueryData(key, { id: '1', name: 'Old' })

      qs.updateDetailCache(key, { id: '1', name: 'New' })

      const cached = qs.client.getQueryData<TestEntity>(key)
      expect(cached).toEqual({ id: '1', name: 'New' })
    })

    it('should not throw on failure', () => {
      const qs2 = new QueryService()
      // Sabotage the client to force an error inside the try-catch
      qs2.client.setQueryData = () => {
        throw new Error('forced failure')
      }

      expect(() => {
        qs2.updateDetailCache(['key'], { id: '1' })
      }).not.toThrow()
    })
  })
})
