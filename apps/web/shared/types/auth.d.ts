import type { UserRole } from '@zephyr/core'

declare module '#auth-utils' {
  interface User {
    id: string
    username: string
    name: string
    avatarUrl: string
    role: UserRole
  }
}

export {}
