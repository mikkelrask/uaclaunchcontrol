import express, { type Request, Response, NextFunction } from 'express'
import { registerRoutes } from './routes'
import { debug } from '@shared/debug'
import * as storage from './storage'
import cors from 'cors'

const expressApp = express()

// CORS is restricted to the app's own renderer origins: the packaged renderer
// loads from file:// (sends `Origin: null`) and the Vite dev server runs on
// localhost. Any other origin — e.g. a random website in the user's browser —
// gets no CORS headers and cannot call the local API.
const allowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true // non-browser clients send no Origin header; CORS doesn't apply
  if (origin === 'null') return true // file:// renderer (packaged app)
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) // Vite dev server
}

expressApp.use(cors({ origin: (origin, cb) => cb(null, allowedOrigin(origin)) }))
// 10mb JSON limit: protocol exports embed screenshots as base64 (up to
// ~1.9MB for the 800px downscaled images, more for older pre-downscale
// exports), which exceeds the 100kb express default and silently broke
// screenshot imports. Localhost-only + CORS-restricted, so a larger limit
// is safe.
expressApp.use(express.json({ limit: '10mb' }))
expressApp.use(express.urlencoded({ extended: false }))

expressApp.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()
  const path = req.path
  let capturedJsonResponse: unknown | undefined = undefined

  const originalResJson = res.json
  res.json = function (bodyJson: unknown) {
    capturedJsonResponse = bodyJson
    return originalResJson.call(res, bodyJson)
  }

  res.on('finish', () => {
    const duration = Date.now() - start
    if (path.startsWith('/api')) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + '…'
      }

      debug(logLine)
    }
  })

  next()
})

export async function startServer(): Promise<void> {
  debug('Starting Production Server...')
  debug('Current working directory:', process.cwd())

  // Ensure storage is initialized and watcher starts
  storage.initStorage()

  const server = await registerRoutes(expressApp)

  expressApp.use(
    (
      err: Error & { status?: number; statusCode?: number },
      _req: Request,
      res: Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: NextFunction
    ) => {
      const status = err.status || err.statusCode || 500
      const message = err.message || 'Internal Server Error'

      res.status(status).json({ message })
      throw err
    }
  )

  // Use serveStatic directly for production
  debug('Starting static server...')
  // serveStatic(expressApp); // In Electron we don't serve static files from Express typically

  const port = 7666
  server.listen(port, '127.0.0.1', () => {
    debug(`Production server is running on port ${port}`)
  })
}
