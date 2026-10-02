import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Loads the repository's .env (if present) for the CLI scripts. */
export function loadRootEnv(): void {
  const file = fileURLToPath(new URL('../../../.env', import.meta.url))
  if (existsSync(file)) process.loadEnvFile(file)
}
