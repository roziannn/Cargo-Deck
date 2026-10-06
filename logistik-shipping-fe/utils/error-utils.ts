// /**
//  * Utility functions for handling API errors consistently across the application
//  */

// import { ApiException } from "@/types/api";

// interface ApiErrorResponse {
// 	status: number;
// 	data: {
// 		message?: string;
// 		statusText?: string;
// 	};
// }

// interface ApiError extends Error {
// 	response?: ApiErrorResponse;
// }

// /**
//  * Extract a user-friendly error message from an API error
//  */
// export function extractErrorMessage(error: unknown): string {
// 	if (!error) {
// 		return "An unknown error occurred";
// 	}

// 	// Handle ApiException first (our new standardized error)
// 	if (error instanceof ApiException) {
// 		return error.message;
// 	}

// 	// Handle Error objects with response data (legacy support)
// 	if (error instanceof Error) {
// 		const apiError = error as ApiError;

// 		if (apiError.response?.data?.message) {
// 			return apiError.response.data.message;
// 		}

// 		if (apiError.response?.status) {
// 			return getStatusErrorMessage(apiError.response.status);
// 		}

// 		// Fallback to error message
// 		if (apiError.message) {
// 			return apiError.message;
// 		}
// 	}

// 	// Handle string errors
// 	if (typeof error === "string") {
// 		return error;
// 	}

// 	// Handle objects with message property
// 	if (typeof error === "object" && error !== null && "message" in error) {
// 		const errorObj = error as { message: unknown };
// 		if (typeof errorObj.message === "string") {
// 			return errorObj.message;
// 		}
// 	}

// 	return "An unexpected error occurred. Please try again.";
// }

// /**
//  * Get user-friendly message based on HTTP status code
//  */
// function getStatusErrorMessage(status: number): string {
// 	switch (status) {
// 		case 400:
// 			return "Invalid data provided. Please check your input and try again.";
// 		case 401:
// 			return "Authentication required. Please log in again.";
// 		case 403:
// 			return "You do not have permission to perform this action.";
// 		case 404:
// 			return "The requested resource was not found.";
// 		case 409:
// 			return "A conflict occurred. The resource may already exist.";
// 		case 422:
// 			return "The provided data is invalid. Please check and try again.";
// 		case 429:
// 			return "Too many requests. Please wait a moment and try again.";
// 		case 500:
// 			return "Internal server error. Please try again later.";
// 		case 502:
// 		case 503:
// 		case 504:
// 			return "Service temporarily unavailable. Please try again later.";
// 		default:
// 			return `Request failed with status ${status}`;
// 	}
// }

// /**
//  * Check if an error is a network/connection error
//  */
// export function isNetworkError(error: unknown): boolean {
// 	if (error instanceof Error) {
// 		const message = error.message.toLowerCase();
// 		return (
// 			message.includes("network") ||
// 			message.includes("connection") ||
// 			message.includes("fetch") ||
// 			message.includes("timeout")
// 		);
// 	}
// 	return false;
// }

// /**
//  * Check if an error is an authentication error
//  */
// export function isAuthError(error: unknown): boolean {
// 	// Handle ApiException
// 	if (error instanceof ApiException) {
// 		return error.isAuthError();
// 	}

// 	// Legacy support
// 	if (error instanceof Error) {
// 		const apiError = error as ApiError;
// 		return (
// 			apiError.response?.status === 401 ||
// 			apiError.response?.status === 403 ||
// 			apiError.message.toLowerCase().includes("unauthorized") ||
// 			apiError.message.toLowerCase().includes("authentication")
// 		);
// 	}
// 	return false;
// }

// /**
//  * Get error severity level for logging and UI purposes
//  */
// export function getErrorSeverity(
// 	error: unknown,
// ): "low" | "medium" | "high" | "critical" {
// 	// Handle ApiException
// 	if (error instanceof ApiException) {
// 		if (error.isServerError()) return "critical";
// 		if (error.isAuthError()) return "high";
// 		if (error.isValidationError()) return "medium";
// 		if (error.isNotFoundError()) return "low";
// 		return "medium";
// 	}

// 	// Legacy support
// 	if (error instanceof Error) {
// 		const apiError = error as ApiError;

// 		if (apiError.response?.status) {
// 			const status = apiError.response.status;

// 			if (status >= 500) return "critical";
// 			if (status === 401 || status === 403) return "high";
// 			if (status === 400 || status === 422) return "medium";
// 			if (status === 404 || status === 409) return "low";
// 		}

// 		if (isNetworkError(error)) return "medium";
// 	}

// 	return "medium";
// }
