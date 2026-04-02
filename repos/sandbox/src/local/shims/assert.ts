import type { TShimDefinition } from '@TSB/types'

export const assertShim: TShimDefinition = {
  names: [`assert`, `node:assert`],

  source: `
    class AssertionError extends Error {
      constructor(options) {
        const msg = typeof options === 'string'
          ? options
          : (options && options.message) || 'Assertion failed'
        super(msg)
        this.name = 'AssertionError'
        this.code = 'ERR_ASSERTION'
        if (options && typeof options === 'object') {
          this.actual = options.actual
          this.expected = options.expected
          this.operator = options.operator
        }
      }
    }

    function fail(message) {
      throw new AssertionError({
        message: message || 'Failed',
        operator: 'fail',
      })
    }

    function ok(value, message) {
      if (!value) {
        throw new AssertionError({
          message: message || 'Expected value to be truthy',
          actual: value,
          expected: true,
          operator: '==',
        })
      }
    }

    function equal(actual, expected, message) {
      if (actual != expected) {
        throw new AssertionError({
          message: message || 'Expected values to be loosely equal',
          actual: actual,
          expected: expected,
          operator: '==',
        })
      }
    }

    function notEqual(actual, expected, message) {
      if (actual == expected) {
        throw new AssertionError({
          message: message || 'Expected values to be not loosely equal',
          actual: actual,
          expected: expected,
          operator: '!=',
        })
      }
    }

    function strictEqual(actual, expected, message) {
      if (actual !== expected) {
        throw new AssertionError({
          message: message || 'Expected values to be strictly equal',
          actual: actual,
          expected: expected,
          operator: '===',
        })
      }
    }

    function notStrictEqual(actual, expected, message) {
      if (actual === expected) {
        throw new AssertionError({
          message: message || 'Expected values to be not strictly equal',
          actual: actual,
          expected: expected,
          operator: '!==',
        })
      }
    }

    function deepStrictEqual(actual, expected, message) {
      const a = JSON.stringify(actual)
      const b = JSON.stringify(expected)
      if (a !== b) {
        throw new AssertionError({
          message: message || 'Expected values to be deeply strictly equal',
          actual: actual,
          expected: expected,
          operator: 'deepStrictEqual',
        })
      }
    }

    function throws(fn, expected, message) {
      let threw = false
      try {
        fn()
      } catch (e) {
        threw = true
        if (expected) {
          if (typeof expected === 'function' && (expected.prototype instanceof Error || expected === Error)) {
            if (!(e instanceof expected)) {
              throw new AssertionError({
                message: message || 'Expected function to throw ' + expected.name,
                actual: e,
                expected: expected,
                operator: 'throws',
              })
            }
          } else if (expected instanceof RegExp) {
            if (!expected.test(e.message || String(e))) {
              throw new AssertionError({
                message: message || 'Expected error message to match ' + expected,
                actual: e.message,
                expected: expected,
                operator: 'throws',
              })
            }
          } else if (typeof expected === 'function') {
            if (!expected(e)) {
              throw new AssertionError({
                message: message || 'Expected error to satisfy validator',
                actual: e,
                expected: expected,
                operator: 'throws',
              })
            }
          }
        }
      }
      if (!threw) {
        throw new AssertionError({
          message: message || 'Expected function to throw',
          operator: 'throws',
        })
      }
    }

    function doesNotThrow(fn, message) {
      try {
        fn()
      } catch (e) {
        throw new AssertionError({
          message: message || 'Expected function not to throw, but it threw: ' + (e.message || e),
          actual: e,
          operator: 'doesNotThrow',
        })
      }
    }

    export { AssertionError, ok, equal, notEqual, strictEqual, notStrictEqual, deepStrictEqual, throws, doesNotThrow, fail }
    export default ok
  `,
}
