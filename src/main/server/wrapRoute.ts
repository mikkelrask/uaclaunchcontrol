import type { Request, Response } from 'express'

/** Wraps an async route handler so thrown errors are caught, logged, and returned as 500. */
export function wrapRoute(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (req: Request, res: Response) => any,
  label: string
): (req: Request, res: Response) => void {
  return (req, res) => {
    handler(req, res).catch((error: unknown) => {
      console.error(`[${label}]`, error)
      const msg = error instanceof Error ? error.message : 'Internal server error'
      res.status(500).json({ message: msg })
    })
  }
}
