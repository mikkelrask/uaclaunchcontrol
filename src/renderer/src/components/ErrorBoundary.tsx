import { Component, ErrorInfo, ReactNode } from 'react'

import { createLogger } from '@shared/logger'

const log = createLogger('ErrorBoundaryx')
interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    log.error('[ErrorBoundary] Caught:', error.message)
    log.error('[ErrorBoundary] Stack:', errorInfo.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-app-primary p-8">
          <div className="max-w-lg text-center space-y-4">
            <div className="text-6xl mb-4 opacity-20">!</div>
            <h1 className="text-2xl font-bold text-accent-highlight">SYSTEM CRASH</h1>
            <p className="text-app-secondary text-sm">
              The application encountered a critical error. Details have been logged to console.
            </p>
            <pre className="text-xs text-left bg-app-secondary p-4 rounded border border-app overflow-auto max-h-40 font-mono text-app-muted">
              {this.state.error?.message || 'Unknown error'}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-accent-highlight text-white rounded hover:opacity-90 text-sm"
            >
              Reload Application
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
