// Every page needs an account, except sign-in, sign-up and the read-only view of share links.
const PUBLIC = new Set(['/login', '/register'])

export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()
  const isPublic = PUBLIC.has(to.path) || /^\/plans\/[^/]+\/play$/.test(to.path)
  if (!loggedIn.value && !isPublic)
    return navigateTo({
      path: '/login',
      query: to.fullPath !== '/' ? { redirect: to.fullPath } : {},
    })
  if (loggedIn.value && PUBLIC.has(to.path)) return navigateTo('/')
})
