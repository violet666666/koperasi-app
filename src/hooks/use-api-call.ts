"use client";

import * as React from "react";
import { toast } from "sonner";

interface ApiCallState<T> {
    data: T | null;
    isLoading: boolean;
    error: Error | null;
}

interface UseApiCallOptions<T> {
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
    showToast?: boolean;
    successMessage?: string;
    errorMessage?: string;
}

/**
 * Custom hook for API calls with loading, error, and retry handling
 * Provides consistent error handling and user feedback across the app
 */
export function useApiCall<T, P extends any[]>(
    apiFunction: (...args: P) => Promise<T>,
    options: UseApiCallOptions<T> = {}
) {
    const {
        onSuccess,
        onError,
        showToast = true,
        successMessage,
        errorMessage = "Terjadi kesalahan. Silakan coba lagi.",
    } = options;

    const [state, setState] = React.useState<ApiCallState<T>>({
        data: null,
        isLoading: false,
        error: null,
    });

    const execute = React.useCallback(
        async (...args: P): Promise<T | null> => {
            setState(prev => ({ ...prev, isLoading: true, error: null }));

            try {
                const result = await apiFunction(...args);
                setState({ data: result, isLoading: false, error: null });

                if (showToast && successMessage) {
                    toast.success(successMessage);
                }

                onSuccess?.(result);
                return result;
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                setState({ data: null, isLoading: false, error });

                // Log error for debugging
                console.error("API call error:", error);

                if (showToast) {
                    // Parse API error message if available
                    const message = parseApiError(err) || errorMessage;
                    toast.error(message);
                }

                onError?.(error);
                return null;
            }
        },
        [apiFunction, onSuccess, onError, showToast, successMessage, errorMessage]
    );

    const reset = React.useCallback(() => {
        setState({ data: null, isLoading: false, error: null });
    }, []);

    const retry = React.useCallback(
        async (...args: P) => {
            return execute(...args);
        },
        [execute]
    );

    return {
        ...state,
        execute,
        reset,
        retry,
    };
}

/**
 * Parse error from API response
 */
function parseApiError(error: unknown): string | null {
    if (!error) return null;

    // Check for Axios-style error
    if (typeof error === "object" && error !== null) {
        const axiosError = error as any;

        // API error response
        if (axiosError.response?.data?.error) {
            return axiosError.response.data.error;
        }
        if (axiosError.response?.data?.message) {
            return axiosError.response.data.message;
        }

        // Network error
        if (axiosError.code === "ERR_NETWORK") {
            return "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.";
        }

        // Timeout
        if (axiosError.code === "ECONNABORTED") {
            return "Koneksi timeout. Silakan coba lagi.";
        }

        // Generic error message
        if (axiosError.message) {
            return axiosError.message;
        }
    }

    if (error instanceof Error) {
        return error.message;
    }

    return null;
}

/**
 * Hook for fetching data on mount with automatic retry
 */
export function useFetch<T>(
    fetchFn: () => Promise<T>,
    dependencies: React.DependencyList = []
) {
    const [data, setData] = React.useState<T | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<Error | null>(null);

    const fetch = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await fetchFn();
            setData(result);
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            console.error("Fetch error:", error);
        } finally {
            setIsLoading(false);
        }
    }, [fetchFn]);

    React.useEffect(() => {
        fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, dependencies);

    return {
        data,
        isLoading,
        error,
        refetch: fetch,
    };
}

/**
 * Global error handler for uncaught promise rejections
 */
export function setupGlobalErrorHandler() {
    if (typeof window !== "undefined") {
        window.addEventListener("unhandledrejection", (event) => {
            console.error("Unhandled promise rejection:", event.reason);

            // Prevent default browser error logging
            event.preventDefault();

            // Show user-friendly toast
            toast.error("Terjadi kesalahan tidak terduga. Silakan muat ulang halaman.");
        });
    }
}
