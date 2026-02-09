import { describe, it, expect } from 'vitest'
import { validateExclusiveArc } from './exclusiveArc'

describe(`validateExclusiveArc`, () => {
  const fields = (orgId?: string, projectId?: string, providerId?: string) => [
    { name: `orgId`, value: orgId },
    { name: `projectId`, value: projectId },
    { name: `providerId`, value: providerId },
  ]

  describe(`valid - exactly one field present`, () => {
    it(`should return the single present field when orgId is provided`, () => {
      const result = validateExclusiveArc(fields(`org-1`, undefined, undefined), `Secret`)
      expect(result).toEqual({ name: `orgId`, value: `org-1` })
    })

    it(`should return the single present field when projectId is provided`, () => {
      const result = validateExclusiveArc(
        fields(undefined, `project-1`, undefined),
        `Secret`
      )
      expect(result).toEqual({ name: `projectId`, value: `project-1` })
    })

    it(`should return the single present field when providerId is provided`, () => {
      const result = validateExclusiveArc(
        fields(undefined, undefined, `provider-1`),
        `Config`
      )
      expect(result).toEqual({ name: `providerId`, value: `provider-1` })
    })
  })

  describe(`invalid - no fields present`, () => {
    it(`should throw 400 when all fields are undefined`, () => {
      expect(() =>
        validateExclusiveArc(fields(undefined, undefined, undefined), `Secret`)
      ).toThrow(`Secret must belong to one of: orgId, projectId, providerId`)
    })

    it(`should throw 400 when all fields are empty string`, () => {
      expect(() => validateExclusiveArc(fields(``, ``, ``), `Secret`)).toThrow(
        `Secret must belong to one of: orgId, projectId, providerId`
      )
    })

    it(`should throw 400 when fields are null`, () => {
      const nullFields = [
        { name: `orgId`, value: null },
        { name: `projectId`, value: null },
      ]
      expect(() => validateExclusiveArc(nullFields, `Config`)).toThrow(
        `Config must belong to one of: orgId, projectId`
      )
    })
  })

  describe(`invalid - multiple fields present`, () => {
    it(`should throw 400 when two fields are present (orgId + projectId)`, () => {
      expect(() =>
        validateExclusiveArc(fields(`org-1`, `project-1`, undefined), `Secret`)
      ).toThrow(
        `Secret can only belong to one of: orgId, projectId, providerId (exclusive arc)`
      )
    })

    it(`should throw 400 when two fields are present (orgId + providerId)`, () => {
      expect(() =>
        validateExclusiveArc(fields(`org-1`, undefined, `provider-1`), `Secret`)
      ).toThrow(
        `Secret can only belong to one of: orgId, projectId, providerId (exclusive arc)`
      )
    })

    it(`should throw 400 when all three fields are present`, () => {
      expect(() =>
        validateExclusiveArc(fields(`org-1`, `project-1`, `provider-1`), `Config`)
      ).toThrow(
        `Config can only belong to one of: orgId, projectId, providerId (exclusive arc)`
      )
    })
  })

  describe(`error message formatting`, () => {
    it(`should include entity name in the zero-fields error`, () => {
      try {
        validateExclusiveArc(fields(undefined, undefined, undefined), `MyEntity`)
        expect.fail(`Expected to throw`)
      } catch (err: any) {
        expect(err.message).toContain(`MyEntity`)
        expect(err.status).toBe(400)
      }
    })

    it(`should include entity name in the multi-fields error`, () => {
      try {
        validateExclusiveArc(fields(`a`, `b`, undefined), `MyEntity`)
        expect.fail(`Expected to throw`)
      } catch (err: any) {
        expect(err.message).toContain(`MyEntity`)
        expect(err.status).toBe(400)
      }
    })

    it(`should list all field names in the error message`, () => {
      try {
        validateExclusiveArc(fields(undefined, undefined, undefined), `Secret`)
        expect.fail(`Expected to throw`)
      } catch (err: any) {
        expect(err.message).toContain(`orgId`)
        expect(err.message).toContain(`projectId`)
        expect(err.message).toContain(`providerId`)
      }
    })

    it(`should work with two-field arcs`, () => {
      const twoFields = [
        { name: `orgId`, value: `org-1` },
        { name: `projectId`, value: `proj-1` },
      ]
      expect(() => validateExclusiveArc(twoFields, `Provider`)).toThrow(
        `Provider can only belong to one of: orgId, projectId (exclusive arc)`
      )
    })
  })
})
