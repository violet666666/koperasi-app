// API Client for Koperasi Digital
// Handles all HTTP requests to the backend API

import { API_BASE_URL } from "@/lib/constants";

export class ApiError extends Error {
    constructor(
        public status: number,
        public statusText: string,
        public data?: {
            message?: string;
            errors?: Record<string, string[]>;
        }
    ) {
        super(data?.message || statusText);
        this.name = "ApiError";
    }
}

interface RequestOptions extends RequestInit {
    params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
    private baseUrl: string;
    private defaultHeaders: HeadersInit = {
        "Content-Type": "application/json",
        Accept: "application/json",
    };

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
        const url = new URL(`${this.baseUrl}${endpoint}`);

        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined) {
                    url.searchParams.append(key, String(value));
                }
            });
        }

        return url.toString();
    }

    private async handleResponse<T>(response: Response): Promise<T> {
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch {
                errorData = { message: response.statusText };
            }
            throw new ApiError(response.status, response.statusText, errorData);
        }

        // Handle empty responses (204 No Content)
        if (response.status === 204) {
            return {} as T;
        }

        return response.json();
    }

    async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
        const { params, ...fetchOptions } = options || {};
        const url = this.buildUrl(endpoint, params);

        const response = await fetch(url, {
            ...fetchOptions,
            method: "GET",
            headers: {
                ...this.defaultHeaders,
                ...fetchOptions.headers,
            },
            credentials: "include", // For cookie-based auth
        });

        return this.handleResponse<T>(response);
    }

    async post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
        const { params, ...fetchOptions } = options || {};
        const url = this.buildUrl(endpoint, params);

        const response = await fetch(url, {
            ...fetchOptions,
            method: "POST",
            headers: {
                ...this.defaultHeaders,
                ...fetchOptions.headers,
            },
            credentials: "include",
            body: data ? JSON.stringify(data) : undefined,
        });

        return this.handleResponse<T>(response);
    }

    async put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
        const { params, ...fetchOptions } = options || {};
        const url = this.buildUrl(endpoint, params);

        const response = await fetch(url, {
            ...fetchOptions,
            method: "PUT",
            headers: {
                ...this.defaultHeaders,
                ...fetchOptions.headers,
            },
            credentials: "include",
            body: data ? JSON.stringify(data) : undefined,
        });

        return this.handleResponse<T>(response);
    }

    async patch<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
        const { params, ...fetchOptions } = options || {};
        const url = this.buildUrl(endpoint, params);

        const response = await fetch(url, {
            ...fetchOptions,
            method: "PATCH",
            headers: {
                ...this.defaultHeaders,
                ...fetchOptions.headers,
            },
            credentials: "include",
            body: data ? JSON.stringify(data) : undefined,
        });

        return this.handleResponse<T>(response);
    }

    async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
        const { params, ...fetchOptions } = options || {};
        const url = this.buildUrl(endpoint, params);

        const response = await fetch(url, {
            ...fetchOptions,
            method: "DELETE",
            headers: {
                ...this.defaultHeaders,
                ...fetchOptions.headers,
            },
            credentials: "include",
        });

        return this.handleResponse<T>(response);
    }

    // Upload file with FormData
    async upload<T>(endpoint: string, formData: FormData, options?: RequestOptions): Promise<T> {
        const { params, ...fetchOptions } = options || {};
        const url = this.buildUrl(endpoint, params);

        const response = await fetch(url, {
            ...fetchOptions,
            method: "POST",
            headers: {
                Accept: "application/json",
                ...fetchOptions.headers,
            },
            credentials: "include",
            body: formData,
        });

        return this.handleResponse<T>(response);
    }
}

// Export singleton instance
export const api = new ApiClient(API_BASE_URL);

// Export type for use in components
export type { RequestOptions };
