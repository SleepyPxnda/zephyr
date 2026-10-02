import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import IndexPage from '~/pages/index.vue'

describe('start page', () => {
  it('shows the lowercase wordmark from the German locale', async () => {
    const page = await mountSuspended(IndexPage)
    expect(page.get('[data-testid="wordmark"]').text()).toBe('zephyr')
    expect(page.text()).toContain('Reit-Choreografien zur Musik planen')
  })
})

describe('i18n number formats', () => {
  it('formats numbers the German way', () => {
    const { $i18n } = useNuxtApp()
    expect($i18n.n(31.4, 'decimal')).toBe('31,4')
    expect($i18n.n(1234.5, 'decimal')).toBe('1.234,5')
  })
})
