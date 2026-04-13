const isDebug = process.env.DEBUG === 'true'

export function debug(...args: unknown[]): void {
  if (isDebug) {
    console.log(...args)
  }
}
