declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string
    role: 'user' | 'admin'
  }
}

export {}
