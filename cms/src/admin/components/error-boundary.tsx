import { AlertTriangle } from 'lucide-react'
import * as React from 'react'

import { Button } from '~/admin/components/ui/button'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleRefresh = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-4 text-center">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
            </div>
            <h1 className="text-lg font-semibold text-foreground">
              Something went wrong
            </h1>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. Please refresh the page to continue.
            </p>
            {this.state.error && (
              <pre className="text-xs text-muted-foreground bg-muted p-3 rounded-md text-left overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <Button onClick={this.handleRefresh} className="mt-4">
              Refresh Page
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
