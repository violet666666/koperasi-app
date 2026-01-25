"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing
 */
export class ErrorBoundary extends React.Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        this.setState({ errorInfo });

        // Log to console in development
        console.error("ErrorBoundary caught an error:", error, errorInfo);

        // Call custom error handler if provided
        this.props.onError?.(error, errorInfo);

        // In production, you might want to log to an error reporting service
        // logErrorToService(error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <Card className="m-4 border-destructive/50">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="rounded-full bg-destructive/10 p-4 mb-4">
                            <AlertTriangle className="h-8 w-8 text-destructive" />
                        </div>
                        <h2 className="text-xl font-semibold mb-2">
                            Terjadi Kesalahan
                        </h2>
                        <p className="text-muted-foreground mb-4 max-w-md">
                            Maaf, terjadi kesalahan yang tidak terduga.
                            Silakan coba lagi atau hubungi administrator jika masalah berlanjut.
                        </p>
                        {process.env.NODE_ENV === "development" && this.state.error && (
                            <pre className="text-xs text-left bg-muted p-4 rounded-lg mb-4 max-w-full overflow-auto">
                                {this.state.error.message}
                            </pre>
                        )}
                        <div className="flex gap-4">
                            <Button onClick={this.handleReset}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Coba Lagi
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => window.location.reload()}
                            >
                                Muat Ulang Halaman
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            );
        }

        return this.props.children;
    }
}

/**
 * Wrapper component for functional error boundary usage
 */
export function withErrorBoundary<P extends object>(
    Component: React.ComponentType<P>,
    fallback?: React.ReactNode
) {
    return function WrappedComponent(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <Component {...props} />
            </ErrorBoundary>
        );
    };
}
