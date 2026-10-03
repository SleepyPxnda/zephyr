/** Admin pages: everyone else goes back to the plan list. */
export default defineNuxtRouteMiddleware(() => {
  const { user } = useUserSession()
  if (!user.value?.isAdmin) return navigateTo('/')
})
