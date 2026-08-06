export type Logger = {
  log: (...a: unknown[]) => void
  info: (...a: unknown[]) => void
  warn: (...a: unknown[]) => void
  error: (...a: unknown[]) => void
  debug: (...a: unknown[]) => void
}

export function createLogger(scope: string): Logger {
  const tag = `[${scope}]`
  return {
    log: (...a: unknown[]) => console.log(tag, ...a),
    info: (...a: unknown[]) => console.info(tag, ...a),
    warn: (...a: unknown[]) => console.warn(tag, ...a),
    error: (...a: unknown[]) => console.error(tag, ...a),
    debug: (...a: unknown[]) => console.debug(tag, ...a)
  }
}
