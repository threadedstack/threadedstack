import { describe, it, expect } from 'vitest'
import { Logger, Log }  from './logger'

describe(`Logger`, () => {
  describe(`init test`, () => {

    it(`should export a Logger that is an instance of the Log class`, () => {
      expect(Logger instanceof Log).toBe(true)
    })
    
  })

})
  