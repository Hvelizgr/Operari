import { apiFetch } from './api';

export const apiClient = {
    get: async (url: string, options?: RequestInit) => {
        const data = await apiFetch(url, { ...options, method: 'GET' });
        return { data };
    },
    post: async (url: string, body?: any, options: RequestInit = {}) => {
        const data = await apiFetch(url, {
            ...options,
            method: 'POST',
            body: body instanceof FormData ? body : JSON.stringify(body),
        });
        return { data };
    },
    put: async (url: string, body?: any, options: RequestInit = {}) => {
        const data = await apiFetch(url, {
            ...options,
            method: 'PUT',
            body: body instanceof FormData ? body : JSON.stringify(body),
        });
        return { data };
    },
    patch: async (url: string, body?: any, options: RequestInit = {}) => {
        const data = await apiFetch(url, {
            ...options,
            method: 'PATCH',
            body: body instanceof FormData ? body : JSON.stringify(body),
        });
        return { data };
    },
    delete: async (url: string, options?: RequestInit) => {
        const data = await apiFetch(url, { ...options, method: 'DELETE' });
        return { data };
    }
};
