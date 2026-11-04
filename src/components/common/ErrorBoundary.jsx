import React from 'react'
import { AlertCircle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }))
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 w-full">
          <div className="max-w-lg w-full bg-white rounded-3xl border border-brand-line/80 shadow-card p-6 sm:p-8 text-center space-y-5 animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto border border-rose-100 shadow-xs">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-brand-heading">
                Something unexpected happened
              </h2>
              <p className="text-sm text-brand-muted leading-relaxed">
                An error occurred while loading this view. Your saved progress, submissions, and account data remain completely safe.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-brand-hover shadow-purple-glow transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-brand-heading text-sm font-semibold hover:bg-slate-200 transition-all cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Go to Dashboard</span>
              </button>
            </div>

            {/* Expandable Developer Details */}
            {this.state.error && (
              <div className="pt-4 border-t border-brand-line/60 text-left">
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="flex items-center justify-between w-full text-xs font-semibold text-brand-muted hover:text-brand-heading transition-colors py-1 cursor-pointer"
                >
                  <span>Technical details</span>
                  {this.state.showDetails ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {this.state.showDetails && (
                  <div className="mt-2 p-3 bg-slate-900 rounded-xl text-emerald-400 text-[11px] font-mono overflow-x-auto max-h-48 leading-relaxed">
                    <p className="font-bold text-rose-400 mb-1">{this.state.error.toString()}</p>
                    <pre className="text-slate-300 text-[10px] whitespace-pre-wrap">
                      {this.state.errorInfo?.componentStack || 'No component stack available.'}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
