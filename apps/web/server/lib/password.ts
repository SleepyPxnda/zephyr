import { hash, verify } from '@node-rs/argon2'

// @node-rs/argon2 defaults to Argon2id (SPEC "Sicherheit"); parameters follow the OWASP
// recommendation of 19 MiB memory, 2 iterations.
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 }

export const hashPassword = (password: string): Promise<string> => hash(password, OPTIONS)

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password)
  } catch {
    return false
  }
}

/** Hash used to spend the same time when an e-mail address is unknown (no account probing by timing). */
let dummy: Promise<string> | undefined
export const dummyHash = (): Promise<string> => (dummy ??= hashPassword('not-a-real-password-0000'))
