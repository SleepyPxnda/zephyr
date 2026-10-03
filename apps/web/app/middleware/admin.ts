/** Admin pages: others go back to the plan list. */
export default defineNuxtRouteMiddleware(() => {
  const { user } = useUserSession()
  if (user.value?.role !== 'admin') return navigateTo('/')
})
