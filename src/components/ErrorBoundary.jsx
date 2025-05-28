import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { 
      hasError: true,
      error: error
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Log to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      // You can integrate with error tracking services like Sentry here
      // logErrorToService(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <h3 className="font-bold mb-2">
            {this.props.fallbackHeader || 'Something went wrong'}
          </h3>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mb-2 text-sm">
              <summary className="cursor-pointer mb-1">Error details</summary>
              <pre className="bg-gray-100 p-2 rounded overflow-auto text-xs">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
          {this.props.showRetry !== false && (
            <button
              onClick={this.handleRetry}
              className="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded mt-2"
            >
              {this.props.retryText || 'Try again'}
            </button>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}