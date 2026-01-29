"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // Stale time - data is fresh for 5 minutes
                staleTime: 5 * 60 * 1000,
                // Retry failed requests 1 time
                retry: 1,
                // Refetch on window focus
                refetchOnWindowFocus: false,
            },
            mutations: {
                // Global error handler for mutations
                onError: (error: Error) => {
                    console.error("Mutation error:", error);
                    toast.error(error.message || "Terjadi kesalahan. Silakan coba lagi.");
                },
            },
        },
    });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
    if (typeof window === "undefined") {
        // Server: always make a new query client
        return makeQueryClient();
    } else {
        // Browser: make a new query client if we don't already have one
        if (!browserQueryClient) browserQueryClient = makeQueryClient();
        return browserQueryClient;
    }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
    const queryClient = getQueryClient();

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
