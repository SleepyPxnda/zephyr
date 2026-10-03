type Level = 'info' | 'warn' | 'error'

/**
 * Structured server log: one JSON object per line on stdout/stderr (docker logs), readable by any
 * log collector. Errors are expanded into name, message and stack.
 */
function write(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  const entry: Record<string, unknown> = { time: new Date().toISOString(), level, msg }
  for (const [k, v] of Object.entries(fields)) entry[k] = v instanceof Error ? serialize(v) : v
  const line = JSON.stringify(entry)
  if (level === 'info') process.stdout.write(line + '\n')
  else process.stderr.write(line + '\n')
}

/** Wrapped errors (e.g. a failed query around ECONNREFUSED) keep their cause. */
function serialize(e: Error): Record<string, unknown> {
  return {
    name: e.name,
    message: e.message,
    stack: e.stack,
    ...(e.cause instanceof Error ? { cause: serialize(e.cause) } : {}),
  }
}

export const log = {
  info: (msg: string, fields?: Record<string, unknown>) => write('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => write('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write('error', msg, fields),
}
