import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Global Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI instead of crashing the app.
 */
class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log the error to console (you could also send to a logging service)
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleReload = () => {
        // Clear the error state and reload the page
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    handleRetry = () => {
        // Clear the error state to attempt re-rendering
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-surface flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
                        {/* Icon */}
                        <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>

                        {/* Title */}
                        <h1 className="text-xl font-bold text-gray-900 mb-2">
                            Something went wrong
                        </h1>

                        {/* Description */}
                        <p className="text-gray-600 mb-6">
                            An unexpected error occurred. Please try again or reload the page.
                        </p>

                        {/* Error details (collapsed by default) */}
                        {this.state.error && (
                            <details className="mb-6 text-left">
                                <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700:text-gray-300">
                                    Show error details
                                </summary>
                                <pre className="mt-2 p-3 bg-gray-100 rounded-lg text-xs text-red-600 overflow-auto max-h-32">
                                    {this.state.error.message}
                                </pre>
                            </details>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleRetry}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200:bg-gray-600 transition-colors"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
