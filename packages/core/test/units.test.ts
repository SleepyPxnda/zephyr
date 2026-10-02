import { describe, expect, it } from 'vitest'
import { msToKmh } from '../src'

describe('msToKmh', () => {
  it('converts the default trot speed', () => {
    expect(msToKmh(3.6)).toBeCloseTo(12.96, 10)
  })
})
