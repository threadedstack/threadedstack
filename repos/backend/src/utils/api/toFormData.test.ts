import { describe, it, expect } from 'vitest'
import { toFormData } from './toFormData'

describe(`toFormData`, () => {
  it(`should return undefined for falsy data`, () => {
    expect(toFormData(null as any)).toBeUndefined()
    expect(toFormData(undefined as any)).toBeUndefined()
    expect(toFormData(0 as any)).toBeUndefined()
    expect(toFormData(`` as any)).toBeUndefined()
    expect(toFormData(false as any)).toBeUndefined()
  })

  it(`should convert simple key-value pairs to FormData`, () => {
    const data = { name: `John`, age: `30` }
    const formData = toFormData(data)

    expect(formData).toBeInstanceOf(FormData)
    expect(formData.get(`name`)).toBe(`John`)
    expect(formData.get(`age`)).toBe(`30`)
  })

  it(`should handle empty object`, () => {
    const data = {}
    const formData = toFormData(data)

    expect(formData).toBeInstanceOf(FormData)
    expect(Array.from(formData.keys())).toHaveLength(0)
  })

  it(`should convert object values to JSON strings`, () => {
    const data = {
      user: { name: `John`, age: 30 },
      config: { theme: `dark`, lang: `en` },
    }
    const formData = toFormData(data)

    expect(formData.get(`user`)).toBe(`{"name":"John","age":30}`)
    expect(formData.get(`config`)).toBe(`{"theme":"dark","lang":"en"}`)
  })

  it(`should handle array values by converting to JSON`, () => {
    const data = {
      tags: [`red`, `blue`, `green`],
      numbers: [1, 2, 3],
    }
    const formData = toFormData(data)

    expect(formData.get(`tags`)).toBe(`["red","blue","green"]`)
    expect(formData.get(`numbers`)).toBe(`[1,2,3]`)
  })

  it(`should handle mixed data types`, () => {
    const data = {
      name: `John`,
      age: 30,
      isActive: true,
      profile: { role: `admin` },
      tags: [`user`, `active`],
      empty: null,
      zero: 0,
    }
    const formData = toFormData(data)

    expect(formData.get(`name`)).toBe(`John`)
    expect(formData.get(`age`)).toBe(`30`)
    expect(formData.get(`isActive`)).toBe(`true`)
    expect(formData.get(`profile`)).toBe(`{"role":"admin"}`)
    expect(formData.get(`tags`)).toBe(`["user","active"]`)
    expect(formData.get(`empty`)).toBe(`null`)
    expect(formData.get(`zero`)).toBe(`0`)
  })

  it(`should handle special characters in keys and values`, () => {
    const data = {
      [`key with spaces`]: `value with spaces`,
      [`key&special`]: `value&special`,
      message: `Hello "world" & <test>`,
    }
    const formData = toFormData(data)

    expect(formData.get(`key with spaces`)).toBe(`value with spaces`)
    expect(formData.get(`key&special`)).toBe(`value&special`)
    expect(formData.get(`message`)).toBe(`Hello "world" & <test>`)
  })

  it(`should handle nested objects`, () => {
    const data = {
      user: {
        personal: { name: `John`, age: 30 },
        settings: { theme: `dark` },
      },
    }
    const formData = toFormData(data)

    expect(formData.get(`user`)).toBe(
      `{"personal":{"name":"John","age":30},"settings":{"theme":"dark"}}`
    )
  })

  it(`should overwrite duplicate keys`, () => {
    const data = { key: `first` }
    const formData = toFormData(data)

    // FormData.set overwrites existing values
    formData.set(`key`, `second`)
    expect(formData.get(`key`)).toBe(`second`)
  })
})
