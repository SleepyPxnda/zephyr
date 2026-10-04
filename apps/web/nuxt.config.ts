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
    experimental: { tasks: true, websocket: true },
    // daily at 03:00: delete soft-deleted plans after 30 days
    scheduledTasks: { '0 3 * * *': ['plans:purge'] },
  },
  // dev-only sign-in without Discord (server/dev/dev-login.ts); not part of production builds
  $development: {
    nitro: {
      handlers: [{ route: '/auth/dev-login', method: 'get', handler: '~~/server/dev/dev-login' }],
    },
  },
  // component names as in the SPEC (HorseLaneHeader, not HorsesHorseLaneHeader)
  components: [{ path: '~/components', pathPrefix: false }],
  css: ['~/assets/css/tailwind.css'],
  vite: {
    plugins: [tailwindcss()],
    // dev server only: extra host names (comma separated), e.g. a tunnel for the Discord login;
    // pasted URLs are reduced to the bare host name
    server: {
      allowedHosts: process.env.DEV_ALLOWED_HOSTS?.split(',')
        .map((h) =>
          h
            .trim()
            .replace(/^[a-z]+:\/\//i, '')
            .replace(/[/:].*$/, ''),
        )
        .filter(Boolean),
    },
  },
  typescript: {
    strict: true,
  },
  app: {
    head: {
      htmlAttrs: { lang: 'de', class: 'dark' },
      title: 'Zephyr',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
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
