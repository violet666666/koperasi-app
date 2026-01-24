// Authentication API functions

import { api } from "./client";
import { API_ENDPOINTS } from "@/lib/constants";
import type { User, AuthResponse, ApiResponse } from "@/types";

export interface LoginCredentials {
    email: string;
    password: string;
    device_name?: string; // For mobile token auth
}

export interface ForgotPasswordRequest {
    email: string;
}

export interface ResetPasswordRequest {
    email: string;
    token: string;
    password: string;
    password_confirmation: string;
}

export interface ChangePasswordRequest {
    current_password: string;
    password: string;
    password_confirmation: string;
}

export interface UpdateProfileRequest {
    name: string;
    email: string;
}

// Auth API functions
export const authApi = {
    /**
     * Login with email and password
     */
    login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
        const response = await api.post<{ data: AuthResponse }>(
            API_ENDPOINTS.AUTH.LOGIN,
            credentials
        );
        return response.data;
    },

    /**
     * Logout current user
     */
    logout: async (): Promise<void> => {
        await api.post(API_ENDPOINTS.AUTH.LOGOUT);
    },

    /**
     * Get current authenticated user
     */
    me: async (): Promise<User> => {
        const response = await api.get<ApiResponse<User>>(API_ENDPOINTS.AUTH.ME);
        return response.data;
    },

    /**
     * Request password reset link
     */
    forgotPassword: async (data: ForgotPasswordRequest): Promise<{ message: string }> => {
        return api.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, data);
    },

    /**
     * Reset password with token
     */
    resetPassword: async (data: ResetPasswordRequest): Promise<{ message: string }> => {
        return api.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, data);
    },

    /**
     * Change current user's password
     */
    changePassword: async (data: ChangePasswordRequest): Promise<{ message: string }> => {
        return api.put(`${API_ENDPOINTS.AUTH.ME}/password`, data);
    },

    /**
     * Update current user's profile
     */
    updateProfile: async (data: UpdateProfileRequest): Promise<User> => {
        const response = await api.put<ApiResponse<User>>(
            `${API_ENDPOINTS.AUTH.ME}/profile`,
            data
        );
        return response.data;
    },
};
