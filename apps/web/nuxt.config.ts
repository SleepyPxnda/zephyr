import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: true },
  modules: [
    '@nuxt/eslint',
    '@nuxtjs/i18n',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    'shadcn-nuxt',
    'nuxt-auth-utils',
  ],
  runtimeConfig: {
    // sealed session cookie (nuxt-auth-utils); password from NUXT_SESSION_PASSWORD
    session: {
      name: 'zephyr-session',
      password: '',
      maxAge: 60 * 60 * 24 * 30,
      cookie: { httpOnly: true, secure: true, sameSite: 'lax' },
    },
  },
  nitro: {
    errorHandler: '~~/server/error',
    experimental: { tasks: true },
    // daily at 03:00: delete soft-deleted plans after 30 days
    scheduledTasks: { '0 3 * * *': ['plans:purge'] },
  },
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
