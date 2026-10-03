declare module '#auth-utils' {
  interface User {
    id: string
    username: string
    name: string
    avatarUrl: string
    /** the account of SUPER_ADMIN_DISCORD_ID */
    isAdmin: boolean
  }
}

export {}
