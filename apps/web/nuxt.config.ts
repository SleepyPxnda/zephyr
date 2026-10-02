import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxtjs/i18n', '@pinia/nuxt', '@vueuse/nuxt', 'shadcn-nuxt'],
  css: ['~/assets/css/tailwind.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  typescript: {
    strict: true,
  },
  app: {
    head: {
      htmlAttrs: { lang: 'de' },
      title: 'zephyr',
    },
  },
  i18n: {
    defaultLocale: 'de',
    strategy: 'no_prefix',
    detectBrowserLanguage: false,
    locales: [
      { code: 'de', language: 'de-DE', name: 'Deutsch', file: 'de.json' },
      { code: 'en', language: 'en-GB', name: 'English', file: 'en.json' },
    ],
  },
  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },
})
