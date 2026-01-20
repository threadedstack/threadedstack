import { describe, it, expect } from 'vitest'
import { objToQuery } from './objToQuery'

describe(`objToQuery`, () => {
  describe(`basic functionality`, () => {
    it(`should convert simple object to query string`, () => {
      const obj = { name: `John`, age: 30 }
      const result = objToQuery(obj)
      expect(result).toBe(`?name=John&age=30`)
    })

    it(`should return empty string for empty object`, () => {
      const obj = {}
      const result = objToQuery(obj)
      expect(result).toBe(``)
    })

    it(`should handle single key-value pair`, () => {
      const obj = { key: `value` }
      const result = objToQuery(obj)
      expect(result).toBe(`?key=value`)
    })
  })

  describe(`data type handling`, () => {
    it(`should handle string values`, () => {
      const obj = { text: `hello world` }
      const result = objToQuery(obj)
      expect(result).toBe(`?text=hello%20world`)
    })

    it(`should handle number values`, () => {
      const obj = { count: 42, price: 19.99 }
      const result = objToQuery(obj)
      expect(result).toBe(`?count=42&price=19.99`)
    })

    it(`should handle boolean values`, () => {
      const obj = { isActive: true, isDeleted: false }
      const result = objToQuery(obj)
      expect(result).toBe(`?isActive=true&isDeleted=false`)
    })

    it(`should handle null and undefined values by skipping them`, () => {
      const obj = { name: `John`, age: null, active: undefined, city: `NYC` }
      const result = objToQuery(obj)
      expect(result).toBe(`?name=John&city=NYC`)
    })
  })

  describe(`array handling with default repeated mode`, () => {
    it(`should handle arrays with repeated parameters by default`, () => {
      const obj = { tags: [`red`, `blue`, `green`] }
      const result = objToQuery(obj)
      expect(result).toBe(`?tags=red&tags=blue&tags=green`)
    })

    it(`should handle arrays with repeated mode explicitly set`, () => {
      const obj = { colors: [`red`, `blue`] }
      const result = objToQuery(obj, { array: `repeated` })
      expect(result).toBe(`?colors=red&colors=blue`)
    })

    it(`should handle arrays with string mode`, () => {
      const obj = { tags: [`red`, `blue`, `green`] }
      const result = objToQuery(obj, { array: `string` })
      expect(result).toBe(`?tags=red%2Cblue%2Cgreen`)
    })

    it(`should handle empty arrays`, () => {
      const obj = { tags: [], name: `test` }
      const result = objToQuery(obj)
      expect(result).toBe(`?name=test`)
    })

    it(`should skip null/undefined array values in repeated mode`, () => {
      const obj = { tags: [`red`, null, `blue`, undefined, `green`] }
      const result = objToQuery(obj)
      expect(result).toBe(`?tags=red&tags=blue&tags=green`)
    })
  })

  describe(`object and complex data handling`, () => {
    it(`should JSON stringify objects`, () => {
      const obj = { config: { theme: `dark`, lang: `en` } }
      const result = objToQuery(obj)
      expect(result).toBe(
        `?config=%7B%22theme%22%3A%22dark%22%2C%22lang%22%3A%22en%22%7D`
      )
    })

    it(`should flatten nested arrays with string mode`, () => {
      const obj = {
        matrix: [
          [1, 2],
          [3, 4],
        ],
      }
      const result = objToQuery(obj, { array: `string` })
      expect(result).toBe(`?matrix=1%2C2%2C3%2C4`)
    })
  })

  describe(`URL encoding`, () => {
    it(`should properly encode special characters in keys`, () => {
      const obj = { [`key with spaces`]: `value`, [`key&with&ampersands`]: `test` }
      const result = objToQuery(obj)
      expect(result).toContain(`key%20with%20spaces=value`)
      expect(result).toContain(`key%26with%26ampersands=test`)
    })

    it(`should properly encode special characters in values`, () => {
      const obj = { message: `Hello & welcome!`, url: `https://example.com?q=test` }
      const result = objToQuery(obj)
      expect(result).toContain(`message=Hello%20%26%20welcome!`)
      expect(result).toContain(`url=https%3A%2F%2Fexample.com%3Fq%3Dtest`)
    })
  })

  describe(`edge cases`, () => {
    it(`should handle objects with mixed data types`, () => {
      const obj = {
        name: `John`,
        age: 30,
        active: true,
        tags: [`admin`, `user`],
        config: { theme: `dark` },
        empty: null,
      }
      const result = objToQuery(obj)
      expect(result).toMatch(/^\?/)
      expect(result).toContain(`name=John`)
      expect(result).toContain(`age=30`)
      expect(result).toContain(`active=true`)
      expect(result).toContain(`tags=admin&tags=user`)
      expect(result).toContain(`config=%7B%22theme%22%3A%22dark%22%7D`)
      expect(result).not.toContain(`empty=`)
    })

    it(`should handle zero values`, () => {
      const obj = { count: 0, rate: 0.0 }
      const result = objToQuery(obj)
      expect(result).toBe(`?count=0&rate=0`)
    })

    it(`should handle empty strings`, () => {
      const obj = { name: ``, title: `test` }
      const result = objToQuery(obj)
      expect(result).toBe(`?name=&title=test`)
    })

    it(`should handle large objects`, () => {
      const obj: Record<string, any> = {}
      for (let i = 0; i < 100; i++) {
        obj[`key${i}`] = `value${i}`
      }
      const result = objToQuery(obj)
      expect(result).toMatch(/^\?/)
      expect(result.split(`&`)).toHaveLength(100)
    })
  })
})
